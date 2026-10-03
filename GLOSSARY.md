# Timesheet

A personal, local-only time and pay tracker: logging worked time against one or more jobs and reporting expected pay over a period.

## Language

**Job**:
An employer or client the user tracks time against. Carries a name, a Job Default Rate, and an optional Pay Period schedule. Can be archived (hidden from active use) but never deleted, so past Entries always resolve to a name.
_Avoid_: Employer, Client, Project.

**Entry**:
A single block of worked time belonging to one Job: a start timestamp, an end timestamp (absent for the Live Session), an Entry Rate, and an optional note. May cross midnight.
_Avoid_: Shift, Record.

**Live Session**:
The one Entry, unique across the whole app, that has no end timestamp yet. Only one Live Session may exist at a time, regardless of Job.
_Avoid_: Active entry, open shift, running timer.

**Job Default Rate**:
The hourly rate configured on a Job. Mutable at any time; changing it only affects Entries created afterward.
_Avoid_: Rate (alone, when the distinction from Entry Rate matters), pay rate.

**Entry Rate**:
The hourly rate recorded on an Entry at the moment it's created — copied from that Job's Job Default Rate, or set explicitly as an override. Immutable afterward: it does not change if the Job's Job Default Rate later changes.
_Avoid_: Rate (alone, when the distinction from Job Default Rate matters).

**Pay Period**:
A recurring cycle configured on a Job: an anchor start date and time, and a frequency (Weekly, Biweekly, or Monthly). Later boundaries recur at the same time of day, offset by the frequency. Used to bound a Report to the Current Pay Period or the Past Pay Period.
_Avoid_: Billing cycle, pay cycle.

**Report**:
A computed summary over one Job's completed Entries (never including the Live Session) within a chosen time range, yielding total hours and Gross Income.
_Avoid_: Summary, invoice, statement.

**Gross Income**:
The sum of each included Entry's duration multiplied by its Entry Rate. Pre-tax; no deductions or overtime multipliers applied.
_Avoid_: Pay, earnings, net income.
