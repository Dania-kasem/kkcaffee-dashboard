import { useMemo } from 'react';
import type { CommentRow, Sentiment } from '../types';
import { getHourlyActivity, getLastSevenDays } from '../utils/dashboardMetrics';

type Labels = Record<string, string>;

function formatDay(day: string, lang: string) {
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
    timeZone: 'UTC', month: 'short', day: '2-digit',
  }).format(new Date(Date.UTC(year, month - 1, date, 12)));
}

export default function Overview({ items, labels, lang, followCount, onTone, onCategory, onFollowup, onComment }: {
  items: CommentRow[]; labels: Labels; lang: string; followCount: number; onTone: (tone: string) => void; onCategory: (category: string) => void; onFollowup: () => void; onComment?: (row: CommentRow) => void;
}) {
  const names: Record<string, string> = { positive: labels.positive, negative: labels.negative, critical: labels.critical, neutral: labels.neutral, pending: labels.pending };
  const stats = useMemo(() => ({
    positive: items.filter(row => row.tone === 'positive').length,
    negative: items.filter(row => row.tone === 'negative').length,
    critical: items.filter(row => row.tone === 'critical').length,
    auto: items.filter(row => row.auto).length,
  }), [items]);
  const total = items.length || 1;
  const recentDays = useMemo(() => getLastSevenDays(items), [items]);
  const hourly = useMemo(() => getHourlyActivity(items), [items]);
  const categories = useMemo(() => Object.entries(items.reduce<Record<string, number>>((acc, row) => { if (row.cat) acc[row.cat] = (acc[row.cat] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]), [items]);
  const criticalRows = useMemo(() => items.filter(row => row.tone === 'critical').slice(0, 3), [items]);
  const toneCounts = (['positive', 'negative', 'critical', 'neutral'] as Sentiment[]).map(tone => ({ tone, count: items.filter(row => row.tone === tone).length }));
  const maxDay = Math.max(1, ...recentDays.map(({ count }) => count)), maxHour = Math.max(1, ...hourly), peakHour = hourly.findIndex(count => count === maxHour);
  const hasDailyActivity = recentDays.some(({ count }) => count > 0), totalHourlyActivity = hourly.reduce((sum, count) => sum + count, 0);
  const autoRate = Math.round(stats.auto / total * 100);
  return <section className="section-content overview-content">
    <div className="overview-intro"><div><span className="eyebrow">{labels.overviewMetrics}</span><p>{labels.overviewIntro}</p></div><span className="data-scope">{items.length} {labels.commentCount}</span></div>
    <div className="stats-grid" role="group" aria-label={labels.overviewMetrics}>
      <button type="button" className="stat-card accent-stat" title={`${labels.total}: ${items.length}`} onClick={() => onTone('all')}><span>{labels.total}</span><strong key={items.length} className="metric-value">{items.length}</strong><small>{labels.comments}</small></button>
      <button type="button" className="stat-card" title={`${labels.positive}: ${stats.positive}`} onClick={() => onTone('positive')}><span>{labels.positive}</span><strong key={stats.positive} className="metric-value">{stats.positive}</strong><small>{Math.round(stats.positive / total * 100)}% {labels.countOf} {items.length}</small></button>
      <button type="button" className="stat-card" title={`${labels.negative}: ${stats.negative}`} onClick={() => onTone('negative')}><span>{labels.negative}</span><strong key={stats.negative} className="metric-value">{stats.negative}</strong><small>{labels.statNegative}</small></button>
      <button type="button" className="stat-card" title={`${labels.critical}: ${stats.critical}`} onClick={() => onTone('critical')}><span>{labels.critical}</span><strong key={stats.critical} className="metric-value">{stats.critical}</strong><small>{Math.round(stats.critical / total * 100)}% {labels.countOf} {items.length}</small></button>
      <button type="button" className="stat-card" title={`${labels.autoRate}: ${autoRate}%`} onClick={() => onTone('auto')}><span>{labels.autoRate}</span><strong key={autoRate} className="metric-value">{autoRate}%</strong><small>{stats.auto} / {items.length} {labels.comments}</small></button>
      <button type="button" className="stat-card follow-stat" title={`${labels.followStat}: ${followCount}`} onClick={onFollowup}><span>{labels.followStat}</span><strong key={followCount} className="metric-value">{followCount}</strong><small>{labels.openFollow} ↗</small></button>
    </div>
    <section className="insights-section" aria-label={labels.insights}>
      <div className="insights-heading"><div><span className="eyebrow">{labels.insights}</span><h2>{labels.priorityAttention}</h2></div></div>
      <div className="insights-grid focus-insights-grid">
        <article className="insight-card insight-critical"><div className="insight-card-heading"><span className="insight-symbol" aria-hidden="true">!</span><span className="priority-pill">{labels.priorityAttention}</span></div><h3>{labels.criticalNeedsReview}</h3>{criticalRows.length > 0 ? <div className="critical-snippets">{criticalRows.map(row => <button type="button" key={row.id} onClick={() => onComment?.(row)}><b dir="auto">{row.user}</b><span dir="auto">{row.text}</span></button>)}</div> : <p>{labels.noCritical}</p>}<button type="button" className="insight-action" onClick={() => onTone("critical")}>{labels.viewComments} <span aria-hidden="true">&rarr;</span></button></article>
      </div>
    </section>
    <div className="metric-grid">
      <section className="metric-card"><div className="metric-heading"><div><span className="eyebrow">{labels.activity}</span><h2>{labels.last7}</h2></div><span className="metric-icon" aria-hidden="true">⌁</span></div><div className="day-bars" role="group" aria-label={labels.dailyChartLabel}>{recentDays.map(({ day, count }) => <div className="day-bar-col" key={day} title={`${formatDay(day, lang)} · ${count} ${labels.commentCount}`}><div className="day-track" aria-hidden="true"><i style={{ height: count > 0 ? `${Math.max(5, count / maxDay * 100)}%` : '0%' }} /></div><b>{count}</b><small>{formatDay(day, lang)}</small></div>)}</div>{!hasDailyActivity && <p className="chart-empty-note" role="status">{labels.noActivityLast7}</p>}</section>
      <section className="metric-card"><div className="metric-heading"><div><span className="eyebrow">{labels.engagement}</span><h2>{labels.byHour}</h2></div><span className="metric-icon" aria-hidden="true">◷</span></div>{totalHourlyActivity > 0 ? <><div className="hour-chart" aria-hidden="true">{hourly.map((count, hour) => <i className={`hour-bar${count === 0 ? ' is-zero' : ''}`} data-tooltip={`${String(hour).padStart(2, '0')}:00 · ${count} ${labels.commentCount}`} key={hour} title={`${String(hour).padStart(2, '0')}:00 · ${count} ${labels.commentCount}`} style={{ height: count > 0 ? `${Math.max(3, count / maxHour * 100)}%` : '0%' }} />)}</div><p className="sr-only">{labels.hourlyChartLabel}: {hourly.flatMap((count, hour) => count > 0 ? [`${String(hour).padStart(2, '0')}:00, ${count} ${labels.commentCount}`] : []).join('; ')}</p><div className="axis-labels" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div><p className="peak-label">{labels.peak}: <b>{String(peakHour).padStart(2, '0')}:00</b></p></> : <div className="chart-empty" role="status">{labels.noActivityByHour}</div>}</section>
      <section className="metric-card"><div className="metric-heading"><div><span className="eyebrow">{labels.sentimentEyebrow}</span><h2>{labels.sentiment}</h2></div></div><div className="sentiment-layout"><div className="donut-chart" role="img" aria-label={`${labels.sentimentChartLabel}: ${Math.round(stats.positive / total * 100)}%`} style={{ background: `conic-gradient(var(--positive) 0 ${stats.positive / total * 100}%,var(--negative) ${stats.positive / total * 100}% ${(stats.positive + stats.negative) / total * 100}%,var(--critical) ${(stats.positive + stats.negative) / total * 100}% ${(stats.positive + stats.negative + stats.critical) / total * 100}%,var(--neutral) ${(stats.positive + stats.negative + stats.critical) / total * 100}% 100%)` }}><div><b>{Math.round(stats.positive / total * 100)}%</b><small>{labels.positive}</small></div></div><div className="legend">{toneCounts.map(({ tone, count }) => <button type="button" key={tone} onClick={() => onTone(tone)}><i aria-hidden="true" className={`dot-${tone}`} />{names[tone]}<b>{count}</b></button>)}</div></div></section>
      <section className="metric-card"><div className="metric-heading"><div><span className="eyebrow">{labels.commentThemes}</span><h2>{labels.category}</h2></div></div>{categories.length ? <div className="category-chart">{categories.map(([category, count]) => <button type="button" key={category} onClick={() => onCategory(category)} aria-label={`${labels.category}: ${(labels as Record<string, string>)[category] || category}, ${count}`} data-tooltip={`${count} ${labels.commentCount}`}><span>{(labels as Record<string, string>)[category] || category}</span><i aria-hidden="true"><b style={{ width: `${count / total * 100}%` }} /></i><strong>{count}</strong></button>)}</div> : <div className="chart-empty" role="status">{labels.noCategoryActivity}</div>}</section>
    </div>
    <div className="automation-note"><span className="robot-icon" aria-hidden="true">🤖</span><div><b>{labels.auto}</b><p>{stats.auto > 0 ? `${stats.auto} / ${items.length} ${labels.comments}` : labels.noConfirmedAuto}</p></div><button className="button" type="button" aria-label={labels.auto} onClick={() => onTone('auto')}>↗</button></div>
  </section>;
}
