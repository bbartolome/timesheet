import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi } from 'vitest';
import { EntryDrawerComponent } from './entry-drawer';
import { TimesheetStore } from '../state/timesheet-store';
import { UiState } from '../state/ui-state';

function setup(): {
  fixture: ComponentFixture<EntryDrawerComponent>;
  store: TimesheetStore;
  ui: UiState;
} {
  TestBed.configureTestingModule({
    imports: [EntryDrawerComponent],
    providers: [provideZonelessChangeDetection()],
  });
  const store = TestBed.inject(TimesheetStore);
  const ui = TestBed.inject(UiState);
  const fixture = TestBed.createComponent(EntryDrawerComponent);
  fixture.detectChanges();
  return { fixture, store, ui };
}

function root(fixture: ComponentFixture<EntryDrawerComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function btn(el: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    (Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().includes(text),
    ) as HTMLButtonElement) ?? null
  );
}

/** Finds a form control by its aria-label, falling back to an associated <label> element. */
function field(el: HTMLElement, label: string): HTMLInputElement | HTMLSelectElement | null {
  const byAria = el.querySelector(`[aria-label="${label}"]`);
  if (byAria) return byAria as HTMLInputElement;
  const lbl = Array.from(el.querySelectorAll('label')).find((l) => l.textContent?.trim() === label);
  if (!lbl) return null;
  const forId = lbl.getAttribute('for');
  if (forId) return el.querySelector(`#${forId}`) as HTMLInputElement | null;
  return lbl.querySelector('input,select,textarea') as HTMLInputElement | null;
}

function setField(control: HTMLInputElement | HTMLSelectElement, value: string): void {
  control.value = value;
  control.dispatchEvent(new Event('input'));
  control.dispatchEvent(new Event('change'));
}

describe('EntryDrawerComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ─── new-entry mode ───────────────────────────────────────────────────────────

  describe('new-entry mode', () => {
    it('title is "New Entry"', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 25);
      ui.openNewEntry();
      fixture.detectChanges();
      expect(root(fixture).textContent).toContain('New Entry');
    });

    it('Entry Rate input is prefilled with the selected Job Default Rate', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();
      const rateInput = field(root(fixture), 'Entry Rate') as HTMLInputElement;
      expect(rateInput).not.toBeNull();
      expect(Number(rateInput.value)).toBe(30);
    });

    it('saving with no Rate override stores the Job Default Rate on the Entry', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 45);
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T09:00');
      setField(field(root(fixture), 'End') as HTMLInputElement, '2024-01-13T10:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(store.entries()[0].rate).toBe(45);
    });

    it('Rate override is saved on the Entry', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T09:00');
      setField(field(root(fixture), 'End') as HTMLInputElement, '2024-01-13T10:00');
      setField(field(root(fixture), 'Entry Rate') as HTMLInputElement, '75');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(store.entries()[0].rate).toBe(75);
    });

    it('closes the drawer after a successful save', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T09:00');
      setField(field(root(fixture), 'End') as HTMLInputElement, '2024-01-13T10:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(ui.entryDrawer()).toBeNull();
    });

    it('does not show a Delete button in new-entry mode', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();
      expect(btn(root(fixture), 'Delete')).toBeNull();
    });
  });

  // ─── midnight-crossing entry ──────────────────────────────────────────────────

  describe('midnight-crossing entry', () => {
    it('saves an entry whose end is on the next calendar day', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T22:00');
      setField(field(root(fixture), 'End') as HTMLInputElement, '2024-01-14T02:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(store.entries().length).toBe(1);
    });

    it('the saved midnight-crossing entry has end after start', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T22:00');
      setField(field(root(fixture), 'End') as HTMLInputElement, '2024-01-14T02:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      const entry = store.entries()[0];
      expect(new Date(entry.end!).getTime()).toBeGreaterThan(new Date(entry.start).getTime());
    });

    it('no error alert is shown for a valid midnight-crossing entry', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T22:00');
      setField(field(root(fixture), 'End') as HTMLInputElement, '2024-01-14T02:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      const alert = root(fixture).querySelector('[role="alert"]');
      expect(alert?.textContent?.trim()).toBeFalsy();
    });
  });

  // ─── End required validation ──────────────────────────────────────────────────

  describe('End required validation', () => {
    it('shows "End is required" in [role="alert"] when End is empty for a new entry', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T09:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      const alert = root(fixture).querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert!.textContent).toContain('End is required');
    });

    it('does not add an entry when End is empty for a new entry', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T09:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(store.entries().length).toBe(0);
    });

    it('drawer stays open when End is empty for a new entry', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T09:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(ui.entryDrawer()).not.toBeNull();
    });

    it('shows "End is required" when End is cleared while editing a completed entry', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.openEditEntry(entry.id);
      fixture.detectChanges();

      setField(field(root(fixture), 'End') as HTMLInputElement, '');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      const alert = root(fixture).querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert!.textContent).toContain('End is required');
    });

    it('does not update the entry when End is cleared on a completed entry', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.openEditEntry(entry.id);
      fixture.detectChanges();

      setField(field(root(fixture), 'End') as HTMLInputElement, '');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(store.entries()[0].end).toBe('2024-01-13T10:00:00.000Z');
    });
  });

  // ─── Live Session edit – End optional ────────────────────────────────────────

  describe('Live Session edit – End optional', () => {
    it('saves successfully when End is left empty while editing the Live Session', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      store.clockIn(job.id);
      const liveSession = store.liveSession()!;
      ui.openEditEntry(liveSession.id);
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-15T10:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      const alert = root(fixture).querySelector('[role="alert"]');
      expect(alert?.textContent?.trim()).toBeFalsy();
    });

    it('closes the drawer after saving the Live Session with no End', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      store.clockIn(job.id);
      const liveSession = store.liveSession()!;
      ui.openEditEntry(liveSession.id);
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-15T10:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(ui.entryDrawer()).toBeNull();
    });

    it('Live Session remains active (end stays null) after saving with no End', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      store.clockIn(job.id);
      const liveSession = store.liveSession()!;
      ui.openEditEntry(liveSession.id);
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-15T10:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(store.liveSession()).not.toBeNull();
      expect(store.liveSession()!.end).toBeNull();
    });
  });

  // ─── end ≤ start validation ───────────────────────────────────────────────────

  describe('end ≤ start validation', () => {
    it('shows [role="alert"] when end is before start', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T10:00');
      setField(field(root(fixture), 'End') as HTMLInputElement, '2024-01-13T09:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      const alert = root(fixture).querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert!.textContent?.trim().length).toBeGreaterThan(0);
    });

    it('shows [role="alert"] when end equals start', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T10:00');
      setField(field(root(fixture), 'End') as HTMLInputElement, '2024-01-13T10:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      const alert = root(fixture).querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert!.textContent?.trim().length).toBeGreaterThan(0);
    });

    it('does not add an entry to the store when end <= start', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T10:00');
      setField(field(root(fixture), 'End') as HTMLInputElement, '2024-01-13T09:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(store.entries().length).toBe(0);
    });

    it('drawer remains open after an end <= start error', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T10:00');
      setField(field(root(fixture), 'End') as HTMLInputElement, '2024-01-13T09:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(ui.entryDrawer()).not.toBeNull();
    });
  });

  // ─── overlap warning ──────────────────────────────────────────────────────────

  describe('overlap warning', () => {
    it('shows "Overlaps" text when the entry overlaps an existing entry of the same Job', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T11:00:00.000Z',
      });
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T10:00');
      setField(field(root(fixture), 'End') as HTMLInputElement, '2024-01-13T12:00');
      fixture.detectChanges();

      expect(root(fixture).textContent).toContain('Overlaps');
    });

    it('overlap warning does not block saving — entry is added', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T11:00:00.000Z',
      });
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T10:00');
      setField(field(root(fixture), 'End') as HTMLInputElement, '2024-01-13T12:00');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(store.entries().length).toBe(2);
    });

    it('does not show "Overlaps" when the entry does not overlap', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.openNewEntry();
      fixture.detectChanges();

      setField(field(root(fixture), 'Start') as HTMLInputElement, '2024-01-13T11:00');
      setField(field(root(fixture), 'End') as HTMLInputElement, '2024-01-13T12:00');
      fixture.detectChanges();

      expect(root(fixture).textContent).not.toContain('Overlaps');
    });
  });

  // ─── edit mode ────────────────────────────────────────────────────────────────

  describe('edit mode', () => {
    it('title is "Edit Entry"', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.openEditEntry(entry.id);
      fixture.detectChanges();
      expect(root(fixture).textContent).toContain('Edit Entry');
    });

    it('Entry Rate input is disabled', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.openEditEntry(entry.id);
      fixture.detectChanges();
      const rateInput = field(root(fixture), 'Entry Rate') as HTMLInputElement;
      expect(rateInput).not.toBeNull();
      expect(rateInput.disabled).toBe(true);
    });

    it('Entry Rate input shows the Entry Rate snapshot, not the current Job Default Rate', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      // Mutate the Job Default Rate after the Entry was created
      store.updateJob(job.id, { defaultRate: 99 });
      ui.openEditEntry(entry.id);
      fixture.detectChanges();
      const rateInput = field(root(fixture), 'Entry Rate') as HTMLInputElement;
      expect(Number(rateInput.value)).toBe(30);
    });

    it('shows a Delete button', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.openEditEntry(entry.id);
      fixture.detectChanges();
      expect(btn(root(fixture), 'Delete')).not.toBeNull();
    });

    it('Job select shows the entry Job when editing', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const jobA = store.addJob('Acme', 30);
      store.addJob('Beta', 40);
      const entry = store.addEntry({
        jobId: jobA.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.openEditEntry(entry.id);
      fixture.detectChanges();
      const jobSelect = field(root(fixture), 'Job') as HTMLSelectElement;
      expect(jobSelect.value).toBe(jobA.id);
    });
  });

  // ─── selected Job option ──────────────────────────────────────────────────────

  describe('selected Job option', () => {
    it('the first active Job is pre-selected in new-entry mode', () => {
      const { fixture, store, ui } = setup();
      const first = store.addJob('Alpha', 20);
      store.addJob('Beta', 40);
      ui.openNewEntry();
      fixture.detectChanges();
      const jobSelect = field(root(fixture), 'Job') as HTMLSelectElement;
      expect(jobSelect.value).toBe(first.id);
    });

    it('the option matching the entry Job has the selected attribute when editing', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      store.addJob('Alpha', 20);
      const jobB = store.addJob('Beta', 40);
      const entry = store.addEntry({
        jobId: jobB.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.openEditEntry(entry.id);
      fixture.detectChanges();
      const jobSelect = field(root(fixture), 'Job') as HTMLSelectElement;
      const selectedOption = Array.from(jobSelect.options).find((o) => o.selected);
      expect(selectedOption?.value).toBe(jobB.id);
    });
  });

  // ─── no active Jobs ───────────────────────────────────────────────────────────

  describe('no active Jobs', () => {
    it('shows "Create a Job first" when there are no active Jobs', () => {
      const { fixture, ui } = setup();
      ui.openNewEntry();
      fixture.detectChanges();
      expect(root(fixture).textContent).toContain('Create a Job first');
    });

    it('shows an "Open Settings" button when there are no active Jobs', () => {
      const { fixture, ui } = setup();
      ui.openNewEntry();
      fixture.detectChanges();
      expect(btn(root(fixture), 'Open Settings')).not.toBeNull();
    });

    it('does not show a "Save" button when there are no active Jobs', () => {
      const { fixture, ui } = setup();
      ui.openNewEntry();
      fixture.detectChanges();
      expect(btn(root(fixture), 'Save')).toBeNull();
    });

    it('clicking "Open Settings" closes the entry drawer', () => {
      const { fixture, ui } = setup();
      ui.openNewEntry();
      fixture.detectChanges();

      btn(root(fixture), 'Open Settings')!.click();
      fixture.detectChanges();

      expect(ui.entryDrawer()).toBeNull();
    });

    it('clicking "Open Settings" opens the settings drawer', () => {
      const { fixture, ui } = setup();
      ui.openNewEntry();
      fixture.detectChanges();

      btn(root(fixture), 'Open Settings')!.click();
      fixture.detectChanges();

      expect(ui.settingsOpen()).toBe(true);
    });

    it('also shows no active Jobs state when all Jobs are archived', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      store.setArchived(job.id, true);
      ui.openNewEntry();
      fixture.detectChanges();
      expect(root(fixture).textContent).toContain('Create a Job first');
    });
  });

  // ─── delete with window.confirm ───────────────────────────────────────────────

  describe('delete with window.confirm', () => {
    it('clicking Delete calls window.confirm with "Delete this entry?"', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.openEditEntry(entry.id);
      fixture.detectChanges();

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      btn(root(fixture), 'Delete')!.click();
      fixture.detectChanges();

      expect(confirmSpy).toHaveBeenCalledWith('Delete this entry?');
    });

    it('when confirm returns true, the entry is deleted', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.openEditEntry(entry.id);
      fixture.detectChanges();

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      btn(root(fixture), 'Delete')!.click();
      fixture.detectChanges();

      expect(store.entries().length).toBe(0);
    });

    it('when confirm returns true, the drawer is closed', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.openEditEntry(entry.id);
      fixture.detectChanges();

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      btn(root(fixture), 'Delete')!.click();
      fixture.detectChanges();

      expect(ui.entryDrawer()).toBeNull();
    });

    it('when confirm returns false, the entry is NOT deleted', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.openEditEntry(entry.id);
      fixture.detectChanges();

      vi.spyOn(window, 'confirm').mockReturnValue(false);
      btn(root(fixture), 'Delete')!.click();
      fixture.detectChanges();

      expect(store.entries().length).toBe(1);
    });

    it('when confirm returns false, the drawer remains open', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      const entry = store.addEntry({
        jobId: job.id,
        start: '2024-01-13T09:00:00.000Z',
        end: '2024-01-13T10:00:00.000Z',
      });
      ui.openEditEntry(entry.id);
      fixture.detectChanges();

      vi.spyOn(window, 'confirm').mockReturnValue(false);
      btn(root(fixture), 'Delete')!.click();
      fixture.detectChanges();

      expect(ui.entryDrawer()).not.toBeNull();
    });
  });
});
