import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommentRow } from '../types';
import { CommentList, FollowUpInbox } from './CommentViews';

const labels = new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) });
const names = { positive: 'Positive', negative: 'Negative', critical: 'Critical', neutral: 'Neutral', pending: 'Analyzing' };
const rows: CommentRow[] = [
  { id: 'negative-1', user: 'guest-one', text: 'Cold coffee and slow service', tone: 'negative', cat: 'service', summary: 'Wait was long', reply: 'We are sorry', post: 'post-1', caption: 'Morning', url: '', ts: Date.parse('2026-11-12T10:00:00Z'), replySource: 'unknown', auto: false },
  { id: 'critical-1', user: 'guest-two', text: 'Found glass in the meal', tone: 'critical', cat: 'food_quality', summary: 'Safety issue', reply: '', post: 'post-2', caption: 'Lunch', url: '', ts: Date.parse('2026-11-12T11:00:00Z'), replySource: 'manual', auto: false },
];

describe('comment management experiences', () => {
  it('expands table rows to reveal comment details and keeps clear reply status', () => {
    render(<CommentList rows={rows} labels={labels} names={names} lang="en" manualReplies={new Set()} handled={new Set()} postLabel={id => id} selected={new Set()} onToggle={() => {}} onOpen={() => {}} displayMode="table" renderDetails={row => <p>{row.summary}</p>} />);

    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('replyUnknown')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'expand: guest-one' }));
    expect(screen.getByText('Wait was long')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'collapse: guest-one' })).toBeTruthy();
  });

  it('filters the follow-up inbox by search and priority and switches selected details', () => {
    const renderDetails = vi.fn((row: CommentRow) => <article>{row.summary}</article>);
    const { container } = render(<FollowUpInbox rows={rows} labels={labels} names={names} lang="en" handled={new Set()} renderDetails={renderDetails} />);

    expect(screen.getByText('Wait was long')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'followSearch' }), { target: { value: 'guest-two' } });
    expect(screen.getByText('Safety issue')).toBeTruthy();
    expect(screen.queryByText('Cold coffee and slow service')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /guest-two/ }));
    expect(container.querySelector('.follow-inbox.mobile-detail')).toBeTruthy();
    expect(screen.getByRole('button', { name: /guest-two/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByLabelText('filterPriority'), { target: { value: 'negative' } });
    expect(screen.getByText('emptyInboxSearch')).toBeTruthy();
  });
});
