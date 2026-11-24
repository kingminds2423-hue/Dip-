import React from 'react';
import {
  Globe,
  Router,
  CreditCard,
  Wrench,
  Shield,
  Smartphone,
  Link2,
  Server
} from 'lucide-react';
import { CustomPortalIconName } from '../types';

export const CUSTOM_PORTAL_ICONS: Array<{
  id: CustomPortalIconName;
  label: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'globe', label: 'ওয়েব / গ্লোব', Icon: Globe },
  { id: 'router', label: 'OLT / রাউটার', Icon: Router },
  { id: 'billing', label: 'বিলিং / পেমেন্ট', Icon: CreditCard },
  { id: 'wrench', label: 'টুলস / রিপেয়ার', Icon: Wrench },
  { id: 'shield', label: 'সিকিউরিটি', Icon: Shield },
  { id: 'smartphone', label: 'মোবাইল অ্যাপ', Icon: Smartphone },
  { id: 'link', label: 'ওয়েব লিংক', Icon: Link2 },
  { id: 'server', label: 'সার্ভার / ড্যাশ', Icon: Server }
];

export function renderCustomPortalIcon(iconName?: CustomPortalIconName, className = 'w-4 h-4') {
  const found = CUSTOM_PORTAL_ICONS.find((i) => i.id === iconName);
  const IconComp = found ? found.Icon : Globe;
  return <IconComp className={className} />;
}
