import { periodContaining, previousPeriod } from './pay-period';
import type { PayPeriod } from './models';

describe('periodContaining', () => {
  describe('Weekly', () => {
    // Anchor: Mon Jan 8 2024 09:00 local
    const pp: PayPeriod = {
      anchor: new Date(2024, 0, 8, 9, 0, 0).toISOString(),
      frequency: 'Weekly',
    };

    it('returns the 7-day period containing `at`', () => {
      const at = new Date(2024, 0, 10, 12, 0, 0).getTime(); // Wed Jan 10
      const range = periodContaining(pp, at);
      expect(range.start).toBe(new Date(2024, 0, 8, 9, 0, 0).getTime());
      expect(range.end).toBe(new Date(2024, 0, 15, 9, 0, 0).getTime());
    });

    it('assigns `at` exactly on a boundary to the new period', () => {
      const at = new Date(2024, 0, 15, 9, 0, 0).getTime(); // Jan 15 09:00 — start of next cycle
      const range = periodContaining(pp, at);
      expect(range.start).toBe(new Date(2024, 0, 15, 9, 0, 0).getTime());
      expect(range.end).toBe(new Date(2024, 0, 22, 9, 0, 0).getTime());
    });

    it('is valid for `at` before the anchor', () => {
      const at = new Date(2024, 0, 3, 12, 0, 0).getTime(); // Jan 3 — one week before anchor
      const range = periodContaining(pp, at);
      expect(range.start).toBe(new Date(2024, 0, 1, 9, 0, 0).getTime());
      expect(range.end).toBe(new Date(2024, 0, 8, 9, 0, 0).getTime());
    });

    it('preserves anchor time of day in period boundaries', () => {
      const ppLate: PayPeriod = {
        anchor: new Date(2024, 0, 8, 14, 30, 0).toISOString(),
        frequency: 'Weekly',
      };
      const at = new Date(2024, 0, 10, 12, 0, 0).getTime();
      const range = periodContaining(ppLate, at);
      expect(new Date(range.start!).getHours()).toBe(14);
      expect(new Date(range.start!).getMinutes()).toBe(30);
      expect(new Date(range.end!).getHours()).toBe(14);
      expect(new Date(range.end!).getMinutes()).toBe(30);
    });

    it('returns non-null start and end', () => {
      const range = periodContaining(pp, new Date(2024, 0, 10).getTime());
      expect(range.start).not.toBeNull();
      expect(range.end).not.toBeNull();
    });
  });

  describe('Biweekly', () => {
    // Anchor: Mon Jan 8 2024 09:00 local
    const pp: PayPeriod = {
      anchor: new Date(2024, 0, 8, 9, 0, 0).toISOString(),
      frequency: 'Biweekly',
    };

    it('returns the 14-day period containing `at`', () => {
      const at = new Date(2024, 0, 15, 12, 0, 0).getTime(); // Jan 15 — within first biweekly period
      const range = periodContaining(pp, at);
      expect(range.start).toBe(new Date(2024, 0, 8, 9, 0, 0).getTime());
      expect(range.end).toBe(new Date(2024, 0, 22, 9, 0, 0).getTime());
    });

    it('assigns `at` exactly on a 14-day boundary to the new period', () => {
      const at = new Date(2024, 0, 22, 9, 0, 0).getTime(); // Jan 22 09:00 — boundary
      const range = periodContaining(pp, at);
      expect(range.start).toBe(new Date(2024, 0, 22, 9, 0, 0).getTime());
      expect(range.end).toBe(new Date(2024, 1, 5, 9, 0, 0).getTime()); // Feb 5
    });

    it('is valid for `at` before the anchor', () => {
      const at = new Date(2024, 0, 1, 12, 0, 0).getTime(); // Jan 1 2024 — two weeks before anchor
      const range = periodContaining(pp, at);
      expect(range.start).toBe(new Date(2023, 11, 25, 9, 0, 0).getTime()); // Dec 25 2023
      expect(range.end).toBe(new Date(2024, 0, 8, 9, 0, 0).getTime());
    });
  });

  describe('Monthly', () => {
    // Anchor: Jan 15 2024 09:00 local
    const pp: PayPeriod = {
      anchor: new Date(2024, 0, 15, 9, 0, 0).toISOString(),
      frequency: 'Monthly',
    };

    it('returns the calendar-month period containing `at`', () => {
      const at = new Date(2024, 0, 20, 12, 0, 0).getTime(); // Jan 20
      const range = periodContaining(pp, at);
      expect(range.start).toBe(new Date(2024, 0, 15, 9, 0, 0).getTime());
      expect(range.end).toBe(new Date(2024, 1, 15, 9, 0, 0).getTime()); // Feb 15
    });

    it('assigns `at` exactly on a monthly boundary to the new period', () => {
      const at = new Date(2024, 1, 15, 9, 0, 0).getTime(); // Feb 15 09:00 — boundary
      const range = periodContaining(pp, at);
      expect(range.start).toBe(new Date(2024, 1, 15, 9, 0, 0).getTime());
      expect(range.end).toBe(new Date(2024, 2, 15, 9, 0, 0).getTime()); // Mar 15
    });

    it('is valid for `at` before the anchor', () => {
      const at = new Date(2023, 11, 20, 12, 0, 0).getTime(); // Dec 20 2023
      const range = periodContaining(pp, at);
      expect(range.start).toBe(new Date(2023, 11, 15, 9, 0, 0).getTime()); // Dec 15 2023
      expect(range.end).toBe(new Date(2024, 0, 15, 9, 0, 0).getTime()); // Jan 15 2024
    });

    it('preserves anchor time of day in monthly boundaries', () => {
      const at = new Date(2024, 0, 20, 12, 0, 0).getTime();
      const range = periodContaining(pp, at);
      expect(new Date(range.start!).getHours()).toBe(9);
      expect(new Date(range.end!).getHours()).toBe(9);
    });

    it('clamps anchor day 31 to Feb 28 in a non-leap year', () => {
      // 2023 is not a leap year
      const pp31: PayPeriod = {
        anchor: new Date(2023, 0, 31, 9, 0, 0).toISOString(),
        frequency: 'Monthly',
      };
      const at = new Date(2023, 1, 15, 12, 0, 0).getTime(); // Feb 15 2023
      const range = periodContaining(pp31, at);
      expect(range.start).toBe(new Date(2023, 0, 31, 9, 0, 0).getTime()); // Jan 31
      expect(range.end).toBe(new Date(2023, 1, 28, 9, 0, 0).getTime()); // Feb 28 (clamped)
    });

    it('clamps anchor day 31 to Feb 29 in a leap year', () => {
      // 2024 is a leap year
      const pp31: PayPeriod = {
        anchor: new Date(2024, 0, 31, 9, 0, 0).toISOString(),
        frequency: 'Monthly',
      };
      const at = new Date(2024, 1, 15, 12, 0, 0).getTime(); // Feb 15 2024
      const range = periodContaining(pp31, at);
      expect(range.start).toBe(new Date(2024, 0, 31, 9, 0, 0).getTime()); // Jan 31
      expect(range.end).toBe(new Date(2024, 1, 29, 9, 0, 0).getTime()); // Feb 29 (clamped)
    });
  });
});

describe('previousPeriod', () => {
  it('returns the period exactly one week before for Weekly', () => {
    const pp: PayPeriod = {
      anchor: new Date(2024, 0, 8, 9, 0, 0).toISOString(),
      frequency: 'Weekly',
    };
    const at = new Date(2024, 0, 10, 12, 0, 0).getTime(); // in [Jan 8, Jan 15)
    const prev = previousPeriod(pp, at);
    expect(prev.start).toBe(new Date(2024, 0, 1, 9, 0, 0).getTime());
    expect(prev.end).toBe(new Date(2024, 0, 8, 9, 0, 0).getTime());
  });

  it('returns the period exactly 14 days before for Biweekly', () => {
    const pp: PayPeriod = {
      anchor: new Date(2024, 0, 8, 9, 0, 0).toISOString(),
      frequency: 'Biweekly',
    };
    const at = new Date(2024, 0, 15, 12, 0, 0).getTime(); // in [Jan 8, Jan 22)
    const prev = previousPeriod(pp, at);
    expect(prev.start).toBe(new Date(2023, 11, 25, 9, 0, 0).getTime()); // Dec 25 2023
    expect(prev.end).toBe(new Date(2024, 0, 8, 9, 0, 0).getTime());
  });

  it('returns the period one calendar month before for Monthly', () => {
    const pp: PayPeriod = {
      anchor: new Date(2024, 0, 15, 9, 0, 0).toISOString(),
      frequency: 'Monthly',
    };
    const at = new Date(2024, 1, 20, 12, 0, 0).getTime(); // in [Feb 15, Mar 15)
    const prev = previousPeriod(pp, at);
    expect(prev.start).toBe(new Date(2024, 0, 15, 9, 0, 0).getTime()); // Jan 15
    expect(prev.end).toBe(new Date(2024, 1, 15, 9, 0, 0).getTime()); // Feb 15
  });

  it('shifts by one cycle when `at` is exactly on a boundary', () => {
    // at = Jan 15 09:00 → periodContaining = [Jan 15, Jan 22); previousPeriod = [Jan 8, Jan 15)
    const pp: PayPeriod = {
      anchor: new Date(2024, 0, 8, 9, 0, 0).toISOString(),
      frequency: 'Weekly',
    };
    const at = new Date(2024, 0, 15, 9, 0, 0).getTime(); // exactly on boundary
    const prev = previousPeriod(pp, at);
    expect(prev.start).toBe(new Date(2024, 0, 8, 9, 0, 0).getTime());
    expect(prev.end).toBe(new Date(2024, 0, 15, 9, 0, 0).getTime());
  });

  it('applies day clamping in the previous monthly period for day-31 anchor', () => {
    // at = Mar 15 2023 → periodContaining = [Feb 28, Mar 31); previousPeriod = [Jan 31, Feb 28)
    const pp31: PayPeriod = {
      anchor: new Date(2023, 0, 31, 9, 0, 0).toISOString(),
      frequency: 'Monthly',
    };
    const at = new Date(2023, 2, 15, 12, 0, 0).getTime(); // Mar 15 2023
    const prev = previousPeriod(pp31, at);
    expect(prev.start).toBe(new Date(2023, 0, 31, 9, 0, 0).getTime()); // Jan 31
    expect(prev.end).toBe(new Date(2023, 1, 28, 9, 0, 0).getTime()); // Feb 28 (clamped)
  });
});
