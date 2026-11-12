import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommentRow } from '../types';
import PostsView from './PostsView';

const labels = new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) });
const names = { positive: 'Positive', negative: 'Negative', critical: 'Critical', neutral: 'Neutral', pending: 'Analyzing' };
const row: CommentRow = {
  id: 'comment-1', user: 'guest', text: 'Great coffee', tone: 'positive', cat: 'food_quality', summary: '', reply: '',
  post: 'post-12345', caption: '', url: '', ts: Date.parse('2026-11-12T13:00:00Z'), replySource: 'unknown', auto: false,
};

describe('post analytics cards', () => {
  it('does not fabricate a preview and navigates to the post filter', () => {
    const onOpenPost = vi.fn();
    render(<PostsView items={[row]} labels={labels} names={names} needsFollowup={() => false} onOpenPost={onOpenPost} />);

    expect(screen.getByText('postPreviewUnavailable')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'post …12345' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /viewComments/ }));
    expect(onOpenPost).toHaveBeenCalledWith('post-12345');
  });
});
