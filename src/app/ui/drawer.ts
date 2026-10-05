import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
  selector: 'app-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="drawer-overlay fixed inset-0 z-10" role="dialog" aria-modal="true">
        <div
          class="drawer-backdrop absolute inset-0 bg-black/50"
          animate.enter="drawer-backdrop-enter"
          animate.leave="drawer-backdrop-leave"
          (click)="closed.emit()"
        ></div>
        <aside
          class="drawer-panel absolute right-0 top-0 flex h-full w-full flex-col bg-stone-800 shadow-xl md:max-w-md"
          animate.enter="drawer-panel-enter"
          animate.leave="drawer-panel-leave"
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
  styles: `
    .drawer-backdrop-enter {
      animation: drawer-backdrop-in 200ms ease-out;
    }

    .drawer-backdrop-leave {
      animation: drawer-backdrop-out 200ms ease-out;
    }

    .drawer-panel-enter {
      animation: drawer-panel-in 200ms ease-out;
    }

    .drawer-panel-leave {
      animation: drawer-panel-out 200ms ease-out;
    }

    @keyframes drawer-backdrop-in {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }

    @keyframes drawer-backdrop-out {
      from {
        opacity: 1;
      }

      to {
        opacity: 0;
      }
    }

    @keyframes drawer-panel-in {
      from {
        transform: translateX(100%);
      }

      to {
        transform: translateX(0);
      }
    }

    @keyframes drawer-panel-out {
      from {
        transform: translateX(0);
      }

      to {
        transform: translateX(100%);
      }
    }
  `,
})
export class DrawerComponent {
  readonly open = input<boolean>(false);
  readonly title = input<string>('');
  readonly closed = output<void>();
}
