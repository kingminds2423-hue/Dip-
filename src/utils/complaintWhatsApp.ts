import { CustomerComplaint, WhatsAppGroupConfig } from '../types';

function formatPriorityLabel(priority: CustomerComplaint['priority']): string {
  switch (priority) {
    case 'critical':
      return '🔴 অতি জরুরি (Critical)';
    case 'urgent':
      return '🟠 জরুরি (Urgent)';
    case 'normal':
    default:
      return '🔵 সাধারণ (Normal)';
  }
}

function formatStatusLabel(status: CustomerComplaint['status']): string {
  switch (status) {
    case 'resolved':
      return '✅ সমাধান সম্পন্ন (Resolved)';
    case 'in_progress':
      return '🔧 কাজ চলছে (In Progress)';
    case 'pending':
    default:
      return '⏳ পেন্ডিং (Pending)';
  }
}

function formatTimestamp(isoStr?: string): string {
  try {
    const date = isoStr ? new Date(isoStr) : new Date();
    return date.toLocaleString('bn-BD', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoStr || '';
  }
}

export function formatComplaintGroupSms(
  complaint: Omit<CustomerComplaint, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  companyName = 'DIP BHOLA NETWORK',
  groupName?: string
): string {
  const lines = [
    `📢 *${companyName} — গ্রাহক অভিযোগ (Complain SMS)*`,
    groupName ? `👥 *গ্রুপ:* ${groupName}` : '',
    `━━━━━━━━━━━━━━━━━━`,
    `🆔 *অভিযোগ আইডি:* #${complaint.idNumber}`,
    `⚡ *গুরুত্ব:* ${formatPriorityLabel(complaint.priority)}`,
    `📌 *অবস্থা:* ${formatStatusLabel(complaint.status)}`,
    `👤 *গ্রাহকের নাম:* ${complaint.name}`,
    `📱 *মোবাইল:* ${complaint.mobileNumber}`,
    `📍 *এলাকা / ঠিকানা:* ${complaint.address}`,
    complaint.packageName ? `📦 *প্যাকেজ:* ${complaint.packageName}` : '',
    complaint.oltInfo ? `🔌 *OLT & PON:* ${complaint.oltInfo}` : '',
    complaint.oltPower ? `📶 *Power / Dist:* ${complaint.oltPower}` : '',
    `🛠️ *সমস্যার বিবরণ:* ${complaint.complainDetails}`,
    complaint.assignedStaffName ? `👷 *দায়িত্বপ্রাপ্ত টেকনিশিয়ান:* ${complaint.assignedStaffName}` : '',
    complaint.autoAssignedReason ? `🤖 *অটো-ম্যাচ:* ${complaint.autoAssignedReason}` : '',
    complaint.reportedBy ? `✍️ *এন্ট্রিদাতা:* ${complaint.reportedBy}` : '',
    complaint.resolutionNote ? `✅ *সমাধান নোট:* ${complaint.resolutionNote}` : '',
    `🕒 *সময়:* ${formatTimestamp(complaint.createdAt)}`,
    `━━━━━━━━━━━━━━━━━━`,
    `দ্রুত সমাধান করে স্ট্যাটাস আপডেট করুন।`
  ];

  return lines.filter(Boolean).join('\n');
}

export function formatMultipleComplaintsGroupSms(
  complaints: CustomerComplaint[],
  companyName = 'DIP BHOLA NETWORK',
  groupName?: string
): string {
  const active = complaints.filter((c) => c.status !== 'resolved');
  const list = active.length > 0 ? active : complaints.slice(0, 10);

  const header = [
    `📢 *${companyName} — চলমান অভিযোগ তালিকা (${list.length}টি)*`,
    groupName ? `👥 *গ্রুপ:* ${groupName}` : '',
    `🕒 *সময়:* ${formatTimestamp()}`,
    `━━━━━━━━━━━━━━━━━━`
  ]
    .filter(Boolean)
    .join('\n');

  const body = list
    .map((c, idx) => {
      return [
        `*${idx + 1}. #${c.idNumber} — ${c.name}* (${formatPriorityLabel(c.priority)})`,
        `📍 ${c.address} | 📱 ${c.mobileNumber}`,
        `🛠️ ${c.complainDetails}`,
        c.assignedStaffName ? `👷 টেকনিশিয়ান: ${c.assignedStaffName}` : '👷 টেকনিশিয়ান: নির্ধারিত নয়',
        `📌 অবস্থা: ${formatStatusLabel(c.status)}`
      ].join('\n');
    })
    .join('\n\n');

  return `${header}\n${body}\n━━━━━━━━━━━━━━━━━━\nদায়িত্বপ্রাপ্ত টেকনিশিয়ানরা দ্রুত কাজ সম্পন্ন করুন।`;
}

export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function buildDeviceSmsUrl(message: string, phone?: string): string {
  const clean = (phone || '').replace(/[^\d+]/g, '');
  return clean
    ? `sms:${clean}?body=${encodeURIComponent(message)}`
    : `sms:?body=${encodeURIComponent(message)}`;
}

export function openAnchorLinkSafely(href: string): void {
  const a = document.createElement('a');
  a.href = href;
  if (href.startsWith('http')) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function dispatchComplaintToWebhook(
  config: WhatsAppGroupConfig | null | undefined,
  complaint: Omit<CustomerComplaint, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  message: string
): Promise<boolean> {
  const url = config?.webhookUrl?.trim();
  if (!url || !url.startsWith('http')) {
    return false;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'customer_complaint',
        groupName: config?.groupName || '',
        groupInviteLink: config?.groupInviteLink || '',
        message,
        complaint
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('WhatsApp webhook dispatch error:', err);
    return false;
  }
}
