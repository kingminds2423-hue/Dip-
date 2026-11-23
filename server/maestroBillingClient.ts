import crypto from 'crypto';

const MAESTRO_ORIGIN = 'https://admin.bhola.net';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_SESSIONS = 25;

export interface BillingPortalMetricCard {
  label: string;
  value: string;
  numericValue: number | null;
}

export interface BillingPortalNavLink {
  label: string;
  linkname: string;
}

export interface BillingPortalTableData {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface BillingPortalSyncedRow {
  memberId: string;
  name: string;
  phone: string;
  address: string;
  packageName?: string;
  monthlyFee?: number;
  expiryDate?: string;
  dueAmount?: number;
  status: 'active' | 'inactive' | 'disconnected';
  statusLabel?: string;
  oltInfo?: string;
  onuMac?: string;
  rxPower?: string;
}

export interface BillingPortalDashReport {
  portalHost: string;
  username: string;
  syncedAt: string;
  pageTitle: string;
  totalCustomers: number | null;
  activeCustomers: number | null;
  expiredCustomers: number | null;
  inactiveCustomers: number | null;
  onlineCustomers: number | null;
  offlineCustomers: number | null;
  todayCollection: number | null;
  monthlyCollection: number | null;
  totalDue: number | null;
  metricCards: BillingPortalMetricCard[];
  navLinks: BillingPortalNavLink[];
  tables: BillingPortalTableData[];
  subscriberRows: BillingPortalSyncedRow[];
}

interface MaestroSession {
  token: string;
  username: string;
  cookies: Record<string, string>;
  portalSessionId: string;
  createdAt: number;
  lastUsedAt: number;
  lastNavLinks: BillingPortalNavLink[];
}

const sessionStore = new Map<string, MaestroSession>();

function pruneExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessionStore.entries()) {
    if (now - session.lastUsedAt > SESSION_TTL_MS) {
      sessionStore.delete(token);
    }
  }
  while (sessionStore.size > MAX_SESSIONS) {
    const oldestKey = sessionStore.keys().next().value;
    if (!oldestKey) break;
    sessionStore.delete(oldestKey);
  }
}

export function getMaestroSession(token: string): MaestroSession | null {
  pruneExpiredSessions();
  const s = sessionStore.get(token);
  if (!s) return null;
  s.lastUsedAt = Date.now();
  return s;
}

export function deleteMaestroSession(token: string): void {
  sessionStore.delete(token);
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
    if (name) {
      jar[name] = val;
    }
  }
}

function formatCookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function extractPortalIdFromUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr, MAESTRO_ORIGIN);
    if (u.origin !== MAESTRO_ORIGIN) return '';
    return (u.searchParams.get('id') || '').trim();
  } catch {
    return '';
  }
}

function resolveSafeMaestroUrl(candidate: string, base: string): URL | null {
  try {
    const u = new URL(candidate, base);
    if (u.origin !== MAESTRO_ORIGIN) return null;
    if (u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

function findClientSideRedirect(html: string): string | null {
  const metaMatch = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url\s*=\s*([^"'\s>]+)/i);
  if (metaMatch?.[1]) return metaMatch[1].trim();

  const jsMatch = html.match(/(?:window\.location(?:\.href)?|location\.replace)\s*(?:=|\()\s*["']([^"']+)["']/i);
  if (jsMatch?.[1]) return jsMatch[1].trim();

  return null;
}

async function fetchMaestroWithJar(
  jar: Record<string, string>,
  relativeOrSameOriginUrl: string,
  init: { method?: 'GET' | 'POST'; body?: string; referer?: string } = {}
): Promise<{ html: string; finalUrl: string; status: number; extractedId: string }> {
  let currentUrl = resolveSafeMaestroUrl(relativeOrSameOriginUrl, MAESTRO_ORIGIN);
  if (!currentUrl) {
    throw new Error('অবৈধ পোর্টাল রিকোয়েস্ট ঠিকানা।');
  }

  let method: 'GET' | 'POST' = init.method || 'GET';
  let body = init.body;
  let referer = init.referer || `${MAESTRO_ORIGIN}/index3.jsp`;
  let extractedId = extractPortalIdFromUrl(currentUrl.toString());

  for (let hop = 0; hop < 6; hop += 1) {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) DIP-BHOLA-ERP/2.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: referer
    };
    const cookieHeader = formatCookieHeader(jar);
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }
    if (method === 'POST' && body !== undefined) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers.Origin = MAESTRO_ORIGIN;
    }

    const upstreamRes = await fetch(currentUrl.toString(), {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(12000)
    });

    applySetCookieHeaders(upstreamRes, jar);

    if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
      const loc = upstreamRes.headers.get('location');
      await upstreamRes.body?.cancel().catch(() => {});
      if (!loc) break;
      const nextUrl = resolveSafeMaestroUrl(loc, currentUrl.toString());
      if (!nextUrl) {
        throw new Error('পোর্টাল রিডাইরেক্ট নিরাপদ ডোমেইনের বাইরে।');
      }
      const nextId = extractPortalIdFromUrl(nextUrl.toString());
      if (nextId) extractedId = nextId;
      referer = currentUrl.toString();
      currentUrl = nextUrl;
      method = 'GET';
      body = undefined;
      continue;
    }

    const html = await upstreamRes.text();
    const htmlUrlId = html.match(/mainPage\.jsp\?[^"'<>]*\bid=([A-Za-z0-9]+)/i)?.[1];
    if (htmlUrlId && !extractedId) extractedId = htmlUrlId;

    const clientRedirect = findClientSideRedirect(html);
    if (clientRedirect && hop < 4) {
      const nextUrl = resolveSafeMaestroUrl(clientRedirect, currentUrl.toString());
      if (nextUrl && nextUrl.toString() !== currentUrl.toString()) {
        const nextId = extractPortalIdFromUrl(nextUrl.toString());
        if (nextId) extractedId = nextId;
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
      status: upstreamRes.status,
      extractedId
    };
  }

  throw new Error('admin.bhola.net থেকে সাড়া পেতে বেশি সময় লাগছে।');
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

function toEngDigits(str: string): string {
  const map: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  return str.replace(/[০-৯]/g, (d) => map[d] || d);
}

function parseNumberFromString(raw: string): number | null {
  const clean = toEngDigits(raw).replace(/,/g, '');
  const m = clean.match(/(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function isLoginOrClosedPage(html: string): boolean {
  const lower = html.toLowerCase();
  if (lower.includes('your session is closed') || lower.includes('you must login to visit this page')) {
    return true;
  }
  if (lower.includes('action="validate4.jsp"') || lower.includes("action='validate4.jsp'")) {
    return true;
  }
  if (lower.includes('name="uname"') && lower.includes('name="passw"')) {
    return true;
  }
  return false;
}

function extractNavLinks(html: string): { links: BillingPortalNavLink[]; sessionIdFromHtml: string } {
  const links: BillingPortalNavLink[] = [];
  const seen = new Set<string>();
  let sessionIdFromHtml = '';

  const anchorRegex = /<a\b[^>]*href=["']([^"']*mainPage\.jsp[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = decodeHtmlEntities(match[1]);
    const label = stripTagsToText(match[2]);
    if (!sessionIdFromHtml) {
      const idMatch = href.match(/[?&]id=([A-Za-z0-9]+)/i);
      if (idMatch?.[1]) sessionIdFromHtml = idMatch[1];
    }
    const lnMatch = href.match(/[?&]linkname=([A-Za-z0-9_-]{1,64})/i);
    const linkname = lnMatch?.[1] || '';
    if (linkname && !seen.has(linkname) && label) {
      seen.add(linkname);
      links.push({ label: label.slice(0, 60), linkname });
    }
  }
  return { links, sessionIdFromHtml };
}

function extractMetricCards(html: string): BillingPortalMetricCard[] {
  const cards: BillingPortalMetricCard[] = [];
  const seen = new Set<string>();

  const cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

  // Pattern 1: Bootstrap SB-Admin / AdminLTE dash cards (.huge + text, or .panel-heading blocks)
  const blockRegex = /<div[^>]*class=["'][^"']*(?:panel-heading|small-box|info-box|card-body|tile-stats|stat-box|dashboard-stat)[^"']*["'][^>]*>([\s\S]{10,1200}?)<\/div>\s*(?:<\/div>)?/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(cleanHtml)) !== null) {
    const block = match[1];
    const hugeMatch = block.match(/<div[^>]*class=["'][^"']*(?:huge|count|number)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
      || block.match(/<(?:h1|h2|h3|h4|strong|span)[^>]*>([\s\S]*?)<\/(?:h1|h2|h3|h4|strong|span)>/i);
    const rawBlockText = stripTagsToText(block);
    if (!rawBlockText || rawBlockText.length > 140) continue;

    if (hugeMatch?.[1]) {
      const valText = stripTagsToText(hugeMatch[1]);
      const num = parseNumberFromString(valText);
      const labelText = rawBlockText.replace(valText, '').trim();
      if (labelText && num !== null && labelText.length >= 2) {
        const key = `${labelText.toLowerCase()}::${valText}`;
        if (!seen.has(key)) {
          seen.add(key);
          cards.push({ label: labelText, value: valText, numericValue: num });
        }
      }
    }
  }

  // Pattern 2: Generic line pairs from stripped text (e.g. "Total Customers: 750" or "Active 710")
  const textWithBreaks = decodeHtmlEntities(
    cleanHtml
      .replace(/<\/(?:div|p|li|tr|td|th|h1|h2|h3|h4|h5|span)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
  const lines = textWithBreaks
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 2 && l.length <= 80);

  const labelKeywords = /(?:total|active|expired|inactive|online|offline|disable|due|balance|collection|paid|bill|income|today|month|customer|client|user|onu|মোট|সচল|মেয়াদ|বকেয়া|আদায়|গ্রাহক)/i;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // Inline "Label : 123"
    const inlineMatch = line.match(/^([A-Za-z\u0980-\u09FF\s/()._-]{3,45})[:\-–]\s*([৳\u09F3TkBDT\s]*[\d,০-৯]+(?:\.[\d০-৯]+)?)$/i);
    if (inlineMatch && labelKeywords.test(inlineMatch[1])) {
      const label = inlineMatch[1].trim();
      const val = inlineMatch[2].trim();
      const num = parseNumberFromString(val);
      const key = `${label.toLowerCase()}::${val}`;
      if (!seen.has(key) && num !== null) {
        seen.add(key);
        cards.push({ label, value: val, numericValue: num });
      }
      continue;
    }

    // Two adjacent lines: Number followed by Label OR Label followed by Number
    const nextLine = lines[i + 1] || '';
    const isLineNum = /^[৳\u09F3TkBDT\s]*[\d,০-৯]+(?:\.[\d০-৯]+)?\s*(?:BDT|TK|৳)?$/i.test(line);
    const isNextNum = /^[৳\u09F3TkBDT\s]*[\d,০-৯]+(?:\.[\d০-৯]+)?\s*(?:BDT|TK|৳)?$/i.test(nextLine);

    if (isLineNum && nextLine && !isNextNum && labelKeywords.test(nextLine)) {
      const num = parseNumberFromString(line);
      const key = `${nextLine.toLowerCase()}::${line}`;
      if (!seen.has(key) && num !== null) {
        seen.add(key);
        cards.push({ label: nextLine, value: line, numericValue: num });
      }
    } else if (!isLineNum && isNextNum && labelKeywords.test(line)) {
      const num = parseNumberFromString(nextLine);
      const key = `${line.toLowerCase()}::${nextLine}`;
      if (!seen.has(key) && num !== null) {
        seen.add(key);
        cards.push({ label: line, value: nextLine, numericValue: num });
      }
    }
  }

  return cards.slice(0, 32);
}

function extractTables(html: string): BillingPortalTableData[] {
  const tables: BillingPortalTableData[] = [];
  const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  let tableIdx = 1;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableBody = tableMatch[1];
    const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    let headers: string[] = [];
    const rows: string[][] = [];

    while ((rowMatch = rowRegex.exec(tableBody)) !== null) {
      const rowHtml = rowMatch[1];
      const cells: string[] = [];
      let hasTh = false;
      const cellRegex = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        if (cellMatch[1].toLowerCase() === 'th') hasTh = true;
        cells.push(stripTagsToText(cellMatch[2]));
      }
      if (cells.length === 0) continue;

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
        title: `টেবিল ${tableIdx}`,
        headers,
        rows: rows.slice(0, 1500)
      });
      tableIdx += 1;
    }
  }

  return tables;
}

function mapTableRowsToSubscribers(tables: BillingPortalTableData[]): BillingPortalSyncedRow[] {
  const results: BillingPortalSyncedRow[] = [];
  const seenKeys = new Set<string>();

  for (const tbl of tables) {
    const headersLower = tbl.headers.map((h) => h.toLowerCase());
    const findIdx = (patterns: RegExp[]) =>
      headersLower.findIndex((h) => patterns.some((p) => p.test(h)));

    const idIdx = findIdx([/\bid\b/, /user\s*id/, /username/, /pppoe/, /code/, /uid/, /সদস্য/]);
    const nameIdx = findIdx([/customer\s*name/, /client\s*name/, /\bname\b/, /full\s*name/, /নাম/]);
    const phoneIdx = findIdx([/mobile/, /phone/, /contact/, /cell/, /মোবাইল/]);
    const addrIdx = findIdx([/address/, /area/, /zone/, /location/, /ঠিকানা/, /এলাকা/]);
    const pkgIdx = findIdx([/package/, /plan/, /profile/, /bandwidth/, /প্যাকেজ/]);
    const feeIdx = findIdx([/monthly/, /bill/, /price/, /fee/, /tariff/, /rate/, /বিল/]);
    const expIdx = findIdx([/expir/, /valid/, /end\s*date/, /মেয়াদ/]);
    const dueIdx = findIdx([/\bdue\b/, /balance/, /বকেয়া/]);
    const statusIdx = findIdx([/status/, /state/, /online/, /active/, /অবস্থা/]);
    const oltIdx = findIdx([/\bolt\b/, /\bpon\b/]);
    const macIdx = findIdx([/\bmac\b/, /onu/, /caller/]);
    const rxIdx = findIdx([/\brx\b/, /power/, /signal/, /dbm/]);

    // Ensure table actually looks like a subscriber/customer list (has name/id + phone/package/status)
    const looksLikeCustomerTable =
      (idIdx >= 0 || nameIdx >= 0) &&
      (phoneIdx >= 0 || pkgIdx >= 0 || statusIdx >= 0 || expIdx >= 0 || addrIdx >= 0);

    if (!looksLikeCustomerTable) continue;

    for (const r of tbl.rows) {
      const rawId = idIdx >= 0 ? (r[idIdx] || '').trim() : '';
      const rawName = nameIdx >= 0 ? (r[nameIdx] || '').trim() : '';
      const rawPhone = phoneIdx >= 0 ? (r[phoneIdx] || '').trim() : '';
      const memberId = rawId || rawPhone;
      const name = rawName || rawId;
      if (!memberId && !name) continue;
      if (/^(?:total|মোট|grand total)/i.test(memberId) || /^(?:total|মোট|grand total)/i.test(name)) continue;

      const dedupKey = `${memberId.toLowerCase()}::${name.toLowerCase()}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);

      const statusText = statusIdx >= 0 ? (r[statusIdx] || '').trim() : '';
      const statusLower = statusText.toLowerCase();
      let status: 'active' | 'inactive' | 'disconnected' = 'active';
      if (/disconnect|terminat|cancel|delete|ব্লক|বিচ্ছিন্ন/.test(statusLower)) {
        status = 'disconnected';
      } else if (/expir|inact|disable|suspend|lock|off|down|বন্ধ|মেয়াদ/.test(statusLower)) {
        status = 'inactive';
      }

      const monthlyFee = feeIdx >= 0 ? parseNumberFromString(r[feeIdx] || '') ?? undefined : undefined;
      const dueAmount = dueIdx >= 0 ? parseNumberFromString(r[dueIdx] || '') ?? undefined : undefined;

      results.push({
        memberId: memberId || name,
        name: name || memberId,
        phone: rawPhone || 'দেওয়া হয়নি',
        address: (addrIdx >= 0 ? r[addrIdx] : '') || 'ভোলা সদর',
        ...(pkgIdx >= 0 && r[pkgIdx] ? { packageName: r[pkgIdx] } : {}),
        ...(monthlyFee !== undefined && monthlyFee > 0 ? { monthlyFee } : {}),
        ...(expIdx >= 0 && r[expIdx] ? { expiryDate: r[expIdx] } : {}),
        ...(dueAmount !== undefined && dueAmount > 0 ? { dueAmount } : {}),
        status,
        ...(statusText ? { statusLabel: statusText } : {}),
        ...(oltIdx >= 0 && r[oltIdx] ? { oltInfo: r[oltIdx] } : {}),
        ...(macIdx >= 0 && r[macIdx] ? { onuMac: r[macIdx] } : {}),
        ...(rxIdx >= 0 && r[rxIdx] ? { rxPower: r[rxIdx] } : {})
      });
    }
  }

  return results;
}

function summarizeReport(
  username: string,
  html: string,
  prevNavLinks: BillingPortalNavLink[] = []
): { report: BillingPortalDashReport; navLinks: BillingPortalNavLink[]; sessionIdFromHtml: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch?.[1] ? stripTagsToText(titleMatch[1]) : 'admin.bhola.net · dashReport';
  const metricCards = extractMetricCards(html);
  const { links, sessionIdFromHtml } = extractNavLinks(html);
  const navLinks = links.length > 0 ? links : prevNavLinks;
  const tables = extractTables(html);
  const subscriberRows = mapTableRowsToSubscribers(tables);

  const pickMetric = (patterns: RegExp[], excludePatterns: RegExp[] = []): number | null => {
    for (const card of metricCards) {
      if (card.numericValue === null) continue;
      const lbl = card.label.toLowerCase();
      if (excludePatterns.some((ex) => ex.test(lbl))) continue;
      if (patterns.some((p) => p.test(lbl))) {
        return card.numericValue;
      }
    }
    return null;
  };

  const totalCustomers = pickMetric([/total.*(?:customer|client|user|subscriber|member)/, /মোট.*গ্রাহক/]);
  const activeCustomers = pickMetric([/active.*(?:customer|client|user|member)/, /\bactive\b/, /সচল/], [/inactive/]);
  const expiredCustomers = pickMetric([/expir/, /মেয়াদোত্তীর্ণ/]);
  const inactiveCustomers = pickMetric([/inact/, /disable/, /lock/, /suspend/, /বন্ধ/]);
  const onlineCustomers = pickMetric([/\bonline\b/, /connected/, /অনলাইন/]);
  const offlineCustomers = pickMetric([/\boffline\b/, /অফলাইন/]);
  const todayCollection = pickMetric([/today.*(?:collect|bill|income|paid|cash|receive)/, /আজকের.*আদায়/]);
  const monthlyCollection = pickMetric([/month.*(?:collect|bill|income|paid|cash|receive)/, /মাসিক.*আদায়/]);
  const totalDue = pickMetric([/(?:total|all).*due/, /\bdue\b/, /বকেয়া/]);

  const report: BillingPortalDashReport = {
    portalHost: 'admin.bhola.net',
    username,
    syncedAt: new Date().toISOString(),
    pageTitle,
    totalCustomers,
    activeCustomers,
    expiredCustomers,
    inactiveCustomers,
    onlineCustomers,
    offlineCustomers,
    todayCollection,
    monthlyCollection,
    totalDue,
    metricCards,
    navLinks,
    tables: tables.slice(0, 8),
    subscriberRows
  };

  return { report, navLinks, sessionIdFromHtml };
}

export async function loginAndFetchDashReport(params: {
  username: string;
  password: string;
  remember?: boolean;
}): Promise<{ sessionToken: string; portalSessionId: string; report: BillingPortalDashReport }> {
  pruneExpiredSessions();

  const username = params.username.trim();
  const password = params.password;
  if (!username || !password) {
    throw new Error('admin.bhola.net ইউজারনেম এবং পাসওয়ার্ড দিন।');
  }

  const jar: Record<string, string> = {};

  // Step 1: Load login page to establish initial session cookie
  await fetchMaestroWithJar(jar, '/index3.jsp', { method: 'GET' });

  // Step 2: Submit credentials cleanly over HTTPS (credentials stay strictly in request scope)
  const formBody = new URLSearchParams({
    uName: username,
    passw: password
  });
  if (params.remember) {
    formBody.set('remember', 'Remember Me');
  }

  const loginRes = await fetchMaestroWithJar(jar, '/validate4.jsp', {
    method: 'POST',
    body: formBody.toString(),
    referer: `${MAESTRO_ORIGIN}/index3.jsp`
  });

  if (isLoginOrClosedPage(loginRes.html)) {
    throw new Error(
      'admin.bhola.net লগইন ব্যর্থ হয়েছে — ইউজারনেম বা পাসওয়ার্ড ভুল, অথবা পোর্টালে 2FA / অতিরিক্ত ভেরিফিকেশন সক্রিয় আছে।'
    );
  }

  let portalSessionId = loginRes.extractedId;
  let targetHtml = loginRes.html;
  let { report, navLinks, sessionIdFromHtml } = summarizeReport(username, targetHtml);
  if (!portalSessionId && sessionIdFromHtml) {
    portalSessionId = sessionIdFromHtml;
  }

  // If landing page wasn't dashReport yet, explicitly fetch dashReport using the verified session
  if (!loginRes.finalUrl.includes('linkname=dashReport')) {
    const dashQuery = portalSessionId
      ? `/mainPage.jsp?id=${encodeURIComponent(portalSessionId)}&linkname=dashReport`
      : '/mainPage.jsp?linkname=dashReport';
    try {
      const dashRes = await fetchMaestroWithJar(jar, dashQuery, {
        method: 'GET',
        referer: loginRes.finalUrl
      });
      if (!isLoginOrClosedPage(dashRes.html)) {
        if (dashRes.extractedId) portalSessionId = dashRes.extractedId;
        targetHtml = dashRes.html;
        const parsedDash = summarizeReport(username, targetHtml, navLinks);
        report = parsedDash.report;
        navLinks = parsedDash.navLinks;
        if (!portalSessionId && parsedDash.sessionIdFromHtml) {
          portalSessionId = parsedDash.sessionIdFromHtml;
        }
      }
    } catch {
      // Keep parsed landing page data if dashReport subfetch hits transient timeout
    }
  }

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const createdSession: MaestroSession = {
    token: sessionToken,
    username,
    cookies: jar,
    portalSessionId,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    lastNavLinks: navLinks
  };
  sessionStore.set(sessionToken, createdSession);

  if (report.subscriberRows.length === 0) {
    try {
      const subRes = await fetchBillingCustomerPage(createdSession);
      if (subRes.rows.length > 0) {
        report.subscriberRows = subRes.rows;
      }
      if (report.tables.length === 0 && subRes.tables.length > 0) {
        report.tables = subRes.tables.slice(0, 8);
      }
    } catch {
      // Keep dashReport metrics even if subscriber sub-page times out
    }
  }

  return {
    sessionToken,
    portalSessionId,
    report
  };
}

export async function refreshDashReport(session: MaestroSession): Promise<BillingPortalDashReport> {
  const dashPath = session.portalSessionId
    ? `/mainPage.jsp?id=${encodeURIComponent(session.portalSessionId)}&linkname=dashReport`
    : '/mainPage.jsp?linkname=dashReport';

  const res = await fetchMaestroWithJar(session.cookies, dashPath, {
    method: 'GET',
    referer: `${MAESTRO_ORIGIN}/mainPage.jsp`
  });

  if (isLoginOrClosedPage(res.html)) {
    deleteMaestroSession(session.token);
    throw new Error('SESSION_CLOSED');
  }

  if (res.extractedId) session.portalSessionId = res.extractedId;
  const { report, navLinks, sessionIdFromHtml } = summarizeReport(
    session.username,
    res.html,
    session.lastNavLinks
  );
  if (!session.portalSessionId && sessionIdFromHtml) {
    session.portalSessionId = sessionIdFromHtml;
  }
  session.lastNavLinks = navLinks;
  session.lastUsedAt = Date.now();
  return report;
}

export async function fetchBillingCustomerPage(
  session: MaestroSession,
  requestedLinkname?: string
): Promise<{
  sourceLinkname: string;
  rows: BillingPortalSyncedRow[];
  tables: BillingPortalTableData[];
}> {
  const candidateLinks: string[] = [];

  if (requestedLinkname) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(requestedLinkname)) {
      throw new Error('অবৈধ পোর্টাল পেজ নাম।');
    }
    candidateLinks.push(requestedLinkname);
  } else {
    // Prioritize discovered Maestro nav links matching customer/subscriber lists
    const customerNavMatches = session.lastNavLinks
      .filter((l) =>
        /(?:customer|client|member|user|subscriber|active|expired|online|all)/i.test(
          `${l.label} ${l.linkname}`
        )
      )
      .map((l) => l.linkname);

    candidateLinks.push(
      ...customerNavMatches,
      'customerList',
      'allCustomer',
      'activeCustomer',
      'viewCustomer',
      'customers',
      'userList',
      'onlineUser',
      'dashReport'
    );
  }

  const tried = new Set<string>();
  let bestRows: BillingPortalSyncedRow[] = [];
  let bestTables: BillingPortalTableData[] = [];
  let bestSource = candidateLinks[0] || 'dashReport';

  for (const linkname of candidateLinks) {
    if (tried.has(linkname)) continue;
    tried.add(linkname);
    if (tried.size > 6 && !requestedLinkname) break;

    const pagePath = session.portalSessionId
      ? `/mainPage.jsp?id=${encodeURIComponent(session.portalSessionId)}&linkname=${encodeURIComponent(linkname)}`
      : `/mainPage.jsp?linkname=${encodeURIComponent(linkname)}`;

    try {
      const res = await fetchMaestroWithJar(session.cookies, pagePath, {
        method: 'GET',
        referer: `${MAESTRO_ORIGIN}/mainPage.jsp`
      });
      if (isLoginOrClosedPage(res.html)) {
        deleteMaestroSession(session.token);
        throw new Error('SESSION_CLOSED');
      }
      const { report } = summarizeReport(session.username, res.html, session.lastNavLinks);
      if (report.subscriberRows.length > bestRows.length) {
        bestRows = report.subscriberRows;
        bestTables = report.tables;
        bestSource = linkname;
      } else if (bestTables.length === 0 && report.tables.length > 0) {
        bestTables = report.tables;
        bestSource = linkname;
      }
      if (bestRows.length >= 25) break;
    } catch (err) {
      if (err instanceof Error && err.message === 'SESSION_CLOSED') throw err;
    }
  }

  session.lastUsedAt = Date.now();
  return {
    sourceLinkname: bestSource,
    rows: bestRows,
    tables: bestTables
  };
}
