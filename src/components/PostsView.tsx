import type { CommentRow, Sentiment } from '../types';

type Labels = Record<string, string>;
const tones: Sentiment[] = ['positive', 'negative', 'critical', 'neutral'];

export default function PostsView({ items, labels, names, needsFollowup, onOpenPost }: {
  items: CommentRow[];
  labels: Labels;
  names: Record<string, string>;
  needsFollowup: (row: CommentRow) => boolean;
  onOpenPost: (postId: string) => void;
}) {
  const postIds = [...new Set(items.map(row => row.post).filter(Boolean))];

  if (!postIds.length) return <section className="posts-page"><div className="posts-page-heading"><div><span className="eyebrow">{labels.posts}</span><h2>{labels.postAnalytics}</h2></div><span className="posts-total">0 {labels.post}</span></div><div className="empty-state"><div className="empty-icon" aria-hidden="true">▧</div><h2>{labels.noPosts}</h2></div></section>;

  return <section className="posts-page" aria-label={labels.posts}>
    <div className="posts-page-heading"><div><span className="eyebrow">{labels.posts}</span><h2>{labels.postAnalytics}</h2></div><span className="posts-total">{postIds.length} {labels.post}</span></div>
    <div className="post-grid premium-post-grid">{postIds.map(postId => {
      const rows = items.filter(row => row.post === postId);
      const caption = rows.find(row => row.caption)?.caption;
      const distribution = tones.map(tone => ({ tone, count: rows.filter(row => row.tone === tone).length }));
      const followCount = rows.filter(needsFollowup).length;
      const displayName = caption || `${labels.post} …${postId.slice(-5)}`;
      const summary = distribution.map(({ tone, count }) => `${names[tone]} ${count}`).join(', ');
      return <article className="post-analytics-card" key={postId}>
        <div className="post-preview-placeholder" role="img" aria-label={labels.postPreviewUnavailable}>
          <span className="post-preview-mark" aria-hidden="true">IG</span>
          <span>{labels.postPreviewUnavailable}</span>
        </div>
        <div className="post-analytics-body">
          <div className="post-analytics-title"><span className="eyebrow">{labels.post}</span><h3 title={displayName}>{displayName}</h3></div>
          <div className="post-kpis"><span><b>{rows.length}</b>{labels.commentCount}</span><span className={followCount ? 'has-followups' : ''}><b>{followCount}</b>{labels.needs}</span></div>
          <div className="post-sentiment" role="img" aria-label={`${labels.sentimentBreakdown}: ${summary}`}>
            <div className="post-sentiment-bar" aria-hidden="true">{distribution.filter(item => item.count > 0).map(({ tone, count }) => <i key={tone} className={`bar-${tone}`} style={{ width: `${count / rows.length * 100}%` }} />)}</div>
            <div className="post-sentiment-legend">{distribution.filter(item => item.count > 0).map(({ tone, count }) => <span key={tone}><i className={`dot-${tone}`} aria-hidden="true" />{names[tone]} <b>{count}</b></span>)}</div>
          </div>
          <button className="button primary post-open-button" type="button" onClick={() => onOpenPost(postId)}>{labels.viewComments}<span aria-hidden="true">↗</span></button>
        </div>
      </article>;
    })}</div>
  </section>;
}
