import type { CommentRow, ReplyRequest, ReplyResult, ReplySource, Sentiment } from '../types';

const COMMENTS_URL = import.meta.env.VITE_COMMENTS_API_URL || 'https://dania04.app.n8n.cloud/webhook/comments';
const REPLY_URL = import.meta.env.VITE_REPLY_API_URL || 'https://dania04.app.n8n.cloud/webhook/reply-comment';
const DASHBOARD_KEY_HEADER = 'X-Dashboard-Key';
const OWNER = 'kkcaffee';

function dashboardHeaders(key: string, json = false): Headers {
  // Fetch header values are ByteStrings. Reject non-Latin-1 keys explicitly;
  // never encode, strip, or otherwise change the credential's meaning.
  if (/[^\u0000-\u00FF]/u.test(key)) {
    throw new Error('The dashboard key contains characters the browser cannot send in an HTTP header. Configure a compatible credential in n8n and enter that exact key again.');
  }

  try {
    const headers = new Headers();
    if (json) headers.set('Content-Type', 'application/json');
    headers.set(DASHBOARD_KEY_HEADER, key);
    return headers;
  } catch {
    // Keep formatting errors generic too: native exceptions must never echo a key.
    throw new Error('The dashboard key cannot be used as an HTTP header. Check that the configured credential is valid for browser headers.');
  }
}

const clean = (value: unknown) => {
  const result = String(value ?? '').trim();
  return result.toUpperCase() === 'N/A' ? '' : result;
};

function isCommentRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const validId = row.comment_id === undefined || row.comment_id === null || ['string', 'number'].includes(typeof row.comment_id);
  return typeof row.comment_text === 'string' && validId;
}

export function readCommentRows(payload: unknown): Record<string, unknown>[] {
  let rows: unknown[];
  if (Array.isArray(payload)) rows = payload;
  else if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const object = payload as Record<string, unknown>;
    if (Array.isArray(object.data)) rows = object.data;
    else if (isCommentRecord(object)) rows = [object];
    else throw new Error('Unexpected comments response structure.');
  } else throw new Error('Unexpected comments response structure.');

  if (!rows.every(isCommentRecord)) throw new Error('Comments response contains an invalid row.');
  return rows;
}

function replySource(row: Record<string, unknown>): ReplySource {
  const source = clean(row.reply_source).toLowerCase();
  if (source === 'automatic' || source === 'auto') return 'automatic';
  if (source === 'manual') return 'manual';
  // Keep compatibility with an explicit auto-specific field, but never infer
  // automation from reply_id or a generic already_replied flag.
  if (!source && ['true', '1', 'yes'].includes(clean(row.auto_replied).toLowerCase())) return 'automatic';
  return 'unknown';
}

export function normalizeComments(rows: Record<string, unknown>[]): CommentRow[] {
  const byId = new Map<string, CommentRow>();
  rows.forEach((row, index) => {
    const id = clean(row.comment_id) || `row-${index}`;
    const text = clean(row.comment_text), user = clean(row.username);
    if (!text || user.toLowerCase() === OWNER) return;
    const rawSentiment = clean(row.sentiment).toLowerCase();
    const tone: Sentiment = (['positive', 'negative', 'critical', 'neutral'] as const).find(value => rawSentiment.includes(value)) || 'pending';
    const source = replySource(row);
    byId.set(id, {
      id, user: user || '—', text, tone, cat: clean(row.category).toLowerCase(), summary: clean(row.summary),
      reply: clean(row.suggested_reply), post: clean(row.post_id), caption: clean(row.post_caption), url: clean(row.comment_url),
      ts: Date.parse(clean(row.timestamp)) || 0, replySource: source, auto: source === 'automatic',
    });
  });
  return [...byId.values()].sort((a, b) => b.ts - a.ts);
}

export async function fetchComments(key: string): Promise<{ rows: Record<string, unknown>[]; comments: CommentRow[] }> {
  const response = await fetch(COMMENTS_URL, { headers: dashboardHeaders(key) });
  if (response.status === 401 || response.status === 403) throw Object.assign(new Error('Authentication failed.'), { status: response.status });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows = readCommentRows(await response.json());
  return { rows, comments: normalizeComments(rows) };
}

export async function sendReply(key: string, payload: ReplyRequest): Promise<ReplyResult> {
  const response = await fetch(REPLY_URL, {
    method: 'POST',
    headers: dashboardHeaders(key, true),
    body: JSON.stringify(payload),
  });
  if (response.status === 401 || response.status === 403) throw Object.assign(new Error('Authentication failed.'), { status: response.status });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  let result: unknown;
  try { result = await response.json(); }
  catch { throw new Error('The reply endpoint returned no valid JSON confirmation.'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('The reply endpoint returned an invalid confirmation.');
  const body = result as Record<string, unknown>;
  if (body.ok === false || body.sent === false) throw new Error('The reply endpoint reported that the reply was not sent.');
  if (body.ok !== true || body.sent !== true) throw new Error('The reply endpoint did not confirm both ok and sent.');
  return { ok: true, sent: true };
}
