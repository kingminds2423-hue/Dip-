export type AppFontSize = 'small' | 'medium' | 'large';

export const APP_FONT_SIZE_KEY = 'dip_bhola_app_font_size_v1';
export const APP_FONT_SIZE_EVENT = 'dip_bhola_font_size_changed';

export const FONT_ROOT_PX: Record<AppFontSize, number> = {
  small: 14,
  medium: 16,
  large: 19
};

export const APP_FONT_SIZE_OPTIONS: ReadonlyArray<{
  id: AppFontSize;
  shortBadge: string;
  label: string;
  englishLabel: string;
  px: number;
  description: string;
}> = [
  {
    id: 'small',
    shortBadge: 'S',
    label: 'ছোট (Small)',
    englishLabel: 'Small',
    px: FONT_ROOT_PX.small,
    description: 'কমপ্যাক্ট ভিউ — এক স্ক্রিনে বেশি তথ্য'
  },
  {
    id: 'medium',
    shortBadge: 'M',
    label: 'মাঝারি (Medium)',
    englishLabel: 'Medium',
    px: FONT_ROOT_PX.medium,
    description: 'স্ট্যান্ডার্ড ভিউ — স্বাভাবিক মাপ (ডিফল্ট)'
  },
  {
    id: 'large',
    shortBadge: 'L',
    label: 'বড় (Large)',
    englishLabel: 'Large',
    px: FONT_ROOT_PX.large,
    description: 'বড় ও স্পষ্ট লেখা — সবার পড়তে সহজ'
  }
];

export function getSavedAppFontSize(): AppFontSize {
  if (typeof window === 'undefined' || !window.localStorage) return 'medium';
  try {
    const val = window.localStorage.getItem(APP_FONT_SIZE_KEY);
    if (val === 'small' || val === 'medium' || val === 'large') {
      return val;
    }
  } catch {
    // ignore storage errors
  }
  return 'medium';
}

export function applyAppFontSize(size?: AppFontSize): AppFontSize {
  const effective = size || getSavedAppFontSize();
  if (typeof document !== 'undefined') {
    document.documentElement.style.fontSize = `${FONT_ROOT_PX[effective]}px`;
    document.documentElement.dataset.appFontSize = effective;
  }
  return effective;
}

export function setAppFontSize(size: AppFontSize): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(APP_FONT_SIZE_KEY, size);
    } catch {
      // ignore storage errors
    }
  }
  applyAppFontSize(size);
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(APP_FONT_SIZE_EVENT, { detail: size }));
    } catch {
      // ignore
    }
  }
}

export function subscribeAppFontSize(listener: (size: AppFontSize) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onEvent = (e: Event) => {
    const ce = e as CustomEvent<AppFontSize>;
    listener(ce.detail || getSavedAppFontSize());
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === APP_FONT_SIZE_KEY) {
      listener(applyAppFontSize());
    }
  };
  window.addEventListener(APP_FONT_SIZE_EVENT, onEvent);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(APP_FONT_SIZE_EVENT, onEvent);
    window.removeEventListener('storage', onStorage);
  };
}
