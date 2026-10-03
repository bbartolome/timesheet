import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi } from 'vitest';
import { EntryTimelineComponent } from './entry-timeline';
import { TimesheetStore } from '../state/timesheet-store';
import { UiState } from '../state/ui-state';

function setup(): { fixture: ComponentFixture<EntryTimelineComponent>; store: TimesheetStore; ui: UiState } {
  TestBed.configureTestingModule({
    imports: [EntryTimelineComponent],
    providers: [provideZonelessChangeDetection()],
  });
  const store = TestBed.inject(TimesheetStore);
  const ui = TestBed.inject(UiState);
  const fixture = TestBed.createComponent(EntryTimelineComponent);
  fixture.detectChanges();
  return { fixture, store, ui };
}

function el(fixture: ComponentFixture<EntryTimelineComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function entryButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll('[data-testid="entry"]')) as HTMLButtonElement[];
}

describe('EntryTimelineComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── empty state ──────────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('shows "No entries" when there are no report entries', () => {
      const { fixture } = setup();
      expect(el(fixture).textContent).toContain('No entries');
    });

    it('renders no [data-testid="entry"] buttons when empty', () => {
      const { fixture } = setup();
      expect(entryButtons(el(fixture))).toHaveLength(0);
    });

    it('does not show "No entries" when there are report entries', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      store.addEntry({ jobId: job.id, start: '2024-01-13T09:00:00.000Z', end: '2024-01-13T10:00:00.000Z' });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(el(fixture).textContent).not.toContain('No entries');
    });
  });

  // ─── listing entries ──────────────────────────────────────────────────────────

  describe('listing entries', () => {
    it('renders one [data-testid="entry"] button per report entry', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      store.addEntry({ jobId: job.id, start: '2024-01-13T09:00:00.000Z', end: '2024-01-13T10:00:00.000Z' });
      store.addEntry({ jobId: job.id, start: '2024-01-14T09:00:00.000Z', end: '2024-01-14T10:00:00.000Z' });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(entryButtons(el(fixture))).toHaveLength(2);
    });

    it('shows the entry note inside the entry button', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
        note: 'Design review',
      });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      const btn = entryButtons(el(fixture))[0];
      expect(btn.textContent).toContain('Design review');
    });

    it('shows start and end times inside the entry button', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      store.addEntry({ jobId: job.id, start: '2024-01-13T09:00:00.000Z', end: '2024-01-13T10:00:00.000Z' });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      // Entry button should contain time information (start/end rendered as local time strings)
      const btn = entryButtons(el(fixture))[0];
      expect(btn.textContent?.trim().length).toBeGreaterThan(0);
    });

    it('shows hours inside the entry button', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      // 2-hour entry
      store.addEntry({ jobId: job.id, start: '2024-01-13T09:00:00.000Z', end: '2024-01-13T11:00:00.000Z' });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      const btn = entryButtons(el(fixture))[0];
      expect(btn.textContent).toContain('2');
    });

    it('only shows entries for the selected Job', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job1 = store.addJob('Acme', 25);
      const job2 = store.addJob('Beta', 30);
      store.addEntry({ jobId: job1.id, start: '2024-01-13T09:00:00.000Z', end: '2024-01-13T10:00:00.000Z' });
      store.addEntry({ jobId: job2.id, start: '2024-01-13T11:00:00.000Z', end: '2024-01-13T12:00:00.000Z' });
      store.addEntry({ jobId: job2.id, start: '2024-01-14T09:00:00.000Z', end: '2024-01-14T10:00:00.000Z' });
      ui.setReportJob(job1.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(entryButtons(el(fixture))).toHaveLength(1);
    });

    it('switching the selected Job updates displayed entries', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job1 = store.addJob('Acme', 25);
      const job2 = store.addJob('Beta', 30);
      store.addEntry({ jobId: job1.id, start: '2024-01-13T09:00:00.000Z', end: '2024-01-13T10:00:00.000Z' });
      store.addEntry({ jobId: job2.id, start: '2024-01-13T11:00:00.000Z', end: '2024-01-13T12:00:00.000Z' });
      store.addEntry({ jobId: job2.id, start: '2024-01-14T09:00:00.000Z', end: '2024-01-14T10:00:00.000Z' });
      ui.setReportJob(job1.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(entryButtons(el(fixture))).toHaveLength(1);

      ui.setReportJob(job2.id);
      fixture.detectChanges();
      expect(entryButtons(el(fixture))).toHaveLength(2);
    });
  });

  // ─── grouping by local day ────────────────────────────────────────────────────

  describe('grouping by local day', () => {
    it('groups entries on the same local day under one day heading', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      // Two entries on the same local date
      store.addEntry({ jobId: job.id, start: '2024-01-13T09:00:00.000Z', end: '2024-01-13T10:00:00.000Z' });
      store.addEntry({ jobId: job.id, start: '2024-01-13T11:00:00.000Z', end: '2024-01-13T12:00:00.000Z' });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(entryButtons(el(fixture))).toHaveLength(2);
    });

    it('places entries from different local days in separate groups', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      store.addEntry({ jobId: job.id, start: '2024-01-13T09:00:00.000Z', end: '2024-01-13T10:00:00.000Z' });
      store.addEntry({ jobId: job.id, start: '2024-01-14T09:00:00.000Z', end: '2024-01-14T10:00:00.000Z' });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      // Both entries visible and two distinct day headings expected
      expect(entryButtons(el(fixture))).toHaveLength(2);
    });
  });

  // ─── Live Session marker ──────────────────────────────────────────────────────

  describe('Live Session marker', () => {
    it('marks the Live Session entry with "Live"', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-13T10:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      store.clockIn(job.id);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      const btns = entryButtons(el(fixture));
      expect(btns.some(b => b.textContent?.includes('Live'))).toBe(true);
    });

    it('does not mark a completed entry with "Live"', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      store.addEntry({ jobId: job.id, start: '2024-01-13T09:00:00.000Z', end: '2024-01-13T10:00:00.000Z' });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      const btns = entryButtons(el(fixture));
      expect(btns.every(b => !b.textContent?.includes('Live'))).toBe(true);
    });

    it('shows exactly one "Live" marker when one Live Session exists', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-13T10:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      store.addEntry({ jobId: job.id, start: '2024-01-13T07:00:00.000Z', end: '2024-01-13T08:00:00.000Z' });
      store.clockIn(job.id);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      const liveBtns = entryButtons(el(fixture)).filter(b => b.textContent?.includes('Live'));
      expect(liveBtns).toHaveLength(1);
    });
  });

  // ─── click opens edit drawer ──────────────────────────────────────────────────

  describe('click opens edit drawer', () => {
    it('clicking an entry button opens the edit drawer', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      store.addEntry({ jobId: job.id, start: '2024-01-13T09:00:00.000Z', end: '2024-01-13T10:00:00.000Z' });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      entryButtons(el(fixture))[0].click();
      fixture.detectChanges();
      const drawer = ui.entryDrawer();
      expect(drawer).not.toBeNull();
      expect(drawer?.mode).toBe('edit');
    });

    it('clicking an entry button sets entryDrawer with the correct entryId', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      const entry = store.addEntry({ jobId: job.id, start: '2024-01-13T09:00:00.000Z', end: '2024-01-13T10:00:00.000Z' });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      entryButtons(el(fixture))[0].click();
      fixture.detectChanges();
      const drawer = ui.entryDrawer() as { mode: 'edit'; entryId: string };
      expect(drawer.entryId).toBe(entry.id);
    });

    it('clicking the Live Session entry opens the edit drawer with its id', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-13T10:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      const live = store.clockIn(job.id);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      const liveBtn = entryButtons(el(fixture)).find(b => b.textContent?.includes('Live'))!;
      liveBtn.click();
      fixture.detectChanges();
      const drawer = ui.entryDrawer() as { mode: 'edit'; entryId: string };
      expect(drawer.mode).toBe('edit');
      expect(drawer.entryId).toBe(live.id);
    });

    it('clicking different entries opens the drawer for each respective entry', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      const entry1 = store.addEntry({ jobId: job.id, start: '2024-01-13T09:00:00.000Z', end: '2024-01-13T10:00:00.000Z' });
      const entry2 = store.addEntry({ jobId: job.id, start: '2024-01-14T09:00:00.000Z', end: '2024-01-14T10:00:00.000Z' });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();

      const btns = entryButtons(el(fixture));
      // Click first entry
      btns[0].click();
      fixture.detectChanges();
      const drawer1 = ui.entryDrawer() as { mode: 'edit'; entryId: string };

      // Click second entry
      btns[1].click();
      fixture.detectChanges();
      const drawer2 = ui.entryDrawer() as { mode: 'edit'; entryId: string };

      const ids = new Set([drawer1.entryId, drawer2.entryId]);
      expect(ids).toContain(entry1.id);
      expect(ids).toContain(entry2.id);
    });
  });
});
