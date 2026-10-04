import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi } from 'vitest';
import { SettingsDrawerComponent } from './settings-drawer';
import { TimesheetStore } from '../state/timesheet-store';
import { UiState } from '../state/ui-state';

function setup(): { fixture: ComponentFixture<SettingsDrawerComponent>; store: TimesheetStore; ui: UiState } {
  TestBed.configureTestingModule({
    imports: [SettingsDrawerComponent],
    providers: [provideZonelessChangeDetection()],
  });
  const store = TestBed.inject(TimesheetStore);
  const ui = TestBed.inject(UiState);
  const fixture = TestBed.createComponent(SettingsDrawerComponent);
  fixture.detectChanges();
  return { fixture, store, ui };
}

function root(fixture: ComponentFixture<SettingsDrawerComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function btn(el: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    (Array.from(el.querySelectorAll('button')).find(b =>
      b.textContent?.trim().includes(text),
    ) as HTMLButtonElement) ?? null
  );
}

/** Finds a form control by its aria-label, falling back to an associated <label> element. */
function field(el: HTMLElement, label: string): HTMLInputElement | HTMLSelectElement | null {
  const byAria = el.querySelector(`[aria-label="${label}"]`);
  if (byAria) return byAria as HTMLInputElement;
  const lbl = Array.from(el.querySelectorAll('label')).find(
    l => l.textContent?.trim() === label,
  );
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

/** Finds the first input whose current value matches the given string. */
function inputWithValue(el: HTMLElement, value: string): HTMLInputElement | null {
  return (
    (Array.from(el.querySelectorAll('input')).find(
      i => (i as HTMLInputElement).value === value,
    ) as HTMLInputElement) ?? null
  );
}

/** Stubs window.FileReader to invoke onload synchronously with the given content. */
function mockFileReader(content: string): void {
  vi.stubGlobal(
    'FileReader',
    class {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      readAsText(_file: File): void {
        this.onload?.({ target: { result: content } });
      }
    },
  );
}

/** Simulates selecting a file on an <input type="file"> element. */
function selectFile(input: HTMLInputElement, content: string, name = 'backup.json'): void {
  const file = new File([content], name, { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

const VALID_IMPORT_JSON = JSON.stringify({
  schemaVersion: 1,
  jobs: [{ id: 'j-imported', name: 'Imported Job', defaultRate: 50, payPeriod: null, archived: false }],
  entries: [],
});

describe('SettingsDrawerComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ─── add Job ──────────────────────────────────────────────────────────────────

  describe('add Job', () => {
    it('filling Name and Rate then adding creates the Job in the store', () => {
      const { fixture, store, ui } = setup();
      ui.openSettings();
      fixture.detectChanges();

      setField(field(root(fixture), 'Name') as HTMLInputElement, 'Acme');
      setField(field(root(fixture), 'Rate') as HTMLInputElement, '25');
      fixture.detectChanges();

      btn(root(fixture), 'Add Job')!.click();
      fixture.detectChanges();

      expect(store.activeJobs().some(j => j.name === 'Acme' && j.defaultRate === 25)).toBe(true);
    });

    it('newly added Job appears as text in the drawer', () => {
      const { fixture, store: _store, ui } = setup();
      ui.openSettings();
      fixture.detectChanges();

      setField(field(root(fixture), 'Name') as HTMLInputElement, 'Bravo Corp');
      setField(field(root(fixture), 'Rate') as HTMLInputElement, '40');
      fixture.detectChanges();

      btn(root(fixture), 'Add Job')!.click();
      fixture.detectChanges();

      expect(root(fixture).textContent).toContain('Bravo Corp');
    });

    it('adding a Job with a Pay Period stores the Pay Period on the Job', () => {
      const { fixture, store, ui } = setup();
      ui.openSettings();
      fixture.detectChanges();

      setField(field(root(fixture), 'Name') as HTMLInputElement, 'Acme');
      setField(field(root(fixture), 'Rate') as HTMLInputElement, '25');
      const anchorInput = field(root(fixture), 'Pay Period Anchor') as HTMLInputElement;
      setField(anchorInput, '2024-01-01T09:00');
      const freqSelect = field(root(fixture), 'Frequency') as HTMLSelectElement;
      setField(freqSelect, 'Biweekly');
      fixture.detectChanges();

      btn(root(fixture), 'Add Job')!.click();
      fixture.detectChanges();

      const job = store.activeJobs().find(j => j.name === 'Acme');
      expect(job?.payPeriod).not.toBeNull();
      expect(job?.payPeriod?.frequency).toBe('Biweekly');
    });
  });

  // ─── rename and rate change ───────────────────────────────────────────────────

  describe('rename and rate change', () => {
    it('renaming a Job and saving updates its name in the store', () => {
      const { fixture, store, ui } = setup();
      store.addJob('OldName', 30);
      ui.openSettings();
      fixture.detectChanges();

      const nameInput = inputWithValue(root(fixture), 'OldName')!;
      setField(nameInput, 'NewName');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(store.jobs().some(j => j.name === 'NewName')).toBe(true);
      expect(store.jobs().some(j => j.name === 'OldName')).toBe(false);
    });

    it('changing the Job Default Rate and saving updates the rate in the store', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openSettings();
      fixture.detectChanges();

      const rateInput = inputWithValue(root(fixture), '30')!;
      setField(rateInput, '55');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(store.activeJobs()[0].defaultRate).toBe(55);
    });

    it('changing the Job Default Rate does not alter existing Entry rates (ADR-0002)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-01T12:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      store.addEntry({
        jobId: job.id,
        start: '2024-03-01T09:00:00.000Z',
        end: '2024-03-01T10:00:00.000Z',
      });
      ui.openSettings();
      fixture.detectChanges();

      const rateInput = inputWithValue(root(fixture), '30')!;
      setField(rateInput, '99');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      expect(store.entries()[0].rate).toBe(30);
    });

    it('setting a Pay Period and saving stores the Pay Period on the Job', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openSettings();
      fixture.detectChanges();

      const anchorInput = field(root(fixture), 'Pay Period Anchor') as HTMLInputElement;
      setField(anchorInput, '2024-06-03T09:00');
      const freqSelect = field(root(fixture), 'Frequency') as HTMLSelectElement;
      setField(freqSelect, 'Weekly');
      fixture.detectChanges();

      btn(root(fixture), 'Save')!.click();
      fixture.detectChanges();

      const job = store.jobs()[0];
      expect(job.payPeriod).not.toBeNull();
      expect(job.payPeriod?.frequency).toBe('Weekly');
    });
  });

  // ─── archive ──────────────────────────────────────────────────────────────────

  describe('archive', () => {
    it('clicking Archive moves the Job to the Archived section', () => {
      const { fixture, store: _store, ui } = setup();
      _store.addJob('Acme', 30);
      ui.openSettings();
      fixture.detectChanges();

      btn(root(fixture), 'Archive')!.click();
      fixture.detectChanges();

      const details = root(fixture).querySelector('details');
      expect(details?.textContent).toContain('Acme');
    });

    it('archived Job no longer appears in the active-Jobs list', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openSettings();
      fixture.detectChanges();

      btn(root(fixture), 'Archive')!.click();
      fixture.detectChanges();

      expect(store.activeJobs().some(j => j.name === 'Acme')).toBe(false);
    });

    it('clicking Unarchive restores the Job to active', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      store.setArchived(job.id, true);
      ui.openSettings();
      fixture.detectChanges();

      btn(root(fixture), 'Unarchive')!.click();
      fixture.detectChanges();

      expect(store.activeJobs().some(j => j.name === 'Acme')).toBe(true);
    });

    it('unarchived Job is removed from the Archived section', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      store.setArchived(job.id, true);
      ui.openSettings();
      fixture.detectChanges();

      btn(root(fixture), 'Unarchive')!.click();
      fixture.detectChanges();

      expect(store.archivedJobs().some(j => j.name === 'Acme')).toBe(false);
    });
  });

  // ─── archive while Live Session runs ─────────────────────────────────────────

  describe('archive while Live Session runs', () => {
    it('shows "Clock out first" in [role="alert"] when archiving the running Job', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-01T09:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      store.clockIn(job.id);
      ui.openSettings();
      fixture.detectChanges();

      btn(root(fixture), 'Archive')!.click();
      fixture.detectChanges();

      const alert = root(fixture).querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('Clock out first');
    });

    it('the Job is NOT archived when archiving is blocked by a Live Session', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-01T09:00:00.000Z'));
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      store.clockIn(job.id);
      ui.openSettings();
      fixture.detectChanges();

      btn(root(fixture), 'Archive')!.click();
      fixture.detectChanges();

      expect(store.jobs().find(j => j.id === job.id)?.archived).toBe(false);
    });
  });

  // ─── no delete ────────────────────────────────────────────────────────────────

  describe('no delete button', () => {
    it('no Delete button is shown for an active Job', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openSettings();
      fixture.detectChanges();

      expect(btn(root(fixture), 'Delete')).toBeNull();
    });

    it('no Delete button is shown for an archived Job', () => {
      const { fixture, store, ui } = setup();
      const job = store.addJob('Acme', 30);
      store.setArchived(job.id, true);
      ui.openSettings();
      fixture.detectChanges();

      expect(btn(root(fixture), 'Delete')).toBeNull();
    });
  });

  // ─── import JSON ──────────────────────────────────────────────────────────────

  describe('import JSON', () => {
    it('does not call importJson when confirm returns false', () => {
      const { fixture, store, ui } = setup();
      ui.openSettings();
      fixture.detectChanges();

      const importSpy = vi.spyOn(store, 'importJson');
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      mockFileReader(VALID_IMPORT_JSON);

      const importInput = root(fixture).querySelector('[aria-label="Import JSON"]') as HTMLInputElement;
      selectFile(importInput, VALID_IMPORT_JSON);
      fixture.detectChanges();

      expect(importSpy).not.toHaveBeenCalled();
    });

    it('existing data is unchanged when confirm returns false', () => {
      const { fixture, store, ui } = setup();
      store.addJob('OriginalJob', 20);
      ui.openSettings();
      fixture.detectChanges();

      vi.spyOn(window, 'confirm').mockReturnValue(false);
      mockFileReader(VALID_IMPORT_JSON);

      const importInput = root(fixture).querySelector('[aria-label="Import JSON"]') as HTMLInputElement;
      selectFile(importInput, VALID_IMPORT_JSON);
      fixture.detectChanges();

      expect(store.jobs().some(j => j.name === 'OriginalJob')).toBe(true);
    });

    it('calls importJson with the file content when confirm returns true', () => {
      const { fixture, store, ui } = setup();
      ui.openSettings();
      fixture.detectChanges();

      const importSpy = vi.spyOn(store, 'importJson');
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockFileReader(VALID_IMPORT_JSON);

      const importInput = root(fixture).querySelector('[aria-label="Import JSON"]') as HTMLInputElement;
      selectFile(importInput, VALID_IMPORT_JSON);
      fixture.detectChanges();

      expect(importSpy).toHaveBeenCalledWith(VALID_IMPORT_JSON);
    });

    it('data is replaced when confirm returns true', () => {
      const { fixture, store, ui } = setup();
      store.addJob('OriginalJob', 20);
      ui.openSettings();
      fixture.detectChanges();

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockFileReader(VALID_IMPORT_JSON);

      const importInput = root(fixture).querySelector('[aria-label="Import JSON"]') as HTMLInputElement;
      selectFile(importInput, VALID_IMPORT_JSON);
      fixture.detectChanges();

      expect(store.jobs().some(j => j.name === 'Imported Job')).toBe(true);
      expect(store.jobs().some(j => j.name === 'OriginalJob')).toBe(false);
    });

    it('shows [role="alert"] when the imported JSON is invalid', () => {
      const { fixture, store: _store, ui } = setup();
      ui.openSettings();
      fixture.detectChanges();

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockFileReader('not valid json at all');

      const importInput = root(fixture).querySelector('[aria-label="Import JSON"]') as HTMLInputElement;
      selectFile(importInput, 'not valid json at all');
      fixture.detectChanges();

      const alert = root(fixture).querySelector('[role="alert"]');
      expect(alert?.textContent?.trim().length).toBeGreaterThan(0);
    });
  });

  // ─── clear all data ───────────────────────────────────────────────────────────

  describe('clear all data', () => {
    it('does not call clearAll when confirm returns false', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openSettings();
      fixture.detectChanges();

      const clearSpy = vi.spyOn(store, 'clearAll');
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      btn(root(fixture), 'Clear all data')!.click();
      fixture.detectChanges();

      expect(clearSpy).not.toHaveBeenCalled();
    });

    it('data is retained when confirm returns false', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openSettings();
      fixture.detectChanges();

      vi.spyOn(window, 'confirm').mockReturnValue(false);
      btn(root(fixture), 'Clear all data')!.click();
      fixture.detectChanges();

      expect(store.jobs().length).toBe(1);
    });

    it('calls clearAll when confirm returns true', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openSettings();
      fixture.detectChanges();

      const clearSpy = vi.spyOn(store, 'clearAll');
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      btn(root(fixture), 'Clear all data')!.click();
      fixture.detectChanges();

      expect(clearSpy).toHaveBeenCalled();
    });

    it('all Jobs are removed when confirm returns true', () => {
      const { fixture, store, ui } = setup();
      store.addJob('Acme', 30);
      ui.openSettings();
      fixture.detectChanges();

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      btn(root(fixture), 'Clear all data')!.click();
      fixture.detectChanges();

      expect(store.jobs().length).toBe(0);
    });
  });
});
