import crypto from 'crypto';
import type {
  BillingPortalMetricCard,
  BillingPortalTableData,
  OltDiscoveredPage,
  OltLiveReport,
  OltPonSummaryCard,
  OltSyncedOnuRow,
  OnuLossStatus
} from '../src/types.ts';

export const OLT_ORIGIN = 'http://103.158.206.4:6560';
const OLT_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_OLT_SESSIONS = 25;

interface OltCgiSession {
  token: string;
  username: string;
  cookies: Record<string, string>;
  createdAt: number;
  lastUsedAt: number;
  discoveredPages: OltDiscoveredPage[];
}

const oltSessionStore = new Map<string, OltCgiSession>();

function pruneExpiredOltSessions(): void {
  const now = Date.now();
  for (const [token, session] of oltSessionStore.entries()) {
    if (now - session.lastUsedAt > OLT_SESSION_TTL_MS) {
      oltSessionStore.delete(token);
    }
  }
  while (oltSessionStore.size > MAX_OLT_SESSIONS) {
    const oldestKey = oltSessionStore.keys().next().value;
    if (!oldestKey) break;
    oltSessionStore.delete(oldestKey);
  }
}

export function getOltCgiSession(token: string): OltCgiSession | null {
  pruneExpiredOltSessions();
  const s = oltSessionStore.get(token);
  if (!s) return null;
  s.lastUsedAt = Date.now();
  return s;
}

export function deleteOltCgiSession(token: string): void {
  oltSessionStore.delete(token);
}

function applySetCookieHeaders(res: globalThis.Response, jar: Record<string, string>): void {
  const headersObj = res.headers as Headers & { getSetCookie?: () => string[] };
  let rawCookies: string[] = [];
  if (typeof headersObj.getSetCookie === 'function') {
    rawCookies = headersObj.getSetCookie();
  } else {
    const single = res.headers.get('set-cookie');
    if (single) {
      rawCookies = single.split(/,(?=\s*[A-Za-z0-9_.-]+=)/g);
    }
  }

  for (const cookieStr of rawCookies) {
    const firstPart = cookieStr.split(';')[0]?.trim();
    if (!firstPart) continue;
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = firstPart.slice(0, eqIdx).trim();
    const val = firstPart.slice(eqIdx + 1).trim();
    if (!name) continue;
    if (val.toLowerCase() === 'deleted' || /max-age=0/i.test(cookieStr)) {
      delete jar[name];
    } else {
      jar[name] = val;
    }
  }
}

function formatCookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function resolveSafeOltUrl(candidate: string, base: string): URL | null {
  try {
    const u = new URL(candidate, base);
    if (u.origin !== OLT_ORIGIN) return null;
    if (u.protocol !== 'http:') return null;
    return u;
  } catch {
    return null;
  }
}

function findClientSideRedirect(html: string): string | null {
  const metaMatch = html.match(
    /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url\s*=\s*([^"'\s>]+)/i
  );
  if (metaMatch?.[1]) return metaMatch[1].trim();

  const jsMatch = html.match(
    /(?:window\.location(?:\.href)?|document\.location(?:\.href)?|top\.location(?:\.href)?|location\.replace)\s*(?:=|\()\s*["']([^"']+)["']/i
  );
  if (jsMatch?.[1]) return jsMatch[1].trim();

  return null;
}

async function fetchOltWithJar(
  jar: Record<string, string>,
  relativeOrSameOriginUrl: string,
  init: { method?: 'GET' | 'POST'; body?: string; referer?: string; timeoutMs?: number } = {}
): Promise<{ html: string; finalUrl: string; status: number }> {
  let currentUrl = resolveSafeOltUrl(relativeOrSameOriginUrl, `${OLT_ORIGIN}/cgi/home.php`);
  if (!currentUrl) {
    throw new Error('অবৈধ OLT রিকোয়েস্ট ঠিকানা।');
  }

  let method: 'GET' | 'POST' = init.method || 'GET';
  let body = init.body;
  let referer = init.referer || `${OLT_ORIGIN}/cgi/login.php`;
  const timeoutMs = init.timeoutMs || 10000;

  for (let hop = 0; hop < 6; hop += 1) {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) DIP-BHOLA-OLT-SYNC/2.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: referer
    };
    const cookieHeader = formatCookieHeader(jar);
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }
    if (method === 'POST' && body !== undefined) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers.Origin = OLT_ORIGIN;
    }

    const upstreamRes = await fetch(currentUrl.toString(), {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs)
    });

    applySetCookieHeaders(upstreamRes, jar);

    if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
      const loc = upstreamRes.headers.get('location');
      await upstreamRes.body?.cancel().catch(() => {});
      if (!loc) break;
      const nextUrl = resolveSafeOltUrl(loc, currentUrl.toString());
      if (!nextUrl) {
        throw new Error('OLT রিডাইরেক্ট অনুমোদিত ঠিকানার বাইরে।');
      }
      referer = currentUrl.toString();
      currentUrl = nextUrl;
      method = 'GET';
      body = undefined;
      continue;
    }

    const html = await upstreamRes.text();

    // Follow login/session client-side redirect automatically (e.g. home.php -> login.php or login.php -> home.php)
    const clientRedirect = findClientSideRedirect(html);
    if (clientRedirect && hop < 4 && html.length < 4000) {
      const nextUrl = resolveSafeOltUrl(clientRedirect, currentUrl.toString());
      if (nextUrl && nextUrl.toString() !== currentUrl.toString()) {
        referer = currentUrl.toString();
        currentUrl = nextUrl;
        method = 'GET';
        body = undefined;
        continue;
      }
    }

    return {
      html,
      finalUrl: currentUrl.toString(),
      status: upstreamRes.status
    };
  }

  throw new Error('OLT ডিভাইস (103.158.206.4:6560) থেকে সাড়া পেতে বেশি সময় লাগছে।');
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : '';
    });
}

function stripTagsToText(htmlFragment: string): string {
  return decodeHtmlEntities(
    htmlFragment
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isOltLoginPage(html: string, finalUrl: string): boolean {
  const lower = html.toLowerCase();
  if (finalUrl.toLowerCase().includes('login.php') && lower.includes('loginform')) {
    return true;
  }
  if (lower.includes('name="loginform"') || (lower.includes('id="encode_name"') && lower.includes('id="encode_pwd"'))) {
    return true;
  }
  if (lower.includes('administrator login') && lower.includes('input_pwd')) {
    return true;
  }
  return false;
}

function extractOltLinksFromHtml(html: string, baseUrl: string): OltDiscoveredPage[] {
  const pages: OltDiscoveredPage[] = [];
  const seen = new Set<string>();

  const addCandidate = (rawPath: string, label: string) => {
    const cleanRaw = decodeHtmlEntities(rawPath).trim();
    if (!cleanRaw || cleanRaw.startsWith('#') || cleanRaw.toLowerCase().startsWith('javascript:')) return;
    if (/(?:logout|reboot|reset|default|upgrade|save|delete|restore)/i.test(cleanRaw)) return;
    const resolved = resolveSafeOltUrl(cleanRaw, baseUrl);
    if (!resolved) return;
    if (!/\.(?:php|html|htm|asp|cgi)/i.test(resolved.pathname)) return;
    if (resolved.pathname.endsWith('/login.php')) return;
    const rel = `${resolved.pathname}${resolved.search}`;
    if (seen.has(rel)) return;
    seen.add(rel);
    pages.push({
      label: (label || resolved.pathname.split('/').pop() || rel).slice(0, 60),
      path: rel
    });
  };

  // 1. Frames / Iframes
  const frameRegex = /<(?:frame|iframe)\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = frameRegex.exec(html)) !== null) {
    addCandidate(m[1], 'Frame');
  }

  // 2. Anchors
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = anchorRegex.exec(html)) !== null) {
    const lbl = stripTagsToText(m[2]);
    addCandidate(m[1], lbl);
  }

  // 3. Inline JS navigation strings (e.g., menu arrays, loadPage('...'), location.href='...')
  const jsUrlRegex = /["']((?:\/cgi\/)?[A-Za-z0-9_./-]+\.php(?:\?[A-Za-z0-9_=&%-]+)?)["']/gi;
  while ((m = jsUrlRegex.exec(html)) !== null) {
    addCandidate(m[1], m[1].replace(/^\/cgi\//, ''));
  }

  // 4. C-DATA OLT onclick / tabExchange triggers
  const tabRegex = /tabExchange\([^)]*['"]([A-Za-z0-9_-]+)['"]\s*,\s*['"]([^'"]+)['"]\)/gi;
  while ((m = tabRegex.exec(html)) !== null) {
    const tab = m[1];
    const lbl = m[2];
    addCandidate(`/cgi/index.php?isajax=1&page=onu&tab=${encodeURIComponent(tab)}`, lbl);
    addCandidate(`/cgi/index.php?isajax=1&page=pon&tab=${encodeURIComponent(tab)}`, lbl);
  }

  return pages;
}

function extractTablesFromHtml(html: string, sourceTitle: string): BillingPortalTableData[] {
  const tables: BillingPortalTableData[] = [];
  const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tMatch: RegExpExecArray | null;
  let idx = 1;

  while ((tMatch = tableRegex.exec(html)) !== null) {
    const body = tMatch[1];
    // Avoid parsing giant nested outer layout tables directly if they contain child tables
    if (/<table\b/i.test(body)) continue;

    const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rMatch: RegExpExecArray | null;
    let headers: string[] = [];
    const rows: string[][] = [];

    while ((rMatch = rowRegex.exec(body)) !== null) {
      const cells: string[] = [];
      let hasTh = false;
      const cellRegex = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      let cMatch: RegExpExecArray | null;
      while ((cMatch = cellRegex.exec(rMatch[1])) !== null) {
        if (cMatch[1].toLowerCase() === 'th') hasTh = true;
        cells.push(stripTagsToText(cMatch[2]));
      }
      if (cells.length === 0 || cells.every((c) => !c)) continue;
      if (hasTh && headers.length === 0) {
        headers = cells;
      } else {
        rows.push(cells);
      }
    }

    if (headers.length === 0 && rows.length > 1) {
      headers = rows.shift() || [];
    }

    if (rows.length > 0 && (headers.length >= 2 || rows[0].length >= 2)) {
      tables.push({
        title: `${sourceTitle} #${idx}`,
        headers,
        rows: rows.slice(0, 1500)
      });
      idx += 1;
    }
  }

  return tables;
}

function extractSystemMetrics(html: string): BillingPortalMetricCard[] {
  const cards: BillingPortalMetricCard[] = [];
  const seen = new Set<string>();
  const tables = extractTablesFromHtml(html, 'System');

  for (const tbl of tables) {
    for (const row of tbl.rows) {
      if (row.length === 2 || row.length === 4) {
        for (let i = 0; i + 1 < row.length; i += 2) {
          const lbl = row[i].replace(/[:：]+$/, '').trim();
          const val = row[i + 1].trim();
          if (!lbl || !val || lbl.length > 40 || val.length > 60) continue;
          const key = `${lbl.toLowerCase()}::${val}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const numMatch = val.match(/(-?\d+(?:\.\d+)?)/);
          const numVal = numMatch ? Number(numMatch[1]) : null;
          cards.push({
            label: lbl,
            value: val,
            numericValue: numVal !== null && Number.isFinite(numVal) ? numVal : null
          });
        }
      }
    }
  }
  return cards.slice(0, 24);
}

function detectPonPortFromText(raw: string): 'PON1' | 'PON2' | 'PON3' | 'PON4' | 'OTHER' {
  const u = (raw || '').toUpperCase();
  if (
    /\bPON\s*[-_:]?\s*0?1\b|(?:EPON|GPON|XPON)?\s*0\/1(?:\/1)?(?::\d+)?\b|(?:EPON|GPON|XPON)?\s*0\/0\/1(?::\d+)?\b|\b1\/\d+\b|^0?1:\d+/.test(
      u
    )
  ) {
    return 'PON1';
  }
  if (
    /\bPON\s*[-_:]?\s*0?2\b|(?:EPON|GPON|XPON)?\s*0\/2(?:\/1)?(?::\d+)?\b|(?:EPON|GPON|XPON)?\s*0\/0\/2(?::\d+)?\b|\b2\/\d+\b|^0?2:\d+/.test(
      u
    )
  ) {
    return 'PON2';
  }
  if (
    /\bPON\s*[-_:]?\s*0?3\b|(?:EPON|GPON|XPON)?\s*0\/3(?:\/1)?(?::\d+)?\b|(?:EPON|GPON|XPON)?\s*0\/0\/3(?::\d+)?\b|\b3\/\d+\b|^0?3:\d+/.test(
      u
    )
  ) {
    return 'PON3';
  }
  if (
    /\bPON\s*[-_:]?\s*0?4\b|(?:EPON|GPON|XPON)?\s*0\/4(?:\/1)?(?::\d+)?\b|(?:EPON|GPON|XPON)?\s*0\/0\/4(?::\d+)?\b|\b4\/\d+\b|^0?4:\d+/.test(
      u
    )
  ) {
    return 'PON4';
  }
  const twoPart = u.match(/\b0\/([1-4])(?::\d+)?\b/);
  if (twoPart) {
    return `PON${Number(twoPart[1])}` as 'PON1' | 'PON2' | 'PON3' | 'PON4';
  }
  const slot = u.match(/\d+\/\d+\/(\d+)/);
  if (slot) {
    const n = Number(slot[1]);
    if (n >= 1 && n <= 4) return `PON${n}` as 'PON1' | 'PON2' | 'PON3' | 'PON4';
  }
  return 'OTHER';
}

function normalizeMac(raw?: string): string {
  const clean = (raw || '').trim().toUpperCase();
  if (!clean) return '';
  const m = clean.match(/([0-9A-F]{2}(?:[:-][0-9A-F]{2}){5})/);
  if (m) return m[1].replace(/-/g, ':');
  if (/^[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}$/.test(clean)) {
    const hex = clean.replace(/\./g, '');
    return hex.match(/.{2}/g)?.join(':') || '';
  }
  if (/^[0-9A-F]{12}$/.test(clean)) {
    return clean.match(/.{2}/g)?.join(':') || clean;
  }
  return '';
}

function parseDbmValue(raw?: string): number | null {
  if (!raw) return null;
  const m = raw.match(/(-?\d{1,2}(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  // Realistic optical Rx/Tx range is roughly -50 to +15 dBm
  if (!Number.isFinite(n) || n < -55 || n > 15) return null;
  return Number(n.toFixed(2));
}

function parseOnuRowsFromTablesAndScripts(
  tables: BillingPortalTableData[],
  rawHtmls: Array<{ source: string; html: string }>
): OltSyncedOnuRow[] {
  const rowsByKey = new Map<string, OltSyncedOnuRow>();

  const upsertOnu = (candidate: OltSyncedOnuRow) => {
    const key = candidate.onuMac
      ? `mac:${candidate.onuMac}`
      : candidate.onuId
      ? `id:${candidate.oltInfo}::${candidate.onuId}`
      : `name:${candidate.ponPort}::${candidate.onuName || ''}`;
    if (!key || key.endsWith('::')) return;

    const prev = rowsByKey.get(key);
    if (!prev) {
      rowsByKey.set(key, candidate);
      return;
    }
    rowsByKey.set(key, {
      ...prev,
      ...candidate,
      onuName: candidate.onuName || prev.onuName,
      onuMac: candidate.onuMac || prev.onuMac,
      phone: candidate.phone || prev.phone,
      rxPower: candidate.rxPower || prev.rxPower,
      txPower: candidate.txPower || prev.txPower,
      fiberLength: candidate.fiberLength || prev.fiberLength,
      temperature: candidate.temperature || prev.temperature,
      lastDownReason: candidate.lastDownReason || prev.lastDownReason,
      issueReason: candidate.issueReason || prev.issueReason,
      lossStatus: candidate.lossStatus !== 'normal' ? candidate.lossStatus : prev.lossStatus
    });
  };

  // 1. Parse HTML tables from all fetched OLT pages
  for (const tbl of tables) {
    const hLower = tbl.headers.map((h) => h.toLowerCase());
    const findIdx = (patterns: RegExp[]) => hLower.findIndex((h) => patterns.some((p) => p.test(h)));

    const ponIdx = findIdx([/\bpon\b/, /port/, /slot/, /interface/, /epon/, /gpon/]);
    const onuIdIdx = findIdx([/onu\s*id/, /\bonu\b/, /llid/, /index/, /\bid\b/]);
    const macIdx = findIdx([/\bmac\b/, /\bsn\b/, /serial/, /loid/]);
    const nameIdx = findIdx([/name/, /desc/, /remark/, /alias/, /customer/, /user/]);
    const statusIdx = findIdx([/status/, /state/, /online/, /link/, /auth/]);
    const rxIdx = findIdx([/\brx\b/, /rx\s*power/, /receive/, /optical\s*power/, /rssi/]);
    const txIdx = findIdx([/\btx\b/, /tx\s*power/, /transmit/]);
    const distIdx = findIdx([/dist/, /length/, /range/, /meter/, /fiber/]);
    const tempIdx = findIdx([/temp/]);
    const reasonIdx = findIdx([/reason/, /down\s*cause/, /dereg/, /fault/, /alarm/]);

    for (const r of tbl.rows) {
      const joined = r.join(' | ');
      const macFromCell = macIdx >= 0 ? normalizeMac(r[macIdx]) : '';
      const macMatch = macFromCell || normalizeMac(joined);
      const ponToken =
        (ponIdx >= 0 ? r[ponIdx] : '') ||
        (onuIdIdx >= 0 ? r[onuIdIdx] : '') ||
        joined.match(/(?:EPON|GPON|XPON)?\s*0\/\d+(?:\/\d+)?(?::\d+)?|PON\s*0?[1-4](?::\d+)?/i)?.[0] ||
        '';

      // Only treat row as an ONU row if it has a MAC/SN OR an explicit PON/ONU designator with status/optical data
      const looksLikeOnu =
        Boolean(macMatch) ||
        (/(?:0\/\d+(?:\/\d+)?(?::\d+)?|pon\s*0?[1-4])/i.test(ponToken) && r.length >= 3);

      if (!looksLikeOnu) continue;

      const onuId = onuIdIdx >= 0 ? (r[onuIdIdx] || '').trim() : '';
      let onuName = nameIdx >= 0 ? (r[nameIdx] || '').trim() : '';
      if (onuName === macMatch || /^[-–—]+$/.test(onuName)) onuName = '';

      const phoneMatch = `${onuName} ${joined}`.match(/\b(01[3-9]\d{8})\b/);
      const rawStatus = (statusIdx >= 0 ? r[statusIdx] : '').trim() ||
        (joined.match(/\b(online|offline|up|down|los|dying.?gasp|power.?off|wire.?down)\b/i)?.[0] || '');
      const statusLower = rawStatus.toLowerCase();

      const rawReason = reasonIdx >= 0 ? (r[reasonIdx] || '').trim() : '';
      const reasonLower = `${rawReason} ${statusLower}`.toLowerCase();

      const rxNum = rxIdx >= 0 ? parseDbmValue(r[rxIdx]) : null;
      const txNum = txIdx >= 0 ? parseDbmValue(r[txIdx]) : null;

      const distRaw = distIdx >= 0 ? (r[distIdx] || '').trim() : '';
      const distNumMatch = distRaw.match(/(\d{1,5})/);
      const fiberLength = distNumMatch ? `${distNumMatch[1]} meter` : undefined;

      const isDyingGasp = /dying|power.?off|pwr/i.test(reasonLower);
      const isLos = /\blos\b|wire.?down|fiber|optic/i.test(reasonLower);
      const isOffline = /offline|down|fail|dereg|inactive/i.test(statusLower) || isLos || isDyingGasp;

      let lossStatus: OnuLossStatus = 'normal';
      let issueReason: string | undefined;
      if (isDyingGasp) {
        lossStatus = 'dying_gasp';
        issueReason = 'Dying Gasp — বিদ্যুৎ / অনু বন্ধ (OLT)';
      } else if (isLos) {
        lossStatus = 'los';
        issueReason = 'LOS — ফাইবার কাটা বা সংযোগ বিচ্ছিন্ন (OLT)';
      } else if (rxNum !== null && rxNum <= -25) {
        lossStatus = 'high_loss';
        issueReason = `OLT হাই অপটিক্যাল লস (${rxNum} dBm)`;
      } else if (isOffline) {
        lossStatus = 'los';
        issueReason = rawReason || 'OLT থেকে অনু Offline দেখাচ্ছে';
      }

      const ponPort = detectPonPortFromText(ponToken || onuId || tbl.title);
      const oltInfoParts = [ponToken || ponPort, onuId && !ponToken.includes(onuId) ? `#${onuId}` : ''].filter(Boolean);

      upsertOnu({
        ponPort,
        oltInfo: oltInfoParts.join(' · ') || ponPort,
        ...(onuId ? { onuId } : {}),
        ...(onuName ? { onuName } : {}),
        ...(macMatch ? { onuMac: macMatch } : {}),
        ...(phoneMatch ? { phone: phoneMatch[1] } : {}),
        status: isOffline ? 'inactive' : 'active',
        statusLabel: rawStatus || (isOffline ? 'Offline' : 'Online'),
        ...(rxNum !== null ? { rxPower: `${rxNum} dBm` } : {}),
        ...(txNum !== null ? { txPower: `${txNum} dBm` } : {}),
        ...(fiberLength ? { fiberLength } : {}),
        ...(tempIdx >= 0 && r[tempIdx] ? { temperature: r[tempIdx] } : {}),
        ...(rawReason ? { lastDownReason: rawReason } : {}),
        lossStatus,
        ...(issueReason ? { issueReason } : {})
      });
    }
  }

  // 2. Fallback: scan inline JS arrays / JSON rows containing MAC addresses & optical telemetry
  for (const page of rawHtmls) {
    const scriptMatches = page.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    for (const sm of scriptMatches) {
      const scriptText = sm[1];
      if (!/[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}/.test(scriptText)) continue;

      const rowArrays = scriptText.matchAll(/(?:\[|\{)[^\]\}]{12,260}?([0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5})[^\]\}]{0,260}?(?:\]|\})/g);
      for (const rm of rowArrays) {
        const snippet = rm[0];
        const mac = normalizeMac(rm[1]);
        if (!mac) continue;
        const rxMatch = snippet.match(/(-\d{1,2}\.\d{1,2})/);
        const ponMatch = snippet.match(/(?:EPON|GPON|XPON)?\s*0\/\d+\/\d+(?::\d+)?|PON\s*[1-4]/i);
        const distMatch = snippet.match(/\b(\d{2,5})\s*(?:m|meter)\b/i);
        const isOff = /offline|down|los|dying/i.test(snippet);
        const isDying = /dying|power/i.test(snippet);
        const rxVal = rxMatch ? parseDbmValue(rxMatch[1]) : null;
        const ponPort = detectPonPortFromText(ponMatch?.[0] || page.source);

        upsertOnu({
          ponPort,
          oltInfo: ponMatch?.[0] || ponPort,
          onuMac: mac,
          status: isOff ? 'inactive' : 'active',
          statusLabel: isDying ? 'Dying Gasp' : isOff ? 'Offline' : 'Online',
          ...(rxVal !== null ? { rxPower: `${rxVal} dBm` } : {}),
          ...(distMatch ? { fiberLength: `${distMatch[1]} meter` } : {}),
          lossStatus: isDying ? 'dying_gasp' : isOff ? 'los' : rxVal !== null && rxVal <= -25 ? 'high_loss' : 'normal',
          ...(isDying
            ? { issueReason: 'Dying Gasp (OLT)' }
            : isOff
            ? { issueReason: 'Offline / LOS (OLT)' }
            : rxVal !== null && rxVal <= -25
            ? { issueReason: `OLT হাই লস (${rxVal} dBm)` }
            : {})
        });
      }
    }
  }

  return Array.from(rowsByKey.values());
}

function buildPonSummary(onuRows: OltSyncedOnuRow[]): OltPonSummaryCard[] {
  return (['PON1', 'PON2', 'PON3', 'PON4'] as const).map((ponId) => {
    const items = onuRows.filter((r) => r.ponPort === ponId);
    const online = items.filter((i) => i.status === 'active').length;
    const offline = items.length - online;
    const highLossCount = items.filter((i) => i.lossStatus === 'high_loss').length;
    const losCount = items.filter((i) => i.lossStatus === 'los' || i.lossStatus === 'dying_gasp').length;
    const rxVals = items
      .map((i) => parseDbmValue(i.rxPower))
      .filter((v): v is number => v !== null);
    const avgRxDbm =
      rxVals.length > 0 ? Number((rxVals.reduce((s, v) => s + v, 0) / rxVals.length).toFixed(1)) : null;
    return { ponId, total: items.length, online, offline, highLossCount, losCount, avgRxDbm };
  });
}

async function crawlOltTelemetryPages(
  jar: Record<string, string>,
  homeHtml: string,
  homeUrl: string
): Promise<{
  pageTitle: string;
  deviceModel?: string;
  discoveredPages: OltDiscoveredPage[];
  systemMetrics: BillingPortalMetricCard[];
  onuRows: OltSyncedOnuRow[];
  rawTables: BillingPortalTableData[];
}> {
  const titleMatch = homeHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch?.[1] ? stripTagsToText(titleMatch[1]) : 'OLT · 103.158.206.4:6560';

  const rawHtmls: Array<{ source: string; html: string }> = [{ source: 'home.php', html: homeHtml }];
  const allTables: BillingPortalTableData[] = [...extractTablesFromHtml(homeHtml, 'Home')];
  let systemMetrics = extractSystemMetrics(homeHtml);

  const initialLinks = extractOltLinksFromHtml(homeHtml, homeUrl);
  const candidateMap = new Map<string, OltDiscoveredPage>();
  initialLinks.forEach((l) => candidateMap.set(l.path, l));

  // C-DATA FD1204S / lighttpd PHP CGI paths (discovered from /html/js.js: isajax=1 endpoints!)
  const fallbackProbePaths = [
    '/cgi/home.php?isajax=1&page=ponlist',
    '/cgi/index.php?page=ajax_left&isajax=1',
    '/cgi/index.php?isajax=1&page=pon&tab=lsslave',
    '/cgi/index.php?isajax=1&page=pon&tab=basic',
    '/cgi/index.php?isajax=1&page=pon&tab=performance',
    '/cgi/index.php?isajax=1&page=pon&tab=port',
    '/cgi/index.php?isajax=1&page=onu&tab=status',
    '/cgi/index.php?isajax=1&page=onu&tab=basic',
    '/cgi/index.php?isajax=1&page=onu&tab=port1',
    '/cgi/index.php?isajax=1&page=onu&tab=port2',
    '/cgi/index.php?isajax=1&page=onu&tab=port3',
    '/cgi/index.php?isajax=1&page=onu&tab=port4',
    '/cgi/index.php?isajax=1&page=onu&tab=temp',
    '/cgi/index.php?isajax=1&page=sys&tab=basic',
    '/cgi/index.php?page=onu&tab=status',
    '/cgi/index.php?page=pon&tab=lsslave'
  ];

  const visitedPaths = new Set<string>(['/cgi/home.php']);
  const firstPassQueue = initialLinks.slice(0, 8);

  const fetchBatch = async (items: OltDiscoveredPage[], discoverLinks: boolean) => {
    const toFetch = items.filter((item) => {
      if (visitedPaths.has(item.path)) return false;
      visitedPaths.add(item.path);
      return true;
    });
    const results = await Promise.allSettled(
      toFetch.map(async (item) => {
        const subRes = await fetchOltWithJar(jar, item.path, {
          method: 'GET',
          referer: homeUrl,
          timeoutMs: 6000
        });
        return { item, subRes };
      })
    );
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const { item, subRes } = r.value;
      if (isOltLoginPage(subRes.html, subRes.finalUrl)) continue;
      rawHtmls.push({ source: item.label, html: subRes.html });
      allTables.push(...extractTablesFromHtml(subRes.html, item.label));
      if (systemMetrics.length === 0) {
        systemMetrics = extractSystemMetrics(subRes.html);
      }
      if (discoverLinks) {
        const subLinks = extractOltLinksFromHtml(subRes.html, subRes.finalUrl);
        subLinks.forEach((sl) => {
          if (!candidateMap.has(sl.path)) candidateMap.set(sl.path, sl);
        });
      }
    }
  };

  // First pass: home links + primary AJAX endpoints in parallel
  await fetchBatch(
    [
      ...fallbackProbePaths.slice(0, 4).map((p) => ({ label: p.replace('/cgi/', ''), path: p })),
      ...firstPassQueue
    ],
    true
  );

  // Second pass: remaining prioritized PON/ONU/DDM pages
  const discoveredPages = Array.from(candidateMap.values());
  const prioritizedPaths = [
    ...discoveredPages.filter((p) =>
      /(?:onu|pon|optic|opm|ddm|slave|status|mac|list|epon|gpon|ajax)/i.test(`${p.label} ${p.path}`)
    ),
    ...fallbackProbePaths.slice(4).map((p) => ({ label: p.replace('/cgi/', ''), path: p }))
  ].slice(0, 20);

  await fetchBatch(prioritizedPaths, false);

  const modelCard = systemMetrics.find((m) => /model|device|type|hardware|fd\d+/i.test(`${m.label} ${m.value}`));
  const onuRows = parseOnuRowsFromTablesAndScripts(allTables, rawHtmls);

  return {
    pageTitle,
    ...(modelCard ? { deviceModel: modelCard.value } : {}),
    discoveredPages: discoveredPages.slice(0, 30),
    systemMetrics,
    onuRows,
    rawTables: allTables.slice(0, 12)
  };
}

function summarizeOltReport(
  username: string,
  crawled: Awaited<ReturnType<typeof crawlOltTelemetryPages>>
): OltLiveReport {
  const ponSummary = buildPonSummary(crawled.onuRows);
  const totalOnus = crawled.onuRows.length;
  const onlineOnus = crawled.onuRows.filter((r) => r.status === 'active').length;
  const offlineOnus = totalOnus - onlineOnus;
  const highLossOnus = crawled.onuRows.filter((r) => r.lossStatus === 'high_loss').length;
  const losOnus = crawled.onuRows.filter((r) => r.lossStatus === 'los' || r.lossStatus === 'dying_gasp').length;

  return {
    oltOrigin: OLT_ORIGIN,
    username,
    syncedAt: new Date().toISOString(),
    pageTitle: crawled.pageTitle,
    ...(crawled.deviceModel ? { deviceModel: crawled.deviceModel } : {}),
    totalOnus,
    onlineOnus,
    offlineOnus,
    highLossOnus,
    losOnus,
    ponSummary,
    systemMetrics: crawled.systemMetrics,
    discoveredPages: crawled.discoveredPages,
    onuRows: crawled.onuRows,
    rawTables: crawled.rawTables
  };
}

export async function loginAndFetchOltReport(params: {
  username: string;
  password: string;
}): Promise<{ sessionToken: string; report: OltLiveReport }> {
  pruneExpiredOltSessions();

  const username = params.username.trim();
  const password = params.password;
  if (!username || !password) {
    throw new Error('OLT ইউজারনেম এবং পাসওয়ার্ড দিন।');
  }

  const jar: Record<string, string> = { Cookie_Language: 'en' };

  // Step 1: Load /cgi/login.php cleanly
  await fetchOltWithJar(jar, '/cgi/login.php', { method: 'GET' });

  // Step 2: Submit Base64-encoded username & password matching loginForm JS
  const formBody = new URLSearchParams({
    language: 'en',
    username: Buffer.from(username, 'utf8').toString('base64'),
    passwd: Buffer.from(password, 'utf8').toString('base64')
  });

  const loginRes = await fetchOltWithJar(jar, '/cgi/login.php', {
    method: 'POST',
    body: formBody.toString(),
    referer: `${OLT_ORIGIN}/cgi/login.php`
  });

  if (isOltLoginPage(loginRes.html, loginRes.finalUrl)) {
    throw new Error(
      'OLT (103.158.206.4:6560) লগইন ব্যর্থ হয়েছে — ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।'
    );
  }

  // Ensure we inspect /cgi/home.php if login landed elsewhere
  let homeHtml = loginRes.html;
  let homeUrl = loginRes.finalUrl;
  if (!homeUrl.includes('home.php')) {
    try {
      const homeRes = await fetchOltWithJar(jar, '/cgi/home.php', {
        method: 'GET',
        referer: loginRes.finalUrl
      });
      if (isOltLoginPage(homeRes.html, homeRes.finalUrl)) {
        throw new Error('OLT সেশন চালু হয়নি — ইউজারনেম বা পাসওয়ার্ড যাচাই করুন।');
      }
      homeHtml = homeRes.html;
      homeUrl = homeRes.finalUrl;
    } catch (err) {
      if (err instanceof Error && err.message.includes('OLT সেশন')) throw err;
    }
  }

  const crawled = await crawlOltTelemetryPages(jar, homeHtml, homeUrl);
  const report = summarizeOltReport(username, crawled);

  const sessionToken = crypto.randomBytes(32).toString('hex');
  oltSessionStore.set(sessionToken, {
    token: sessionToken,
    username,
    cookies: jar,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    discoveredPages: crawled.discoveredPages
  });

  return { sessionToken, report };
}

export async function refreshOltLiveReport(session: OltCgiSession): Promise<OltLiveReport> {
  const homeRes = await fetchOltWithJar(session.cookies, '/cgi/home.php', {
    method: 'GET',
    referer: `${OLT_ORIGIN}/cgi/home.php`
  });

  if (isOltLoginPage(homeRes.html, homeRes.finalUrl)) {
    deleteOltCgiSession(session.token);
    throw new Error('OLT_SESSION_CLOSED');
  }

  const crawled = await crawlOltTelemetryPages(session.cookies, homeRes.html, homeRes.finalUrl);
  session.discoveredPages = crawled.discoveredPages;
  session.lastUsedAt = Date.now();
  return summarizeOltReport(session.username, crawled);
}

export async function fetchSpecificOltPage(
  session: OltCgiSession,
  requestedPath: string
): Promise<{
  path: string;
  tables: BillingPortalTableData[];
  onuRows: OltSyncedOnuRow[];
}> {
  const cleanPath = requestedPath.trim();
  if (!cleanPath.startsWith('/cgi/') || /[<>'"\s]/.test(cleanPath)) {
    throw new Error('অবৈধ OLT পাতার ঠিকানা।');
  }

  const res = await fetchOltWithJar(session.cookies, cleanPath, {
    method: 'GET',
    referer: `${OLT_ORIGIN}/cgi/home.php`
  });

  if (isOltLoginPage(res.html, res.finalUrl)) {
    deleteOltCgiSession(session.token);
    throw new Error('OLT_SESSION_CLOSED');
  }

  const tables = extractTablesFromHtml(res.html, cleanPath.replace('/cgi/', ''));
  const onuRows = parseOnuRowsFromTablesAndScripts(tables, [{ source: cleanPath, html: res.html }]);
  session.lastUsedAt = Date.now();

  return {
    path: cleanPath,
    tables,
    onuRows
  };
}
