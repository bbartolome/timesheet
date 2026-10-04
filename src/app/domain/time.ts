import type { Entry } from './models';

/**
 * Compute the duration of an Entry in milliseconds.
 * For a Live Session (end is null) the given `now` is used as the end time.
 * Never returns a negative value.
 */
export function durationMs(e: Entry, now: number = Date.now()): number {
  const endMs = e.end !== null ? Date.parse(e.end) : now;
  const startMs = Date.parse(e.start);
  return Math.max(0, endMs - startMs);
}

/**
 * Format a millisecond duration as `H:MM:SS` with unbounded hours.
 * Minutes and seconds are always zero-padded to two digits.
 * Examples: 309000 → '0:05:09', 97200000 → '27:00:00'
 */
export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format a millisecond duration as decimal hours with two decimal places.
 * Examples: 5400000 → '1.50', 0 → '0.00'
 */
export function formatHours(ms: number): string {
  return (ms / 3_600_000).toFixed(2);
}

/**
 * Format a number as a fixed two-decimal string with no currency symbol.
 * Examples: 123.4 → '123.40', 50 → '50.00'
 */
export function formatMoney(n: number): string {
  return n.toFixed(2);
}

/**
 * Resolve the epoch-ms end time of an Entry, substituting `now` for Live Sessions.
 */
function resolveEnd(e: Entry, now: number): number {
  return e.end !== null ? Date.parse(e.end) : now;
}

/**
 * Return true when two Entries strictly overlap:
 *  - they share the same jobId,
 *  - their ids differ (not the same Entry),
 *  - their intervals intersect at more than a single point.
 *
 * Entry intervals are [start, end) where a null end is resolved to `now`.
 * Touching endpoints (a.end == b.start or vice versa) do NOT count as overlap.
 */
export function overlaps(a: Entry, b: Entry, now: number = Date.now()): boolean {
  if (a.id === b.id || a.jobId !== b.jobId) return false;

  const aStart = Date.parse(a.start);
  const aEnd = resolveEnd(a, now);
  const bStart = Date.parse(b.start);
  const bEnd = resolveEnd(b, now);

  // Strict intersection: neither interval's end is ≤ the other's start.
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Return all Entries in `all` that strictly overlap `e` (excluding `e` itself,
 * and ignoring Entries on different Jobs).
 */
export function findOverlaps(e: Entry, all: Entry[], now: number = Date.now()): Entry[] {
  return all.filter((other) => overlaps(e, other, now));
}

/**
 * Generate a new unique identifier.
 */
export function newId(): string {
  return crypto.randomUUID();
}
