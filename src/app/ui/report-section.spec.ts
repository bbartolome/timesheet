import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi } from 'vitest';
import { ReportSectionComponent } from './report-section';
import { TimesheetStore } from '../state/timesheet-store';
import { UiState } from '../state/ui-state';
import type { ReportFilter } from '../domain/models';

function captureExportFilename(
  fixture: ComponentFixture<ReportSectionComponent>,
): string | undefined {
  const anchors: HTMLAnchorElement[] = [];
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const node = origCreate(tag);
    if (tag === 'a') anchors.push(node as HTMLAnchorElement);
    return node;
  });
  Object.defineProperty(globalThis, 'URL', {
    value: { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() },
    writable: true,
    configurable: true,
  });
  const exportBtn = Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
  ).find((b) => b.textContent?.trim().includes('Export CSV')) as HTMLButtonElement;
  exportBtn.click();
  fixture.detectChanges();
  vi.restoreAllMocks();
  return anchors.find((a) => a.download !== '')?.download;
}

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
  let savedURL: unknown;

  beforeEach(() => {
    savedURL = (globalThis as Record<string, unknown>)['URL'];
    localStorage.clear();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as Record<string, unknown>)['URL'] = savedURL;
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

      let capturedBlob: Blob | undefined;
      const createObjectURL = vi.fn((obj: Blob | MediaSource) => {
        capturedBlob = obj as Blob;
        return 'blob:mock-url';
      });
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

      expect(capturedBlob?.type).toBe('text/csv');
    });

    it('the download filename uses the sanitized job name (lowercase, non-alnum runs as hyphens)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme Corp', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(captureExportFilename(fixture)).toBe('timesheet-acme-corp.csv');
    });
  });

  // ─── chip aria-pressed and active classes ─────────────────────────────────────

  describe('chip aria-pressed and active classes', () => {
    it('the default active chip ("This Week") has aria-pressed="true"', () => {
      const { fixture } = setup();
      expect(chip(el(fixture), 'This Week')?.getAttribute('aria-pressed')).toBe('true');
    });

    it('inactive chips have aria-pressed="false"', () => {
      const { fixture } = setup();
      const root = el(fixture);
      for (const text of ['This Month', 'All Time', 'Custom']) {
        expect(chip(root, text)?.getAttribute('aria-pressed')).toBe('false');
      }
    });

    it('active chip has bg-amber-300 class', () => {
      const { fixture } = setup();
      expect(chip(el(fixture), 'This Week')?.classList.contains('bg-amber-300')).toBe(true);
    });

    it('active chip has text-stone-900 class', () => {
      const { fixture } = setup();
      expect(chip(el(fixture), 'This Week')?.classList.contains('text-stone-900')).toBe(true);
    });

    it('inactive chip has bg-stone-700 class', () => {
      const { fixture } = setup();
      expect(chip(el(fixture), 'This Month')?.classList.contains('bg-stone-700')).toBe(true);
    });

    it('inactive chip has text-stone-400 class', () => {
      const { fixture } = setup();
      expect(chip(el(fixture), 'This Month')?.classList.contains('text-stone-400')).toBe(true);
    });

    it('clicking a chip transfers aria-pressed and amber classes to it', () => {
      const { fixture } = setup();
      chip(el(fixture), 'This Month')!.click();
      fixture.detectChanges();
      const root = el(fixture);
      expect(chip(root, 'This Month')?.getAttribute('aria-pressed')).toBe('true');
      expect(chip(root, 'This Month')?.classList.contains('bg-amber-300')).toBe(true);
      expect(chip(root, 'This Week')?.getAttribute('aria-pressed')).toBe('false');
      expect(chip(root, 'This Week')?.classList.contains('bg-stone-700')).toBe(true);
    });

    it('only the active chip has bg-amber-300; all others have bg-stone-700', () => {
      const { fixture } = setup();
      chip(el(fixture), 'All Time')!.click();
      fixture.detectChanges();
      const root = el(fixture);
      for (const text of ['This Week', 'This Month', 'Custom']) {
        expect(chip(root, text)?.classList.contains('bg-stone-700')).toBe(true);
        expect(chip(root, text)?.classList.contains('bg-amber-300')).toBe(false);
      }
      expect(chip(root, 'All Time')?.classList.contains('bg-amber-300')).toBe(true);
    });
  });

  // ─── Job select selected option ───────────────────────────────────────────────

  describe('Job select selected option', () => {
    it('the option for the current reportJobId has its selected property true', () => {
      const { fixture, store, ui } = setup();
      const job1 = store.addJob('Alpha', 20);
      const job2 = store.addJob('Beta', 30);
      ui.setReportJob(job2.id);
      fixture.detectChanges();
      const select = selectEl(el(fixture), 'Report Job')!;
      const opt = Array.from(select.options).find((o) => o.value === job2.id);
      expect(opt?.selected).toBe(true);
    });

    it('options for non-selected jobs have selected property false', () => {
      const { fixture, store, ui } = setup();
      const job1 = store.addJob('Alpha', 20);
      const job2 = store.addJob('Beta', 30);
      ui.setReportJob(job2.id);
      fixture.detectChanges();
      const select = selectEl(el(fixture), 'Report Job')!;
      const opt = Array.from(select.options).find((o) => o.value === job1.id);
      expect(opt?.selected).toBe(false);
    });

    it('selected option updates when setReportJob is called again', () => {
      const { fixture, store, ui } = setup();
      const job1 = store.addJob('Alpha', 20);
      const job2 = store.addJob('Beta', 30);
      ui.setReportJob(job1.id);
      fixture.detectChanges();
      ui.setReportJob(job2.id);
      fixture.detectChanges();
      const select = selectEl(el(fixture), 'Report Job')!;
      expect(Array.from(select.options).find((o) => o.value === job2.id)?.selected).toBe(true);
      expect(Array.from(select.options).find((o) => o.value === job1.id)?.selected).toBe(false);
    });
  });

  // ─── empty or invalid custom range ────────────────────────────────────────────

  describe('empty or invalid custom range', () => {
    it('shows "Pick a date range" when custom from is empty', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      chip(el(fixture), 'Custom')!.click();
      fixture.detectChanges();
      // from defaults to '' after clicking Custom
      expect(el(fixture).textContent).toContain('Pick a date range');
    });

    it('shows "Pick a date range" when custom filter has both dates empty', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'custom', from: '', to: '' });
      fixture.detectChanges();
      expect(el(fixture).textContent).toContain('Pick a date range');
    });

    it('shows "Pick a date range" when to is empty', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'custom', from: '2024-01-10', to: '' });
      fixture.detectChanges();
      expect(el(fixture).textContent).toContain('Pick a date range');
    });

    it('shows "Pick a date range" when to is before from', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'custom', from: '2024-01-20', to: '2024-01-10' });
      fixture.detectChanges();
      expect(el(fixture).textContent).toContain('Pick a date range');
    });

    it('shows "0.00" for total-hours when custom range is empty', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'custom', from: '', to: '' });
      fixture.detectChanges();
      expect(el(fixture).querySelector('[data-testid="total-hours"]')?.textContent).toContain(
        '0.00',
      );
    });

    it('does not show "Pick a date range" when custom range is valid', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'custom', from: '2024-01-01', to: '2024-01-31' });
      fixture.detectChanges();
      expect(el(fixture).textContent).not.toContain('Pick a date range');
    });
  });

  // ─── sanitized CSV filename ────────────────────────────────────────────────────

  describe('sanitized CSV filename', () => {
    it('simple lowercase name: "Acme" -> "timesheet-acme.csv"', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(captureExportFilename(fixture)).toBe('timesheet-acme.csv');
    });

    it('spaces become hyphens: "Acme Corp" -> "timesheet-acme-corp.csv"', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme Corp', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(captureExportFilename(fixture)).toBe('timesheet-acme-corp.csv');
    });

    it('special chars collapsed to single hyphen: "Job & Co." -> "timesheet-job-co.csv"', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Job & Co.', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(captureExportFilename(fixture)).toBe('timesheet-job-co.csv');
    });

    it('leading/trailing hyphens trimmed: "  My Client  " -> "timesheet-my-client.csv"', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('  My Client  ', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(captureExportFilename(fixture)).toBe('timesheet-my-client.csv');
    });

    it('digits preserved: "Client 2025" -> "timesheet-client-2025.csv"', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Client 2025', 25);
      ui.setReportJob(job.id);
      ui.filter.set({ kind: 'allTime' });
      fixture.detectChanges();
      expect(captureExportFilename(fixture)).toBe('timesheet-client-2025.csv');
    });
  });
});
