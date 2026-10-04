import { Injectable, computed, signal } from '@angular/core';
import type { ReportFilter } from '../domain/models';
import { REPORT_JOB_KEY } from '../domain/models';
import {
  computeTotals,
  defaultReportJobId,
  entriesInRange,
  resolveRange,
} from '../domain/report';
import { TimesheetStore } from './timesheet-store';

export type EntryDrawerState = { mode: 'new' } | { mode: 'edit'; entryId: string } | null;

@Injectable({ providedIn: 'root' })
export class UiState {
  private readonly _now = signal<number>(Date.now());
  readonly now = this._now.asReadonly();

  readonly settingsOpen = signal<boolean>(false);
  readonly entryDrawer = signal<EntryDrawerState>(null);
  readonly filter = signal<ReportFilter>({ kind: 'thisWeek' });

  /** The Job id the user explicitly chose with setReportJob; null until then. */
  private readonly _selectedJobId = signal<string | null>(null);
  /** Mirrors localStorage[REPORT_JOB_KEY] so re-defaulting stays reactive. */
  private readonly _storedJobId = signal<string | null>(
    (() => {
      const stored = localStorage.getItem(REPORT_JOB_KEY);
      return stored === null ? null : stored;
    })()
  );

  /**
   * The Job the report is showing: the explicit selection when it still
   * matches a Job, otherwise the default re-derived from the current
   * jobs/entries and the stored selection (defaultReportJobId). Re-computes
   * synchronously whenever the store or the selection changes.
   */
  readonly reportJobId = computed<string | null>(() => {
    const jobs = this.store.jobs();
    const entries = this.store.entries();
    const explicit = this._selectedJobId();
    if (explicit !== null && jobs.some(j => j.id === explicit)) return explicit;
    return defaultReportJobId(jobs, entries, this._storedJobId());
  });

  readonly reportJob = computed(
    () => this.store.jobs().find(j => j.id === this.reportJobId()) ?? null
  );

  readonly range = computed(() => {
    const job = this.reportJob();
    if (job === null) return null;
    return resolveRange(this.filter(), job, this.now());
  });

  readonly reportEntries = computed(() => {
    const job = this.reportJob();
    const range = this.range();
    if (job === null || range === null) return [];
    return entriesInRange(this.store.entries(), job.id, range);
  });

  readonly totals = computed(() => computeTotals(this.reportEntries()));

  constructor(private readonly store: TimesheetStore) {
    setInterval(() => this._now.set(Date.now()), 1000);
  }

  setReportJob(id: string): void {
    this._selectedJobId.set(id);
    this._storedJobId.set(id);
    localStorage.setItem(REPORT_JOB_KEY, id);
  }

  openSettings(): void {
    this.settingsOpen.set(true);
  }

  closeSettings(): void {
    this.settingsOpen.set(false);
  }

  openNewEntry(): void {
    this.entryDrawer.set({ mode: 'new' });
  }

  openEditEntry(id: string): void {
    this.entryDrawer.set({ mode: 'edit', entryId: id });
  }

  closeEntryDrawer(): void {
    this.entryDrawer.set(null);
  }
}
