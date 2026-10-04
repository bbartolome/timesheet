import { resolveRange, entriesInRange, computeTotals, defaultReportJobId } from './report';
import type { Entry, Job } from './models';

function entry(overrides: Pick<Entry, 'id' | 'jobId' | 'start'> & Partial<Entry>): Entry {
  return { end: null, rate: 20, note: '', ...overrides };
}

function job(overrides: Pick<Job, 'id'> & Partial<Job>): Job {
  return { name: 'Job', defaultRate: 20, payPeriod: null, archived: false, ...overrides };
}

// ─── resolveRange ────────────────────────────────────────────────────────────

describe('resolveRange', () => {
  // Wednesday Jan 10 2024 12:00:00 local — a mid-week anchor for deterministic tests
  const NOW = new Date(2024, 0, 10, 12, 0, 0).getTime();
  const j = job({ id: 'j1' });

  describe('thisWeek', () => {
    it('returns local Monday 00:00 .. next Monday 00:00 when now is mid-week', () => {
      const range = resolveRange({ kind: 'thisWeek' }, j, NOW);
      expect(range?.start).toBe(new Date(2024, 0, 8, 0, 0, 0).getTime()); // Mon Jan 8
      expect(range?.end).toBe(new Date(2024, 0, 15, 0, 0, 0).getTime()); // Mon Jan 15
    });

    it('uses the same Monday when now is Monday', () => {
      const monday = new Date(2024, 0, 8, 12, 0, 0).getTime();
      const range = resolveRange({ kind: 'thisWeek' }, j, monday);
      expect(range?.start).toBe(new Date(2024, 0, 8, 0, 0, 0).getTime());
      expect(range?.end).toBe(new Date(2024, 0, 15, 0, 0, 0).getTime());
    });

    it('assigns Sunday to the previous Mon–Sun week (Monday week start)', () => {
      // Jan 14 2024 is a Sunday — belongs to the week starting Jan 8
      const sunday = new Date(2024, 0, 14, 12, 0, 0).getTime();
      const range = resolveRange({ kind: 'thisWeek' }, j, sunday);
      expect(range?.start).toBe(new Date(2024, 0, 8, 0, 0, 0).getTime());
      expect(range?.end).toBe(new Date(2024, 0, 15, 0, 0, 0).getTime());
    });
  });

  describe('thisMonth', () => {
    it('returns 1st 00:00 .. next 1st 00:00 in local time', () => {
      const range = resolveRange({ kind: 'thisMonth' }, j, NOW);
      expect(range?.start).toBe(new Date(2024, 0, 1, 0, 0, 0).getTime());
      expect(range?.end).toBe(new Date(2024, 1, 1, 0, 0, 0).getTime());
    });
  });

  describe('allTime', () => {
    it('returns {start: null, end: null}', () => {
      expect(resolveRange({ kind: 'allTime' }, j, NOW)).toEqual({ start: null, end: null });
    });
  });

  describe('custom', () => {
    it('returns from 00:00 local .. day-after-to 00:00 local', () => {
      const range = resolveRange({ kind: 'custom', from: '2024-01-10', to: '2024-01-12' }, j, NOW);
      expect(range?.start).toBe(new Date(2024, 0, 10, 0, 0, 0).getTime());
      expect(range?.end).toBe(new Date(2024, 0, 13, 0, 0, 0).getTime()); // day after to
    });

    it('single-day range (from == to) spans exactly one day', () => {
      const range = resolveRange({ kind: 'custom', from: '2024-01-10', to: '2024-01-10' }, j, NOW);
      expect(range?.start).toBe(new Date(2024, 0, 10, 0, 0, 0).getTime());
      expect(range?.end).toBe(new Date(2024, 0, 11, 0, 0, 0).getTime());
    });

    it('returns null when from is empty', () => {
      expect(resolveRange({ kind: 'custom', from: '', to: '2024-01-12' }, j, NOW)).toBeNull();
    });

    it('returns null when to is empty', () => {
      expect(resolveRange({ kind: 'custom', from: '2024-01-10', to: '' }, j, NOW)).toBeNull();
    });

    it('returns null when from is not a valid yyyy-mm-dd', () => {
      expect(resolveRange({ kind: 'custom', from: 'not-a-date', to: '2024-01-12' }, j, NOW)).toBeNull();
    });

    it('returns null when to is not a valid yyyy-mm-dd', () => {
      expect(resolveRange({ kind: 'custom', from: '2024-01-10', to: '2024/01/12' }, j, NOW)).toBeNull();
    });

    it('returns null when to is before from', () => {
      expect(resolveRange({ kind: 'custom', from: '2024-01-12', to: '2024-01-10' }, j, NOW)).toBeNull();
    });
  });

  describe('currentPayPeriod', () => {
    // Weekly Pay Period anchored Mon Jan 8 2024 09:00 local
    const jWeekly = job({
      id: 'j1',
      payPeriod: { anchor: new Date(2024, 0, 8, 9, 0, 0).toISOString(), frequency: 'Weekly' },
    });

    it('returns the period containing now', () => {
      // now = Wed Jan 10 → period [Jan 8 09:00, Jan 15 09:00)
      const range = resolveRange({ kind: 'currentPayPeriod' }, jWeekly, NOW);
      expect(range?.start).toBe(new Date(2024, 0, 8, 9, 0, 0).getTime());
      expect(range?.end).toBe(new Date(2024, 0, 15, 9, 0, 0).getTime());
    });

    it('returns null when the Job has no Pay Period', () => {
      expect(resolveRange({ kind: 'currentPayPeriod' }, j, NOW)).toBeNull();
    });
  });

  describe('pastPayPeriod', () => {
    const jWeekly = job({
      id: 'j1',
      payPeriod: { anchor: new Date(2024, 0, 8, 9, 0, 0).toISOString(), frequency: 'Weekly' },
    });

    it('returns the period one cycle before the current period', () => {
      // now = Wed Jan 10 → current [Jan 8, Jan 15) → past [Jan 1, Jan 8)
      const range = resolveRange({ kind: 'pastPayPeriod' }, jWeekly, NOW);
      expect(range?.start).toBe(new Date(2024, 0, 1, 9, 0, 0).getTime());
      expect(range?.end).toBe(new Date(2024, 0, 8, 9, 0, 0).getTime());
    });

    it('returns null when the Job has no Pay Period', () => {
      expect(resolveRange({ kind: 'pastPayPeriod' }, j, NOW)).toBeNull();
    });
  });
});

// ─── entriesInRange ──────────────────────────────────────────────────────────

describe('entriesInRange', () => {
  const START_MS = new Date(2024, 0, 10, 0, 0, 0).getTime();
  const END_MS = new Date(2024, 0, 12, 0, 0, 0).getTime();
  const RANGE = { start: START_MS, end: END_MS };

  const e1 = entry({
    id: 'e1',
    jobId: 'j1',
    start: new Date(2024, 0, 10, 9, 0, 0).toISOString(),
    end: new Date(2024, 0, 10, 11, 0, 0).toISOString(),
  });
  const e2 = entry({
    id: 'e2',
    jobId: 'j1',
    start: new Date(2024, 0, 11, 9, 0, 0).toISOString(),
    end: new Date(2024, 0, 11, 11, 0, 0).toISOString(),
  });
  const e3 = entry({
    id: 'e3',
    jobId: 'j2', // different Job
    start: new Date(2024, 0, 10, 9, 0, 0).toISOString(),
    end: new Date(2024, 0, 10, 11, 0, 0).toISOString(),
  });
  // Live Session within range
  const live = entry({
    id: 'live',
    jobId: 'j1',
    start: new Date(2024, 0, 11, 15, 0, 0).toISOString(),
  });

  it('excludes entries from a different Job', () => {
    const result = entriesInRange([e1, e2, e3, live], 'j1', RANGE);
    expect(result.every((e) => e.jobId === 'j1')).toBe(true);
    expect(result.find((e) => e.id === 'e3')).toBeUndefined();
  });

  it('sorts results by start descending', () => {
    const result = entriesInRange([e1, e2, live], 'j1', RANGE);
    expect(result[0].id).toBe('live');
    expect(result[1].id).toBe('e2');
    expect(result[2].id).toBe('e1');
  });

  it('includes an entry whose start is exactly at range.start (half-open [start,end))', () => {
    const atStart = entry({
      id: 'atStart',
      jobId: 'j1',
      start: new Date(START_MS).toISOString(),
      end: new Date(START_MS + 3_600_000).toISOString(),
    });
    expect(entriesInRange([atStart], 'j1', RANGE).find((e) => e.id === 'atStart')).toBeDefined();
  });

  it('excludes an entry whose start is exactly at range.end (half-open [start,end))', () => {
    const atEnd = entry({
      id: 'atEnd',
      jobId: 'j1',
      start: new Date(END_MS).toISOString(),
      end: new Date(END_MS + 3_600_000).toISOString(),
    });
    expect(entriesInRange([atEnd], 'j1', RANGE)).toHaveLength(0);
  });

  it('excludes an entry whose start is before range.start', () => {
    const before = entry({
      id: 'before',
      jobId: 'j1',
      start: new Date(2024, 0, 9, 9, 0, 0).toISOString(),
      end: new Date(2024, 0, 9, 11, 0, 0).toISOString(),
    });
    expect(entriesInRange([before], 'j1', RANGE)).toHaveLength(0);
  });

  it('includes the Live Session when its start falls within range', () => {
    const result = entriesInRange([live], 'j1', RANGE);
    expect(result.find((e) => e.id === 'live')).toBeDefined();
  });

  it('excludes the Live Session when its start is outside range', () => {
    const liveOutside = entry({
      id: 'liveOut',
      jobId: 'j1',
      start: new Date(2024, 0, 9, 9, 0, 0).toISOString(),
    });
    expect(entriesInRange([liveOutside], 'j1', RANGE)).toHaveLength(0);
  });

  it('returns all matching entries for an unbounded range {start:null, end:null}', () => {
    const allTime = { start: null, end: null };
    const result = entriesInRange([e1, e2, e3, live], 'j1', allTime);
    expect(result.map((e) => e.id).sort()).toEqual(['e1', 'e2', 'live'].sort());
  });
});

// ─── computeTotals ───────────────────────────────────────────────────────────

describe('computeTotals', () => {
  it('returns {hours:0, grossIncome:0} for an empty array', () => {
    expect(computeTotals([])).toEqual({ hours: 0, grossIncome: 0 });
  });

  it('computes hours as sum(ms) / 3.6e6', () => {
    const e = entry({
      id: 'e1',
      jobId: 'j1',
      start: '2024-01-10T09:00:00.000Z',
      end: '2024-01-10T11:00:00.000Z', // 7_200_000 ms = 2h
      rate: 20,
    });
    expect(computeTotals([e]).hours).toBe(2);
  });

  it('computes Gross Income as hours × Entry Rate', () => {
    const e = entry({
      id: 'e1',
      jobId: 'j1',
      start: '2024-01-10T09:00:00.000Z',
      end: '2024-01-10T10:30:00.000Z', // 5_400_000 ms = 1.5h
      rate: 20,
    });
    expect(computeTotals([e]).grossIncome).toBe(30); // 1.5 × 20
  });

  it('uses per-Entry Rate when entries have different rates', () => {
    const eA = entry({
      id: 'eA',
      jobId: 'j1',
      start: '2024-01-10T09:00:00.000Z',
      end: '2024-01-10T11:00:00.000Z', // 2h
      rate: 10,
    });
    const eB = entry({
      id: 'eB',
      jobId: 'j1',
      start: '2024-01-11T09:00:00.000Z',
      end: '2024-01-11T10:00:00.000Z', // 1h
      rate: 15,
    });
    const totals = computeTotals([eA, eB]);
    expect(totals.hours).toBe(3);
    expect(totals.grossIncome).toBe(35); // 2×10 + 1×15
  });

  it('excludes the Live Session (end == null) from totals', () => {
    const live = entry({ id: 'live', jobId: 'j1', start: '2024-01-10T09:00:00.000Z' });
    const completed = entry({
      id: 'e1',
      jobId: 'j1',
      start: '2024-01-10T09:00:00.000Z',
      end: '2024-01-10T11:00:00.000Z', // 2h at rate 20
      rate: 20,
    });
    const totals = computeTotals([live, completed]);
    expect(totals.hours).toBe(2);
    expect(totals.grossIncome).toBe(40);
  });

  it('returns zero totals when only the Live Session is present', () => {
    const live = entry({ id: 'live', jobId: 'j1', start: '2024-01-10T09:00:00.000Z' });
    expect(computeTotals([live])).toEqual({ hours: 0, grossIncome: 0 });
  });

  it('does not round: preserves fractional hours and income', () => {
    // 1h 10min = 4_200_000ms → hours = 7/6, income = 7/6 × 10 ≈ 11.666...
    const e = entry({
      id: 'e1',
      jobId: 'j1',
      start: '2024-01-10T09:00:00.000Z',
      end: '2024-01-10T10:10:00.000Z', // 4_200_000 ms
      rate: 10,
    });
    const { hours, grossIncome } = computeTotals([e]);
    expect(hours).toBe(4_200_000 / 3.6e6);
    expect(grossIncome).toBe((4_200_000 / 3.6e6) * 10);
  });
});

// ─── defaultReportJobId ──────────────────────────────────────────────────────

describe('defaultReportJobId', () => {
  const j1 = job({ id: 'j1', archived: false });
  const j2 = job({ id: 'j2', archived: false });
  const jArchived = job({ id: 'ja', archived: true });

  it('returns stored when it matches an existing job id', () => {
    expect(defaultReportJobId([j1, j2], [], 'j1')).toBe('j1');
  });

  it('returns stored even when the matched job is archived', () => {
    expect(defaultReportJobId([j1, jArchived], [], 'ja')).toBe('ja');
  });

  it('returns the Live Session jobId when stored does not match any job', () => {
    const live = entry({ id: 'live', jobId: 'j2', start: '2024-01-10T09:00:00.000Z' });
    expect(defaultReportJobId([j1, j2], [live], 'invalid')).toBe('j2');
  });

  it('returns the Live Session jobId when stored is null', () => {
    const live = entry({ id: 'live', jobId: 'j2', start: '2024-01-10T09:00:00.000Z' });
    expect(defaultReportJobId([j1, j2], [live], null)).toBe('j2');
  });

  it('returns Live Session jobId even when stored matches a job id (Live Session has highest precedence)', () => {
    const live = entry({ id: 'live', jobId: 'j2', start: '2024-01-10T09:00:00.000Z' });
    // stored matches j1, but Live Session is on j2 — Live Session wins
    expect(defaultReportJobId([j1, j2], [live], 'j1')).toBe('j2');
  });

  it('prefers the Live Session over the entry with the latest start', () => {
    // Live Session starts earlier, but it still takes precedence over the latest completed entry
    const live = entry({ id: 'live', jobId: 'j2', start: '2024-01-10T08:00:00.000Z' });
    const latestCompleted = entry({
      id: 'e1',
      jobId: 'j1',
      start: '2024-01-11T09:00:00.000Z',
      end: '2024-01-11T11:00:00.000Z',
    });
    expect(defaultReportJobId([j1, j2], [live, latestCompleted], null)).toBe('j2');
  });

  it('returns jobId of the entry with the latest start when no stored and no Live Session', () => {
    const older = entry({
      id: 'e1',
      jobId: 'j1',
      start: '2024-01-09T09:00:00.000Z',
      end: '2024-01-09T11:00:00.000Z',
    });
    const newer = entry({
      id: 'e2',
      jobId: 'j2',
      start: '2024-01-10T09:00:00.000Z',
      end: '2024-01-10T11:00:00.000Z',
    });
    expect(defaultReportJobId([j1, j2], [older, newer], null)).toBe('j2');
  });

  it('falls back to first non-archived job when there are no entries and stored is null', () => {
    // jArchived is first in the array but should be skipped
    expect(defaultReportJobId([jArchived, j1, j2], [], null)).toBe('j1');
  });

  it('falls back to first non-archived job when stored does not match and there are no entries', () => {
    expect(defaultReportJobId([j1, j2], [], 'invalid')).toBe('j1');
  });

  it('returns null when all jobs are archived and there are no entries', () => {
    expect(defaultReportJobId([jArchived], [], null)).toBeNull();
  });

  it('returns null when there are no jobs', () => {
    expect(defaultReportJobId([], [], null)).toBeNull();
  });
});
