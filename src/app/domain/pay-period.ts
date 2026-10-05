import type { DateRange, PayFrequency, PayPeriod } from './models';

const DAY_MS = 86_400_000;

/** Local calendar day as UTC midnight, so day math ignores timezone offset. */
function localDay(t: Date): number {
  return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
}

function monthIndex(t: Date): number {
  return t.getFullYear() * 12 + t.getMonth();
}

function spanDays(frequency: PayFrequency): number {
  return frequency === 'Weekly' ? 7 : 14;
}

/**
 * Cycle index k such that the candidate period starts at advance(anchor, k):
 * floor of calendar-day difference for Weekly/Biweekly;
 * floor of month difference for Monthly (day comparison refined by the caller).
 */
function baseK(pp: PayPeriod, at: number): number {
  const anchor = new Date(pp.anchor);
  const t = new Date(at);
  if (pp.frequency === 'Monthly') {
    return monthIndex(t) - monthIndex(anchor);
  }
  const diffDays = Math.round((localDay(t) - localDay(anchor)) / DAY_MS);
  return Math.floor(diffDays / spanDays(pp.frequency));
}

/**
 * Anchor shifted by k cycles in local time, keeping the anchor's time of day.
 * Weekly/Biweekly: k * 7 (or 14) local calendar days.
 * Monthly: k calendar months; a day that overflows the target month clamps to its last day.
 * Valid for negative k (before the anchor) as well.
 */
function advance(pp: PayPeriod, k: number): number {
  if (k === 0) return new Date(pp.anchor).getTime();
  const d = new Date(pp.anchor);
  if (pp.frequency === 'Monthly') {
    const day = d.getDate();
    d.setMonth(d.getMonth() + k);
    if (d.getDate() !== day) d.setDate(0); // overflowed month end → last day of target month
  } else {
    d.setDate(d.getDate() + spanDays(pp.frequency) * k);
  }
  return d.getTime();
}

/** Cycle index of the period [advance(k), advance(k+1)) that contains `at` (boundaries assign to the new period). */
function containingK(pp: PayPeriod, at: number): number {
  let k = baseK(pp, at);
  while (at < advance(pp, k)) k--;
  return k;
}

/** The period [start, end) containing `at`; both bounds non-null. */
export function periodContaining(pp: PayPeriod, at: number): DateRange {
  const k = containingK(pp, at);
  return { start: advance(pp, k), end: advance(pp, k + 1) };
}

/** Exactly one cycle before periodContaining(pp, at). */
export function previousPeriod(pp: PayPeriod, at: number): DateRange {
  const k = containingK(pp, at);
  return { start: advance(pp, k - 1), end: advance(pp, k) };
}
