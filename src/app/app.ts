import { Component, inject } from '@angular/core';
import { TimesheetStore } from './state/timesheet-store';
import { UiState } from './state/ui-state';
import { ClockCardComponent } from './ui/clock-card';
import { EntryDrawerComponent } from './ui/entry-drawer';
import { EntryTimelineComponent } from './ui/entry-timeline';
import { ReportSectionComponent } from './ui/report-section';
import { SettingsDrawerComponent } from './ui/settings-drawer';

@Component({
  selector: 'app-root',
  host: {
    class: 'min-h-screen bg-stone-900 text-stone-100',
  },
  imports: [
    ClockCardComponent,
    ReportSectionComponent,
    EntryTimelineComponent,
    SettingsDrawerComponent,
    EntryDrawerComponent,
  ],
  template: `
    <div class="mx-auto max-w-2xl space-y-10 px-6 py-10 pb-28">
      @if (store.loadError()) {
        <div
          role="alert"
          class="rounded-xl border border-amber-300/40 bg-stone-800 p-4 text-sm text-amber-300"
        >
          <p class="font-semibold">Saved data could not be loaded</p>
          <p class="mt-1 text-stone-400">{{ store.loadError() }}</p>
          <p class="mt-1 text-stone-400">
            A copy of the raw data is kept in the localStorage key
            <code class="font-mono text-amber-300">timesheet.data.corrupt</code>.
          </p>
        </div>
      }

      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold text-stone-100">Timesheet</h1>
        <button
          type="button"
          aria-label="Settings"
          class="rounded-full border border-stone-600 px-4 py-1.5 text-sm text-stone-400 hover:bg-stone-800 hover:text-stone-100"
          (click)="ui.openSettings()"
        >
          Settings
        </button>
      </header>

      <app-clock-card />
      <app-report-section />
      <app-entry-timeline />
    </div>

    <button
      type="button"
      class="fixed bottom-6 right-6 rounded-full bg-amber-300 px-5 py-3 font-semibold text-stone-900 shadow-lg hover:bg-amber-200"
      (click)="ui.openNewEntry()"
    >
      + Entry
    </button>

    <app-settings-drawer />
    <app-entry-drawer />
  `,
})
export class App {
  /** The timesheet store; surfaced for the load-error banner. */
  protected readonly store = inject(TimesheetStore);
  /** UI state for template bindings (settings/entry drawer, etc.). */
  protected readonly ui = inject(UiState);
}
