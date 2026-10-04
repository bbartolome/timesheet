import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import type { Entry, Job } from '../domain/models';
import { findOverlaps } from '../domain/time';
import { TimesheetStore } from '../state/timesheet-store';
import { UiState } from '../state/ui-state';
import { DrawerComponent } from './drawer';

/** Format an ISO datetime as a `datetime-local` value (local 'yyyy-MM-ddTHH:mm'). */
function toDatetimeLocal(iso: string): string {
  const ms = Date.parse(iso);
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = new Date(ms - d.getTimezoneOffset() * 60_000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/** Parse a `datetime-local` value (local time, no zone) to an ISO UTC string. Null when empty/invalid. */
function fromDatetimeLocal(value: string): string | null {
  if (value === '') return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

@Component({
  selector: 'app-entry-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerComponent],
  template: `
    <app-drawer [open]="open()" [title]="title()" (closed)="close()">
      <form class="flex flex-col gap-5" (submit)="$event.preventDefault(); save()">
        <label class="flex flex-col gap-1 text-sm text-stone-400">
          <span>Job</span>
          <select
            id="entry-job"
            class="rounded bg-stone-700 px-3 py-2 text-stone-100"
            [value]="jobId()"
            (change)="onJobChange($event)"
          >
            @for (j of jobOptions(); track j.id) {
              <option [value]="j.id">{{ j.name }}</option>
            }
          </select>
        </label>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1 text-sm text-stone-400">
            <span>Start</span>
            <input
              id="entry-start"
              type="datetime-local"
              class="rounded bg-stone-700 px-3 py-2 text-stone-100"
              [value]="start()"
              (input)="onStart($event)"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm text-stone-400">
            <span>End</span>
            <input
              id="entry-end"
              type="datetime-local"
              class="rounded bg-stone-700 px-3 py-2 text-stone-100"
              [value]="end()"
              (input)="onEnd($event)"
            />
          </label>
        </div>

        <label class="flex flex-col gap-1 text-sm text-stone-400">
          <span>Rate</span>
          <input
            id="entry-rate"
            type="number"
            min="0"
            step="0.01"
            class="rounded bg-stone-700 px-3 py-2 text-stone-100 disabled:bg-stone-800 disabled:text-stone-400"
            [value]="rate()"
            [disabled]="isEdit()"
            (input)="onRate($event)"
          />
        </label>

        <label class="flex flex-col gap-1 text-sm text-stone-400">
          <span>Note</span>
          <input
            id="entry-note"
            type="text"
            class="rounded bg-stone-700 px-3 py-2 text-stone-100"
            [value]="note()"
            (input)="onNote($event)"
          />
        </label>

        @if (overlapCount() > 0) {
          <p class="text-sm text-amber-300">
            Overlaps {{ overlapCount() }} existing entr{{ overlapCount() === 1 ? 'y' : 'ies' }}
          </p>
        }

        @if (error() !== null) {
          <div role="alert" class="text-sm text-red-400">{{ error() }}</div>
        }

        <div class="mt-2 flex items-center justify-end gap-3">
          @if (isEdit()) {
            <button
              type="button"
              class="rounded border border-stone-600 px-5 py-2 text-sm text-stone-400 transition-colors hover:border-red-400/60 hover:text-red-400"
              (click)="delete()"
            >
              Delete
            </button>
          }
          <button
            type="submit"
            class="rounded bg-amber-300 px-5 py-2 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-200"
          >
            Save
          </button>
        </div>
      </form>
    </app-drawer>
  `,
})
export class EntryDrawerComponent {
  private readonly store = inject(TimesheetStore);
  private readonly ui = inject(UiState);

  // ── form state ───────────────────────────────────────────
  readonly jobId = signal<string>('');
  readonly start = signal<string>('');
  readonly end = signal<string>('');
  readonly rate = signal<string>('');
  readonly note = signal<string>('');
  readonly error = signal<string | null>(null);

  // ── derived ──────────────────────────────────────────────
  readonly open = computed<boolean>(() => this.ui.entryDrawer() !== null);

  readonly isEdit = computed<boolean>(
    () => this.ui.entryDrawer() !== null && this.ui.entryDrawer()!.mode === 'edit',
  );

  readonly title = computed<string>(() => (this.isEdit() ? 'Edit Entry' : 'New Entry'));

  /** Active Jobs; in edit mode the entry's own Job is always included. */
  readonly jobOptions = computed<Job[]>(() => {
    const active = this.store.activeJobs();
    if (!this.isEdit()) return active;
    const entry = this.editingEntry();
    if (entry !== null) {
      const current = this.store.jobs().find(j => j.id === entry.jobId);
      if (current !== undefined && !active.some(j => j.id === current.id)) {
        return [current, ...active];
      }
    }
    return active;
  });

  /** Count of existing same-Job entries the drafted interval strictly overlaps (warning only). */
  readonly overlapCount = computed<number>(() => {
    const startIso = fromDatetimeLocal(this.start());
    if (startIso === null) return 0;
    const endIso = this.end() === '' ? null : fromDatetimeLocal(this.end());
    if (endIso === null || Date.parse(endIso) <= Date.parse(startIso)) return 0;
    const draft: Entry = {
      id: this.editingEntry()?.id ?? 'draft',
      jobId: this.jobId(),
      start: startIso,
      end: endIso,
      rate: 0,
      note: '',
    };
    return findOverlaps(draft, this.store.entries(), this.ui.now()).length;
  });

  constructor() {
    // Prefill the form whenever the drawer switches into New / Edit mode.
    // `effect` runs before the view refreshes during the same detectChanges
    // cycle, so the signals are populated before the template renders.
    effect(() => {
      const state = this.ui.entryDrawer();
      if (state === null) return;
      this.prefillFor(state);
    });
  }

  // ── prefill ──────────────────────────────────────────────
  private editingEntry(): Entry | null {
    const state = this.ui.entryDrawer();
    if (state === null || state.mode !== 'edit') return null;
    return this.store.entries().find(e => e.id === state.entryId) ?? null;
  }

  private prefillFor(state: { mode: 'new' } | { mode: 'edit'; entryId: string }): void {
    this.error.set(null);

    if (state.mode === 'edit') {
      const entry = this.store.entries().find(e => e.id === state.entryId);
      if (entry === undefined) return;
      this.jobId.set(entry.jobId);
      this.start.set(toDatetimeLocal(entry.start));
      this.end.set(entry.end !== null ? toDatetimeLocal(entry.end) : '');
      // Immutable Entry Rate snapshot (ADR-0002) — not the Job Default Rate.
      this.rate.set(String(entry.rate));
      this.note.set(entry.note);
    } else {
      const options = this.jobOptions();
      const first = options[0];
      this.jobId.set(first !== undefined ? first.id : '');
      this.start.set('');
      this.end.set('');
      this.rate.set(first !== undefined ? String(first.defaultRate) : '');
      this.note.set('');
    }
  }

  // ── field handlers ───────────────────────────────────────
  private valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  onJobChange(event: Event): void {
    this.jobId.set(this.valueOf(event));
    // Refresh the Rate default on Job change (new-entry mode only;
    // the snapshot is immutable while editing).
    if (!this.isEdit()) {
      const job = this.store.jobs().find(j => j.id === this.jobId());
      if (job !== undefined) this.rate.set(String(job.defaultRate));
    }
    this.clearError();
  }

  onStart(event: Event): void {
    this.start.set(this.valueOf(event));
    this.clearError();
  }

  onEnd(event: Event): void {
    this.end.set(this.valueOf(event));
    this.clearError();
  }

  onRate(event: Event): void {
    this.rate.set(this.valueOf(event));
    this.clearError();
  }

  onNote(event: Event): void {
    this.note.set(this.valueOf(event));
    this.clearError();
  }

  // ── actions ──────────────────────────────────────────────
  save(): void {
    const startIso = fromDatetimeLocal(this.start());
    const endIso = this.end() === '' ? null : fromDatetimeLocal(this.end());
    if (startIso === null) {
      this.error.set('Please provide a start date');
      return;
    }

    const rateValue = this.rate() === '' ? NaN : Number(this.rate());
    const rate = Number.isFinite(rateValue) ? rateValue : undefined;

    try {
      if (this.isEdit()) {
        const entry = this.editingEntry();
        if (entry === null) {
          this.error.set('Entry no longer exists');
          return;
        }
        this.store.updateEntry(entry.id, {
          jobId: this.jobId(),
          start: startIso,
          end: endIso,
          note: this.note(),
        });
      } else {
        this.store.addEntry({
          jobId: this.jobId(),
          start: startIso,
          end: endIso,
          rate,
          note: this.note(),
        });
      }
      this.close();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  delete(): void {
    const entry = this.editingEntry();
    if (entry === null) return;
    if (!window.confirm('Delete this entry?')) return;
    this.store.deleteEntry(entry.id);
    this.close();
  }

  close(): void {
    this.ui.closeEntryDrawer();
  }

  private clearError(): void {
    this.error.set(null);
  }
}
