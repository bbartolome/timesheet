import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
  selector: 'app-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-10" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-black/50" (click)="closed.emit()"></div>
        <aside
          class="absolute right-0 top-0 flex h-full w-full flex-col bg-stone-800 shadow-xl md:max-w-md"
          (click)="$event.stopPropagation()"
        >
          <header class="flex items-start justify-between gap-4 border-b border-stone-700 p-5">
            <h2 class="text-lg font-semibold text-stone-100">{{ title() }}</h2>
            <button
              type="button"
              aria-label="Close"
              class="rounded p-1 text-stone-400 hover:bg-stone-700 hover:text-stone-100"
              (click)="closed.emit()"
            >
              ✕
            </button>
          </header>
          <div class="flex-1 overflow-y-auto p-5 text-stone-100">
            <ng-content />
          </div>
        </aside>
      </div>
    }
  `,
})
export class DrawerComponent {
  readonly open = input<boolean>(false);
  readonly title = input<string>('');
  readonly closed = output<void>();
}
