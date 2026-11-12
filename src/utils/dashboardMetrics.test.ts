import { describe, expect, it } from 'vitest';
import type { CommentRow } from '../types';
import { getHourlyActivity, getLastSevenDays, getSevenDayComparison } from './dashboardMetrics';

function comment(id: string, ts: number): CommentRow {
  return {
    id, user: 'guest', text: 'comment', tone: 'positive', cat: 'food_quality', summary: '', reply: '',
    post: '', caption: '', url: '', ts, replySource: 'unknown', auto: false,
  };
}

describe('dashboard activity calculations', () => {
  it('returns exactly seven consecutive Asia/Amman calendar days and includes zero-count days', () => {
    const days = getLastSevenDays([
      comment('start-day', Date.parse('2026-11-05T22:30:00.000Z')),
      comment('end-day', Date.parse('2026-11-12T20:30:00.000Z')),
      comment('outside-window', Date.parse('2026-11-05T20:00:00.000Z')),
      comment('missing-timestamp', 0),
    ], Date.parse('2026-11-12T20:00:00.000Z'));

    expect(days).toEqual([
      { day: '2026-11-06', count: 1 },
      { day: '2026-11-07', count: 0 },
      { day: '2026-11-08', count: 0 },
      { day: '2026-11-09', count: 0 },
      { day: '2026-11-10', count: 0 },
      { day: '2026-11-11', count: 0 },
      { day: '2026-11-12', count: 1 },
    ]);
  });

  it('counts hourly activity in Asia/Amman and ignores missing timestamps', () => {
    const hours = getHourlyActivity([
      comment('one', Date.parse('2026-11-12T13:00:00.000Z')),
      comment('two', Date.parse('2026-11-12T13:20:00.000Z')),
      comment('missing-timestamp', 0),
    ]);

    expect(hours).toHaveLength(24);
    expect(hours[16]).toBe(2);
    expect(hours.reduce((sum, count) => sum + count, 0)).toBe(2);
    expect(hours.filter(count => count === 0)).toHaveLength(23);
  });

  it('compares two complete seven-day windows before today using only supplied rows', () => {
    const comparison = getSevenDayComparison([
      { ...comment('previous-negative', Date.parse('2026-11-04T10:00:00.000Z')), tone: 'negative' },
      { ...comment('current-positive', Date.parse('2026-11-05T13:00:00.000Z')), tone: 'positive' },
      comment('outside-windows', Date.parse('2026-10-28T13:00:00.000Z')),
    ], Date.parse('2026-11-12T20:00:00.000Z'));

    expect(comparison.hasPreviousData).toBe(true);
    expect(comparison.current).toMatchObject({ total: 1, positive: 1, negative: 0 });
    expect(comparison.previous).toMatchObject({ total: 1, positive: 0, negative: 1 });
  });

  it('does not report prior history when supplied rows fall outside the prior window', () => {
    const comparison = getSevenDayComparison([
      comment('recent', Date.parse('2026-11-11T13:00:00.000Z')),
      comment('old', Date.parse('2026-10-01T13:00:00.000Z')),
    ], Date.parse('2026-11-12T20:00:00.000Z'));

    expect(comparison.hasPreviousData).toBe(false);
    expect(comparison.current.total).toBe(1);
    expect(comparison.previous.total).toBe(0);
  });
});
