import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommentRow } from '../types';
import Overview from './Overview';

const labels = new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) });
const row: CommentRow = {
  id: 'one', user: 'guest', text: 'comment', tone: 'positive', cat: 'food_quality', summary: '', reply: '',
  post: '', caption: '', url: '', ts: Date.parse('2026-11-12T13:00:00.000Z'), replySource: 'unknown', auto: false,
};

describe('Overview activity charts', () => {
  it('renders bars only for hours with comments', () => {
    const { container } = render(<Overview items={[row]} labels={labels} lang="en" followCount={0} onTone={() => {}} onCategory={() => {}} onFollowup={() => {}} />);

    expect(container.querySelectorAll('.hour-bar:not(.is-zero)')).toHaveLength(1);
    expect(container.querySelectorAll('.hour-bar.is-zero')).toHaveLength(23);
    expect(container.querySelector('.hour-bar.is-zero')?.getAttribute('style')).toContain('height: 0%');
  });

  it('shows an hourly empty state when there are no usable timestamps', () => {
    render(<Overview items={[{ ...row, ts: 0 }]} labels={labels} lang="en" followCount={0} onTone={() => {}} onCategory={() => {}} onFollowup={() => {}} />);

    expect(screen.getByText('noActivityByHour')).toBeTruthy();
    expect(screen.getByText('noActivityLast7')).toBeTruthy();
  });

  it('shows actionable critical comments using supplied data and opens that comment', () => {
    const critical: CommentRow = { ...row, id: 'urgent', user: 'guest-critical', text: 'There was a piece of glass in the food', tone: 'critical' };
    const onComment = vi.fn();
    render(<Overview items={[row, critical]} labels={labels} lang="en" followCount={1} onTone={() => {}} onCategory={() => {}} onFollowup={() => {}} onComment={onComment} />);

    fireEvent.click(screen.getByRole('button', { name: /There was a piece of glass in the food/ }));
    expect(onComment).toHaveBeenCalledWith(critical);
    expect(screen.getByRole('heading', { name: 'criticalNeedsReview' })).toBeTruthy();
  });

  it('does not show period deltas when the API provides no history-coverage metadata', () => {
    render(<Overview items={[row]} labels={labels} lang="en" followCount={0} onTone={() => {}} onCategory={() => {}} onFollowup={() => {}} />);

    expect(screen.queryByText('periodTrend')).toBeNull();
    expect(screen.queryByText('noPeriodTrend')).toBeNull();
    expect(screen.getByText('100% countOf 1')).toBeTruthy();
  });
});
