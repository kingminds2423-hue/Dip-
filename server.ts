import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  deleteMaestroSession,
  fetchBillingCustomerPage,
  getMaestroSession,
  loginAndFetchDashReport,
  refreshDashReport
} from './server/maestroBillingClient.ts';
import {
  deleteOltCgiSession,
  fetchSpecificOltPage,
  getOltCgiSession,
  loginAndFetchOltReport,
  refreshOltLiveReport
} from './server/oltCgiClient.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function isBlockedHealthCheckHost(rawHostname: string): boolean {
  const host = rawHostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localdomain') ||
    host === 'metadata' ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split('.').map((n) => Number(n));
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  } else if (ipVersion === 6) {
    if (
      host === '::' ||
      host === '::1' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80') ||
      host.startsWith('::ffff:')
    ) {
      return true;
    }
  }

  return false;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'dip-bhola-network-api' });
  });

  // Live reachability probe for Troubleshooting Web Portal URLs (detects Cloud Run 404 / active 200-302 / offline)
  app.get('/api/portal-health-check', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
      res.status(400).json({ ok: false, error: 'URL দেওয়া হয়নি।' });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      res.status(400).json({ ok: false, error: 'সঠিক HTTP/HTTPS URL নয়।' });
      return;
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      res.status(400).json({ ok: false, error: 'শুধু http:// অথবা https:// লিংক অনুমোদিত।' });
      return;
    }

    if (isBlockedHealthCheckHost(parsedUrl.hostname)) {
      res.status(403).json({ ok: false, error: 'লোকাল বা প্রাইভেট ঠিকানা অনুমোদিত নয়।' });
      return;
    }

    const startedAt = Date.now();
    try {
      const upstreamRes = await fetch(parsedUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(7000),
        headers: {
          'User-Agent': 'DIP-BHOLA-ERP-Portal-Check/1.0'
        }
      });
      // Drain body immediately so sockets close cleanly
      await upstreamRes.body?.cancel().catch(() => {});

      const latencyMs = Date.now() - startedAt;
      const status = upstreamRes.status;
      const active = status >= 200 && status < 400;

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok: true,
        url: parsedUrl.toString(),
        reachable: true,
        active,
        status,
        statusText: upstreamRes.statusText || '',
        latencyMs,
        checkedAt: new Date().toISOString()
      });
    } catch {
      const latencyMs = Date.now() - startedAt;
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok: true,
        url: parsedUrl.toString(),
        reachable: false,
        active: false,
        status: 0,
        statusText: 'Unreachable',
        latencyMs,
        checkedAt: new Date().toISOString()
      });
    }
  });

  app.get('/api/speedtest-download', (req, res) => {
    const requestedKb = Math.min(2048, Math.max(64, Number(req.query.kb) || 512));
    const buf = crypto.randomBytes(requestedKb * 1024);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(buf);
  });

  app.post('/api/speedtest-upload', express.raw({ type: '*/*', limit: '2mb' }), (req, res) => {
    const bytes = Buffer.isBuffer(req.body) ? req.body.length : 0;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, receivedBytes: bytes });
  });

  // ==========================================
  // Server-to-Server admin.bhola.net Live Session & dashReport Sync
  // ==========================================
  const extractBearerToken = (req: express.Request): string => {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      return auth.slice(7).trim();
    }
    return '';
  };

  app.post('/api/billing-portal/login', async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const remember = Boolean(body.remember);

      if (!username || username.length > 120 || !password || password.length > 200) {
        res.status(400).json({ ok: false, error: 'সঠিক ইউজারনেম ও পাসওয়ার্ড দিন।' });
        return;
      }

      const result = await loginAndFetchDashReport({ username, password, remember });
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok: true,
        sessionToken: result.sessionToken,
        portalSessionId: result.portalSessionId,
        report: result.report
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'admin.bhola.net-এ লগইন করা যায়নি।';
      res.status(401).json({ ok: false, error: message });
    }
  });

  app.get('/api/billing-portal/dash-report', async (req, res) => {
    const token = extractBearerToken(req);
    const session = token ? getMaestroSession(token) : null;
    if (!session) {
      res.status(401).json({
        ok: false,
        sessionExpired: true,
        error: 'admin.bhola.net সেশন পাওয়া যায়নি বা মেয়াদ শেষ হয়েছে। অনুগ্রহ করে আবার লগইন করুন।'
      });
      return;
    }

    try {
      const report = await refreshDashReport(session);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, report });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'SESSION_CLOSED') {
        res.status(401).json({
          ok: false,
          sessionExpired: true,
          error: 'admin.bhola.net সেশন বন্ধ হয়ে গেছে। আবার লগইন করুন।'
        });
        return;
      }
      res.status(502).json({
        ok: false,
        error: msg || 'dashReport তথ্য আনতে সাময়িক সমস্যা হয়েছে।'
      });
    }
  });

  app.post('/api/billing-portal/fetch-customers', async (req, res) => {
    const token = extractBearerToken(req);
    const session = token ? getMaestroSession(token) : null;
    if (!session) {
      res.status(401).json({
        ok: false,
        sessionExpired: true,
        error: 'admin.bhola.net সেশন মেয়াদ শেষ হয়েছে। আবার লগইন করুন।'
      });
      return;
    }

    try {
      const rawLinkname =
        req.body && typeof req.body.linkname === 'string' ? req.body.linkname.trim() : undefined;
      if (rawLinkname && !/^[a-zA-Z0-9_-]{1,64}$/.test(rawLinkname)) {
        res.status(400).json({ ok: false, error: 'অবৈধ পোর্টাল পেজ নাম।' });
        return;
      }
      const result = await fetchBillingCustomerPage(session, rawLinkname);
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok: true,
        sourceLinkname: result.sourceLinkname,
        rows: result.rows,
        tables: result.tables,
        totalParsed: result.rows.length
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'SESSION_CLOSED') {
        res.status(401).json({
          ok: false,
          sessionExpired: true,
          error: 'admin.bhola.net সেশন বন্ধ হয়ে গেছে। আবার লগইন করুন।'
        });
        return;
      }
      res.status(502).json({
        ok: false,
        error: msg || 'গ্রাহক তালিকা আনতে সমস্যা হয়েছে।'
      });
    }
  });

  app.post('/api/billing-portal/logout', (req, res) => {
    const token = extractBearerToken(req);
    if (token) {
      deleteMaestroSession(token);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true });
  });

  // Live C-DATA / Lighttpd OLT CGI (http://103.158.206.4:6560/cgi/home.php) server-to-server endpoints
  app.post('/api/olt-portal/login', async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username || !password || username.length > 120 || password.length > 200) {
      res.status(400).json({
        ok: false,
        error: 'OLT (103.158.206.4:6560) সঠিক ইউজারনেম ও পাসওয়ার্ড দিন।'
      });
      return;
    }

    try {
      const result = await loginAndFetchOltReport({ username, password });
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok: true,
        sessionToken: result.sessionToken,
        report: result.report
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'OLT (103.158.206.4:6560) পোর্টালে লগইন করা যায়নি।';
      const isAuthFailure = /লগইন ব্যর্থ|সঠিক নয়|সেশন চালু হয়নি/i.test(message);
      res.status(isAuthFailure ? 401 : 502).json({ ok: false, error: message });
    }
  });

  app.get('/api/olt-portal/live-report', async (req, res) => {
    const token = extractBearerToken(req);
    const session = token ? getOltCgiSession(token) : null;
    if (!session) {
      res.status(401).json({
        ok: false,
        sessionExpired: true,
        error: 'OLT সেশন পাওয়া যায়নি বা মেয়াদ শেষ হয়েছে। আবার OLT লগইন করুন।'
      });
      return;
    }

    try {
      const report = await refreshOltLiveReport(session);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, report });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'OLT_SESSION_CLOSED') {
        res.status(401).json({
          ok: false,
          sessionExpired: true,
          error: 'OLT সেশন বন্ধ হয়ে গেছে। আবার লগইন করুন।'
        });
        return;
      }
      res.status(502).json({
        ok: false,
        error: msg || 'OLT লাইভ টেলিমেট্রি রিফ্রেশ করতে সমস্যা হয়েছে।'
      });
    }
  });

  app.post('/api/olt-portal/fetch-page', async (req, res) => {
    const token = extractBearerToken(req);
    const session = token ? getOltCgiSession(token) : null;
    if (!session) {
      res.status(401).json({
        ok: false,
        sessionExpired: true,
        error: 'OLT সেশন মেয়াদ শেষ হয়েছে। আবার OLT লগইন করুন।'
      });
      return;
    }

    const rawPath =
      req.body && typeof req.body.path === 'string' ? req.body.path.trim() : '';
    if (!/^\/cgi\/[A-Za-z0-9_./?&=%-]{1,180}$/.test(rawPath)) {
      res.status(400).json({ ok: false, error: 'অবৈধ OLT পাতার ঠিকানা।' });
      return;
    }

    try {
      const result = await fetchSpecificOltPage(session, rawPath);
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok: true,
        path: result.path,
        tables: result.tables,
        onuRows: result.onuRows
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'OLT_SESSION_CLOSED') {
        res.status(401).json({
          ok: false,
          sessionExpired: true,
          error: 'OLT সেশন বন্ধ হয়ে গেছে। আবার লগইন করুন।'
        });
        return;
      }
      res.status(502).json({
        ok: false,
        error: msg || 'নির্বাচিত OLT পাতা থেকে ডেটা আনা যায়নি।'
      });
    }
  });

  app.post('/api/olt-portal/logout', (req, res) => {
    const token = extractBearerToken(req);
    if (token) {
      deleteOltCgiSession(token);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true });
  });

  app.post('/api/ai/monitoring-report', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY কনফিগার করা নেই। AI Studio Secrets প্যানেলে API Key যুক্ত করুন।'
      });
      return;
    }

    try {
      const payload = req.body || {};
      const companyName = String(payload.companyName || 'DIP BHOLA NETWORK');
      const periodLabel = String(payload.periodLabel || 'চলতি হিসাব');
      const totalRecords = Number(payload.totalRecords || 0);
      const totalIncome = Number(payload.totalIncome || 0);
      const totalExpense = Number(payload.totalExpense || 0);
      const netBalance = Number(payload.netBalance || 0);
      const categorySummary = Array.isArray(payload.categorySummary) ? payload.categorySummary : [];
      const staffActivity = Array.isArray(payload.staffActivity) ? payload.staffActivity : [];
      const recentTransactions = Array.isArray(payload.recentTransactions) ? payload.recentTransactions : [];
      const partners = Array.isArray(payload.partners) ? payload.partners : [];
      const complaintsSummary = payload.complaintsSummary || {};

      const prompt = [
        `প্রতিষ্ঠান: ${companyName}`,
        `প্রতিবেদনের সময়সীমা: ${periodLabel}`,
        `মোট লেনদেন সংখ্যা: ${totalRecords}`,
        `মোট আয় / জমা: ৳${totalIncome}`,
        `মোট ব্যয় / খরচ: ৳${totalExpense}`,
        `নিট ক্যাশ ব্যালেন্স: ৳${netBalance}`,
        `ক্যাটাগরি সারসংক্ষেপ: ${JSON.stringify(categorySummary.slice(0, 15))}`,
        `স্টাফ/এন্ট্রিদাতা কার্যক্রম: ${JSON.stringify(staffActivity.slice(0, 15))}`,
        `অংশীদার বণ্টন: ${JSON.stringify(partners.slice(0, 10))}`,
        `অভিযোগ/সার্ভিস অবস্থা: ${JSON.stringify(complaintsSummary)}`,
        `সাম্প্রতিক নমুনা লেনদেন: ${JSON.stringify(recentTransactions.slice(0, 25))}`,
        '',
        'উপরোক্ত তথ্যের ভিত্তিতে সম্পূর্ণ বাংলায় একটি পেশাদার, নিখুঁত এবং তথ্যভিত্তিক AI মনিটরিং ও অডিট প্রতিবেদন তৈরি করুন। কোনো কাল্পনিক সংখ্যা যোগ করবেন না — প্রদত্ত হিসাব থেকেই বিশ্লেষণ দিন।'
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are the automated AI Financial Monitoring & Audit Officer for an ISP & Broadband business in Bangladesh (DIP BHOLA NETWORK). Always reply strictly in clear, formal Bengali matching the JSON schema. Base all numbers strictly on the provided payload.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              healthStatus: {
                type: Type.STRING,
                description:
                  'One of: অত্যন্ত ভালো (Excellent), সন্তোষজনক (Good), সতর্কতা প্রয়োজন (Warning), জরুরি পর্যবেক্ষণ (Critical)'
              },
              auditScore: {
                type: Type.INTEGER,
                description: 'Integer audit confidence & financial monitoring score from 0 to 100'
              },
              executiveSummary: {
                type: Type.STRING,
                description: '2-3 sentence formal Bengali executive audit summary of income, expense, net balance, and period performance.'
              },
              keyFindings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 to 4 concise Bengali bullet points highlighting income/expense categories, staff activity, and cash flow.'
              },
              riskAlerts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '1 to 3 Bengali monitoring alerts or confirmation that vouchers and expenses are within normal limits.'
              },
              aiRecommendation: {
                type: Type.STRING,
                description: '1-2 sentence actionable Bengali financial recommendation for Management & Share Partners.'
              },
              aiVerificationStatement: {
                type: Type.STRING,
                description: '1 short formal Bengali verification statement confirming AI Auto-Monitor verification and digital seal eligibility.'
              }
            },
            required: [
              'healthStatus',
              'auditScore',
              'executiveSummary',
              'keyFindings',
              'riskAlerts',
              'aiRecommendation',
              'aiVerificationStatement'
            ]
          }
        }
      });

      const rawText = (response.text || '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json({
        ...parsed,
        generatedAt: new Date().toISOString(),
        source: 'gemini-ai'
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI মনিটরিং রিপোর্ট তৈরিতে ত্রুটি হয়েছে।';
      console.error('AI Monitoring Report Error:', err);
      res.status(500).json({ error: message });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use((req, res, next) => {
      if (
        req.headers.origin &&
        (req.path.endsWith('manifest.json') ||
          req.path.endsWith('manifest.webmanifest') ||
          req.path.endsWith('version.json') ||
          req.path.endsWith('.png') ||
          req.path.endsWith('.svg') ||
          req.path.endsWith('.ico'))
      ) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      }
      next();
    });
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('version.json') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('registerSW.js') ||
            filePath.endsWith('manifest.json') ||
            filePath.endsWith('manifest.webmanifest')
          ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          }
          if (filePath.endsWith('manifest.json') || filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          }
        }
      })
    );
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DIP BHOLA NETWORK server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
