import { Fragment, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import type { CommentRow } from '../types';

type Labels = Record<string, string>;

function formatTime(timestamp: number, lang: string) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
    timeZone: 'Asia/Amman', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(timestamp);
}

function relativeTime(timestamp: number, lang: string) {
  const delta = (timestamp - Date.now()) / 1000, absolute = Math.abs(delta);
  const [value, unit] = absolute < 3600 ? [Math.round(delta / 60), 'minute'] : absolute < 86400 ? [Math.round(delta / 3600), 'hour'] : [Math.round(delta / 86400), 'day'];
  return new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' }).format(value, unit as Intl.RelativeTimeFormatUnit);
}

export function CommentMeta({ row, labels, names, lang, seen, manualReplies, handled, postLabel }: {
  row: CommentRow; labels: Labels; names: Record<string, string>; lang: string; seen: Set<string>; manualReplies: Set<string>; handled: Set<string>; postLabel: (id: string) => string;
}) {
  const isManual = row.replySource === 'manual' || manualReplies.has(row.id);
  return <div className="comment-meta">
    <span className="user-name" dir="auto">{row.user}</span>
    <span className={`badge tone-${row.tone}`}>{names[row.tone]}</span>
    {!seen.has(row.id) && <span className="badge new-badge">{labels.newBadge}</span>}
    {row.auto && <span className="badge auto-badge">{labels.replySourceAuto || labels.autoShort}</span>}
    {isManual && <span className="badge reply-badge">{labels.replySourceManual || labels.manualReply}</span>}
    {!row.auto && !isManual && <span className="badge reply-unknown-badge">{labels.replyUnknown}</span>}
    {handled.has(row.id) && <span className="badge handled-badge" title={labels.handledTooltip}>✓ {labels.handled}</span>}
    {row.cat && <span className="category-label">{(labels as Record<string, string>)[row.cat] || row.cat}</span>}
    {row.post && <span className="post-label">{postLabel(row.post)}</span>}
    {row.ts > 0 && <time title={formatTime(row.ts, lang)}>{relativeTime(row.ts, lang)}</time>}
  </div>;
}

export function CommentPanel({ row, labels, names, lang, seen, manualReplies, handled, postLabel, draft, onDraft, onReply, onCopy, onHandled }: {
  row: CommentRow; labels: Labels; names: Record<string, string>; lang: string; seen: Set<string>; manualReplies: Set<string>; handled: Set<string>; postLabel: (id: string) => string;
  draft: string; onDraft: (value: string) => void; onReply: (row: CommentRow, text: string) => void; onCopy: (text: string) => void; onHandled: (row: CommentRow) => void;
}) {
  return <article className={`comment-card ${row.tone}`}>
    <CommentMeta row={row} labels={labels} names={names} lang={lang} seen={seen} manualReplies={manualReplies} handled={handled} postLabel={postLabel} />
    <p className="comment-text" dir="auto">{row.text}</p>
    {row.summary && <p className="summary-line"><span>{labels.summary}:</span> {row.summary}</p>}
    {row.auto && <p className="confirmed-note">{labels.auto}</p>}
    <div className="comment-actions">
      <textarea data-comment-id={row.id} aria-label={`${labels.reply}: ${row.user}`} aria-keyshortcuts="Control+Enter Meta+Enter" value={draft} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onDraft(event.target.value)} placeholder={labels.reply} rows={3} />
      <div className="action-row">
        <button className="button primary" type="button" onClick={() => onReply(row, draft)}>{labels.send}</button>
        <button className="button" type="button" onClick={() => onCopy(draft)}>{labels.copy}</button>
        <button className="button" type="button" title={labels.handledTooltip} onClick={() => onHandled(row)}>{handled.has(row.id) ? labels.reopen : labels.markHandled}</button>
        {row.url && <a className="button" href={row.url} target="_blank" rel="noreferrer">{labels.openInstagram}</a>}
      </div>
      <small className="local-note">{labels.localOnly}</small>
    </div>
  </article>;
}

function replyState(row: CommentRow, manualReplies: Set<string>, labels: Labels) {
  if (row.auto) return labels.replySourceAuto || labels.autoShort;
  if (row.replySource === 'manual' || manualReplies.has(row.id)) return labels.replySourceManual || labels.manualReply;
  return labels.replyUnknown;
}

export function CommentList({ rows, labels, names, lang, manualReplies, handled, postLabel, selected, onToggle, onOpen, displayMode = 'list', renderDetails }: {
  rows: CommentRow[]; labels: Labels; names: Record<string, string>; lang: string; manualReplies: Set<string>; handled: Set<string>; postLabel: (id: string) => string; selected: Set<string>;
  onToggle: (row: CommentRow, checked: boolean) => void; onOpen: (row: CommentRow, trigger: HTMLElement) => void; displayMode?: 'list' | 'table'; renderDetails?: (row: CommentRow) => ReactNode;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => setExpanded(previous => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const details = (row: CommentRow) => expanded.has(row.id) && renderDetails && <div className="expanded-comment-details">{renderDetails(row)}</div>;

  if (displayMode === 'table') return <div className="comments-table-wrap"><table className="comments-table"><caption className="sr-only">{labels.comments}</caption><thead><tr><th scope="col"><span className="sr-only">{labels.selectAll}</span></th><th scope="col">{labels.commenter}</th><th scope="col">{labels.comment}</th><th scope="col">{labels.sentiment}</th><th scope="col">{labels.reply}</th><th scope="col">{labels.date}</th><th scope="col">{labels.actions}</th></tr></thead><tbody>{rows.map(row => <Fragment key={row.id}>
    <tr key={row.id} className={handled.has(row.id) ? 'is-handled' : undefined}>
      <td><input type="checkbox" className="row-check" checked={selected.has(row.id)} aria-label={`${labels.selectComment}: ${row.user}`} onChange={event => onToggle(row, event.target.checked)} /></td>
      <th scope="row"><span className="user-name" dir="auto">{row.user}</span><small className="table-comment-id">{row.id}</small></th>
      <td><button className="table-comment-open" type="button" onClick={event => onOpen(row, event.currentTarget)}><span dir="auto">{row.text}</span>{row.cat && <small>{(labels as Record<string, string>)[row.cat] || row.cat}</small>}</button></td>
      <td><span className={`badge tone-${row.tone}`}>{names[row.tone]}</span></td>
      <td><span className={`badge ${row.auto ? 'auto-badge' : row.replySource === 'manual' || manualReplies.has(row.id) ? 'reply-badge' : 'reply-unknown-badge'}`}>{replyState(row, manualReplies, labels)}</span></td>
      <td>{row.ts > 0 ? <time title={formatTime(row.ts, lang)}>{relativeTime(row.ts, lang)}</time> : '—'}</td>
      <td><button className="button table-expand" type="button" aria-expanded={expanded.has(row.id)} aria-label={`${expanded.has(row.id) ? labels.collapse : labels.expand}: ${row.user}`} onClick={() => toggleExpanded(row.id)}>{expanded.has(row.id) ? '−' : '+'}</button></td>
    </tr>
    {expanded.has(row.id) && renderDetails && <tr key={`${row.id}-details`} className="expanded-table-row"><td colSpan={7}>{details(row)}</td></tr>}
  </Fragment>)}</tbody></table></div>;

  return <div className="comment-list">{rows.map(row => <div className={`list-row compact-list-row ${handled.has(row.id) ? 'is-handled' : ''}`} key={row.id}>
    <input type="checkbox" className="row-check" checked={selected.has(row.id)} aria-label={`${labels.selectComment}: ${row.user}`} onChange={event => onToggle(row, event.target.checked)} />
    <button className="row-open" type="button" onClick={event => onOpen(row, event.currentTarget)}>
      <span className="compact-row-heading"><span className="user-name" dir="auto">{row.user}</span><span className={`badge tone-${row.tone}`}>{names[row.tone]}</span><span className={`badge ${row.auto ? 'auto-badge' : row.replySource === 'manual' || manualReplies.has(row.id) ? 'reply-badge' : 'reply-unknown-badge'}`}>{replyState(row, manualReplies, labels)}</span><time>{row.ts > 0 ? relativeTime(row.ts, lang) : '—'}</time></span>
      <span className="compact-row-text" dir="auto">{row.text}</span>
      <span className="compact-row-meta">{row.cat && <span>{(labels as Record<string, string>)[row.cat] || row.cat}</span>}{row.post && <span>{postLabel(row.post)}</span>}</span>
    </button>
    <button className="button expand-row-button" type="button" aria-expanded={expanded.has(row.id)} aria-label={`${expanded.has(row.id) ? labels.collapse : labels.expand}: ${row.user}`} onClick={() => toggleExpanded(row.id)}>{expanded.has(row.id) ? '−' : '+'}</button>
    {details(row)}
  </div>)}</div>;
}

export function FollowUpInbox({ rows, labels, names, lang, handled, renderDetails }: {
  rows: CommentRow[]; labels: Labels; names: Record<string, string>; lang: string; handled: Set<string>; renderDetails: (row: CommentRow) => ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState('all');
  const [selectedId, setSelectedId] = useState(rows[0]?.id || '');
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const filteredRows = useMemo(() => rows.filter(row => {
    const searchable = `${row.id} ${row.user} ${row.text} ${row.summary} ${row.caption} ${row.cat} ${labels[row.cat] || ''}`.toLowerCase();
    return (!query.trim() || searchable.includes(query.trim().toLowerCase())) && (priority === 'all' || row.tone === priority);
  }), [rows, query, priority, labels]);
  const selected = filteredRows.find(row => row.id === selectedId) || filteredRows[0];

  return <section className={`follow-inbox${mobileShowDetail ? ' mobile-detail' : ''}`} aria-label={labels.follow}>
    <aside className="follow-inbox-list" aria-label={labels.follow}>
      <header className="follow-inbox-heading"><div><span className="eyebrow">{labels.follow}</span><h2>{filteredRows.length} {labels.commentCount}</h2></div><span className="inbox-priority-total">{rows.filter(row => row.tone === 'critical').length} {labels.critical}</span></header>
      <label className="inbox-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={labels.followSearch} placeholder={labels.followSearch} /></label>
      <label className="inbox-priority-filter"><span>{labels.filterPriority}</span><select value={priority} onChange={event => setPriority(event.target.value)}><option value="all">{labels.allPriorities}</option><option value="critical">{labels.highPriority}</option><option value="negative">{labels.mediumPriority}</option></select></label>
      {filteredRows.length ? <div className="inbox-row-list" role="list">{filteredRows.map(row => <div role="listitem" key={row.id}><button type="button" className={`inbox-row ${selected?.id === row.id ? 'selected' : ''}`} aria-pressed={selected?.id === row.id} onClick={() => { setSelectedId(row.id); setMobileShowDetail(true); }}>
        <span className={`priority-marker ${row.tone}`} aria-hidden="true" />
        <span className="inbox-row-content"><span className="inbox-row-top"><b dir="auto">{row.user}</b><time>{row.ts > 0 ? relativeTime(row.ts, lang) : '—'}</time></span><span className="inbox-row-text" dir="auto">{row.text}</span><span className="inbox-row-bottom"><span className={`badge tone-${row.tone}`}>{names[row.tone]}</span>{handled.has(row.id) && <span className="badge handled-badge">{labels.handled}</span>}</span></span>
      </button></div>)}</div> : <div className="inbox-empty"><span className="empty-icon" aria-hidden="true">⌕</span><p>{query || priority !== 'all' ? labels.emptyInboxSearch : labels.followEmpty}</p></div>}
    </aside>
    <section className="follow-inbox-detail" aria-label={labels.selectedComment}>{selected ? <><button className="button inbox-back-button" type="button" onClick={() => setMobileShowDetail(false)}>← {labels.backToInbox}</button>{renderDetails(selected)}</> : <div className="inbox-detail-empty"><span className="empty-icon" aria-hidden="true">✓</span><h2>{labels.followEmpty}</h2></div>}</section>
  </section>;
}

