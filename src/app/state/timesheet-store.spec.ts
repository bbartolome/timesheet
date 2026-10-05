import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TimesheetStore } from './timesheet-store';
import { STORAGE_KEY, SCHEMA_VERSION } from '../domain/models';
import type { TimesheetData } from '../domain/models';
import { emptyData } from '../domain/data-io';

const CORRUPT_KEY = 'timesheet.data.corrupt';

function freshStore(): TimesheetStore {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  return TestBed.inject(TimesheetStore);
}

describe('TimesheetStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  describe('initial state', () => {
    it('starts with emptyData when localStorage has no entry', () => {
      const store = freshStore();
      expect(store.data()).toEqual(emptyData());
    });

    it('falls back to emptyData when localStorage contains corrupt JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-valid-json');
      const store = freshStore();
      expect(store.data()).toEqual(emptyData());
    });

    it('falls back to emptyData when localStorage contains a structurally invalid document', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ corrupt: true }));
      const store = freshStore();
      expect(store.data()).toEqual(emptyData());
    });
  });

  describe('loadError signal and corrupt backup', () => {
    it('loadError is null when localStorage has no entry', () => {
      const store = freshStore();
      expect(store.loadError()).toBeNull();
    });

    it('loadError is null when localStorage has valid data', () => {
      const store1 = freshStore();
      store1.addJob('Acme', 25);
      TestBed.resetTestingModule();
      const store2 = freshStore();
      expect(store2.loadError()).toBeNull();
    });

    it('loadError is set to a non-null string when localStorage contains corrupt JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-valid-json');
      const store = freshStore();
      expect(store.loadError()).not.toBeNull();
      expect(typeof store.loadError()).toBe('string');
    });

    it('loadError is set when localStorage contains a structurally invalid document', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ corrupt: true }));
      const store = freshStore();
      expect(store.loadError()).not.toBeNull();
    });

    it('copies corrupt data to timesheet.data.corrupt when that key is empty', () => {
      localStorage.setItem(STORAGE_KEY, 'not-valid-json');
      freshStore();
      expect(localStorage.getItem(CORRUPT_KEY)).toBe('not-valid-json');
    });

    it('does not overwrite timesheet.data.corrupt when it already contains data', () => {
      localStorage.setItem(STORAGE_KEY, 'second-corrupt');
      localStorage.setItem(CORRUPT_KEY, 'first-corrupt');
      freshStore();
      expect(localStorage.getItem(CORRUPT_KEY)).toBe('first-corrupt');
    });

    it('does not overwrite STORAGE_KEY before the first mutation', () => {
      localStorage.setItem(STORAGE_KEY, 'corrupt-payload');
      freshStore();
      expect(localStorage.getItem(STORAGE_KEY)).toBe('corrupt-payload');
    });

    it('writes valid data to STORAGE_KEY after the first mutation following a corrupt load', () => {
      localStorage.setItem(STORAGE_KEY, 'corrupt-payload');
      const store = freshStore();
      store.addJob('Recovered', 40);
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.jobs).toHaveLength(1);
      expect(parsed.jobs[0].name).toBe('Recovered');
    });
  });

  describe('persistence round-trip', () => {
    it('a new store instance reads data written by a previous instance', () => {
      const store1 = freshStore();
      const job = store1.addJob('Acme', 25);

      TestBed.resetTestingModule();
      const store2 = freshStore();

      expect(store2.jobs()).toHaveLength(1);
      expect(store2.jobs()[0].id).toBe(job.id);
      expect(store2.jobs()[0].name).toBe('Acme');
    });

    it('every mutation synchronously writes serialized data to localStorage', () => {
      const store = freshStore();
      store.addJob('Beta', 30);
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.jobs).toHaveLength(1);
      expect(parsed.jobs[0].name).toBe('Beta');
    });
  });

  describe('jobs', () => {
    it('addJob returns a Job with the given name, rate, and archived=false', () => {
      const store = freshStore();
      const job = store.addJob('Dev Client', 50);
      expect(job.name).toBe('Dev Client');
      expect(job.defaultRate).toBe(50);
      expect(job.archived).toBe(false);
    });

    it('activeJobs excludes archived Jobs', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      store.setArchived(job.id, true);
      expect(store.activeJobs().find((j) => j.id === job.id)).toBeUndefined();
    });

    it('archivedJobs includes archived Jobs', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      store.setArchived(job.id, true);
      expect(store.archivedJobs().find((j) => j.id === job.id)).toBeDefined();
    });

    it('setArchived(id, true) throws "Clock out first" when the Job holds the Live Session', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      store.clockIn(job.id);
      expect(() => store.setArchived(job.id, true)).toThrow('Clock out first');
    });

    it('setArchived does not throw for a Job with no Live Session', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      expect(() => store.setArchived(job.id, true)).not.toThrow();
    });
  });

  describe('Live Session', () => {
    it('liveSession is null when no Live Session exists', () => {
      const store = freshStore();
      expect(store.liveSession()).toBeNull();
    });

    it('clockIn creates a Live Session with Entry Rate = Job Default Rate at that moment', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 40);
      const entry = store.clockIn(job.id);
      expect(entry.end).toBeNull();
      expect(entry.rate).toBe(40);
      expect(store.liveSession()).not.toBeNull();
    });

    it('clockIn throws when a Live Session already exists (single Live Session rule)', () => {
      const store = freshStore();
      const job1 = store.addJob('Job A', 20);
      const job2 = store.addJob('Job B', 30);
      store.clockIn(job1.id);
      expect(() => store.clockIn(job2.id)).toThrow();
    });

    it('clockIn throws when the target Job is archived', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      store.setArchived(job.id, true);
      expect(() => store.clockIn(job.id)).toThrow();
    });

    it('clockOut sets end on the Live Session and liveSession returns null afterward', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      store.clockIn(job.id);
      const completed = store.clockOut();
      expect(completed).not.toBeNull();
      expect(completed!.end).not.toBeNull();
      expect(store.liveSession()).toBeNull();
    });

    it('clockOut returns null when there is no Live Session', () => {
      const store = freshStore();
      expect(store.clockOut()).toBeNull();
    });
  });

  describe('Entry Rate snapshot (ADR-0002)', () => {
    it('clockIn rate is unaffected by a later updateJob on the same Job', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      store.clockIn(job.id);
      store.updateJob(job.id, { defaultRate: 100 });
      const completed = store.clockOut()!;
      expect(completed.rate).toBe(25);
    });

    it('addEntry defaults rate to the Job Default Rate at creation time', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 40);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      expect(entry.rate).toBe(40);
    });

    it('updateJob defaultRate does not alter an existing Entry rate', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 40);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      store.updateJob(job.id, { defaultRate: 80 });
      const found = store.entries().find((e) => e.id === entry.id)!;
      expect(found.rate).toBe(40);
    });
  });

  describe('addEntry validation', () => {
    it('throws when end is before start', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      expect(() =>
        store.addEntry({
          jobId: job.id,
          start: '2024-01-15T10:00:00.000Z',
          end: '2024-01-15T09:00:00.000Z',
        }),
      ).toThrow();
    });

    it('throws when end equals start', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      expect(() =>
        store.addEntry({
          jobId: job.id,
          start: '2024-01-15T09:00:00.000Z',
          end: '2024-01-15T09:00:00.000Z',
        }),
      ).toThrow();
    });

    it('throws Error("End is required") when end is null', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.addEntry({ jobId: job.id, start: '2024-01-15T09:00:00.000Z', end: null as any }),
      ).toThrow('End is required');
    });

    it('throws Error("End is required") when end is an empty string', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      expect(() =>
        store.addEntry({ jobId: job.id, start: '2024-01-15T09:00:00.000Z', end: '' }),
      ).toThrow('End is required');
    });

    it('addEntry never creates a Live Session — only clockIn does', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      store.addEntry({
        jobId: job.id,
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      expect(store.liveSession()).toBeNull();
    });

    it('throws Error("Rate must be a non-negative number") when explicit rate is negative', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      expect(() =>
        store.addEntry({
          jobId: job.id,
          start: '2024-01-15T09:00:00.000Z',
          end: '2024-01-15T10:00:00.000Z',
          rate: -1,
        }),
      ).toThrow('Rate must be a non-negative number');
    });

    it('throws Error("Rate must be a non-negative number") when explicit rate is Infinity', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      expect(() =>
        store.addEntry({
          jobId: job.id,
          start: '2024-01-15T09:00:00.000Z',
          end: '2024-01-15T10:00:00.000Z',
          rate: Infinity,
        }),
      ).toThrow('Rate must be a non-negative number');
    });

    it('accepts an explicit rate override', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
        rate: 99,
      });
      expect(entry.rate).toBe(99);
    });
  });

  describe('updateEntry validation', () => {
    it('throws when patching end to before start', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      expect(() => store.updateEntry(entry.id, { end: '2024-01-15T08:00:00.000Z' })).toThrow();
    });

    it('throws when patching end to equal start', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      expect(() => store.updateEntry(entry.id, { end: '2024-01-15T09:00:00.000Z' })).toThrow();
    });

    it('throws Error("End is required") when patching end to null on a non-Live-Session entry', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      expect(() => store.updateEntry(entry.id, { end: null })).toThrow('End is required');
    });

    it('allows patching end to null when the entry is already the Live Session', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      const live = store.clockIn(job.id);
      expect(() => store.updateEntry(live.id, { end: null })).not.toThrow();
      expect(store.liveSession()).not.toBeNull();
    });
  });

  describe('rate immutability via updateEntry', () => {
    it('Entry rate is unchanged after an updateEntry call (patch excludes rate)', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      store.updateEntry(entry.id, { note: 'revised note' });
      const found = store.entries().find((e) => e.id === entry.id)!;
      expect(found.rate).toBe(25);
    });
  });

  describe('rate validation — addJob / updateJob', () => {
    it('addJob throws Error("Rate must be a non-negative number") for a negative defaultRate', () => {
      const store = freshStore();
      expect(() => store.addJob('Acme', -1)).toThrow('Rate must be a non-negative number');
    });

    it('addJob throws Error("Rate must be a non-negative number") for Infinity', () => {
      const store = freshStore();
      expect(() => store.addJob('Acme', Infinity)).toThrow('Rate must be a non-negative number');
    });

    it('addJob throws Error("Rate must be a non-negative number") for NaN', () => {
      const store = freshStore();
      expect(() => store.addJob('Acme', NaN)).toThrow('Rate must be a non-negative number');
    });

    it('addJob accepts zero as a valid defaultRate', () => {
      const store = freshStore();
      expect(() => store.addJob('Pro Bono', 0)).not.toThrow();
    });

    it('updateJob throws Error("Rate must be a non-negative number") for a negative defaultRate', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      expect(() => store.updateJob(job.id, { defaultRate: -5 })).toThrow(
        'Rate must be a non-negative number',
      );
    });

    it('updateJob throws Error("Rate must be a non-negative number") for a non-finite defaultRate', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      expect(() => store.updateJob(job.id, { defaultRate: Infinity })).toThrow(
        'Rate must be a non-negative number',
      );
    });
  });

  describe('importJson / exportJson (§3.5)', () => {
    it('exportJson returns valid JSON containing current jobs and schemaVersion', () => {
      const store = freshStore();
      store.addJob('Acme', 25);
      const parsed = JSON.parse(store.exportJson());
      expect(parsed.jobs).toHaveLength(1);
      expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    });

    it('importJson replaces all current data with the imported document', () => {
      const store = freshStore();
      store.addJob('Original', 20);
      const replacement: TimesheetData = {
        schemaVersion: SCHEMA_VERSION,
        jobs: [
          { id: 'j99', name: 'Imported Job', defaultRate: 60, payPeriod: null, archived: false },
        ],
        entries: [],
      };
      store.importJson(JSON.stringify(replacement));
      expect(store.jobs()).toHaveLength(1);
      expect(store.jobs()[0].name).toBe('Imported Job');
    });

    it('export followed by import on a fresh store reproduces identical Jobs and Entries (AC §3.5)', () => {
      const store = freshStore();
      const snapshot: TimesheetData = {
        schemaVersion: SCHEMA_VERSION,
        jobs: [{ id: 'jA', name: 'Agency', defaultRate: 75, payPeriod: null, archived: false }],
        entries: [
          {
            id: 'e1',
            jobId: 'jA',
            start: '2024-01-15T09:00:00.000Z',
            end: '2024-01-15T10:00:00.000Z',
            rate: 75,
            note: '',
          },
        ],
      };
      store.importJson(JSON.stringify(snapshot));
      const exported = JSON.parse(store.exportJson()) as TimesheetData;
      expect(exported.jobs).toEqual(snapshot.jobs);
      expect(exported.entries).toEqual(snapshot.entries);
    });

    it('importJson throws and leaves data unchanged when given invalid JSON', () => {
      const store = freshStore();
      const job = store.addJob('Existing', 30);
      expect(() => store.importJson('not-json')).toThrow();
      expect(store.jobs()).toHaveLength(1);
      expect(store.jobs()[0].id).toBe(job.id);
    });

    it('importJson throws and leaves data unchanged when given a structurally invalid document', () => {
      const store = freshStore();
      const job = store.addJob('Existing', 30);
      expect(() => store.importJson(JSON.stringify({ corrupt: true }))).toThrow();
      expect(store.jobs()).toHaveLength(1);
      expect(store.jobs()[0].id).toBe(job.id);
    });
  });

  describe('clearAll', () => {
    it('resets data to emptyData()', () => {
      const store = freshStore();
      store.addJob('Acme', 25);
      store.clearAll();
      expect(store.data()).toEqual(emptyData());
    });

    it('removes all jobs and entries', () => {
      const store = freshStore();
      const job = store.addJob('Acme', 25);
      store.addEntry({
        jobId: job.id,
        start: '2024-01-15T09:00:00.000Z',
        end: '2024-01-15T10:00:00.000Z',
      });
      store.clearAll();
      expect(store.jobs()).toHaveLength(0);
      expect(store.entries()).toHaveLength(0);
    });

    it('persists the cleared state to localStorage', () => {
      const store = freshStore();
      store.addJob('Acme', 25);
      store.clearAll();
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.jobs).toHaveLength(0);
      expect(parsed.entries).toHaveLength(0);
    });
  });
});
