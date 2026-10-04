import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi } from 'vitest';
import { ReportSectionComponent } from './report-section';
import { TimesheetStore } from '../state/timesheet-store';
import { UiState } from '../state/ui-state';
import type { ReportFilter } from '../domain/models';

function setup(): {
  fixture: ComponentFixture<ReportSectionComponent>;
  store: TimesheetStore;
  ui: UiState;
} {
  TestBed.configureTestingModule({
    imports: [ReportSectionComponent],
    providers: [provideZonelessChangeDetection()],
  });
  const store = TestBed.inject(TimesheetStore);
  const ui = TestBed.inject(UiState);
  const fixture = TestBed.createComponent(ReportSectionComponent);
  fixture.detectChanges();
  return { fixture, store, ui };
}

function el(fixture: ComponentFixture<ReportSectionComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function chip(root: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    (Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === text,
    ) as HTMLButtonElement) ?? null
  );
}

function selectEl(root: HTMLElement, label: string): HTMLSelectElement | null {
  const select = root.querySelector(`[aria-label="${label}"]`);
  return (select as HTMLSelectElement) ?? null;
}

describe('ReportSectionComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Job selector ─────────────────────────────────────────────────────────────

  describe('Job selector', () => {
    it('renders a select with aria-label "Report Job"', () => {
      const { fixture } = setup();
      expect(selectEl(el(fixture), 'Report Job')).not.toBeNull();
    });

    it('lists all active Jobs in the select', () => {
      const { fixture, store } = setup();
      store.addJob('Alpha', 20);
      store.addJob('Beta', 30);
      fixture.detectChanges();
      const select = selectEl(el(fixture), 'Report Job')!;
      const options = Array.from(select.options).map((o) => o.text);
      expect(options).toContain('Alpha');
      expect(options).toContain('Beta');
    });

    it('lists archived Jobs labelled with "(archived)"', () => {
      const { fixture, store } = setup();
      store.addJob('Active', 20);
      const archivedJob = store.addJob('OldClient', 15);
      store.setArchived(archivedJob.id, true);
      fixture.detectChanges();
      const select = selectEl(el(fixture), 'Report Job')!;
      const options = Array.from(select.options).map((o) => o.text);
      expect(options.some((t) => t.includes('OldClient') && t.includes('(archived)'))).toBe(true);
    });

    it('includes archived Jobs in the same select as active Jobs', () => {
      const { fixture, store } = setup();
      store.addJob('Active', 20);
      const archived = store.addJob('OldClient', 15);
      store.setArchived(archived.id, true);
      fixture.detectChanges();
      const select = selectEl(el(fixture), 'Report Job')!;
      expect(select.options.length).toBeGreaterThanOrEqual(2);
    });

    it('changing the select calls ui.setReportJob with the selected job id', () => {
      const { fixture, store, ui } = setup();
      const job1 = store.addJob('Alpha', 20);
      const job2 = store.addJob('Beta', 30);
      fixture.detectChanges();
      const spy = vi.spyOn(ui, 'setReportJob');
      const select = selectEl(el(fixture), 'Report Job')!;
      select.value = job2.id;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(spy).toHaveBeenCalledWith(job2.id);
      spy.mockRestore();
    });

    it('select value reflects the current ui.reportJobId', () => {
      const { fixture, store, ui } = setup();
      const job1 = store.addJob('Alpha', 20);
      const job2 = store.addJob('Beta', 30);
      fixture.detectChanges();
      ui.setReportJob(job2.id);
      fixture.detectChanges();
      const select = selectEl(el(fixture), 'Report Job')!;
      expect(select.value).toBe(job2.id);
    });
  });

  // ─── filter chips ─────────────────────────────────────────────────────────────

  describe('filter chips', () => {
    it('renders a "This Week" chip button', () => {
      const { fixture } = setup();
      expect(chip(el(fixture), 'This Week')).not.toBeNull();
    });

    it('renders a "This Month" chip button', () => {
      const { fixture } = setup();
      expect(chip(el(fixture), 'This Month')).not.toBeNull();
    });

    it('renders an "All Time" chip button', () => {
      const { fixture } = setup();
      expect(chip(el(fixture), 'All Time')).not.toBeNull();
    });

    it('renders a "Custom" chip button', () => {
      const { fixture } = setup();
      expect(chip(el(fixture), 'Custom')).not.toBeNull();
    });

    it('renders a "Current Pay Period" chip button', () => {
      const { fixture } = setup();
      expect(chip(el(fixture), 'Current Pay Period')).not.toBeNull();
    });

    it('renders a "Past Pay Period" chip button', () => {
      const { fixture } = setup();
      expect(chip(el(fixture), 'Past Pay Period')).not.toBeNull();
    });

    it('clicking "This Month" sets filter to {kind:"thisMonth"}', () => {
      const { fixture, ui } = setup();
      chip(el(fixture), 'This Month')!.click();
      fixture.detectChanges();
      expect(ui.filter()).toEqual({ kind: 'thisMonth' });
    });

    it('clicking "All Time" sets filter to {kind:"allTime"}', () => {
      const { fixture, ui } = setup();
      chip(el(fixture), 'All Time')!.click();
      fixture.detectChanges();
      expect(ui.filter()).toEqual({ kind: 'allTime' });
    });

    it('clicking "This Week" sets filter to {kind:"thisWeek"}', () => {
      const { fixture, ui } = setup();
      // change away first
      chip(el(fixture), 'All Time')!.click();
      fixture.detectChanges();
      chip(el(fixture), 'This Week')!.click();
      fixture.detectChanges();
      expect(ui.filter()).toEqual({ kind: 'thisWeek' });
    });

    it('clicking "Current Pay Period" sets filter to {kind:"currentPayPeriod"}', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25, {
        anchor: '2024-01-01T00:00:00.000Z',
        frequency: 'Weekly',
      });
      ui.setReportJob(job.id);
      fixture.detectChanges();
      chip(el(fixture), 'Current Pay Period')!.click();
      fixture.detectChanges();
      expect(ui.filter()).toEqual({ kind: 'currentPayPeriod' });
    });

    it('clicking "Past Pay Period" sets filter to {kind:"pastPayPeriod"}', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25, {
        anchor: '2024-01-01T00:00:00.000Z',
        frequency: 'Weekly',
      });
      ui.setReportJob(job.id);
      fixture.detectChanges();
      chip(el(fixture), 'Past Pay Period')!.click();
      fixture.detectChanges();
      expect(ui.filter()).toEqual({ kind: 'pastPayPeriod' });
    });
  });

  // ─── pay-period chips disabled when no payPeriod ──────────────────────────────

  describe('pay-period chips disabled when reportJob has no payPeriod', () => {
    it('"Current Pay Period" chip is disabled when reportJob.payPeriod is null', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      fixture.detectChanges();
      expect(chip(el(fixture), 'Current Pay Period')?.disabled).toBe(true);
    });

    it('"Past Pay Period" chip is disabled when reportJob.payPeriod is null', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      fixture.detectChanges();
      expect(chip(el(fixture), 'Past Pay Period')?.disabled).toBe(true);
    });

    it('"Current Pay Period" chip is enabled when reportJob has a payPeriod', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25, {
        anchor: '2024-01-01T00:00:00.000Z',
        frequency: 'Weekly',
      });
      ui.setReportJob(job.id);
      fixture.detectChanges();
      expect(chip(el(fixture), 'Current Pay Period')?.disabled).toBe(false);
    });

    it('"Past Pay Period" chip is enabled when reportJob has a payPeriod', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25, {
        anchor: '2024-01-01T00:00:00.000Z',
        frequency: 'Weekly',
      });
      ui.setReportJob(job.id);
      fixture.detectChanges();
      expect(chip(el(fixture), 'Past Pay Period')?.disabled).toBe(false);
    });

    it('"Current Pay Period" chip is disabled when no job is selected', () => {
      const { fixture } = setup();
      // no jobs added
      fixture.detectChanges();
      expect(chip(el(fixture), 'Current Pay Period')?.disabled).toBe(true);
    });

    it('"This Week" chip is never disabled regardless of payPeriod', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      fixture.detectChanges();
      expect(chip(el(fixture), 'This Week')?.disabled).toBe(false);
    });
  });

  // ─── Custom filter date inputs ────────────────────────────────────────────────

  describe('Custom filter date inputs', () => {
    it('shows "From" and "To" date inputs when Custom chip is active', () => {
      const { fixture } = setup();
      chip(el(fixture), 'Custom')!.click();
      fixture.detectChanges();
      expect(el(fixture).querySelector('[aria-label="From"]')).not.toBeNull();
      expect(el(fixture).querySelector('[aria-label="To"]')).not.toBeNull();
    });

    it('does not show date inputs when filter is not Custom', () => {
      const { fixture } = setup();
      // default is thisWeek
      fixture.detectChanges();
      expect(el(fixture).querySelector('[aria-label="From"]')).toBeNull();
      expect(el(fixture).querySelector('[aria-label="To"]')).toBeNull();
    });

    it('updating "From" input updates the custom filter from date', () => {
      const { fixture, ui } = setup();
      chip(el(fixture), 'Custom')!.click();
      fixture.detectChanges();
      const fromInput = el(fixture).querySelector('[aria-label="From"]') as HTMLInputElement;
      fromInput.value = '2024-01-10';
      fromInput.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      const filter = ui.filter() as { kind: 'custom'; from: string; to: string };
      expect(filter.from).toBe('2024-01-10');
    });

    it('updating "To" input updates the custom filter to date', () => {
      const { fixture, ui } = setup();
      chip(el(fixture), 'Custom')!.click();
      fixture.detectChanges();
      const toInput = el(fixture).querySelector('[aria-label="To"]') as HTMLInputElement;
      toInput.value = '2024-01-20';
      toInput.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      const filter = ui.filter() as { kind: 'custom'; from: string; to: string };
      expect(filter.to).toBe('2024-01-20');
    });
  });

  // ─── totals display ────────────────────────────────────────────────────────────

  describe('totals display with seeded entries', () => {
    it('shows [data-testid="total-hours"] element', () => {
      const { fixture } = setup();
      expect(el(fixture).querySelector('[data-testid="total-hours"]')).not.toBeNull();
    });

    it('shows [data-testid="gross-income"] element', () => {
      const { fixture } = setup();
      expect(el(fixture).querySelector('[data-testid="gross-income"]')).not.toBeNull();
    });

    it('total-hours is 0.00 with no entries in range', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(el(fixture).querySelector('[data-testid="total-hours"]')!.textContent).toContain(
        '0.00',
      );
    });

    it('total-hours reflects sum of completed entries in range', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      // Two 1-hour entries = 2 hours total
      store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      store.addEntry({
        jobId: job.id,
        start: '2024-01-14T09:00:00.000Z',
        end: '2024-01-14T10:00:00.000Z',
      });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(el(fixture).querySelector('[data-testid="total-hours"]')!.textContent).toContain(
        '2.00',
      );
    });

    it('gross-income reflects sum of hours × rate over completed entries', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      // 2 hours at $25 = $50.00
      store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T11:00:00.000Z',
      });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(el(fixture).querySelector('[data-testid="gross-income"]')!.textContent).toContain(
        '50.00',
      );
    });

    it('Live Session is excluded from totals', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      // One completed 1-hour entry = 1 hour; Live Session should not add to total
      store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      store.clockIn(job.id);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(el(fixture).querySelector('[data-testid="total-hours"]')!.textContent).toContain(
        '1.00',
      );
    });

    it('gross-income is shown as plain decimal with 2 decimal places, no currency symbol', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 22.5);
      // 2 hours at $22.50 = 45.00
      store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T11:00:00.000Z',
      });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      const incomeText =
        el(fixture).querySelector('[data-testid="gross-income"]')!.textContent ?? '';
      // no currency symbol
      expect(incomeText).not.toMatch(/[$€£¥]/);
      expect(incomeText).toContain('45.00');
    });
  });

  // ─── Export CSV ───────────────────────────────────────────────────────────────

  describe('Export CSV', () => {
    it('renders an "Export CSV" button', () => {
      const { fixture } = setup();
      expect(
        Array.from(el(fixture).querySelectorAll('button')).some((b) =>
          b.textContent?.trim().includes('Export CSV'),
        ),
      ).toBe(true);
    });

    it('clicking Export CSV calls URL.createObjectURL with a Blob', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();

      const createObjectURL = vi.fn((_obj: Blob | MediaSource) => 'blob:mock-url');
      const revokeObjectURL = vi.fn();
      Object.defineProperty(globalThis, 'URL', {
        value: { createObjectURL, revokeObjectURL },
        writable: true,
        configurable: true,
      });

      const exportBtn = Array.from(el(fixture).querySelectorAll('button')).find((b) =>
        b.textContent?.trim().includes('Export CSV'),
      ) as HTMLButtonElement;
      exportBtn.click();
      fixture.detectChanges();

      expect(createObjectURL).toHaveBeenCalledOnce();
      const arg = createObjectURL.mock.calls[0][0];
      expect(arg).toBeInstanceOf(Blob);
    });

    it('the CSV Blob has text/csv mime type', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();

      const createObjectURL = vi.fn((_obj: Blob | MediaSource) => 'blob:mock-url');
      Object.defineProperty(globalThis, 'URL', {
        value: { createObjectURL, revokeObjectURL: vi.fn() },
        writable: true,
        configurable: true,
      });

      const exportBtn = Array.from(el(fixture).querySelectorAll('button')).find((b) =>
        b.textContent?.trim().includes('Export CSV'),
      ) as HTMLButtonElement;
      exportBtn.click();
      fixture.detectChanges();

      const blob = createObjectURL.mock.calls[0][0] as Blob;
      expect(blob.type).toBe('text/csv');
    });

    it('the download filename includes the job name', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme Corp', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();

      const createObjectURL = vi.fn((_obj: Blob | MediaSource) => 'blob:mock-url');
      Object.defineProperty(globalThis, 'URL', {
        value: { createObjectURL, revokeObjectURL: vi.fn() },
        writable: true,
        configurable: true,
      });

      // Spy on anchor creation to capture the filename
      const anchors: HTMLAnchorElement[] = [];
      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const node = origCreate(tag);
        if (tag === 'a') anchors.push(node as HTMLAnchorElement);
        return node;
      });

      const exportBtn = Array.from(el(fixture).querySelectorAll('button')).find((b) =>
        b.textContent?.trim().includes('Export CSV'),
      ) as HTMLButtonElement;
      exportBtn.click();
      fixture.detectChanges();

      const anchor = anchors.find((a) => a.download !== '');
      expect(anchor?.download).toContain('Acme Corp');
      vi.restoreAllMocks();
    });
  });
});
