import { BillingPortalDashReport, BillingPortalSyncedRow, BillingPortalTableData } from '../types';

export interface BillingPortalLoginResponse {
  ok: boolean;
  sessionToken: string;
  portalSessionId: string;
  report: BillingPortalDashReport;
}

export interface BillingPortalFetchCustomersResponse {
  ok: boolean;
  sourceLinkname: string;
  rows: BillingPortalSyncedRow[];
  tables: BillingPortalTableData[];
  totalParsed: number;
}

export async function loginAdminBholaNet(params: {
  username: string;
  password: string;
  remember?: boolean;
}): Promise<BillingPortalLoginResponse> {
  const res = await fetch('/api/billing-portal/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(params)
  });

  const data = (await res.json().catch(() => ({}))) as Partial<BillingPortalLoginResponse> & {
    error?: string;
  };
  if (!res.ok || !data.ok || !data.sessionToken || !data.report) {
    throw new Error(data.error || 'admin.bhola.net-এ লগইন করা যায়নি।');
  }
  return data as BillingPortalLoginResponse;
}

export async function fetchLiveDashReport(
  sessionToken: string
): Promise<BillingPortalDashReport> {
  const res = await fetch('/api/billing-portal/dash-report', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sessionToken}`
    },
    cache: 'no-store'
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    report?: BillingPortalDashReport;
    error?: string;
    sessionExpired?: boolean;
  };
  if (!res.ok || !data.ok || !data.report) {
    const err = new Error(data.error || 'dashReport রিফ্রেশ করা যায়নি।') as Error & {
      sessionExpired?: boolean;
    };
    err.sessionExpired = Boolean(data.sessionExpired || res.status === 401);
    throw err;
  }
  return data.report;
}

export async function fetchBillingSubscribers(
  sessionToken: string,
  linkname?: string
): Promise<BillingPortalFetchCustomersResponse> {
  const res = await fetch('/api/billing-portal/fetch-customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`
    },
    cache: 'no-store',
    body: JSON.stringify(linkname ? { linkname } : {})
  });

  const data = (await res.json().catch(() => ({}))) as Partial<BillingPortalFetchCustomersResponse> & {
    error?: string;
    sessionExpired?: boolean;
  };
  if (!res.ok || !data.ok) {
    const err = new Error(data.error || 'গ্রাহক তালিকা আনা যায়নি।') as Error & {
      sessionExpired?: boolean;
    };
    err.sessionExpired = Boolean(data.sessionExpired || res.status === 401);
    throw err;
  }
  return data as BillingPortalFetchCustomersResponse;
}

export async function logoutAdminBholaNet(sessionToken: string): Promise<void> {
  if (!sessionToken) return;
  await fetch('/api/billing-portal/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  }).catch(() => {});
}
