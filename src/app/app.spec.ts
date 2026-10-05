import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { App } from './app';
import { UiState } from './state/ui-state';
import { STORAGE_KEY } from './domain/models';

function setup(): { fixture: ComponentFixture<App>; ui: UiState } {
  TestBed.configureTestingModule({
    imports: [App],
    providers: [provideZonelessChangeDetection()],
  });
  const ui = TestBed.inject(UiState);
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();
  return { fixture, ui };
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('renders h1 with text Timesheet', () => {
    const { fixture } = setup();
    const h1 = (fixture.nativeElement as HTMLElement).querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('Timesheet');
  });

  it('Settings button opens the settings drawer', () => {
    const { fixture, ui } = setup();
    expect(ui.settingsOpen()).toBe(false);
    const settingsBtn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="Settings"]',
    );
    expect(settingsBtn).not.toBeNull();
    settingsBtn!.click();
    fixture.detectChanges();
    expect(ui.settingsOpen()).toBe(true);
  });

  it('renders app-clock-card, app-report-section, and app-entry-timeline in that order', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;
    const sections = Array.from(
      el.querySelectorAll('app-clock-card, app-report-section, app-entry-timeline'),
    );
    expect(sections.length).toBe(3);
    expect(sections[0].tagName.toLowerCase()).toBe('app-clock-card');
    expect(sections[1].tagName.toLowerCase()).toBe('app-report-section');
    expect(sections[2].tagName.toLowerCase()).toBe('app-entry-timeline');
  });

  it('+ Entry button opens the entry drawer', () => {
    const { fixture, ui } = setup();
    expect(ui.entryDrawer()).toBeNull();
    const addBtn = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((b) => b.textContent?.trim() === '+ Entry');
    expect(addBtn).not.toBeUndefined();
    addBtn!.click();
    fixture.detectChanges();
    expect(ui.entryDrawer()).toEqual({ mode: 'new' });
  });

  it('does not contain a router-outlet', () => {
    const { fixture } = setup();
    expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).toBeNull();
  });

  it('shows a load-error alert when localStorage contains corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    const { fixture } = setup();
    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('Saved data could not be loaded');
  });
});
