import { entriesToCsv } from './csv';
import type { Entry, Job } from './models';

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'j1',
    name: 'Acme Corp',
    defaultRate: 25,
    payPeriod: null,
    archived: false,
    ...overrides,
  };
}

function entry(overrides: Partial<Entry> & Pick<Entry, 'id' | 'start'>): Entry {
  return { jobId: 'j1', end: '2024-01-15T10:00:00.000Z', rate: 25, note: '', ...overrides };
}

describe('entriesToCsv', () => {
  describe('header', () => {
    it('outputs exactly the required header as the first row', () => {
      const result = entriesToCsv([], job());
      expect(result).toBe('job,start,end,hours,rate,gross_income,note');
    });

    it('header columns are exactly job,start,end,hours,rate,gross_income,note', () => {
      const lines = entriesToCsv([], job()).split('\n');
      expect(lines[0]).toBe('job,start,end,hours,rate,gross_income,note');
    });
  });

  describe('Live Session skipped', () => {
    it('omits an Entry with null end (the Live Session)', () => {
      const live = entry({ id: 'live1', start: '2024-01-15T09:00:00.000Z', end: null });
      const result = entriesToCsv([live], job());
      const lines = result.split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('job,start,end,hours,rate,gross_income,note');
    });

    it('includes completed Entries while still skipping the Live Session', () => {
      const live = entry({ id: 'live1', start: '2024-01-15T09:00:00.000Z', end: null });
      const done = entry({
        id: 'e1',
        start: '2024-01-14T09:00:00.000Z',
        end: '2024-01-14T11:00:00.000Z',
      });
      const result = entriesToCsv([live, done], job());
      const lines = result.split('\n');
      expect(lines).toHaveLength(2);
    });
  });

  describe('numeric formatting', () => {
    it('formats hours with toFixed(2) for a 2-hour Entry', () => {
      const e = entry({
        id: 'e1',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T11:00:00.000Z',
        rate: 20,
      });
      const lines = entriesToCsv([e], job()).split('\n');
      const cols = lines[1].split(',');
      expect(cols[3]).toBe('2.00');
    });

    it('formats hours with toFixed(2) for a 1.5-hour Entry', () => {
      const e = entry({
        id: 'e1',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:30:00.000Z',
        rate: 20,
      });
      const lines = entriesToCsv([e], job()).split('\n');
      const cols = lines[1].split(',');
      expect(cols[3]).toBe('1.50');
    });

    it('formats rate with toFixed(2)', () => {
      const e = entry({
        id: 'e1',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
        rate: 22.5,
      });
      const lines = entriesToCsv([e], job()).split('\n');
      const cols = lines[1].split(',');
      expect(cols[4]).toBe('22.50');
    });

    it('formats gross_income with toFixed(2) as hours × rate', () => {
      // 2 hours at $22.50 = $45.00
      const e = entry({
        id: 'e1',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T11:00:00.000Z',
        rate: 22.5,
      });
      const lines = entriesToCsv([e], job()).split('\n');
      const cols = lines[1].split(',');
      expect(cols[5]).toBe('45.00');
    });

    it('stores start and end as the raw ISO strings from the Entry', () => {
      const e = entry({
        id: 'e1',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      const lines = entriesToCsv([e], job()).split('\n');
      const cols = lines[1].split(',');
      expect(cols[1]).toBe('2024-01-15T09:00:00.000Z');
      expect(cols[2]).toBe('2024-01-15T10:00:00.000Z');
    });
  });

  describe('RFC 4180 quoting', () => {
    it('quotes a job name containing a comma', () => {
      const j = job({ name: 'Acme, Inc' });
      const e = entry({
        id: 'e1',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      const lines = entriesToCsv([e], j).split('\n');
      expect(lines[1].startsWith('"Acme, Inc"')).toBe(true);
    });

    it('quotes a job name containing a double-quote and doubles the inner quote', () => {
      const j = job({ name: 'Acme "Co"' });
      const e = entry({
        id: 'e1',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      const lines = entriesToCsv([e], j).split('\n');
      expect(lines[1].startsWith('"Acme ""Co"""')).toBe(true);
    });

    it('quotes a note containing a comma', () => {
      const e = entry({
        id: 'e1',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
        note: 'foo, bar',
      });
      const lines = entriesToCsv([e], job()).split('\n');
      expect(lines[1].endsWith('"foo, bar"')).toBe(true);
    });

    it('quotes a note containing a double-quote and doubles the inner quote', () => {
      const e = entry({
        id: 'e1',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
        note: 'say "hi"',
      });
      const lines = entriesToCsv([e], job()).split('\n');
      expect(lines[1].endsWith('"say ""hi"""')).toBe(true);
    });

    it('quotes a note containing a newline', () => {
      const e = entry({
        id: 'e1',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
        note: 'line1\nline2',
      });
      const result = entriesToCsv([e], job());
      const lastField = result.slice(result.lastIndexOf(',') + 1);
      expect(lastField).toBe('"line1\nline2"');
    });

    it('quotes a note containing a carriage return', () => {
      const e = entry({
        id: 'e1',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
        note: 'line1\rline2',
      });
      const result = entriesToCsv([e], job());
      const lastField = result.slice(result.lastIndexOf(',') + 1);
      expect(lastField).toBe('"line1\rline2"');
    });

    it('does not quote plain fields that need no quoting', () => {
      const e = entry({
        id: 'e1',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
        note: 'simple',
      });
      const lines = entriesToCsv([e], job()).split('\n');
      expect(lines[1].endsWith(',simple')).toBe(true);
    });
  });

  describe('no trailing newline', () => {
    it('does not end with a newline when there are no data rows', () => {
      const result = entriesToCsv([], job());
      expect(result.endsWith('\n')).toBe(false);
    });

    it('does not end with a newline when there is one data row', () => {
      const e = entry({
        id: 'e1',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      const result = entriesToCsv([e], job());
      expect(result.endsWith('\n')).toBe(false);
    });

    it('does not end with a newline when there are multiple data rows', () => {
      const e1 = entry({
        id: 'e1',
        start: '2024-01-14T09:00:00.000Z',
        end: '2024-01-14T10:00:00.000Z',
      });
      const e2 = entry({
        id: 'e2',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      const result = entriesToCsv([e1, e2], job());
      expect(result.endsWith('\n')).toBe(false);
    });
  });

  describe('multiple rows', () => {
    it('produces header + one row per completed Entry', () => {
      const e1 = entry({
        id: 'e1',
        start: '2024-01-14T09:00:00.000Z',
        end: '2024-01-14T10:00:00.000Z',
      });
      const e2 = entry({
        id: 'e2',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T11:00:00.000Z',
      });
      const lines = entriesToCsv([e1, e2], job()).split('\n');
      expect(lines).toHaveLength(3);
    });

    it('rows are joined by \\n', () => {
      const e1 = entry({
        id: 'e1',
        start: '2024-01-14T09:00:00.000Z',
        end: '2024-01-14T10:00:00.000Z',
      });
      const e2 = entry({
        id: 'e2',
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      const result = entriesToCsv([e1, e2], job());
      expect((result.match(/\n/g) ?? []).length).toBe(2);
    });
  });
});
