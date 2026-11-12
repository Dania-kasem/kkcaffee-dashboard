import type { CommentRow } from '../types';

const TIME_ZONE = 'Asia/Amman';
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const hourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

function getDateKey(date: Date): string {
  const parts = Object.fromEntries(dayFormatter.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export type DayActivity = { day: string; count: number };
export type SevenDayComparison = {
  current: { total: number; positive: number; negative: number; critical: number; automatic: number };
  previous: { total: number; positive: number; negative: number; critical: number; automatic: number };
  hasPreviousData: boolean;
};

/** Compares two complete seven-day windows before today in Asia/Amman, using only supplied rows. */
export function getSevenDayComparison(items: CommentRow[], now: number | Date = Date.now()): SevenDayComparison {
  const todayKey = getDateKey(now instanceof Date ? now : new Date(now));
  const [year, month, day] = todayKey.split('-').map(Number);
  const utcToday = Date.UTC(year, month - 1, day);
  const dates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(utcToday - ((index + 1) * 86_400_000));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  });
  const currentDates = new Set(dates.slice(0, 7));
  const previousDates = new Set(dates.slice(7));
  const empty = () => ({ total: 0, positive: 0, negative: 0, critical: 0, automatic: 0 });
  const current = empty(), previous = empty();
  items.forEach(item => {
    if (!Number.isFinite(item.ts) || item.ts <= 0) return;
    const date = getDateKey(new Date(item.ts));
    const target = currentDates.has(date) ? current : previousDates.has(date) ? previous : null;
    if (!target) return;
    target.total += 1;
    if (item.tone === 'positive') target.positive += 1;
    if (item.tone === 'negative') target.negative += 1;
    if (item.tone === 'critical') target.critical += 1;
    if (item.auto) target.automatic += 1;
  });
  return { current, previous, hasPreviousData: previous.total > 0 };
}

/** Returns the seven consecutive calendar days ending today in Asia/Amman. */
export function getLastSevenDays(items: CommentRow[], now: number | Date = Date.now()): DayActivity[] {
  const todayKey = getDateKey(now instanceof Date ? now : new Date(now));
  const [year, month, day] = todayKey.split('-').map(Number);
  const utcToday = Date.UTC(year, month - 1, day);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(utcToday + (index - 6) * 86_400_000);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  });
  const counts = new Map(days.map(date => [date, 0]));

  items.forEach(item => {
    if (!Number.isFinite(item.ts) || item.ts <= 0) return;
    const date = getDateKey(new Date(item.ts));
    if (counts.has(date)) counts.set(date, (counts.get(date) || 0) + 1);
  });

  return days.map(date => ({ day: date, count: counts.get(date) || 0 }));
}

/** Returns one count for each local hour (0–23); rows without timestamps are ignored. */
export function getHourlyActivity(items: CommentRow[]): number[] {
  const hours = Array<number>(24).fill(0);
  items.forEach(item => {
    if (!Number.isFinite(item.ts) || item.ts <= 0) return;
    const hour = Number(hourFormatter.formatToParts(new Date(item.ts)).find(part => part.type === 'hour')?.value);
    if (Number.isInteger(hour) && hour >= 0 && hour < hours.length) hours[hour] += 1;
  });
  return hours;
}
