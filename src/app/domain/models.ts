/** Frequency options for a Pay Period recurring cycle. */
export type PayFrequency = 'Weekly' | 'Biweekly' | 'Monthly';

/** Pay Period: anchor start datetime and recurrence frequency configured on a Job. */
export interface PayPeriod {
  anchor: string; // ISO datetime
  frequency: PayFrequency;
}

/** Job: an employer or client the user tracks time against. Never deleted; archived to hide from active use. */
export interface Job {
  id: string;
  name: string;
  /** Job Default Rate: the hourly rate on this Job; changing it only affects future Entries. */
  defaultRate: number;
  payPeriod: PayPeriod | null;
  archived: boolean;
}

/** Entry: a single block of worked time belonging to one Job. */
export interface Entry {
  id: string;
  jobId: string;
  start: string; // ISO datetime
  /** null only for the Live Session (the one Entry with no end timestamp). */
  end: string | null;
  /** Entry Rate: hourly rate snapshot copied at creation; immutable afterward (ADR-0002). */
  rate: number;
  note: string;
}

/** Persisted schema version for migration guards. */
export const SCHEMA_VERSION = 1;

/** Root persisted shape: versioned container of Jobs and Entries. */
export interface TimesheetData {
  schemaVersion: number;
  jobs: Job[];
  entries: Entry[];
}

/**
 * Report filter: bounds a Report to a named range or a custom date span.
 * currentPayPeriod / pastPayPeriod require the selected Job to have a Pay Period configured.
 */
export type ReportFilter =
  | { kind: 'thisWeek' }
  | { kind: 'thisMonth' }
  | { kind: 'allTime' }
  | { kind: 'custom'; from: string /* yyyy-mm-dd */; to: string /* yyyy-mm-dd inclusive */ }
  | { kind: 'currentPayPeriod' }
  | { kind: 'pastPayPeriod' };

/** Resolved epoch-ms bounds for a Report filter; half-open [start, end); null = unbounded. */
export interface DateRange {
  start: number | null;
  end: number | null;
}

/** Report output: total hours and Gross Income over the filtered Entries. */
export interface ReportTotals {
  hours: number;
  /** Gross Income: sum of each Entry's duration × Entry Rate. Pre-tax, no deductions. */
  grossIncome: number;
}

/** localStorage key for TimesheetData. */
export const STORAGE_KEY = 'timesheet.data';

/** localStorage key for the Report's selected Job id. */
export const REPORT_JOB_KEY = 'timesheet.reportJobId';

/** Duration threshold (ms) above which a Live Session is flagged as unusually long. */
export const LONG_SESSION_MS = 12 * 3600_000;
