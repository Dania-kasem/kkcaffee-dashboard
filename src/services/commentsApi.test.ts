import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchComments, normalizeComments, readCommentRows, sendReply } from './commentsApi';

const row = { comment_id: 'comment-1', comment_text: 'The food was lovely', username: 'guest', sentiment: 'positive', category: 'food_quality' };

describe('comments API compatibility and reply classification', () => {
  it('accepts an array, a data array, or one comment object', () => {
    expect(readCommentRows([row])).toEqual([row]);
    expect(readCommentRows({ data: [row] })).toEqual([row]);
    expect(readCommentRows(row)).toEqual([row]);
  });

  it('rejects malformed response shapes and malformed rows', () => {
    expect(() => readCommentRows({ error: 'failed' })).toThrow(/structure/i);
    expect(() => readCommentRows([{ comment_id: 'missing-text' }])).toThrow(/invalid row/i);
  });

  it('preserves the GET endpoint and header while validating the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [row] }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchComments('secret');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://dania04.app.n8n.cloud/webhook/comments');
    expect(new Headers(init?.headers).get('X-Dashboard-Key')).toBe('secret');
    expect(result.comments).toHaveLength(1);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    await expect(fetchComments('secret')).rejects.toThrow('HTTP 502');
  });

  it('rejects an unsupported Unicode key for both endpoints before fetch without including the key', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const unsupportedKey = `compatible-prefix-${String.fromCodePoint(0x1f512)}`;

    let message = '';
    try { await fetchComments(unsupportedKey); }
    catch (error) { message = error instanceof Error ? error.message : ''; }

    expect(message).toMatch(/browser cannot send/i);
    expect(message).not.toContain(unsupportedKey);
    await expect(sendReply(unsupportedKey, { comment_id: 'c1', post_id: 'p1', username: 'guest', reply_text: 'hi' }))
      .rejects.toThrow(/browser cannot send/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses reply_source, never a reply ID alone, to classify automation', () => {
    const comments = normalizeComments([
      { ...row, comment_id: 'auto', reply_id: 'r1', reply_source: 'automatic' },
      { ...row, comment_id: 'manual', reply_id: 'r2', reply_source: 'manual' },
      { ...row, comment_id: 'unknown', reply_id: 'r3' },
      { ...row, comment_id: 'legacy-auto', auto_replied: true },
    ]);
    expect(comments.find(comment => comment.id === 'auto')?.auto).toBe(true);
    expect(comments.find(comment => comment.id === 'manual')?.auto).toBe(false);
    expect(comments.find(comment => comment.id === 'unknown')?.replySource).toBe('unknown');
    expect(comments.find(comment => comment.id === 'unknown')?.auto).toBe(false);
    expect(comments.find(comment => comment.id === 'legacy-auto')?.auto).toBe(true);
  });

  it('preserves the POST contract and requires the existing ok/sent confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, sent: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const payload = { comment_id: 'c1', post_id: 'p1', username: 'guest', reply_text: 'يسعدنا ذلك' };
    await expect(sendReply('secret', payload)).resolves.toEqual({ ok: true, sent: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://dania04.app.n8n.cloud/webhook/reply-comment');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Dashboard-Key')).toBe('secret');
    expect(init?.body).toBe(JSON.stringify(payload));
  });

  it('rejects explicit delivery failure and missing delivery confirmation on 2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, sent: false }) }));
    await expect(sendReply('secret', { comment_id: 'c1', post_id: 'p1', username: 'guest', reply_text: 'hi' })).rejects.toThrow(/not sent/i);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    await expect(sendReply('secret', { comment_id: 'c1', post_id: 'p1', username: 'guest', reply_text: 'hi' })).rejects.toThrow(/did not confirm/i);
  });

  it('reports HTTP failure statuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(sendReply('secret', { comment_id: 'c1', post_id: 'p1', username: 'guest', reply_text: 'hi' })).rejects.toThrow('HTTP 503');
  });
});

afterEach(() => vi.unstubAllGlobals());
