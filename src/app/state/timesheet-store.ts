import { Injectable, computed, signal } from '@angular/core';
import type { Entry, Job, PayPeriod, TimesheetData } from '../domain/models';
import { STORAGE_KEY } from '../domain/models';
import { emptyData, parseData, serialize } from '../domain/data-io';
import { newId } from '../domain/time';

const CORRUPT_KEY = 'timesheet.data.corrupt';

function assertRate(value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Rate must be a non-negative number');
  }
}

@Injectable({ providedIn: 'root' })
export class TimesheetStore {
  constructor() {
    const initial = this.loadInitial();
    this._data.set(initial.data);
    this._loadError.set(initial.loadError);
  }

  private readonly _data = signal<TimesheetData>(emptyData());
  private readonly _loadError = signal<string | null>(null);

  readonly data = this._data.asReadonly();
  readonly loadError = this._loadError.asReadonly();
  readonly jobs = computed(() => this._data().jobs);
  readonly entries = computed(() => this._data().entries);
  readonly activeJobs = computed(() => this._data().jobs.filter((j) => !j.archived));
  readonly archivedJobs = computed(() => this._data().jobs.filter((j) => j.archived));
  readonly liveSession = computed<Entry | null>(
    () => this._data().entries.find((e) => e.end === null) ?? null,
  );

  private loadInitial(): { data: TimesheetData; loadError: string | null } {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return { data: emptyData(), loadError: null };
    }
    try {
      return { data: parseData(raw), loadError: null };
    } catch (err) {
      const backup = localStorage.getItem(CORRUPT_KEY);
      if (backup === null || backup === '') {
        localStorage.setItem(CORRUPT_KEY, raw);
      }
      const message = err instanceof Error ? err.message : String(err);
      return { data: emptyData(), loadError: message };
    }
  }

  private commit(next: TimesheetData): void {
    this._data.set(next);
    localStorage.setItem(STORAGE_KEY, serialize(next));
  }

  private jobById(id: string): Job {
    const job = this._data().jobs.find((j) => j.id === id);
    if (!job) throw new Error(`Unknown job: ${id}`);
    return job;
  }

  private entryById(id: string): Entry {
    const entry = this._data().entries.find((e) => e.id === id);
    if (!entry) throw new Error(`Unknown entry: ${id}`);
    return entry;
  }

  addJob(name: string, defaultRate: number, payPeriod?: PayPeriod | null): Job {
    assertRate(defaultRate);
    const job: Job = {
      id: newId(),
      name,
      defaultRate,
      payPeriod: payPeriod === undefined ? null : payPeriod,
      archived: false,
    };
    this.commit({ ...this._data(), jobs: [...this._data().jobs, job] });
    return job;
  }

  updateJob(id: string, patch: Partial<Pick<Job, 'name' | 'defaultRate' | 'payPeriod'>>): void {
    this.jobById(id);
    if (patch.defaultRate !== undefined) {
      assertRate(patch.defaultRate);
    }
    const jobs = this._data().jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
    this.commit({ ...this._data(), jobs });
  }

  setArchived(id: string, archived: boolean): void {
    if (archived) {
      const live = this.liveSession();
      if (live !== null && live.jobId === id) {
        throw new Error('Clock out first');
      }
    }
    const jobs = this._data().jobs.map((j) => (j.id === id ? { ...j, archived } : j));
    this.commit({ ...this._data(), jobs });
  }

  clockIn(jobId: string, now: number = Date.now()): Entry {
    if (this.liveSession() !== null) {
      throw new Error('A Live Session already exists');
    }
    const job = this.jobById(jobId);
    if (job.archived) {
      throw new Error(`Cannot clock in on the archived Job: ${job.name}`);
    }
    const entry: Entry = {
      id: newId(),
      jobId,
      start: new Date(now).toISOString(),
      end: null,
      rate: job.defaultRate,
      note: '',
    };
    this.commit({ ...this._data(), entries: [...this._data().entries, entry] });
    return entry;
  }

  clockOut(now: number = Date.now()): Entry | null {
    const live = this.liveSession();
    if (live === null) return null;
    const end = new Date(now).toISOString();
    const entries = this._data().entries.map((e) => (e.id === live.id ? { ...e, end } : e));
    const completed: Entry = { ...live, end };
    this.commit({ ...this._data(), entries });
    return completed;
  }

  addEntry(input: {
    jobId: string;
    start: string;
    end: string;
    rate?: number;
    note?: string;
  }): Entry {
    if (!input.end) {
      throw new Error('End is required');
    }
    const job = this.jobById(input.jobId);
    if (Date.parse(input.end) <= Date.parse(input.start)) {
      throw new Error('Entry end must be after its start');
    }
    const rate = input.rate !== undefined ? input.rate : job.defaultRate;
    assertRate(rate);
    const entry: Entry = {
      id: newId(),
      jobId: input.jobId,
      start: input.start,
      end: input.end,
      rate,
      note: input.note !== undefined ? input.note : '',
    };
    this.commit({ ...this._data(), entries: [...this._data().entries, entry] });
    return entry;
  }

  updateEntry(id: string, patch: Partial<Pick<Entry, 'jobId' | 'start' | 'end' | 'note'>>): void {
    const current = this.entryById(id);
    const nextStart = patch.start !== undefined ? patch.start : current.start;
    const nextEnd = patch.end !== undefined ? patch.end : current.end;
    if (nextEnd === null && current.end !== null) {
      throw new Error('End is required');
    }
    if (nextEnd !== null && Date.parse(nextEnd) <= Date.parse(nextStart)) {
      throw new Error('Entry end must be after its start');
    }
    if (patch.jobId !== undefined) {
      this.jobById(patch.jobId);
    }
    const entries = this._data().entries.map((e) =>
      e.id === id ? { ...e, ...patch, rate: e.rate } : e,
    );
    this.commit({ ...this._data(), entries });
  }

  deleteEntry(id: string): void {
    this.entryById(id);
    const entries = this._data().entries.filter((e) => e.id !== id);
    this.commit({ ...this._data(), entries });
  }

  exportJson(): string {
    return serialize(this._data());
  }

  importJson(json: string): void {
    const next = parseData(json);
    this.commit(next);
  }

  clearAll(): void {
    this.commit(emptyData());
  }
}
