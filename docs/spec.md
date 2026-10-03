# Timesheet app — spec

A personal, local-only time and pay tracker. Vocabulary is defined in [GLOSSARY.md](../GLOSSARY.md); decisions are in [ADR-0001](adr/0001-no-client-side-routing.md) and [ADR-0002](adr/0002-entry-rate-snapshot.md). Visual design is in section 7.

## 1. Data model

Persisted in browser localStorage. The stored document carries a top-level `schemaVersion` field from day one (no migration logic yet).

### Job
| Field | Notes |
|---|---|
| name | Renamable |
| Job Default Rate | Hourly; mutable; changes affect only Entries created afterward |
| Pay Period (optional) | Anchor start date **and time** + frequency: Weekly, Biweekly, or Monthly |
| archived | Hides the Job from the Clock screen; Jobs are never hard-deleted |

### Entry
| Field | Notes |
|---|---|
| job | Exactly one Job |
| start | Absolute timestamp; may cross midnight |
| end | Absolute timestamp; absent only for the Live Session |
| Entry Rate | Copied from the Job Default Rate at creation, or explicit override; immutable once the Entry exists |
| note | Optional free text |

Rules:
- Exactly one Live Session (Entry with no end) may exist across the whole app.
- Overlapping Entries for the same Job produce a warning, never a block.
- No rounding: durations are exact elapsed time. No overtime rules.
- An Entry can be deleted individually, with confirmation.

## 2. Navigation

One scrolling page, no Angular Router, no tabs, no anchor links (ADR-0001). Top to bottom: header (with Settings button), hero Clock card, Report section, Entry timeline. The Settings drawer and the Entry drawer are signal-driven in-page overlays with no URLs or router state.

## 3. UX flows and acceptance criteria

### 3.1 Clock card
- A hero card at the top of the page. While a Live Session runs it shows the running Job, big elapsed time, and Clock Out; other active Jobs appear as "switch to" actions, disabled while a Live Session exists. When idle, it offers Clock In for each active Job.
- AC: Clock In creates a Live Session with start = now and Entry Rate = the Job's current Job Default Rate.
- AC: While any Live Session exists, Clock In on other Jobs is unavailable (only one Live Session globally).
- AC: The Clock card shows live elapsed time for the Live Session.
- AC: After ~12 hours running, the Clock card shows an advisory "still clocked in?" banner; it never blocks any action.
- AC: Clock Out sets end = now, completing the Entry.
- AC: With zero Jobs, the Clock card shows a "create your first Job" prompt (opening the Settings drawer) instead of Clock In actions.
- AC: Archived Jobs do not appear in the Clock card.

### 3.2 Advanced entry (create / edit / backfill)
- Opened in the Entry drawer, via the fixed bottom-right "+ Entry" button (new) or from an Entry in the timeline (edit). A form to set Job, start, end, Entry Rate (override), and note, for new or existing Entries, with no Live Session involved.
- AC: Creating an Entry defaults Entry Rate to the selected Job's Job Default Rate; the user may override it.
- AC: Saving an Entry that overlaps another Entry of the same Job shows a warning and still allows saving.
- AC: Entries crossing midnight save and display correctly.
- AC: Deleting an Entry requires confirmation.
- AC: Changing a Job's Job Default Rate does not alter any existing Entry's Entry Rate.

### 3.3 Jobs management (Settings drawer)
- The Settings drawer (header button) has two sections: Jobs and Data (3.5). Jobs: create, rename, change rate, configure Pay Period, archive / unarchive. Archived Jobs sit in a collapsed group and are edited in the same drawer.
- AC: Archiving the Job that holds the Live Session is blocked with a "clock out first" message. Archiving otherwise needs no confirmation (reversible).
- AC: There is no delete action for Jobs.
- AC: Archived Jobs' Entries still display with the Job's name.

### 3.4 Report
- A Job selector in the Report header; the Report is always scoped to exactly one Job. Archived Jobs are selectable. The Entry timeline filters to the same Job and range.
- AC: The default Job is the running Job, else the most recently used, else the first active Job; the selection persists in localStorage.
- Filters: This Week, This Month, All Time, custom date range, Current Pay Period, Past Pay Period.
- AC: Current/Past Pay Period filters are disabled until the selected Job has a Pay Period.
- AC: Pay Period boundaries recur at the anchor's clock time, offset by the frequency; Past Pay Period is exactly one cycle before the current one.
- AC: Output is total hours and Gross Income = sum(duration × Entry Rate) over **completed** Entries in range; the Live Session is excluded.
- AC: Currency is shown as a plain number with 2 decimals, no symbol or locale.

### 3.5 Data management
- All data actions live in the Settings drawer's Data section, except CSV export, which sits beside the Report.
- **JSON export**: full-fidelity backup of all Jobs and Entries (including `schemaVersion`).
- **JSON import**: replaces all current local data, after a confirmation warning that it will overwrite.
- **CSV export**: Entries only; scoped to exactly the Report's selected Job and active filter; no CSV import.
- **Clear all data**: standalone action, separate from import, with confirmation.
- AC: Export followed by import on a fresh browser reproduces identical Jobs and Entries.
- AC: Import and clear never run without an explicit confirmation.

## 4. Build and deployment

- Angular single-page app, base-href `/timesheet/`, published to GitHub Pages at `bbartolome.github.io/timesheet/`.
- GitHub Actions on every push to `main`: `ng build`, then tests, then deploy.
- AC: A failing test fails the workflow and blocks deploy.
- No separate lint gate for v1.

## 5. Out of scope
Rounding, overtime rules, cross-job report totals, semi-monthly pay periods, CSV import, merge-on-import, currency symbols/locales, deep-linkable screens.

## 6. Open items
- Test framework and the exact Angular version are not decided by this map; the deploy pipeline requires only that a test command exists.

## 7. Visual design

Chosen from three throwaway prototypes (branch `prototype/visual-design`): Variant C, single scrolling page.
- **Style**: dark stone background, amber accent.
- **Layout**: hero Clock card, then Report section (Job selector, filter chips, hours + Gross Income, Export CSV), then Entry timeline. Entry form and Settings are right-hand side drawers.
- **Responsive**: same structure at every width, equally good on phone and desktop. Single column on phone; centred max-width column (~640-720px) on desktop.
- **Drawers**: slide in from the right on desktop, fill the screen on phone; close button and tap-outside backdrop.
- **"+ Entry" button**: fixed bottom-right at both sizes.
- **Stale warning**: the 12h banner lives in the hero Clock card.
- AC: All flows in section 3 are usable at phone and desktop widths without horizontal scrolling.
