import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi } from 'vitest';
import { ClockCardComponent } from './clock-card';
import { TimesheetStore } from '../state/timesheet-store';
import { UiState } from '../state/ui-state';
import { LONG_SESSION_MS } from '../domain/models';

function setup(): {
  fixture: ComponentFixture<ClockCardComponent>;
  store: TimesheetStore;
  ui: UiState;
} {
  TestBed.configureTestingModule({
    imports: [ClockCardComponent],
    providers: [provideZonelessChangeDetection()],
  });
  const store = TestBed.inject(TimesheetStore);
  const ui = TestBed.inject(UiState);
  const fixture = TestBed.createComponent(ClockCardComponent);
  fixture.detectChanges();
  return { fixture, store, ui };
}

function btn(el: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    (Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().includes(text),
    ) as HTMLButtonElement) ?? null
  );
}

describe('ClockCardComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── zero Jobs ────────────────────────────────────────────────────────────────

  describe('zero Jobs', () => {
    it('shows create your first Job prompt', () => {
      const { fixture } = setup();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Create your first Job');
    });

    it('renders no Clock In buttons', () => {
      const { fixture } = setup();
      const el = fixture.nativeElement as HTMLElement;
      const clockInBtns = Array.from(el.querySelectorAll('button')).filter((b) =>
        b.textContent?.includes('Clock In'),
      );
      expect(clockInBtns).toHaveLength(0);
    });

    it('prompt button opens the Settings drawer', () => {
      const { fixture, ui } = setup();
      btn(fixture.nativeElement as HTMLElement, 'Create your first Job')!.click();
      fixture.detectChanges();
      expect(ui.settingsOpen()).toBe(true);
    });
  });

  // ─── idle — no Live Session ───────────────────────────────────────────────────

  describe('idle — no Live Session', () => {
    it('shows one Clock In button per active Job', () => {
      const { fixture, store } = setup();
      store.addJob('Acme', 25);
      store.addJob('Beta', 30);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Clock In Acme');
      expect(el.textContent).toContain('Clock In Beta');
    });

    it('does not show Clock In button for an archived Job', () => {
      const { fixture, store } = setup();
      store.addJob('Active', 25);
      const archived = store.addJob('Archived', 20);
      store.setArchived(archived.id, true);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Clock In Active');
      expect(el.textContent).not.toContain('Clock In Archived');
    });

    it('Clock In button creates a Live Session for the correct Job', () => {
      const { fixture, store } = setup();
      const job = store.addJob('Acme', 25);
      fixture.detectChanges();
      btn(fixture.nativeElement as HTMLElement, 'Clock In Acme')!.click();
      fixture.detectChanges();
      expect(store.liveSession()?.jobId).toBe(job.id);
    });

    it('shows no Clock Out button and no elapsed element when idle', () => {
      const { fixture, store } = setup();
      store.addJob('Acme', 25);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(btn(el, 'Clock Out')).toBeNull();
      expect(el.querySelector('[data-testid="elapsed"]')).toBeNull();
    });
  });

  // ─── running — Live Session active ────────────────────────────────────────────

  describe('running — Live Session active', () => {
    it('shows the running Job name', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 10, 9, 0, 0));
      const { fixture, store } = setup();
      const job = store.addJob('Acme', 25);
      store.clockIn(job.id);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Acme');
    });

    it('shows [data-testid="elapsed"] element', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 10, 9, 0, 0));
      const { fixture, store } = setup();
      const job = store.addJob('Acme', 25);
      store.clockIn(job.id);
      fixture.detectChanges();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('[data-testid="elapsed"]'),
      ).not.toBeNull();
    });

    it('shows Clock Out button', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 10, 9, 0, 0));
      const { fixture, store } = setup();
      const job = store.addJob('Acme', 25);
      store.clockIn(job.id);
      fixture.detectChanges();
      expect(btn(fixture.nativeElement as HTMLElement, 'Clock Out')).not.toBeNull();
    });

    it('Clock Out button completes the Live Session', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 10, 9, 0, 0));
      const { fixture, store } = setup();
      const job = store.addJob('Acme', 25);
      store.clockIn(job.id);
      fixture.detectChanges();
      btn(fixture.nativeElement as HTMLElement, 'Clock Out')!.click();
      fixture.detectChanges();
      expect(store.liveSession()).toBeNull();
    });

    it('other active Jobs appear as disabled Switch to <name> buttons', () => {
      const { fixture, store } = setup();
      const job1 = store.addJob('Acme', 25);
      store.addJob('Beta', 30);
      store.clockIn(job1.id);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const switchBtns = Array.from(el.querySelectorAll('button')).filter((b) =>
        b.textContent?.includes('Switch to'),
      ) as HTMLButtonElement[];
      expect(switchBtns.length).toBeGreaterThan(0);
      switchBtns.forEach((b) => expect(b.disabled).toBe(true));
    });

    it('switch buttons list each non-running active Job', () => {
      const { fixture, store } = setup();
      const job1 = store.addJob('Acme', 25);
      store.addJob('Beta', 30);
      store.addJob('Gamma', 35);
      store.clockIn(job1.id);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Switch to Beta');
      expect(el.textContent).toContain('Switch to Gamma');
    });

    it('archived Jobs do not appear as Switch to buttons', () => {
      const { fixture, store } = setup();
      const job1 = store.addJob('Acme', 25);
      const archived = store.addJob('Old Client', 20);
      store.setArchived(archived.id, true);
      store.clockIn(job1.id);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
        'Switch to Old Client',
      );
    });

    it('shows no Clock In buttons while a Live Session runs', () => {
      const { fixture, store } = setup();
      const job = store.addJob('Acme', 25);
      store.addJob('Beta', 30);
      store.clockIn(job.id);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const clockInBtns = Array.from(el.querySelectorAll('button')).filter((b) =>
        b.textContent?.includes('Clock In'),
      );
      expect(clockInBtns).toHaveLength(0);
    });
  });

  // ─── "Still clocked in?" banner ───────────────────────────────────────────────

  describe('"Still clocked in?" banner', () => {
    it('shows banner when elapsed >= LONG_SESSION_MS', () => {
      vi.useFakeTimers();
      const now = new Date(2024, 0, 10, 9, 0, 0).getTime();
      vi.setSystemTime(now);
      const { fixture, store } = setup();
      const job = store.addJob('Acme', 25);
      // entry started exactly LONG_SESSION_MS ago; one interval tick pushes elapsed over threshold
      store.clockIn(job.id, now - LONG_SESSION_MS);
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent?.toLowerCase()).toContain(
        'still clocked in',
      );
    });

    it('does not show banner when elapsed < LONG_SESSION_MS', () => {
      vi.useFakeTimers();
      const now = new Date(2024, 0, 10, 9, 0, 0).getTime();
      vi.setSystemTime(now);
      const { fixture, store } = setup();
      const job = store.addJob('Acme', 25);
      // entry started 2 s before threshold; after one tick elapsed = LONG_SESSION_MS - 1000
      store.clockIn(job.id, now - LONG_SESSION_MS + 2000);
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent?.toLowerCase()).not.toContain(
        'still clocked in',
      );
    });

    it('banner does not disable Clock Out', () => {
      vi.useFakeTimers();
      const now = new Date(2024, 0, 10, 9, 0, 0).getTime();
      vi.setSystemTime(now);
      const { fixture, store } = setup();
      const job = store.addJob('Acme', 25);
      store.clockIn(job.id, now - LONG_SESSION_MS);
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const clockOutBtn = btn(el, 'Clock Out') as HTMLButtonElement;
      expect(clockOutBtn).not.toBeNull();
      expect(clockOutBtn.disabled).toBe(false);
    });
  });
});
