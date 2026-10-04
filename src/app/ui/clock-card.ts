import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { Entry, Job } from '../domain/models';
import { LONG_SESSION_MS } from '../domain/models';
import { durationMs, formatElapsed } from '../domain/time';
import { TimesheetStore } from '../state/timesheet-store';
import { UiState } from '../state/ui-state';

@Component({
  selector: 'app-clock-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.activeJobs().length === 0) {
      <div class="rounded-xl border border-stone-700 bg-stone-800 p-10 text-center">
        <p class="mb-5 text-stone-400">You have no active Jobs yet.</p>
        <button
          type="button"
          class="rounded-full bg-amber-300 px-8 py-3 font-semibold text-stone-900 hover:bg-amber-200"
          (click)="ui.openSettings()"
        >
          Create your first Job
        </button>
      </div>
    } @else if (live()) {
      <div class="text-center">
        @if (elapsedMs() >= longSessionMs) {
          <div
            class="mx-auto mb-5 w-fit rounded-lg bg-amber-300/10 px-4 py-2 text-amber-300"
            role="status"
          >
            Still clocked in?
          </div>
        }
        <div class="text-sm uppercase tracking-widest text-stone-400">Now working</div>
        <div data-testid="elapsed" class="mt-2 font-mono text-7xl font-light text-amber-300">
          {{ elapsedText() }}
        </div>
        <div class="mt-2 text-xl">{{ liveJobName() }}</div>
        <button
          type="button"
          class="mt-5 rounded-full bg-amber-300 px-10 py-3 font-semibold text-stone-900 hover:bg-amber-200"
          (click)="store.clockOut()"
        >
          Clock Out
        </button>
        @if (otherJobs().length > 0) {
          <div class="mt-6 flex flex-wrap justify-center gap-3">
            @for (j of otherJobs(); track j.id) {
              <button
                type="button"
                disabled
                class="cursor-not-allowed rounded-full border border-stone-600 px-4 py-1 text-stone-400"
              >
                Switch to {{ j.name }}
              </button>
            }
          </div>
        }
      </div>
    } @else {
      <div class="text-center">
        <div class="text-sm uppercase tracking-widest text-stone-400">Ready to work</div>
        <div class="mt-5 flex flex-wrap justify-center gap-3">
          @for (j of store.activeJobs(); track j.id) {
            <button
              type="button"
              class="rounded-full bg-amber-300 px-5 py-2 font-semibold text-stone-900 hover:bg-amber-200"
              (click)="store.clockIn(j.id)"
            >
              Clock In {{ j.name }}
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class ClockCardComponent {
  readonly store = inject(TimesheetStore);
  readonly ui = inject(UiState);
  readonly longSessionMs = LONG_SESSION_MS;

  readonly live = computed<Entry | null>(() => this.store.liveSession());

  readonly elapsedMs = computed(() => {
    const live = this.live();
    return live === null ? 0 : durationMs(live, this.ui.now());
  });

  readonly elapsedText = computed(() => formatElapsed(this.elapsedMs()));

  readonly liveJobName = computed(() => {
    const live = this.live();
    if (live === null) return '';
    return this.store.jobs().find((j: Job) => j.id === live.jobId)?.name ?? '';
  });

  readonly otherJobs = computed<Job[]>(() => {
    const live = this.live();
    if (live === null) return [];
    return this.store.activeJobs().filter((j) => j.id !== live.jobId);
  });
}
