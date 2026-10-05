import {
  durationMs,
  findOverlaps,
  formatElapsed,
  formatHours,
  formatMoney,
  newId,
  overlaps,
} from './time';
import type { Entry } from './models';

function entry(overrides: Pick<Entry, 'id' | 'jobId' | 'start'> & Partial<Entry>): Entry {
  return { end: null, rate: 20, note: '', ...overrides };
}

describe('durationMs', () => {
  it('returns end minus start for a completed Entry', () => {
    const e = entry({
      id: '1',
      jobId: 'j1',
      start: '2024-01-15T09:00:00.000Z',
      end: '2024-01-15T10:30:00.000Z',
    });
    expect(durationMs(e)).toBe(5_400_000);
  });

  it('uses explicit now for the Live Session (end null)', () => {
    const e = entry({ id: '1', jobId: 'j1', start: '2024-01-15T09:00:00.000Z' });
    const now = new Date('2024-01-15T11:00:00.000Z').getTime();
    expect(durationMs(e, now)).toBe(7_200_000);
  });

  it('handles midnight-crossing Entries', () => {
    const e = entry({
      id: '1',
      jobId: 'j1',
      start: '2024-01-15T23:00:00.000Z',
      end: '2024-01-16T02:00:00.000Z',
    });
    expect(durationMs(e)).toBe(10_800_000);
  });

  it('never returns a negative duration when start equals end', () => {
    const e = entry({
      id: '1',
      jobId: 'j1',
      start: '2024-01-15T09:00:00.000Z',
      end: '2024-01-15T09:00:00.000Z',
    });
    expect(durationMs(e)).toBeGreaterThanOrEqual(0);
  });
});

describe('formatElapsed', () => {
  it('formats 309000ms as 0:05:09 (spec example)', () => {
    expect(formatElapsed(309_000)).toBe('0:05:09');
  });

  it('formats 97200000ms as 27:00:00 (spec example — hours unbounded)', () => {
    expect(formatElapsed(97_200_000)).toBe('27:00:00');
  });

  it('formats 0ms as 0:00:00', () => {
    expect(formatElapsed(0)).toBe('0:00:00');
  });

  it('pads minutes and seconds to two digits', () => {
    expect(formatElapsed(3_661_000)).toBe('1:01:01');
  });

  it('formats exactly one hour as 1:00:00', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
  });
});

describe('formatHours', () => {
  it('formats 5400000ms as 1.50 (spec example)', () => {
    expect(formatHours(5_400_000)).toBe('1.50');
  });

  it('formats 0ms as 0.00', () => {
    expect(formatHours(0)).toBe('0.00');
  });

  it('formats exactly one hour as 1.00', () => {
    expect(formatHours(3_600_000)).toBe('1.00');
  });

  it('formats two hours as 2.00', () => {
    expect(formatHours(7_200_000)).toBe('2.00');
  });
});

describe('formatMoney', () => {
  it('formats 123.4 as 123.40 (spec example)', () => {
    expect(formatMoney(123.4)).toBe('123.40');
  });

  it('formats 0 as 0.00', () => {
    expect(formatMoney(0)).toBe('0.00');
  });

  it('formats a whole number with .00 suffix', () => {
    expect(formatMoney(50)).toBe('50.00');
  });

  it('leaves already-two-decimal values unchanged', () => {
    expect(formatMoney(99.99)).toBe('99.99');
  });
});

describe('overlaps', () => {
  const NOW = new Date('2024-01-15T15:00:00.000Z').getTime();

  it('returns true when same jobId and intervals intersect', () => {
    const a = entry({
      id: '1',
      jobId: 'j1',
      start: '2024-01-15T09:00:00.000Z',
      end: '2024-01-15T11:00:00.000Z',
    });
    const b = entry({
      id: '2',
      jobId: 'j1',
      start: '2024-01-15T10:00:00.000Z',
      end: '2024-01-15T12:00:00.000Z',
    });
    expect(overlaps(a, b, NOW)).toBe(true);
  });

  it('returns false when same jobId but endpoints only touch (a.end == b.start)', () => {
    const a = entry({
      id: '1',
      jobId: 'j1',
      start: '2024-01-15T09:00:00.000Z',
      end: '2024-01-15T10:00:00.000Z',
    });
    const b = entry({
      id: '2',
      jobId: 'j1',
      start: '2024-01-15T10:00:00.000Z',
      end: '2024-01-15T11:00:00.000Z',
    });
    expect(overlaps(a, b, NOW)).toBe(false);
  });

  it('returns false for Entries on different Jobs', () => {
    const a = entry({
      id: '1',
      jobId: 'j1',
      start: '2024-01-15T09:00:00.000Z',
      end: '2024-01-15T11:00:00.000Z',
    });
    const b = entry({
      id: '2',
      jobId: 'j2',
      start: '2024-01-15T10:00:00.000Z',
      end: '2024-01-15T12:00:00.000Z',
    });
    expect(overlaps(a, b, NOW)).toBe(false);
  });

  it('returns false for self-comparison (same id)', () => {
    const a = entry({
      id: '1',
      jobId: 'j1',
      start: '2024-01-15T09:00:00.000Z',
      end: '2024-01-15T11:00:00.000Z',
    });
    expect(overlaps(a, a, NOW)).toBe(false);
  });

  it('uses explicit now for a Live Session end (null) and detects overlap', () => {
    const liveNow = new Date('2024-01-15T11:00:00.000Z').getTime();
    const live = entry({ id: '1', jobId: 'j1', start: '2024-01-15T10:00:00.000Z' });
    const b = entry({
      id: '2',
      jobId: 'j1',
      start: '2024-01-15T10:30:00.000Z',
      end: '2024-01-15T12:00:00.000Z',
    });
    expect(overlaps(live, b, liveNow)).toBe(true);
  });

  it("returns false when Live Session starts exactly at another Entry's end (touching)", () => {
    const liveNow = new Date('2024-01-15T13:00:00.000Z').getTime();
    const live = entry({ id: '1', jobId: 'j1', start: '2024-01-15T11:00:00.000Z' });
    const b = entry({
      id: '2',
      jobId: 'j1',
      start: '2024-01-15T10:00:00.000Z',
      end: '2024-01-15T11:00:00.000Z',
    });
    expect(overlaps(live, b, liveNow)).toBe(false);
  });

  it('detects overlap in midnight-crossing Entries', () => {
    const a = entry({
      id: '1',
      jobId: 'j1',
      start: '2024-01-15T23:00:00.000Z',
      end: '2024-01-16T02:00:00.000Z',
    });
    const b = entry({
      id: '2',
      jobId: 'j1',
      start: '2024-01-16T01:00:00.000Z',
      end: '2024-01-16T03:00:00.000Z',
    });
    expect(overlaps(a, b, NOW)).toBe(true);
  });
});

describe('findOverlaps', () => {
  const NOW = new Date('2024-01-15T15:00:00.000Z').getTime();

  it('returns only Entries of the same Job that strictly overlap the target', () => {
    const target = entry({
      id: '1',
      jobId: 'j1',
      start: '2024-01-15T09:00:00.000Z',
      end: '2024-01-15T11:00:00.000Z',
    });
    const overlapping = entry({
      id: '2',
      jobId: 'j1',
      start: '2024-01-15T10:00:00.000Z',
      end: '2024-01-15T12:00:00.000Z',
    });
    const touching = entry({
      id: '3',
      jobId: 'j1',
      start: '2024-01-15T11:00:00.000Z',
      end: '2024-01-15T13:00:00.000Z',
    });
    const diffJob = entry({
      id: '4',
      jobId: 'j2',
      start: '2024-01-15T10:00:00.000Z',
      end: '2024-01-15T11:30:00.000Z',
    });

    const result = findOverlaps(target, [target, overlapping, touching, diffJob], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('excludes self from results', () => {
    const target = entry({
      id: '1',
      jobId: 'j1',
      start: '2024-01-15T09:00:00.000Z',
      end: '2024-01-15T11:00:00.000Z',
    });
    expect(findOverlaps(target, [target], NOW)).toHaveLength(0);
  });

  it('returns an empty array when no Entries overlap', () => {
    const target = entry({
      id: '1',
      jobId: 'j1',
      start: '2024-01-15T09:00:00.000Z',
      end: '2024-01-15T10:00:00.000Z',
    });
    const after = entry({
      id: '2',
      jobId: 'j1',
      start: '2024-01-15T10:00:00.000Z',
      end: '2024-01-15T11:00:00.000Z',
    });
    expect(findOverlaps(target, [target, after], NOW)).toHaveLength(0);
  });

  it('includes a Live Session when it overlaps the target', () => {
    const liveNow = new Date('2024-01-15T12:00:00.000Z').getTime();
    const live = entry({ id: '1', jobId: 'j1', start: '2024-01-15T11:00:00.000Z' });
    const completed = entry({
      id: '2',
      jobId: 'j1',
      start: '2024-01-15T10:00:00.000Z',
      end: '2024-01-15T11:30:00.000Z',
    });
    const result = findOverlaps(live, [live, completed], liveNow);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });
});

describe('newId', () => {
  it('returns a non-empty string', () => {
    const id = newId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns a unique value on each call', () => {
    expect(newId()).not.toBe(newId());
  });

  it('output matches the UUID v4 format', () => {
    const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(newId()).toMatch(UUID_V4);
  });

  describe('when crypto.randomUUID is unavailable', () => {
    let originalRandomUUID: typeof crypto.randomUUID;

    beforeEach(() => {
      originalRandomUUID = crypto.randomUUID;
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: undefined,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: originalRandomUUID,
        configurable: true,
      });
    });

    it('still returns a UUID v4', () => {
      const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      expect(newId()).toMatch(UUID_V4);
    });

    it('does not throw', () => {
      expect(() => newId()).not.toThrow();
    });

    it('two calls return different values', () => {
      expect(newId()).not.toBe(newId());
    });
  });
});
