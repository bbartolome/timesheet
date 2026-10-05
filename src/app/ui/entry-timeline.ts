import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { Entry } from '../domain/models';
import { durationMs, formatHours } from '../domain/time';
import { UiState } from '../state/ui-state';

const DAY_MS = 86_400_000;

interface DayGroup {
  key: string;
  heading: string;
  entries: Entry[];
}

function localDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Whole local calendar days between the start's and end's local day; > 0 means the end fell on a later day. */
function nextDayOffset(startMs: number, endMs: number | null): number {
  if (endMs === null) return 0;
  const localStart = (ms: number): number => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((localStart(endMs) - localStart(startMs)) / DAY_MS);
  return days > 0 ? days : 0;
}

function dayHeading(key: string): string {
  try {
    return new Date(`${key}T00:00:00`).toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return key;
  }
}

@Component({
  selector: 'app-entry-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl border border-stone-700 bg-stone-800 p-5">
      <h2 class="mb-4 flex items-baseline gap-2 text-lg font-semibold text-stone-100">
        <span>Entries</span>
        @if (jobLabel() !== '') {
          <span data-testid="timeline-job" class="text-base font-normal text-stone-400">
            {{ jobLabel() }}
          </span>
        }
      </h2>

      @if (groups().length === 0) {
        <p class="text-sm text-stone-400">No entries</p>
      } @else {
        <ol class="space-y-6 border-l border-stone-700 pl-5">
          @for (g of groups(); track g.key) {
            <li class="relative">
              <span
                class="absolute -left-[1.6rem] top-1.5 h-2 w-2 rounded-full bg-amber-300"
              ></span>
              <div class="mb-2 text-xs uppercase tracking-widest text-stone-400">
                {{ g.heading }}
              </div>
              <div class="flex flex-col gap-2">
                @for (e of g.entries; track e.id) {
                  <button
                    type="button"
                    data-testid="entry"
                    class="w-full rounded-lg bg-stone-900 px-4 py-3 text-left transition-colors hover:bg-stone-700"
                    (click)="onEntryClick(e)"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <span class="flex items-center gap-2 font-mono text-sm text-stone-100">
                        {{ formatTime(dateMs(e.start)) }}–{{
                          e.end !== null ? formatTime(dateMs(e.end)) : ''
                        }}
                        @if (nextDay(e) > 0) {
                          <span data-testid="next-day" class="text-amber-300">
                            +{{ nextDay(e) }}d
                          </span>
                        }
                      </span>
                      <span class="flex items-center gap-2">
                        @if (e.end === null) {
                          <span
                            class="rounded-full bg-amber-300/10 px-2 py-0.5 text-xs font-semibold text-amber-300"
                          >
                            Live
                          </span>
                        }
                        <span class="font-mono text-sm text-stone-400">{{ hoursOf(e) }}h</span>
                      </span>
                    </div>
                    @if (e.note !== '') {
                      <div class="mt-1 text-sm italic text-stone-500">{{ e.note }}</div>
                    }
                  </button>
                }
              </div>
            </li>
          }
        </ol>
      }
    </section>
  `,
})
export class EntryTimelineComponent {
  readonly ui = inject(UiState);

  /** The report Job's name, suffixed with " (archived)" when the Job is archived. */
  readonly jobLabel = computed<string>(() => {
    const job = this.ui.reportJob();
    if (job === null) return '';
    return job.archived ? `${job.name} (archived)` : job.name;
  });

  /** Report entries grouped by their local calendar day, ordered by start time. */
  readonly groups = computed<DayGroup[]>(() => {
    const entries = [...this.ui.reportEntries()].sort(
      (a, b) => Date.parse(a.start) - Date.parse(b.start),
    );

    const byDay = new Map<string, Entry[]>();
    for (const entry of entries) {
      const key = localDayKey(Date.parse(entry.start));
      const list = byDay.get(key) ?? [];
      list.push(entry);
      byDay.set(key, list);
    }

    return [...byDay.entries()].map(([key, list]) => ({
      key,
      heading: dayHeading(key),
      entries: list,
    }));
  });

  onEntryClick(entry: Entry): void {
    this.ui.openEditEntry(entry.id);
  }

  dateMs(iso: string): number {
    return Date.parse(iso);
  }

  formatTime(ms: number): string {
    return localTime(ms);
  }

  hoursOf(entry: Entry): string {
    return formatHours(durationMs(entry, this.ui.now()));
  }

  /** Whole local calendar days the end falls after the start; 0 if no end / same day. */
  nextDay(entry: Entry): number {
    return nextDayOffset(Date.parse(entry.start), entry.end !== null ? Date.parse(entry.end) : null);
  }
}
