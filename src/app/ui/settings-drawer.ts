import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { Job, PayFrequency, PayPeriod } from '../domain/models';
import { TimesheetStore } from '../state/timesheet-store';
import { UiState } from '../state/ui-state';
import { DrawerComponent } from './drawer';

const FREQUENCIES: PayFrequency[] = ['Weekly', 'Biweekly', 'Monthly'];

/** Format an ISO datetime as a `datetime-local` value (local 'yyyy-MM-ddTHH:mm'). */
function toDatetimeLocal(iso: string): string {
  const ms = Date.parse(iso);
  const local = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/** Parse a `datetime-local` value (local time, no zone) to an ISO UTC string. Null when empty/invalid. */
function fromDatetimeLocal(value: string): string | null {
  if (value === '') return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

interface JobFormValues {
  name: string;
  rate: string;
  anchor: string;
  frequency: PayFrequency;
}

@Component({
  selector: 'app-settings-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerComponent],
  template: `
    <app-drawer [open]="ui.settingsOpen()" title="Settings" (closed)="close()">
      @if (error() !== null) {
        <div role="alert" class="mb-4 text-sm text-red-400">{{ error() }}</div>
      }

      <h2 class="mb-3 text-lg font-semibold text-stone-100">Jobs</h2>

      <div class="flex flex-col gap-4">
        @for (job of store.activeJobs(); track job.id) {
          <form
            class="flex flex-col gap-3 rounded-lg border border-stone-700 bg-stone-700/30 p-4"
            (submit)="$event.preventDefault(); onSaveEdit($event, job.id)"
          >
            <h3 class="text-base font-semibold text-stone-100">{{ job.name }}</h3>

            <label class="flex flex-col gap-1 text-sm text-stone-400">
              <span>Name</span>
              <input
                aria-label="Name"
                type="text"
                class="rounded bg-stone-700 px-3 py-2 text-stone-100"
                [value]="job.name"
              />
            </label>

            <label class="flex flex-col gap-1 text-sm text-stone-400">
              <span>Rate</span>
              <input
                aria-label="Rate"
                type="number"
                min="0"
                step="0.01"
                class="rounded bg-stone-700 px-3 py-2 text-stone-100"
                [value]="job.defaultRate"
              />
            </label>

            <label class="flex flex-col gap-1 text-sm text-stone-400">
              <span>Pay Period Anchor</span>
              <input
                aria-label="Pay Period Anchor"
                type="datetime-local"
                class="rounded bg-stone-700 px-3 py-2 text-stone-100"
                [value]="anchorOf(job)"
              />
            </label>

            <label class="flex flex-col gap-1 text-sm text-stone-400">
              <span>Frequency</span>
              <select
                aria-label="Frequency"
                class="rounded bg-stone-700 px-3 py-2 text-stone-100"
                [value]="frequencyOf(job)"
              >
                @for (f of frequencies; track f) {
                  <option [value]="f">{{ f }}</option>
                }
              </select>
            </label>

            <div class="flex items-center gap-3">
              <button
                type="submit"
                class="rounded bg-amber-300 px-4 py-1.5 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-200"
              >
                Save
              </button>
              <button
                type="button"
                class="rounded border border-stone-600 px-4 py-1.5 text-sm text-stone-400 transition-colors hover:border-amber-300/60 hover:text-amber-300"
                (click)="archive(job.id)"
              >
                Archive
              </button>
            </div>
          </form>
        }
      </div>

      <form
        class="mt-6 flex flex-col gap-3"
        (submit)="$event.preventDefault(); onAdd($event)"
      >
        <label class="flex flex-col gap-1 text-sm text-stone-400">
          <span>Name</span>
          <input
            type="text"
            class="rounded bg-stone-700 px-3 py-2 text-stone-100"
          />
        </label>

        <label class="flex flex-col gap-1 text-sm text-stone-400">
          <span>Rate</span>
          <input
            type="number"
            min="0"
            step="0.01"
            class="rounded bg-stone-700 px-3 py-2 text-stone-100"
          />
        </label>

        <label class="flex flex-col gap-1 text-sm text-stone-400">
          <span>Pay Period Anchor</span>
          <input
            type="datetime-local"
            class="rounded bg-stone-700 px-3 py-2 text-stone-100"
          />
        </label>

        <label class="flex flex-col gap-1 text-sm text-stone-400">
          <span>Frequency</span>
          <select
            aria-label="Frequency"
            class="rounded bg-stone-700 px-3 py-2 text-stone-100"
            value="Weekly"
          >
            @for (f of frequencies; track f) {
              <option [value]="f">{{ f }}</option>
            }
          </select>
        </label>

        <button
          type="submit"
          class="mt-1 self-start rounded bg-amber-300 px-5 py-2 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-200"
        >
          Add Job
        </button>
      </form>

      @if (store.archivedJobs().length > 0) {
        <details class="mt-6">
          <summary class="cursor-pointer text-sm text-stone-400 hover:text-stone-100">
            Archived
          </summary>
          <div class="mt-3 flex flex-col gap-3">
            @for (job of store.archivedJobs(); track job.id) {
              <div
                class="flex items-center justify-between gap-3 rounded-lg border border-stone-700 bg-stone-700/30 p-4"
              >
                <span class="text-sm text-stone-100">{{ job.name }}</span>
                <button
                  type="button"
                  class="rounded border border-stone-600 px-4 py-1.5 text-sm text-stone-400 transition-colors hover:border-amber-300/60 hover:text-amber-300"
                  (click)="unarchive(job.id)"
                >
                  Unarchive
                </button>
              </div>
            }
          </div>
        </details>
      }

      <h2 class="mt-8 mb-3 text-lg font-semibold text-stone-100">Data</h2>

      <div class="flex flex-col gap-4 rounded-lg border border-stone-700 bg-stone-700/30 p-4">
        <button
          type="button"
          class="self-start rounded bg-amber-300 px-5 py-2 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-200"
          (click)="exportJson()"
        >
          Export JSON
        </button>

        <label class="flex flex-col gap-1 text-sm text-stone-400">
          <span>Import JSON</span>
          <input
            aria-label="Import JSON"
            type="file"
            accept="application/json,.json"
            class="text-sm text-stone-400 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-stone-600 file:px-3 file:py-1.5 file:text-stone-100 file:transition-colors hover:file:bg-stone-500"
            (change)="onImport($event)"
          />
        </label>

        <button
          type="button"
          class="self-start rounded border border-red-500/40 px-5 py-2 text-sm text-red-400 transition-colors hover:border-red-400 hover:text-red-300"
          (click)="clearAll()"
        >
          Clear all data
        </button>
      </div>
    </app-drawer>
  `,
})
export class SettingsDrawerComponent {
  readonly store = inject(TimesheetStore);
  readonly ui = inject(UiState);

  readonly frequencies: PayFrequency[] = FREQUENCIES;

  readonly error = signal<string | null>(null);

  // ── display helpers ──────────────────────────────────────
  anchorOf(job: Job): string {
    return job.payPeriod !== null && job.payPeriod !== undefined
      ? toDatetimeLocal(job.payPeriod.anchor)
      : '';
  }

  frequencyOf(job: Job): PayFrequency {
    return job.payPeriod?.frequency ?? 'Weekly';
  }

  // ── actions ──────────────────────────────────────────────
  onAdd(event: Event): void {
    const values = this.readJobForm(event.target as HTMLFormElement);
    if (values.name.trim() === '') {
      this.error.set('Please provide a Name');
      return;
    }
    const rate = Number(values.rate);
    if (!Number.isFinite(rate)) {
      this.error.set('Please provide a valid Rate');
      return;
    }
    try {
      this.store.addJob(values.name.trim(), rate, this.payPeriodFrom(values));
      (event.target as HTMLFormElement).reset();
      this.clearError();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  onSaveEdit(event: Event, jobId: string): void {
    const values = this.readJobForm(event.target as HTMLFormElement);
    const rate = Number(values.rate);
    if (!Number.isFinite(rate)) {
      this.error.set('Please provide a valid Rate');
      return;
    }
    try {
      this.store.updateJob(jobId, {
        name: values.name.trim(),
        defaultRate: rate,
        payPeriod: this.payPeriodFrom(values),
      });
      this.clearError();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  archive(jobId: string): void {
    try {
      this.store.setArchived(jobId, true);
      this.clearError();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  unarchive(jobId: string): void {
    try {
      this.store.setArchived(jobId, false);
      this.clearError();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  close(): void {
    this.clearError();
    this.ui.closeSettings();
  }

  // ── data (export / import / clear) ───────────────────────
  exportJson(): void {
    const json = this.store.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'timesheet-backup.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    this.clearError();
  }

  onImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (file === null) return;
    if (window.confirm('Replace all data?') === false) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const text = (e.target?.result ?? '') as string;
      try {
        this.store.importJson(text);
        this.clearError();
      } catch (err) {
        this.error.set(err instanceof Error ? err.message : String(err));
      }
    };
    reader.onerror = () => {
      this.error.set('Could not read the file');
    };
    reader.readAsText(file);
  }

  clearAll(): void {
    if (window.confirm('Clear all data?') === false) {
      return;
    }
    try {
      this.store.clearAll();
      this.clearError();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  // ── form plumbing ────────────────────────────────────────
  private readJobForm(form: HTMLFormElement): JobFormValues {
    const valueOf = (selector: string): string =>
      (form.querySelector(selector) as HTMLInputElement | HTMLSelectElement | null)
        ?.value ?? '';
    return {
      name: valueOf('input[type="text"]'),
      rate: valueOf('input[type="number"]'),
      anchor: valueOf('input[type="datetime-local"]'),
      frequency: (valueOf('select') === '' ? 'Weekly' : valueOf('select')) as PayFrequency,
    };
  }

  /** A Pay Period is only stored when an anchor was provided. */
  private payPeriodFrom(values: JobFormValues): PayPeriod | null {
    const iso = fromDatetimeLocal(values.anchor);
    if (iso === null) return null;
    return { anchor: iso, frequency: values.frequency };
  }

  private clearError(): void {
    this.error.set(null);
  }
}
