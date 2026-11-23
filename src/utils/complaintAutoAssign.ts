import { CustomerComplaint, Staff } from '../types';
import { toEnglishDigits } from './formatters';
import { detectPonPort } from './oltDiagnostics';

export const DEFAULT_SERVICE_AREA_PRESETS: string[] = [
  'জাংগালিয়া',
  'পশ্চিম ইলিশা',
  'পূর্ব ইলিশা',
  'ইলিশা',
  'বিশ্বরোড',
  'বাপ্তা',
  'ভোলা সদর',
  'ধনিয়া',
  'ভেদুরিয়া',
  'দৌলতখান',
  'বোরহানউদ্দিন',
  'খেয়াঘাট',
  'চৌমহনী',
  'নতুন বাজার',
  'কালিবাড়ি',
  'বাংলাবাজার',
  'চর সামাইয়া',
  'আলীনগর',
  'রাজাপুর',
];

export const OLT_PON_AREA_OPTIONS = ['PON1', 'PON2', 'PON3', 'PON4'] as const;

// Bilingual locality synonym clusters so English OLT/Billing addresses match Bengali area tags
const AREA_SYNONYM_CLUSTERS: string[][] = [
  ['জাংগালিয়া', 'জাঙ্গালিয়া', 'জঙ্গালিয়া', 'zangalia', 'jangalia', 'jangaliya', 'zangaliya'],
  ['পশ্চিম ইলিশা', '৩নং পশ্চিম ইলিশা', 'পশ্চিম ইলিশা ভোলা', 'west ilisha', 'paschim ilisha', 'poschim ilisha'],
  ['পূর্ব ইলিশা', '২নং পূর্ব ইলিশা', 'purbo ilisha', 'east ilisha'],
  ['ইলিশা', 'ইলিশা ঘাট', 'ইলিশা জংশন', 'ilisha', 'elisha'],
  ['বিশ্বরোড', 'বিশ্ব রোড', 'biswaroad', 'bishwaroad', 'biswa road', 'bishwa road'],
  ['বাপ্তা', 'bapta'],
  ['ভোলা সদর', 'ভোলা', 'সদর', 'bhola sadar', 'bhola'],
  ['ধনিয়া', 'dhania', 'dhaniya', 'daniya'],
  ['ভেদুরিয়া', 'veduria', 'bheduria'],
  ['দৌলতখান', 'daulatkhan', 'doulatkhan'],
  ['বোরহানউদ্দিন', 'borhanuddin', 'burhanuddin'],
  ['খেয়াঘাট', 'kheyaghat', 'kheya ghat'],
  ['চৌমহনী', 'chowmuhani', 'choumohoni'],
  ['নতুন বাজার', 'নতুনবাজার', 'natun bazar', 'notun bazar'],
  ['কালিবাড়ি', 'kalibari'],
  ['বাংলাবাজার', 'বাংলা বাজার', 'banglabazar', 'bangla bazar'],
  ['চর সামাইয়া', 'সামাইয়া', 'char samaiya', 'samaiya'],
  ['আলীনগর', 'alinagar'],
  ['রাজাপুর', 'rajapur'],
  ['মাঝির হাট', 'majhirhat', 'majhir hat'],
  ['পরাণগঞ্জ', 'পরানগঞ্জ', 'paranganj', 'porangonj'],
];

const STOP_WORDS = new Set([
  'ভোলা',
  'সদর',
  'রোড',
  'road',
  'bazar',
  'বাজার',
  'মোড়',
  'পাড়',
  'বাড়ি',
  'বাড়ী',
  'এলাকা',
  'থানা',
  'জেলা',
  'ইউনিয়ন',
  'ওয়ার্ড',
  'ward',
  'union',
  'house',
]);

function normalizeAreaText(raw: string): string {
  return toEnglishDigits(raw || '')
    .toLowerCase()
    .replace(/[।,./\\|()[\]{}:;_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingCluster(textNorm: string, areaNorm: string): string | null {
  if (!textNorm || !areaNorm) return null;
  for (const cluster of AREA_SYNONYM_CLUSTERS) {
    const areaInCluster = cluster.some((syn) => {
      const nSyn = normalizeAreaText(syn);
      return areaNorm === nSyn || areaNorm.includes(nSyn) || nSyn.includes(areaNorm);
    });
    if (!areaInCluster) continue;
    const textHasCluster = cluster.some((syn) => textNorm.includes(normalizeAreaText(syn)));
    if (textHasCluster) {
      return cluster[0];
    }
  }
  return null;
}

function isTechnicianRole(designation?: string): boolean {
  const d = (designation || '').toLowerCase();
  return (
    d.includes('টেকনিশিয়ান') ||
    d.includes('technician') ||
    d.includes('লাইন') ||
    d.includes('line') ||
    d.includes('ফিল্ড') ||
    d.includes('field') ||
    d.includes('সহকারী') ||
    d.includes('assistant') ||
    d.includes('ইঞ্জিনিয়ার') ||
    d.includes('engineer') ||
    d.includes('সাপোর্ট') ||
    d.includes('support')
  );
}

export interface AutoAssignResult {
  staff: Staff | null;
  matchedArea: string | null;
  ponPort: string | null;
  matchType: 'area_match' | 'pon_match' | 'home_area_match' | 'workload_fallback' | 'none';
  score: number;
  openTicketCount: number;
  reasonBengali: string;
}

export function autoAssignTechnicianByLocation(params: {
  address?: string;
  oltInfo?: string;
  staffs: Staff[];
  complaints?: CustomerComplaint[];
}): AutoAssignResult {
  const { address = '', oltInfo = '', staffs, complaints = [] } = params;

  const activeStaffs = staffs.filter((s) => s.status !== 'inactive');
  if (activeStaffs.length === 0) {
    return {
      staff: null,
      matchedArea: null,
      ponPort: null,
      matchType: 'none',
      score: 0,
      openTicketCount: 0,
      reasonBengali: 'সক্রিয় কোনো টেকনিশিয়ান পাওয়া যায়নি',
    };
  }

  const combinedLocationText = normalizeAreaText(`${address} ${oltInfo}`);
  const detectedPon = oltInfo ? detectPonPort(oltInfo).ponPort : 'OTHER';
  const ponPort = detectedPon !== 'OTHER' ? detectedPon : null;

  // Compute live workload per technician (pending + in_progress complaints)
  const openLoadMap = new Map<string, number>();
  for (const c of complaints) {
    if (c.status !== 'resolved' && c.assignedStaffId) {
      openLoadMap.set(c.assignedStaffId, (openLoadMap.get(c.assignedStaffId) || 0) + 1);
    }
  }

  interface CandidateScore {
    staff: Staff;
    score: number;
    matchedArea: string | null;
    matchedPon: string | null;
    matchType: AutoAssignResult['matchType'];
    openTicketCount: number;
    isTech: boolean;
  }

  const scoredCandidates: CandidateScore[] = activeStaffs.map((staff) => {
    const openCount = openLoadMap.get(staff.id) || 0;
    const isTech = isTechnicianRole(staff.designation);
    let score = isTech ? 15 : 0;
    let matchedArea: string | null = null;
    let matchedPon: string | null = null;
    let matchType: AutoAssignResult['matchType'] = 'workload_fallback';

    // 1. Explicit configured service areas (highest priority)
    const configuredAreas = Array.isArray(staff.assignedAreas) ? staff.assignedAreas : [];
    let bestAreaPoints = 0;
    for (const rawArea of configuredAreas) {
      const areaNorm = normalizeAreaText(rawArea);
      if (!areaNorm || areaNorm.length < 2) continue;

      if (combinedLocationText.includes(areaNorm)) {
        const pts = 140 + Math.min(20, areaNorm.length);
        if (pts > bestAreaPoints) {
          bestAreaPoints = pts;
          matchedArea = rawArea.trim();
        }
        continue;
      }

      const clusterLabel = findMatchingCluster(combinedLocationText, areaNorm);
      if (clusterLabel) {
        const pts = 135;
        if (pts > bestAreaPoints) {
          bestAreaPoints = pts;
          matchedArea = rawArea.trim() || clusterLabel;
        }
        continue;
      }

      const areaTokens = areaNorm.split(' ').filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
      const matchedTokens = areaTokens.filter((tok) => combinedLocationText.includes(tok));
      if (matchedTokens.length > 0) {
        const pts = 85 + matchedTokens.length * 10;
        if (pts > bestAreaPoints) {
          bestAreaPoints = pts;
          matchedArea = rawArea.trim();
        }
      }
    }

    if (bestAreaPoints > 0) {
      score += bestAreaPoints;
      matchType = 'area_match';
    }

    // 2. OLT PON Port scope match
    const ponScopes = Array.isArray(staff.oltPonScopes)
      ? staff.oltPonScopes.map((p) => p.toUpperCase().trim())
      : [];
    if (ponPort && ponScopes.includes(ponPort.toUpperCase())) {
      score += 95;
      matchedPon = ponPort;
      if (matchType === 'workload_fallback') {
        matchType = 'pon_match';
      }
    }

    // 3. Fallback locality match from staff's residential / permanent address
    if (!matchedArea) {
      const staffHomeNorm = normalizeAreaText(`${staff.address || ''} ${staff.permanentAddress || ''}`);
      if (staffHomeNorm && combinedLocationText) {
        for (const cluster of AREA_SYNONYM_CLUSTERS) {
          const staffHas = cluster.some((syn) => staffHomeNorm.includes(normalizeAreaText(syn)));
          const ticketHas = cluster.some((syn) => combinedLocationText.includes(normalizeAreaText(syn)));
          if (staffHas && ticketHas && cluster[0] !== 'ভোলা সদর') {
            score += 45;
            matchedArea = cluster[0];
            if (matchType === 'workload_fallback') {
              matchType = 'home_area_match';
            }
            break;
          }
        }
      }
    }

    // 4. Workload penalty so equal-area techs rotate evenly
    score -= openCount * 8;

    return {
      staff,
      score,
      matchedArea,
      matchedPon,
      matchType,
      openTicketCount: openCount,
      isTech,
    };
  });

  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.openTicketCount !== b.openTicketCount) return a.openTicketCount - b.openTicketCount;
    if (a.isTech !== b.isTech) return a.isTech ? -1 : 1;
    return (a.staff.name || '').localeCompare(b.staff.name || '');
  });

  const best = scoredCandidates[0];
  let reasonBengali = '';
  if (best.matchType === 'area_match' && best.matchedArea && best.matchedPon) {
    reasonBengali = `অটো-অ্যাসাইন: এলাকা (${best.matchedArea}) ও ${best.matchedPon} জোন ম্যাচ`;
  } else if (best.matchType === 'area_match' && best.matchedArea) {
    reasonBengali = `অটো-অ্যাসাইন: এলাকা "${best.matchedArea}" অনুযায়ী`;
  } else if (best.matchType === 'pon_match' && best.matchedPon) {
    reasonBengali = `অটো-অ্যাসাইন: OLT ${best.matchedPon} পোর্ট দায়িত্ব অনুযায়ী`;
  } else if (best.matchType === 'home_area_match' && best.matchedArea) {
    reasonBengali = `অটো-অ্যাসাইন: নিকটবর্তী ঠিকানা (${best.matchedArea}) ম্যাচ`;
  } else {
    reasonBengali =
      best.openTicketCount === 0
        ? 'অটো-অ্যাসাইন: সবচেয়ে কম পেন্ডিং কাজের ভিত্তিতে'
        : 'অটো-অ্যাসাইন: চলমান কাজের ভারসাম্য অনুযায়ী';
  }

  return {
    staff: best.staff,
    matchedArea: best.matchedArea,
    ponPort: best.matchedPon || ponPort,
    matchType: best.matchType,
    score: best.score,
    openTicketCount: best.openTicketCount,
    reasonBengali,
  };
}
