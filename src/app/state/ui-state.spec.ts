import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi } from 'vitest';
import { UiState } from './ui-state';
import { TimesheetStore } from './timesheet-store';
import { REPORT_JOB_KEY, SCHEMA_VERSION, STORAGE_KEY } from '../domain/models';
import type { TimesheetData } from '../domain/models';

function freshState(): { store: TimesheetStore; ui: UiState } {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  return {
    store: TestBed.inject(TimesheetStore),
    ui: TestBed.inject(UiState),
  };
}

describe('UiState', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── initial defaults ────────────────────────────────────────────────────────

  describe('initial defaults', () => {
    it('filter defaults to {kind: "thisWeek"}', () => {
      const { ui } = freshState();
      expect(ui.filter()).toEqual({ kind: 'thisWeek' });
    });

    it('settingsOpen defaults to false', () => {
      const { ui } = freshState();
      expect(ui.settingsOpen()).toBe(false);
    });

    it('entryDrawer defaults to null', () => {
      const { ui } = freshState();
      expect(ui.entryDrawer()).toBeNull();
    });

    it('reportJobId is null when there are no jobs', () => {
      const { ui } = freshState();
      expect(ui.reportJobId()).toBeNull();
    });
  });

  // ─── reportJobId default precedence ─────────────────────────────────────────

  describe('reportJobId default precedence', () => {
    it('uses stored REPORT_JOB_KEY when it matches a job', () => {
      const data: TimesheetData = {
        schemaVersion: SCHEMA_VERSION,
        jobs: [
          { id: 'j1', name: 'Alpha', defaultRate: 20, payPeriod: null, archived: false },
          { id: 'j2', name: 'Beta', defaultRate: 30, payPeriod: null, archived: false },
        ],
        entries: [],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(REPORT_JOB_KEY, 'j2');
      const { ui } = freshState();
      expect(ui.reportJobId()).toBe('j2');
    });

    it('uses stored REPORT_JOB_KEY even when the matched job is archived', () => {
      const data: TimesheetData = {
        schemaVersion: SCHEMA_VERSION,
        jobs: [
          { id: 'j1', name: 'Active', defaultRate: 20, payPeriod: null, archived: false },
          { id: 'ja', name: 'Archived', defaultRate: 30, payPeriod: null, archived: true },
        ],
        entries: [],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(REPORT_JOB_KEY, 'ja');
      const { ui } = freshState();
      expect(ui.reportJobId()).toBe('ja');
    });

    it('falls back to the Live Session job when stored does not match any job', () => {
      const data: TimesheetData = {
        schemaVersion: SCHEMA_VERSION,
        jobs: [
          { id: 'j1', name: 'Alpha', defaultRate: 20, payPeriod: null, archived: false },
          { id: 'j2', name: 'Beta', defaultRate: 30, payPeriod: null, archived: false },
        ],
        entries: [
          {
            id: 'live',
            jobId: 'j2',
            start: new Date(2024, 0, 10, 9, 0, 0).toISOString(),
            end: null,
            rate: 30,
            note: '',
          },
        ],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(REPORT_JOB_KEY, 'invalid-id');
      const { ui } = freshState();
      expect(ui.reportJobId()).toBe('j2');
    });

    it('falls back to the jobId of the entry with the latest start when stored is null and no Live Session', () => {
      const data: TimesheetData = {
        schemaVersion: SCHEMA_VERSION,
        jobs: [
          { id: 'j1', name: 'Alpha', defaultRate: 20, payPeriod: null, archived: false },
          { id: 'j2', name: 'Beta', defaultRate: 30, payPeriod: null, archived: false },
        ],
        entries: [
          {
            id: 'e1',
            jobId: 'j1',
            start: '2024-01-09T09:00:00.000Z',
            end: '2024-01-09T10:00:00.000Z',
            rate: 20,
            note: '',
          },
          {
            id: 'e2',
            jobId: 'j2',
            start: '2024-01-10T09:00:00.000Z',
            end: '2024-01-10T10:00:00.000Z',
            rate: 30,
            note: '',
          },
        ],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      // no REPORT_JOB_KEY set
      const { ui } = freshState();
      expect(ui.reportJobId()).toBe('j2');
    });

    it('falls back to the first non-archived job when no stored and no entries', () => {
      const data: TimesheetData = {
        schemaVersion: SCHEMA_VERSION,
        jobs: [
          { id: 'ja', name: 'Archived', defaultRate: 20, payPeriod: null, archived: true },
          { id: 'j1', name: 'Active', defaultRate: 30, payPeriod: null, archived: false },
        ],
        entries: [],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      const { ui } = freshState();
      expect(ui.reportJobId()).toBe('j1');
    });

    it('re-defaults to a newly added job when reportJobId was null', () => {
      const { store, ui } = freshState();
      expect(ui.reportJobId()).toBeNull();
      const job = store.addJob('NewJob', 25);
      expect(ui.reportJobId()).toBe(job.id);
    });
  });

  // ─── setReportJob ────────────────────────────────────────────────────────────

  describe('setReportJob', () => {
    it('updates reportJobId signal immediately', () => {
      const { store, ui } = freshState();
      const job1 = store.addJob('Alpha', 20);
      const job2 = store.addJob('Beta', 30);
      ui.setReportJob(job1.id);
      expect(ui.reportJobId()).toBe(job1.id);
      ui.setReportJob(job2.id);
      expect(ui.reportJobId()).toBe(job2.id);
    });

    it('persists the selected job id to localStorage[REPORT_JOB_KEY]', () => {
      const { store, ui } = freshState();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      expect(localStorage.getItem(REPORT_JOB_KEY)).toBe(job.id);
    });

    it('a fresh UiState instance restores the persisted reportJobId', () => {
      const { store, ui } = freshState();
      const job1 = store.addJob('Alpha', 20);
      const job2 = store.addJob('Beta', 30);
      ui.setReportJob(job2.id);

      TestBed.resetTestingModule();
      const { ui: ui2 } = freshState();
      expect(ui2.reportJobId()).toBe(job2.id);
    });
  });

  // ─── reportJob ───────────────────────────────────────────────────────────────

  describe('reportJob', () => {
    it('returns the Job matching reportJobId', () => {
      const { store, ui } = freshState();
      const job = store.addJob('Acme', 40);
      ui.setReportJob(job.id);
      expect(ui.reportJob()?.id).toBe(job.id);
    });

    it('returns null when reportJobId is null', () => {
      const { ui } = freshState();
      expect(ui.reportJob()).toBeNull();
    });
  });

  // ─── range ───────────────────────────────────────────────────────────────────

  describe('range', () => {
    it('returns null when reportJobId is null', () => {
      const { ui } = freshState();
      expect(ui.range()).toBeNull();
    });

    it('returns null for currentPayPeriod when the selected Job has no payPeriod', () => {
      const { store, ui } = freshState();
      const job = store.addJob('No Period', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'currentPayPeriod' });
      expect(ui.range()).toBeNull();
    });

    it('returns null for pastPayPeriod when the selected Job has no payPeriod', () => {
      const { store, ui } = freshState();
      const job = store.addJob('No Period', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'pastPayPeriod' });
      expect(ui.range()).toBeNull();
    });

    it('returns a non-null range for thisWeek', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 10, 12, 0, 0));
      const { store, ui } = freshState();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'thisWeek' });
      expect(ui.range()).not.toBeNull();
    });

    it('returns {start: null, end: null} for allTime', () => {
      const { store, ui } = freshState();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      expect(ui.range()).toEqual({ start: null, end: null });
    });
  });

  // ─── reportEntries and totals ─────────────────────────────────────────────────

  describe('reportEntries and totals', () => {
    // Wednesday Jan 10 2024 12:00 local — mid-week
    const WEEK_NOW = new Date(2024, 0, 10, 12, 0, 0).getTime();

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(WEEK_NOW);
    });

    it('reportEntries returns [] when range is null (currentPayPeriod, no payPeriod on job)', () => {
      const { store, ui } = freshState();
      const job = store.addJob('No Period', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'currentPayPeriod' });
      store.addEntry({
        jobId: job.id,
        start: new Date(2024, 0, 9, 9, 0, 0).toISOString(),
        end: new Date(2024, 0, 9, 11, 0, 0).toISOString(),
      });
      expect(ui.reportEntries()).toEqual([]);
    });

    it('reportEntries returns entries within the active range for the selected job', () => {
      const { store, ui } = freshState();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'thisWeek' }); // Mon Jan 8 – Mon Jan 15

      store.addEntry({
        jobId: job.id,
        start: new Date(2024, 0, 9, 9, 0, 0).toISOString(), // Tue Jan 9 — within range ✓
        end: new Date(2024, 0, 9, 11, 0, 0).toISOString(),
      });
      store.addEntry({
        jobId: job.id,
        start: new Date(2024, 0, 1, 9, 0, 0).toISOString(), // Jan 1 — outside range ✗
        end: new Date(2024, 0, 1, 11, 0, 0).toISOString(),
      });

      expect(ui.reportEntries()).toHaveLength(1);
    });

    it('reportEntries excludes entries from a different job', () => {
      const { store, ui } = freshState();
      const job1 = store.addJob('Alpha', 25);
      const job2 = store.addJob('Beta', 30);
      ui.setReportJob(job1.id);
      ui.filter.set({ kind: 'allTime' });

      store.addEntry({
        jobId: job2.id,
        start: new Date(2024, 0, 9, 9, 0, 0).toISOString(),
        end: new Date(2024, 0, 9, 11, 0, 0).toISOString(),
      });

      expect(ui.reportEntries()).toHaveLength(0);
    });

    it('reportEntries reacts to filter changes', () => {
      const { store, ui } = freshState();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);

      store.addEntry({
        jobId: job.id,
        start: new Date(2024, 0, 9, 9, 0, 0).toISOString(), // Tue Jan 9
        end: new Date(2024, 0, 9, 11, 0, 0).toISOString(),
      });

      ui.filter.set({ kind: 'thisWeek' }); // Mon Jan 8 – Mon Jan 15: includes Jan 9
      expect(ui.reportEntries()).toHaveLength(1);

      ui.filter.set({ kind: 'custom', from: '2024-01-20', to: '2024-01-25' }); // excludes Jan 9
      expect(ui.reportEntries()).toHaveLength(0);
    });

    it('reportEntries reacts to new entries added to the store', () => {
      const { store, ui } = freshState();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'thisWeek' });

      expect(ui.reportEntries()).toHaveLength(0);

      store.addEntry({
        jobId: job.id,
        start: new Date(2024, 0, 9, 9, 0, 0).toISOString(),
        end: new Date(2024, 0, 9, 11, 0, 0).toISOString(),
      });

      expect(ui.reportEntries()).toHaveLength(1);
    });

    it('totals reflects computeTotals over reportEntries', () => {
      const { store, ui } = freshState();
      const job = store.addJob('Acme', 20);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'thisWeek' });

      store.addEntry({
        jobId: job.id,
        start: new Date(2024, 0, 9, 9, 0, 0).toISOString(), // 2h at rate 20
        end: new Date(2024, 0, 9, 11, 0, 0).toISOString(),
      });

      expect(ui.totals()).toEqual({ hours: 2, grossIncome: 40 });
    });

    it('totals are zero when reportEntries is empty', () => {
      const { store, ui } = freshState();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'thisWeek' });
      expect(ui.totals()).toEqual({ hours: 0, grossIncome: 0 });
    });

    it('totals react to new entries being added', () => {
      const { store, ui } = freshState();
      const job = store.addJob('Acme', 20);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'thisWeek' });

      expect(ui.totals()).toEqual({ hours: 0, grossIncome: 0 });

      store.addEntry({
        jobId: job.id,
        start: new Date(2024, 0, 9, 9, 0, 0).toISOString(), // 2h at rate 20
        end: new Date(2024, 0, 9, 11, 0, 0).toISOString(),
      });

      expect(ui.totals()).toEqual({ hours: 2, grossIncome: 40 });
    });
  });

  // ─── drawer methods ───────────────────────────────────────────────────────────

  describe('drawer methods', () => {
    it('openSettings sets settingsOpen to true', () => {
      const { ui } = freshState();
      ui.openSettings();
      expect(ui.settingsOpen()).toBe(true);
    });

    it('closeSettings sets settingsOpen back to false', () => {
      const { ui } = freshState();
      ui.openSettings();
      ui.closeSettings();
      expect(ui.settingsOpen()).toBe(false);
    });

    it('openNewEntry sets entryDrawer to {mode: "new"}', () => {
      const { ui } = freshState();
      ui.openNewEntry();
      expect(ui.entryDrawer()).toEqual({ mode: 'new' });
    });

    it('openEditEntry sets entryDrawer to {mode: "edit", entryId}', () => {
      const { ui } = freshState();
      ui.openEditEntry('e42');
      expect(ui.entryDrawer()).toEqual({ mode: 'edit', entryId: 'e42' });
    });

    it('closeEntryDrawer sets entryDrawer back to null', () => {
      const { ui } = freshState();
      ui.openNewEntry();
      ui.closeEntryDrawer();
      expect(ui.entryDrawer()).toBeNull();
    });

    it('openEditEntry replaces an existing drawer state', () => {
      const { ui } = freshState();
      ui.openNewEntry();
      ui.openEditEntry('e99');
      expect(ui.entryDrawer()).toEqual({ mode: 'edit', entryId: 'e99' });
    });
  });

  // ─── now signal ticks ─────────────────────────────────────────────────────────

  describe('now signal', () => {
    it('starts at Date.now() at construction time', () => {
      vi.useFakeTimers();
      const start = new Date(2024, 0, 10, 12, 0, 0).getTime();
      vi.setSystemTime(start);
      const { ui } = freshState();
      expect(ui.now()).toBe(start);
    });

    it('does not advance before the first 1000 ms', () => {
      vi.useFakeTimers();
      const start = new Date(2024, 0, 10, 12, 0, 0).getTime();
      vi.setSystemTime(start);
      const { ui } = freshState();
      vi.advanceTimersByTime(999);
      expect(ui.now()).toBe(start);
    });

    it('advances by 1000 ms after one setInterval tick', () => {
      vi.useFakeTimers();
      const start = new Date(2024, 0, 10, 12, 0, 0).getTime();
      vi.setSystemTime(start);
      const { ui } = freshState();
      vi.advanceTimersByTime(1000);
      expect(ui.now()).toBe(start + 1000);
    });

    it('advances in steps on each subsequent tick', () => {
      vi.useFakeTimers();
      const start = new Date(2024, 0, 10, 12, 0, 0).getTime();
      vi.setSystemTime(start);
      const { ui } = freshState();
      vi.advanceTimersByTime(3000);
      expect(ui.now()).toBe(start + 3000);
    });
  });
});
