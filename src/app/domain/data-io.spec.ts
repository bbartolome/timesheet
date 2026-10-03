import { emptyData, serialize, parseData } from './data-io';
import type { TimesheetData, Job, Entry } from './models';
import { SCHEMA_VERSION } from './models';

function job(overrides: Partial<Job> = {}): Job {
  return { id: 'j1', name: 'Acme Corp', defaultRate: 25, payPeriod: null, archived: false, ...overrides };
}

function entry(overrides: Partial<Entry> & Pick<Entry, 'id' | 'start'>): Entry {
  return { jobId: 'j1', end: '2024-01-15T10:00:00.000Z', rate: 25, note: '', ...overrides };
}

function validData(overrides: Partial<TimesheetData> = {}): TimesheetData {
  return {
    schemaVersion: SCHEMA_VERSION,
    jobs: [job()],
    entries: [entry({ id: 'e1', start: '2024-01-15T09:00:00.000Z' })],
    ...overrides,
  };
}

describe('emptyData', () => {
  it('returns schemaVersion equal to SCHEMA_VERSION', () => {
    expect(emptyData().schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('returns an empty jobs array', () => {
    expect(emptyData().jobs).toEqual([]);
  });

  it('returns an empty entries array', () => {
    expect(emptyData().entries).toEqual([]);
  });
});

describe('serialize', () => {
  it('produces valid JSON', () => {
    expect(() => JSON.parse(serialize(emptyData()))).not.toThrow();
  });

  it('includes schemaVersion in the serialized output', () => {
    const parsed = JSON.parse(serialize(emptyData()));
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('round-trip identity', () => {
  it('parseData(serialize(emptyData())) deep-equals emptyData()', () => {
    expect(parseData(serialize(emptyData()))).toEqual(emptyData());
  });

  it('round-trips a document with jobs and entries', () => {
    const d = validData();
    expect(parseData(serialize(d))).toEqual(d);
  });

  it('round-trips a job with a Weekly pay period', () => {
    const d = validData({
      jobs: [job({ payPeriod: { anchor: '2024-01-01T09:00:00.000Z', frequency: 'Weekly' } })],
    });
    expect(parseData(serialize(d))).toEqual(d);
  });

  it('round-trips a job with a Biweekly pay period', () => {
    const d = validData({
      jobs: [job({ payPeriod: { anchor: '2024-01-01T09:00:00.000Z', frequency: 'Biweekly' } })],
    });
    expect(parseData(serialize(d))).toEqual(d);
  });

  it('round-trips a job with a Monthly pay period', () => {
    const d = validData({
      jobs: [job({ payPeriod: { anchor: '2024-01-01T09:00:00.000Z', frequency: 'Monthly' } })],
    });
    expect(parseData(serialize(d))).toEqual(d);
  });

  it('round-trips an Entry with a null end (Live Session)', () => {
    const d: TimesheetData = {
      schemaVersion: SCHEMA_VERSION,
      jobs: [job()],
      entries: [entry({ id: 'live', start: '2024-01-15T09:00:00.000Z', end: null })],
    };
    expect(parseData(serialize(d))).toEqual(d);
  });

  it('round-trips an Entry with a non-empty note', () => {
    const d = validData({
      entries: [entry({ id: 'e1', start: '2024-01-15T09:00:00.000Z', note: 'some note' })],
    });
    expect(parseData(serialize(d))).toEqual(d);
  });

  it('round-trips an archived job', () => {
    const d = validData({ jobs: [job({ archived: true })] });
    expect(parseData(serialize(d))).toEqual(d);
  });
});

describe('parseData rejection cases', () => {
  describe('invalid JSON', () => {
    it('throws on non-JSON input', () => {
      expect(() => parseData('not json')).toThrow();
    });

    it('throws on empty string', () => {
      expect(() => parseData('')).toThrow();
    });
  });

  describe('schemaVersion', () => {
    it('throws when schemaVersion is missing', () => {
      const d = validData() as Record<string, unknown>;
      delete d['schemaVersion'];
      expect(() => parseData(JSON.stringify(d))).toThrow();
    });

    it('throws when schemaVersion is not a number', () => {
      expect(() => parseData(JSON.stringify({ ...validData(), schemaVersion: '1' }))).toThrow();
    });

    it('throws when schemaVersion is greater than SCHEMA_VERSION', () => {
      expect(() => parseData(JSON.stringify({ ...validData(), schemaVersion: SCHEMA_VERSION + 1 }))).toThrow();
    });

    it('accepts schemaVersion equal to SCHEMA_VERSION', () => {
      expect(() => parseData(JSON.stringify(validData()))).not.toThrow();
    });
  });

  describe('jobs', () => {
    it('throws when jobs is missing', () => {
      const d = validData() as Record<string, unknown>;
      delete d['jobs'];
      expect(() => parseData(JSON.stringify(d))).toThrow();
    });

    it('throws when jobs is not an array', () => {
      expect(() => parseData(JSON.stringify({ ...validData(), jobs: {} }))).toThrow();
    });

    it('throws when a job is missing id', () => {
      const j = job() as Record<string, unknown>;
      delete j['id'];
      expect(() => parseData(JSON.stringify({ ...validData(), jobs: [j], entries: [] }))).toThrow();
    });

    it('throws when a job id is not a string', () => {
      expect(() =>
        parseData(JSON.stringify({ ...validData(), jobs: [{ ...job(), id: 1 }], entries: [] }))
      ).toThrow();
    });

    it('throws when a job name is not a string', () => {
      expect(() =>
        parseData(JSON.stringify({ ...validData(), jobs: [{ ...job(), name: 42 }], entries: [] }))
      ).toThrow();
    });

    it('throws when a job defaultRate is not a number', () => {
      expect(() =>
        parseData(JSON.stringify({ ...validData(), jobs: [{ ...job(), defaultRate: '25' }], entries: [] }))
      ).toThrow();
    });

    it('throws when a job archived is not a boolean', () => {
      expect(() =>
        parseData(JSON.stringify({ ...validData(), jobs: [{ ...job(), archived: 'false' }], entries: [] }))
      ).toThrow();
    });
  });

  describe('entries', () => {
    it('throws when entries is missing', () => {
      const d = validData() as Record<string, unknown>;
      delete d['entries'];
      expect(() => parseData(JSON.stringify(d))).toThrow();
    });

    it('throws when entries is not an array', () => {
      expect(() => parseData(JSON.stringify({ ...validData(), entries: {} }))).toThrow();
    });

    it('throws when an entry id is not a string', () => {
      expect(() =>
        parseData(
          JSON.stringify({
            ...validData(),
            entries: [{ ...entry({ id: 'e1', start: '2024-01-15T09:00:00.000Z' }), id: 99 }],
          })
        )
      ).toThrow();
    });

    it('throws when an entry jobId is not a string', () => {
      expect(() =>
        parseData(
          JSON.stringify({
            ...validData(),
            entries: [{ ...entry({ id: 'e1', start: '2024-01-15T09:00:00.000Z' }), jobId: 42 }],
          })
        )
      ).toThrow();
    });

    it('throws when an entry start is not a string', () => {
      expect(() =>
        parseData(
          JSON.stringify({
            ...validData(),
            entries: [{ ...entry({ id: 'e1', start: '2024-01-15T09:00:00.000Z' }), start: 0 }],
          })
        )
      ).toThrow();
    });

    it('throws when an entry rate is not a number', () => {
      expect(() =>
        parseData(
          JSON.stringify({
            ...validData(),
            entries: [{ ...entry({ id: 'e1', start: '2024-01-15T09:00:00.000Z' }), rate: '25' }],
          })
        )
      ).toThrow();
    });

    it('throws when an entry note is not a string', () => {
      expect(() =>
        parseData(
          JSON.stringify({
            ...validData(),
            entries: [{ ...entry({ id: 'e1', start: '2024-01-15T09:00:00.000Z' }), note: null }],
          })
        )
      ).toThrow();
    });
  });

  describe('entry.jobId referential integrity', () => {
    it('throws when entry.jobId does not match any job', () => {
      const d: TimesheetData = {
        schemaVersion: SCHEMA_VERSION,
        jobs: [job({ id: 'j1' })],
        entries: [entry({ id: 'e1', start: '2024-01-15T09:00:00.000Z', jobId: 'unknown' })],
      };
      expect(() => parseData(JSON.stringify(d))).toThrow();
    });

    it('accepts entries whose jobIds all resolve to known jobs', () => {
      expect(() => parseData(JSON.stringify(validData()))).not.toThrow();
    });
  });

  describe('Live Session uniqueness', () => {
    it('throws when more than one entry has end === null', () => {
      const d: TimesheetData = {
        schemaVersion: SCHEMA_VERSION,
        jobs: [job()],
        entries: [
          entry({ id: 'live1', start: '2024-01-15T08:00:00.000Z', end: null }),
          entry({ id: 'live2', start: '2024-01-15T09:00:00.000Z', end: null }),
        ],
      };
      expect(() => parseData(JSON.stringify(d))).toThrow();
    });

    it('accepts exactly one entry with end === null', () => {
      const d: TimesheetData = {
        schemaVersion: SCHEMA_VERSION,
        jobs: [job()],
        entries: [entry({ id: 'live', start: '2024-01-15T09:00:00.000Z', end: null })],
      };
      expect(() => parseData(JSON.stringify(d))).not.toThrow();
    });

    it('accepts zero entries with end === null', () => {
      expect(() => parseData(JSON.stringify(validData()))).not.toThrow();
    });
  });
});
