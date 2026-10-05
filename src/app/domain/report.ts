import type { DateRange, Entry, Job, ReportFilter, ReportTotals } from './models';
import { periodContaining, previousPeriod } from './pay-period';
import { durationMs } from './time';

/**
 * Resolve a Report Filter to a half-open [start, end) range in epoch ms.
 * Pay-period filters return null when the Job has no Pay Period configured.
 */
export function resolveRange(filter: ReportFilter, job: Job, now: number): DateRange | null {
  switch (filter.kind) {
    case 'thisWeek': {
      const t = new Date(now);
      const daysSinceMonday = (t.getDay() + 6) % 7;
      const monday = new Date(t);
      monday.setDate(t.getDate() - daysSinceMonday);
      monday.setHours(0, 0, 0, 0);
      const nextMonday = new Date(monday);
      nextMonday.setDate(monday.getDate() + 7);
      return { start: monday.getTime(), end: nextMonday.getTime() };
    }
    case 'thisMonth': {
      const t = new Date(now);
      const start = new Date(t.getFullYear(), t.getMonth(), 1, 0, 0, 0, 0).getTime();
      const end = new Date(t.getFullYear(), t.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
      return { start, end };
    }
    case 'allTime':
      return { start: null, end: null };
    case 'custom': {
      const from = parseLocalDate(filter.from);
      const to = parseLocalDate(filter.to);
      if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;
      return { start: from, end: to + 86_400_000 }; // day after `to`, 00:00 local — inclusive end boundary
    }
    case 'currentPayPeriod':
      return job.payPeriod === null ? null : periodContaining(job.payPeriod, now);
    case 'pastPayPeriod':
      return job.payPeriod === null ? null : previousPeriod(job.payPeriod, now);
  }
}

/** Parse a `yyyy-mm-dd` string as local midnight; NaN for malformed input. */
function parseLocalDate(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

/**
 * Entries for `jobId` whose start falls in the half-open range [start, end).
 * Null bounds are unbounded. Includes the Live Session. Sorted by start descending.
 */
export function entriesInRange(entries: Entry[], jobId: string, range: DateRange): Entry[] {
  return entries
    .filter((e) => e.jobId === jobId)
    .filter((e) => {
      const s = Date.parse(e.start);
      if (range.start !== null && s < range.start) return false;
      if (range.end !== null && s >= range.end) return false;
      return true;
    })
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
}

/**
 * Totals over completed Entries only (the Live Session, end == null, is excluded).
 * hours = sum of durations / 3.6e6; grossIncome = sum of hours_i × rate_i. Unrounded.
 */
export function computeTotals(entries: Entry[]): ReportTotals {
  let hours = 0;
  let grossIncome = 0;
  for (const e of entries) {
    if (e.end === null) continue;
    const hours_i = durationMs(e) / 3_600_000;
    hours += hours_i;
    grossIncome += hours_i * e.rate;
  }
  return { hours, grossIncome };
}

/**
 * Decide which Job the report defaults to:
 *  1. the job of the Live Session;
 *  2. the stored id, when it matches an existing Job;
 *  3. the job of the Entry with the latest start;
 *  4. the first non-archived Job;
 *  5. null.
 */
export function defaultReportJobId(
  jobs: Job[],
  entries: Entry[],
  stored: string | null,
): string | null {
  const live = entries.find((e) => e.end === null);
  if (live !== undefined) return live.jobId;

  if (stored !== null && jobs.some((j) => j.id === stored)) return stored;

  if (entries.length > 0) {
    let latest = entries[0];
    for (const e of entries) {
      if (Date.parse(e.start) > Date.parse(latest.start)) latest = e;
    }
    return latest.jobId;
  }

  const first = jobs.find((j) => !j.archived);
  return first !== undefined ? first.id : null;
}
