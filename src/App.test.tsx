import { useLocation, MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { CommentRow } from './types';
import { fetchComments, sendReply } from './services/commentsApi';

vi.mock('./services/commentsApi', async importOriginal => {
  const actual = await importOriginal<typeof import('./services/commentsApi')>();
  return { ...actual, fetchComments: vi.fn(), sendReply: vi.fn() };
});

const comments: CommentRow[] = [
  { id: 'c-negative', user: 'guest-one', text: 'Slow service and cold coffee', tone: 'negative', cat: 'food_quality', summary: '', reply: 'نعتذر منك', post: 'post-1', caption: 'Breakfast', url: '', ts: 1_800_000_000_000, replySource: 'unknown', auto: false },
  { id: 'c-positive', user: 'guest-two', text: 'Great noodles', tone: 'positive', cat: 'service', summary: '', reply: 'شكراً', post: 'post-2', caption: 'Lunch', url: '', ts: 1_800_000_100_000, replySource: 'unknown', auto: false },
];
const rawRows = comments.map(comment => ({ comment_id: comment.id, comment_text: comment.text, username: comment.user, sentiment: comment.tone, category: comment.cat, suggested_reply: comment.reply, post_id: comment.post, timestamp: new Date(comment.ts).toISOString() }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderApp(path = '/overview') {
  return render(<MemoryRouter initialEntries={[path]}><App /><LocationProbe /></MemoryRouter>);
}

describe('dashboard stabilization regressions', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('k', 'test-key');
    vi.mocked(fetchComments).mockResolvedValue({ rows: rawRows, comments });
    vi.mocked(sendReply).mockResolvedValue({ ok: true, sent: true });
  });

  it('restores negative and follow-up overview cards with navigation', async () => {
    renderApp();
    await screen.findByRole('button', { name: /التعليقات السلبية/ });
    fireEvent.click(screen.getByRole('button', { name: /التعليقات السلبية/ }));
    expect(screen.getByTestId('location').textContent).toBe('/comments?tone=negative');

    cleanup();
    renderApp();
    await screen.findByRole('button', { name: /بحاجة متابعة/ });
    fireEvent.click(screen.getByRole('button', { name: /بحاجة متابعة/ }));
    expect(screen.getByTestId('location').textContent).toBe('/follow');
  });

  it('applies a category chart click to the URL and visible comments', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'English' }));
    fireEvent.click(await screen.findByRole('button', { name: /By category: Food quality, 1/ }));
    expect(screen.getByTestId('location').textContent).toBe('/comments?cat=food_quality');
    expect(await screen.findByText('Slow service and cold coffee')).toBeTruthy();
    expect(screen.queryByText('Great noodles')).toBeNull();
  });

  it('searches by comment ID while combining search with existing filters', async () => {
    renderApp('/comments?q=c-negative&tone=negative');
    expect(await screen.findByText('Slow service and cold coffee')).toBeTruthy();
    expect(screen.queryByText('Great noodles')).toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/comments?q=c-negative&tone=negative');
  });

  it('searches localized category names and combines search with sentiment filters', async () => {
    renderApp('/comments?q=food%20quality&tone=positive');
    fireEvent.click(await screen.findByRole('button', { name: 'English' }));
    expect(await screen.findByText('No comments match these filters.')).toBeTruthy();
    expect(screen.queryByText('Great noodles')).toBeNull();
  });

  it('summarizes active filters and resets all filter state and the URL together', async () => {
    renderApp('/comments?q=c-negative&tone=negative&cat=food_quality&sort=old');
    fireEvent.click(await screen.findByRole('button', { name: 'English' }));
    const summary = await screen.findByRole('group', { name: 'Active filters' });
    expect(summary.querySelectorAll('.filter-summary-chip')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Reset all filters' }));

    expect(screen.getByTestId('location').textContent).toBe('/comments');
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('group', { name: 'Active filters' })).toBeNull();
    expect(await screen.findByText('Slow service and cold coffee')).toBeTruthy();
    expect(screen.getByText('Great noodles')).toBeTruthy();
  });

  it('switches comments to table view and expands reply details inline', async () => {
    renderApp('/comments');
    fireEvent.click(await screen.findByRole('button', { name: 'English' }));
    fireEvent.click(screen.getByRole('button', { name: 'Table view' }));

    expect(screen.getByRole('table')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand details: guest-one' }));
    expect(await screen.findByRole('textbox', { name: 'Write a reply: guest-one' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Collapse details: guest-one' })).toBeTruthy();
  });

  it('supports Ctrl+Enter in Follow-up and marks successful manual replies handled', async () => {
    renderApp('/follow');
    const reply = await screen.findByRole('textbox', { name: /اكتبي رداً مناسباً/ });
    fireEvent.change(reply, { target: { value: 'رح نتابع الموضوع' } });
    reply.focus();
    fireEvent.keyDown(reply, { key: 'Enter', ctrlKey: true });
    expect(await screen.findByText('تأكيد إرسال هذا الرد على إنستغرام؟')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد' }));
    await waitFor(() => expect(sendReply).toHaveBeenCalledWith('test-key', {
      comment_id: 'c-negative', post_id: 'post-1', username: 'guest-one', reply_text: 'رح نتابع الموضوع',
    }));
    expect(await screen.findByText('لا توجد تعليقات بحاجة للمتابعة الآن.')).toBeTruthy();
  });

  it('detects the system dark scheme when no saved theme exists', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'نظرة عامة' });
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('provides a skip link and updates navigation language and document direction', async () => {
    renderApp();
    expect(screen.getByRole('link', { name: 'تخطي إلى المحتوى الرئيسي' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'English' }));
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en');
      expect(document.documentElement.dir).toBe('ltr');
    });
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toBeTruthy();
  });

  it('keeps the displayed comments when a later refresh fails', async () => {
    renderApp('/comments');
    expect(await screen.findByText('Slow service and cold coffee')).toBeTruthy();
    vi.mocked(fetchComments).mockRejectedValueOnce(new Error('network down'));
    fireEvent.click(screen.getByRole('button', { name: 'تحديث' }));
    expect(await screen.findByText('تعذر الاتصال. نعرض آخر بيانات تم حفظها.')).toBeTruthy();
    expect(screen.getByText('Slow service and cold coffee')).toBeTruthy();
  });

  it('shows a subtle refresh state while cached comments remain visible', async () => {
    localStorage.setItem('cache-data', JSON.stringify(rawRows));
    localStorage.setItem('cache-time', JSON.stringify(Date.now()));
    vi.mocked(fetchComments).mockImplementationOnce(() => new Promise(() => {}));
    const { container } = renderApp('/comments');

    expect(screen.getByText('Slow service and cold coffee')).toBeTruthy();
    await waitFor(() => expect(container.querySelector('.sync-refreshing')).toBeTruthy());
    expect(container.querySelector('.refresh-button')?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('.skeleton')).toBeNull();
    expect(screen.getByText('Slow service and cold coffee')).toBeTruthy();
  });
});
