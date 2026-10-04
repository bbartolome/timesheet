import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { Job, ReportFilter } from '../domain/models';
import { entriesToCsv } from '../domain/csv';
import { formatHours, formatMoney } from '../domain/time';
import { TimesheetStore } from '../state/timesheet-store';
import { UiState } from '../state/ui-state';

interface Chip {
  label: string;
  kind: ReportFilter['kind'];
  /** Pay-period chips are disabled when the report Job has no Pay Period configured. */
  payPeriodOnly: boolean;
}

const CHIPS: Chip[] = [
  { label: 'This Week', kind: 'thisWeek', payPeriodOnly: false },
  { label: 'This Month', kind: 'thisMonth', payPeriodOnly: false },
  { label: 'All Time', kind: 'allTime', payPeriodOnly: false },
  { label: 'Custom', kind: 'custom', payPeriodOnly: false },
  { label: 'Current Pay Period', kind: 'currentPayPeriod', payPeriodOnly: true },
  { label: 'Past Pay Period', kind: 'pastPayPeriod', payPeriodOnly: true },
];

@Component({
  selector: 'app-report-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl border border-stone-700 bg-stone-800 p-5">
      <div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label class="flex items-center gap-2 text-sm text-stone-400">
          <span>Job</span>
          <select
            aria-label="Report Job"
            class="rounded bg-stone-700 px-3 py-2 text-stone-100"
            [value]="ui.reportJobId()"
            (change)="onJobChange($event)"
          >
            @for (j of jobOptions(); track j.id) {
              <option [value]="j.id">{{ label(j) }}</option>
            }
          </select>
        </label>
        <button
          type="button"
          class="text-sm text-amber-300 underline"
          [disabled]="reportJob() === null"
          (click)="exportCsv()"
        >
          Export CSV
        </button>
      </div>

      <div class="mb-4 flex flex-wrap gap-2">
        @for (c of chips(); track c.label) {
          <button
            type="button"
            class="rounded-full px-3 py-1 text-xs transition-colors"
            class="active:bg-amber-300 active:text-stone-900"
            class="inactive:bg-stone-700 text-stone-400 hover:bg-stone-600"
            class="disabled:cursor-not-allowed disabled:opacity-40"
            [class.active]="filterKind() === c.kind"
            [class.inactive]="filterKind() !== c.kind"
            [disabled]="c.payPeriodOnly && !hasPayPeriod()"
            (click)="setFilter(c.kind)"
          >
            {{ c.label }}
          </button>
        }
      </div>

      @if (isCustom()) {
        <div class="mb-4 flex flex-wrap items-end gap-3 text-sm">
          <label class="flex flex-col gap-1 text-stone-400">
            <span>From</span>
            <input
              aria-label="From"
              type="date"
              class="rounded bg-stone-700 px-3 py-2 text-stone-100"
              [value]="customFrom()"
              (change)="onCustomFrom($event)"
            />
          </label>
          <label class="flex flex-col gap-1 text-stone-400">
            <span>To</span>
            <input
              aria-label="To"
              type="date"
              class="rounded bg-stone-700 px-3 py-2 text-stone-100"
              [value]="customTo()"
              (change)="onCustomTo($event)"
            />
          </label>
        </div>
      }

      <div class="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-stone-700 text-center">
        <div class="bg-stone-800 p-5">
          <div data-testid="total-hours" class="text-3xl text-stone-100">
            {{ hoursText() }}
          </div>
          <div class="text-xs text-stone-400">hours</div>
        </div>
        <div class="bg-stone-800 p-5">
          <div data-testid="gross-income" class="text-3xl text-amber-300">
            {{ incomeText() }}
          </div>
          <div class="text-xs text-stone-400">gross income</div>
        </div>
      </div>
    </section>
  `,
})
export class ReportSectionComponent {
  readonly store = inject(TimesheetStore);
  readonly ui = inject(UiState);

  readonly chips = computed<Chip[]>(() => CHIPS);

  /** Options for the Report Job selector: every Job, archived ones labelled "(archived)". */
  readonly jobOptions = computed<Job[]>(() => this.store.jobs());

  readonly reportJob = computed<Job | null>(() => this.ui.reportJob());

  readonly hasPayPeriod = computed<boolean>(() => {
    const job = this.reportJob();
    return job !== null && job.payPeriod !== null;
  });

  readonly filterKind = computed<ReportFilter['kind']>(() => this.ui.filter().kind);

  readonly isCustom = computed<boolean>(() => this.filterKind() === 'custom');

  readonly customFrom = computed<string>(() => {
    const f = this.ui.filter();
    return f.kind === 'custom' ? f.from : '';
  });

  readonly customTo = computed<string>(() => {
    const f = this.ui.filter();
    return f.kind === 'custom' ? f.to : '';
  });

  readonly hoursText = computed<string>(() => formatHours(this.ui.totals().hours * 3_600_000));

  readonly incomeText = computed<string>(() => formatMoney(this.ui.totals().grossIncome));

  label(j: Job): string {
    return j.archived ? `${j.name} (archived)` : j.name;
  }

  onJobChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    if (value !== '') {
      this.ui.setReportJob(value);
    }
  }

  setFilter(kind: ReportFilter['kind']): void {
    if (kind === 'custom') {
      const f = this.ui.filter();
      const from = f.kind === 'custom' ? f.from : '';
      const to = f.kind === 'custom' ? f.to : '';
      this.ui.filter.set({ kind: 'custom', from, to });
      return;
    }
    // Preserve any previously chosen custom dates when switching back to Custom.
    this.ui.filter.set({ kind } as ReportFilter);
  }

  onCustomFrom(event: Event): void {
    const f = this.ui.filter();
    const from = (event.target as HTMLInputElement).value;
    const to = f.kind === 'custom' ? f.to : '';
    this.ui.filter.set({ kind: 'custom', from, to });
  }

  onCustomTo(event: Event): void {
    const f = this.ui.filter();
    const from = f.kind === 'custom' ? f.from : '';
    const to = (event.target as HTMLInputElement).value;
    this.ui.filter.set({ kind: 'custom', from, to });
  }

  exportCsv(): void {
    const job = this.reportJob();
    if (job === null) return;
    const csv = entriesToCsv(this.ui.reportEntries(), job);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `timesheet-${job.name}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
