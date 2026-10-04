import type { Entry, Job } from './models';

const HEADER = 'job,start,end,hours,rate,gross_income,note';

function needsQuotes(value: string): boolean {
  return value.includes(',') || value.includes('"') || value.includes('\r') || value.includes('\n');
}

function quote(value: string): string {
  if (!needsQuotes(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}

function toHours(start: string, end: string): number {
  return (Date.parse(end) - Date.parse(start)) / 3_600_000;
}

export function entriesToCsv(entries: Entry[], job: Job): string {
  const rows = [HEADER];
  for (const entry of entries) {
    if (entry.end === null) {
      // The Live Session is not exported.
      continue;
    }
    const hours = toHours(entry.start, entry.end);
    const grossIncome = hours * entry.rate;
    rows.push(
      [
        quote(job.name),
        quote(entry.start),
        quote(entry.end),
        hours.toFixed(2),
        entry.rate.toFixed(2),
        grossIncome.toFixed(2),
        quote(entry.note),
      ].join(',')
    );
  }
  return rows.join('\n');
}
