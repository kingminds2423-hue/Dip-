import { BillingPortalTableData, OltLiveReport, OltSyncedOnuRow } from '../types';

export interface OltPortalLoginResponse {
  ok: boolean;
  sessionToken: string;
  report: OltLiveReport;
}

export interface OltFetchPageResponse {
  ok: boolean;
  path: string;
  tables: BillingPortalTableData[];
  onuRows: OltSyncedOnuRow[];
}

export async function loginOltPortal(params: {
  username: string;
  password: string;
}): Promise<OltPortalLoginResponse> {
  const res = await fetch('/api/olt-portal/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(params)
  });

  const data = (await res.json().catch(() => ({}))) as Partial<OltPortalLoginResponse> & {
    error?: string;
  };
  if (!res.ok || !data.ok || !data.sessionToken || !data.report) {
    throw new Error(data.error || 'OLT (103.158.206.4:6560) পোর্টালে লগইন করা যায়নি।');
  }
  return data as OltPortalLoginResponse;
}

export async function fetchLiveOltReport(sessionToken: string): Promise<OltLiveReport> {
  const res = await fetch('/api/olt-portal/live-report', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sessionToken}`
    },
    cache: 'no-store'
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    report?: OltLiveReport;
    error?: string;
    sessionExpired?: boolean;
  };
  if (!res.ok || !data.ok || !data.report) {
    const err = new Error(data.error || 'OLT লাইভ টেলিমেট্রি রিফ্রেশ করা যায়নি।') as Error & {
      sessionExpired?: boolean;
    };
    err.sessionExpired = Boolean(data.sessionExpired || res.status === 401);
    throw err;
  }
  return data.report;
}

export async function fetchSpecificOltPageRows(
  sessionToken: string,
  pagePath: string
): Promise<OltFetchPageResponse> {
  const res = await fetch('/api/olt-portal/fetch-page', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`
    },
    cache: 'no-store',
    body: JSON.stringify({ path: pagePath })
  });

  const data = (await res.json().catch(() => ({}))) as Partial<OltFetchPageResponse> & {
    error?: string;
    sessionExpired?: boolean;
  };
  if (!res.ok || !data.ok) {
    const err = new Error(data.error || 'OLT পাতা থেকে ডেটা আনা যায়নি।') as Error & {
      sessionExpired?: boolean;
    };
    err.sessionExpired = Boolean(data.sessionExpired || res.status === 401);
    throw err;
  }
  return data as OltFetchPageResponse;
}

export async function logoutOltPortal(sessionToken: string): Promise<void> {
  if (!sessionToken) return;
  await fetch('/api/olt-portal/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  }).catch(() => {});
}
