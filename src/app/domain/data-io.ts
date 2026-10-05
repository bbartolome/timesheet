import {
  SCHEMA_VERSION,
  type Entry,
  type Job,
  type PayFrequency,
  type PayPeriod,
  type TimesheetData,
} from './models';

const PAY_FREQUENCIES: readonly PayFrequency[] = ['Weekly', 'Biweekly', 'Monthly'];

type RawObject = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(`Invalid TimesheetData: ${message}`);
}

function isRecord(value: unknown): value is RawObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns a fresh, empty TimesheetData document. */
export function emptyData(): TimesheetData {
  return { schemaVersion: SCHEMA_VERSION, jobs: [], entries: [] };
}

/** Serializes TimesheetData to a pretty-printed JSON string. */
export function serialize(d: TimesheetData): string {
  return JSON.stringify(d, null, 2);
}

function validatePayPeriod(value: unknown, label: string): PayPeriod {
  if (!isRecord(value)) {
    fail(`${label}.payPeriod must be an object with anchor and frequency`);
  }
  const anchor = value['anchor'];
  if (typeof anchor !== 'string') {
    fail(`${label}.payPeriod.anchor must be a string`);
  }
  const frequency = value['frequency'];
  if (typeof frequency !== 'string' || !PAY_FREQUENCIES.includes(frequency as PayFrequency)) {
    fail(`${label}.payPeriod.frequency must be 'Weekly', 'Biweekly', or 'Monthly'`);
  }
  return { anchor, frequency: frequency as PayFrequency };
}

function validateJob(value: unknown, index: number): Job {
  const label = `jobs[${index}]`;
  if (!isRecord(value)) {
    fail(`${label} must be an object`);
  }
  const id = value['id'];
  if (typeof id !== 'string') {
    fail(`${label}.id must be a string`);
  }
  const name = value['name'];
  if (typeof name !== 'string') {
    fail(`${label}.name must be a string`);
  }
  const defaultRate = value['defaultRate'];
  if (typeof defaultRate !== 'number' || !Number.isFinite(defaultRate)) {
    fail(`${label}.defaultRate must be a number`);
  }
  const payPeriodRaw = value['payPeriod'];
  if (payPeriodRaw !== null && !isRecord(payPeriodRaw)) {
    fail(`${label}.payPeriod must be an object or null`);
  }
  const archived = value['archived'];
  if (typeof archived !== 'boolean') {
    fail(`${label}.archived must be a boolean`);
  }
  return {
    id,
    name,
    defaultRate,
    payPeriod: payPeriodRaw === null ? null : validatePayPeriod(payPeriodRaw, label),
    archived,
  };
}

function validateEntry(value: unknown, index: number): Entry {
  const label = `entries[${index}]`;
  if (!isRecord(value)) {
    fail(`${label} must be an object`);
  }
  const id = value['id'];
  if (typeof id !== 'string') {
    fail(`${label}.id must be a string`);
  }
  const jobId = value['jobId'];
  if (typeof jobId !== 'string') {
    fail(`${label}.jobId must be a string`);
  }
  const start = value['start'];
  if (typeof start !== 'string') {
    fail(`${label}.start must be a string`);
  }
  const end = value['end'];
  if (end !== null && typeof end !== 'string') {
    fail(`${label}.end must be a string or null`);
  }
  const rate = value['rate'];
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    fail(`${label}.rate must be a number`);
  }
  const note = value['note'];
  if (typeof note !== 'string') {
    fail(`${label}.note must be a string`);
  }
  return { id, jobId, start, end, rate, note };
}

/**
 * Parses and validates a JSON string into TimesheetData.
 *
 * Throws an Error with a readable message on: invalid JSON; missing, non-number
 * or too-new schemaVersion; jobs/entries not arrays; field type mismatches;
 * entry.jobId not referencing a known job; or more than one Live Session
 * (entry with end === null).
 */
export function parseData(json: string): TimesheetData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid TimesheetData: not valid JSON (${detail})`);
  }

  if (!isRecord(raw)) {
    fail('root must be an object');
  }

  const schemaVersion = raw['schemaVersion'];
  if (typeof schemaVersion !== 'number' || !Number.isFinite(schemaVersion)) {
    fail('schemaVersion must be a number');
  }
  if (schemaVersion > SCHEMA_VERSION) {
    fail(`schemaVersion ${schemaVersion} is greater than supported version ${SCHEMA_VERSION}`);
  }
  if (schemaVersion < 0) {
    fail('schemaVersion must not be negative');
  }

  const rawJobs = raw['jobs'];
  if (!Array.isArray(rawJobs)) {
    fail('jobs must be an array');
  }
  const rawEntries = raw['entries'];
  if (!Array.isArray(rawEntries)) {
    fail('entries must be an array');
  }

  const jobs = rawJobs.map((j, i) => validateJob(j, i));
  const entries = rawEntries.map((e, i) => validateEntry(e, i));

  const jobIds = new Set(jobs.map((j) => j.id));
  for (let i = 0; i < entries.length; i++) {
    const jobId = entries[i].jobId;
    if (!jobIds.has(jobId)) {
      fail(`entries[${i}].jobId "${jobId}" does not reference any job`);
    }
  }

  let liveCount = 0;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].end === null) {
      liveCount++;
    }
  }
  if (liveCount > 1) {
    fail(`at most one entry may have end === null (found ${liveCount})`);
  }

  return { schemaVersion, jobs, entries };
}
