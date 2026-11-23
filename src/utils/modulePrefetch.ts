// Shared module loaders & background/hover prefetchers so switching ERP Options feels instantaneous

export const loadErpCommandHub = () =>
  import('../components/ErpCommandHub').then((m) => ({ default: m.ErpCommandHub }));

export const loadTransactionsTable = () =>
  import('../components/TransactionsTable').then((m) => ({ default: m.TransactionsTable }));

export const loadCustomerComplaintsView = () =>
  import('../components/CustomerComplaintsView').then((m) => ({
    default: m.CustomerComplaintsView
  }));

export const loadCustomersDirectoryView = () =>
  import('../components/CustomersDirectoryView').then((m) => ({
    default: m.CustomersDirectoryView
  }));

export const loadCustomerDuesView = () =>
  import('../components/CustomerDuesView').then((m) => ({ default: m.CustomerDuesView }));

export const loadTroubleshootPortalView = () =>
  import('../components/TroubleshootPortalView').then((m) => ({
    default: m.TroubleshootPortalView
  }));

export const loadReportsView = () =>
  import('../components/ReportsView').then((m) => ({ default: m.ReportsView }));

export const loadStaffManagement = () =>
  import('../components/StaffManagement').then((m) => ({ default: m.StaffManagement }));

export const loadPartnersView = () =>
  import('../components/PartnersView').then((m) => ({ default: m.PartnersView }));

export const loadOfficersView = () =>
  import('../components/OfficersView').then((m) => ({ default: m.OfficersView }));

export const loadDigitalDisplayBoard = () =>
  import('../components/DigitalDisplayBoard').then((m) => ({
    default: m.DigitalDisplayBoard
  }));

export const loadPlayStoreAppView = () =>
  import('../components/PlayStoreAppView').then((m) => ({ default: m.PlayStoreAppView }));

export const loadTransactionModal = () =>
  import('../components/TransactionModal').then((m) => ({ default: m.TransactionModal }));

export const loadComplaintModal = () =>
  import('../components/ComplaintModal').then((m) => ({ default: m.ComplaintModal }));

const prefetchedIds = new Set<string>();

const PORTAL_LOADERS: Record<string, () => Promise<unknown>> = {
  erp_hub: loadErpCommandHub,
  transactions: loadTransactionsTable,
  complaints: loadCustomerComplaintsView,
  customers: loadCustomersDirectoryView,
  dues: loadCustomerDuesView,
  troubleshoot_portal: loadTroubleshootPortalView,
  reports: loadReportsView,
  staff: loadStaffManagement,
  partners: loadPartnersView,
  officers: loadOfficersView,
  display: loadDigitalDisplayBoard,
  playstore: loadPlayStoreAppView,
  tx_modal: loadTransactionModal,
  complaint_modal: loadComplaintModal
};

export function prefetchPortalModule(portalId?: string | null): void {
  if (!portalId) return;
  const loader = PORTAL_LOADERS[portalId];
  if (!loader || prefetchedIds.has(portalId)) return;
  prefetchedIds.add(portalId);
  void loader().catch(() => {
    prefetchedIds.delete(portalId);
  });
}

export function scheduleIdleErpPrefetch(priorityPortalIds?: string[]): () => void {
  if (typeof window === 'undefined') return () => {};

  const primaryQueue = priorityPortalIds && priorityPortalIds.length > 0
    ? priorityPortalIds
    : ['transactions', 'complaints', 'troubleshoot_portal', 'tx_modal', 'complaint_modal', 'customers', 'dues'];

  const secondaryQueue = ['reports', 'staff', 'partners', 'display', 'officers'];

  let cancelled = false;
  const timers: number[] = [];

  const runBatch = (ids: string[], delayMs: number) => {
    const id = window.setTimeout(() => {
      if (cancelled) return;
      const exec = () => {
        if (cancelled) return;
        ids.forEach((pid) => prefetchPortalModule(pid));
      };
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
      if (typeof ric === 'function') {
        ric(exec, { timeout: 2000 });
      } else {
        exec();
      }
    }, delayMs);
    timers.push(id);
  };

  // Prefetch daily-use views right after initial render settles
  runBatch(primaryQueue, 650);
  // Prefetch secondary ERP portals quietly afterwards
  runBatch(secondaryQueue, 2400);

  return () => {
    cancelled = true;
    timers.forEach((t) => window.clearTimeout(t));
  };
}
