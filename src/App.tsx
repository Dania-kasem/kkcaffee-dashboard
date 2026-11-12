import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchComments, normalizeComments, readCommentRows, sendReply as postManualReply } from './services/commentsApi';
import { CommentList, CommentPanel, FollowUpInbox } from './components/CommentViews';
import Overview from './components/Overview';
import PostsView from './components/PostsView';
import type { CommentRow, View } from './types';

type Toast = { id: number; message: string; kind?: 'success' | 'error' | 'warning'; action?: string; onAction?: () => void };
type Filters = { q: string; tone: string; post: string; cat: string; range: string; sort: string };

const STRINGS = {
  ar: {
    title: 'لوحة تعليقات kkcaffee', subtitle: 'إدارة التعليقات', updated: 'آخر مزامنة', stale: 'البيانات المعروضة قديمة', refresh: 'تحديث', updating: 'جارٍ التحديث…', follow: 'المتابعة', comments: 'كل التعليقات', posts: 'المنشورات', overview: 'نظرة عامة', positive: 'إيجابي', negative: 'سلبي', critical: 'حرج', neutral: 'محايد', pending: 'قيد التحليل', food_quality: 'جودة الأكل', delivery: 'التوصيل', service: 'الخدمة', price: 'السعر', hygiene: 'النظافة', other: 'أخرى', all: 'الكل', auto: 'رد تلقائي مؤكد', autoShort: '🤖 رد تلقائي', total: 'إجمالي التعليقات', autoRate: 'نسبة الردود التلقائية المؤكدة', needs: 'بحاجة متابعة', followStat: 'بحاجة متابعة', statNegative: 'التعليقات السلبية', peak: 'أكثر ساعة تفاعلاً', manualReply: 'رد يدوي مؤكد', last7: 'آخر 7 أيام', byHour: 'التعليقات حسب الساعة', sentiment: 'توزيع المشاعر', category: 'حسب التصنيف', search: 'ابحث عن تعليق أو اسم…', allPosts: 'كل المنشورات', allCategories: 'كل التصنيفات', allTime: 'كل الأوقات', last24: 'آخر 24 ساعة', last30: 'آخر 30 يوم', newest: 'الأحدث أولاً', oldest: 'الأقدم أولاً', new: 'جديد', handled: 'تم التعامل معه على هذا الجهاز', markHandled: 'تم التعامل معه', reopen: 'إعادة فتح', followEmpty: 'لا توجد تعليقات بحاجة للمتابعة الآن.', noResults: 'ما في نتائج مطابقة للفلاتر.', noPosts: 'لا توجد منشورات.', clearFilters: 'مسح الفلاتر', openFollow: 'عرض المتابعة', login: 'دخول', pin: 'أدخلي رمز الدخول', pinHelp: 'يُرسل الرمز إلى n8n عبر ترويسة المصادقة الحالية، ويُحفظ في الجلسة فقط.', send: 'إرسال الرد', copy: 'نسخ', close: 'إغلاق', reply: 'اكتبي رداً مناسباً', confirmReply: 'تأكيد إرسال هذا الرد على إنستغرام؟', confirm: 'تأكيد', cancel: 'إلغاء', sending: 'جارٍ الإرسال…', sent: 'تم إرسال الرد', sendError: 'تعذّر إرسال الرد', emptyReply: 'اكتبي الرد أولاً.', fetchError: 'تعذّر جلب التعليقات', offline: 'تعذر الاتصال. نعرض آخر بيانات تم حفظها.', newComments: 'تعليقات جديدة', selectAll: 'تحديد الظاهر', selected: 'محدد', markSelected: 'تحديد كتم التعامل', clearSelection: 'إلغاء التحديد', undo: 'تراجع', localOnly: 'الحالة محفوظة على هذا الجهاز فقط', noConfirmedAuto: 'لا توجد بيانات مؤكدة عن الرد التلقائي في استجابة n8n الحالية.', replyLocally: 'أُرسل من لوحة التحكم', openInstagram: 'فتح إنستغرام', copyDone: 'تم النسخ', post: 'منشور', summary: 'الملخص', categoryLabel: 'التصنيف', theme: 'المظهر', language: 'English', loading: 'جارٍ تحميل التعليقات', updatedFailed: 'تعذر التحديث', hours: 'ساعة', commentCount: 'تعليق', newBadge: 'جديد', handledTooltip: 'محلي على هذا الجهاز', clearSearch: 'مسح البحث', sortLabel: 'الترتيب', rangeLabel: 'الفترة', countOf: 'من', errorBadShape: 'صيغة البيانات التي أعادها n8n غير متوقعة.', statPositive: 'التعليقات الإيجابية', statCritical: 'التعليقات الحرجة', activity: 'النشاط', engagement: 'التفاعل', sentimentEyebrow: 'المشاعر', commentThemes: 'موضوعات التعليقات', noActivityLast7: 'لا توجد تعليقات خلال آخر 7 أيام.', noActivityByHour: 'لا توجد بيانات نشاط حسب الساعة.', noCategoryActivity: 'لا توجد تصنيفات متاحة.', activeFilters: 'الفلاتر النشطة', resetAllFilters: 'مسح كل الفلاتر', searchFilter: 'بحث'
  },
  en: {
    title: 'kkcaffee Comments', subtitle: 'Comment management', updated: 'Last synced', stale: 'Showing stale data', refresh: 'Refresh', updating: 'Refreshing…', follow: 'Follow-up', comments: 'All comments', posts: 'Posts', overview: 'Overview', positive: 'Positive', negative: 'Negative', critical: 'Critical', neutral: 'Neutral', pending: 'Analyzing', food_quality: 'Food quality', delivery: 'Delivery', service: 'Service', price: 'Price', hygiene: 'Hygiene', other: 'Other', all: 'All', auto: 'Confirmed auto reply', autoShort: '🤖 Auto replied', total: 'Total comments', autoRate: 'Confirmed auto reply rate', needs: 'Need follow-up', followStat: 'Need follow-up', statNegative: 'Negative comments', peak: 'Peak hour', manualReply: 'Manual reply confirmed', last7: 'Last 7 days', byHour: 'Comments by hour', sentiment: 'Sentiment split', category: 'By category', search: 'Search comments or names…', allPosts: 'All posts', allCategories: 'All categories', allTime: 'All time', last24: 'Last 24 hours', last30: 'Last 30 days', newest: 'Newest first', oldest: 'Oldest first', new: 'New', handled: 'Handled on this device', markHandled: 'Mark handled', reopen: 'Reopen', followEmpty: 'Nothing needs follow-up right now.', noResults: 'No comments match these filters.', noPosts: 'No posts available.', clearFilters: 'Clear filters', openFollow: 'View follow-up', login: 'Sign in', pin: 'Enter the access code', pinHelp: 'The code is sent to n8n using the existing authentication header and kept for this session only.', send: 'Send reply', copy: 'Copy', close: 'Close', reply: 'Write a reply', confirmReply: 'Send this reply on Instagram?', confirm: 'Confirm', cancel: 'Cancel', sending: 'Sending…', sent: 'Reply sent', sendError: 'Could not send reply', emptyReply: 'Write a reply first.', fetchError: 'Could not load comments', offline: 'Connection failed. Showing the last saved data.', newComments: 'new comments', selectAll: 'Select visible', selected: 'selected', markSelected: 'Mark handled', clearSelection: 'Clear selection', undo: 'Undo', localOnly: 'Status is saved on this device only', noConfirmedAuto: 'The current n8n response has no confirmed auto reply data.', replyLocally: 'Sent from dashboard', openInstagram: 'Open Instagram', copyDone: 'Copied', post: 'Post', summary: 'Summary', categoryLabel: 'Category', theme: 'Theme', language: 'العربية', loading: 'Loading comments', updatedFailed: 'Update failed', hours: 'hour', commentCount: 'comments', newBadge: 'New', handledTooltip: 'Local to this device', clearSearch: 'Clear search', sortLabel: 'Sort', rangeLabel: 'Period', countOf: 'of', errorBadShape: 'Unexpected comments response structure.', statPositive: 'Positive comments', statCritical: 'Critical comments', activity: 'Activity', engagement: 'Engagement', sentimentEyebrow: 'SENTIMENT', commentThemes: 'Comment themes', noActivityLast7: 'No comments during the last 7 days.', noActivityByHour: 'No hourly activity data is available.', noCategoryActivity: 'No categories are available.', activeFilters: 'Active filters', resetAllFilters: 'Reset all filters', searchFilter: 'Search'
  }
} as const;
type Lang = keyof typeof STRINGS;
const EXTRA_STRINGS: Record<Lang, Record<string, string>> = {
  ar: {
    skipMain: 'تخطي إلى المحتوى الرئيسي', mainNavigation: 'التنقل الرئيسي', brandEyebrow: 'إدارة التعليقات الاجتماعية',
    commentDetails: 'تفاصيل التعليق', instagram: 'إنستغرام', secureAccess: 'دخول آمن', accessCode: 'رمز الدخول',
    switchTheme: 'تبديل المظهر', switchLanguage: 'تغيير لغة الواجهة', copyError: 'تعذر نسخ النص', searchShortcut: 'اضغط / للبحث', reviewComments: 'عرض التعليقات', selectComment: 'تحديد التعليق',
    dailyChartLabel: 'عدد التعليقات لكل يوم خلال آخر سبعة أيام', hourlyChartLabel: 'عدد التعليقات حسب الساعة', sentimentChartLabel: 'نسبة التعليقات الإيجابية', overviewMetrics: 'مؤشرات نظرة عامة', themeDark: 'داكن', themeLight: 'فاتح',
    overviewIntro: 'ملخص أداء التعليقات والمواضيع التي تحتاج إلى انتباهك.', periodTrend: 'مقارنة بالأيام السبعة السابقة ضمن البيانات المحمّلة', noPeriodTrend: 'لا توجد بيانات كافية للمقارنة بعد.', insights: 'رؤى قابلة للتنفيذ', priorityAttention: 'أولوية عالية', criticalNeedsReview: 'تعليقات حرجة تحتاج إلى مراجعة', criticalCount: 'تعليقات حرجة', noCritical: 'لا توجد تعليقات حرجة ضمن البيانات الحالية.', followUpAction: 'تعليقات تنتظر المراجعة',
    topCategory: 'التصنيف الأكثر تكراراً', mostCommon: 'الأكثر شيوعاً', viewComments: 'عرض التعليقات', replyUnknown: 'حالة الرد غير مؤكدة', replySourceAuto: 'رد تلقائي مؤكد', replySourceManual: 'رد يدوي مؤكد', commenter: 'صاحب التعليق', comment: 'التعليق', date: 'التاريخ', actions: 'الإجراءات', viewList: 'عرض القائمة', viewTable: 'عرض الجدول', expand: 'توسيع التفاصيل', collapse: 'طي التفاصيل',
    followSearch: 'ابحث في تعليقات المتابعة', filterPriority: 'الأولوية', allPriorities: 'كل الأولويات', highPriority: 'حرجة', mediumPriority: 'سلبية', selectedComment: 'التعليق المحدد', emptyInboxSearch: 'لا توجد تعليقات مطابقة لهذا البحث.', backToInbox: 'العودة إلى قائمة المتابعة', postAnalytics: 'تحليلات المنشور', postPreviewUnavailable: 'لا تتوفر صورة معاينة في بيانات التعليقات الحالية.', sentimentBreakdown: 'توزيع المشاعر',
  },
  en: {
    skipMain: 'Skip to main content', mainNavigation: 'Main navigation', brandEyebrow: 'Social comment management',
    commentDetails: 'Comment details', instagram: 'Instagram', secureAccess: 'Secure access', accessCode: 'Access code',
    switchTheme: 'Toggle appearance', switchLanguage: 'Change interface language', copyError: 'Could not copy text', searchShortcut: 'Press / to search', reviewComments: 'Review comments', selectComment: 'Select comment',
    dailyChartLabel: 'Comment count for each of the last seven days', hourlyChartLabel: 'Comment count by hour', sentimentChartLabel: 'Percentage of positive comments', overviewMetrics: 'Overview metrics', themeDark: 'dark', themeLight: 'light',
    overviewIntro: 'A clear view of comment performance and what needs your attention.', periodTrend: 'Compared with the prior seven days in loaded data', noPeriodTrend: 'Not enough history to compare yet.', insights: 'Actionable insights', priorityAttention: 'High priority', criticalNeedsReview: 'Critical comments need review', criticalCount: 'Critical comments', noCritical: 'No critical comments in the current data.', followUpAction: 'Comments waiting for review',
    topCategory: 'Most frequent category', mostCommon: 'Most common', viewComments: 'View comments', replyUnknown: 'Reply status unconfirmed', replySourceAuto: 'Confirmed automatic reply', replySourceManual: 'Confirmed manual reply', commenter: 'Commenter', comment: 'Comment', date: 'Date', actions: 'Actions', viewList: 'List view', viewTable: 'Table view', expand: 'Expand details', collapse: 'Collapse details',
    followSearch: 'Search follow-up comments', filterPriority: 'Priority', allPriorities: 'All priorities', highPriority: 'Critical', mediumPriority: 'Negative', selectedComment: 'Selected comment', emptyInboxSearch: 'No comments match this search.', backToInbox: 'Back to follow-up list', postAnalytics: 'Post analytics', postPreviewUnavailable: 'No image preview is available in the current comments data.', sentimentBreakdown: 'Sentiment breakdown',
  },
};
const readJson = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
const getSavedTheme = () => { try { const saved = localStorage.getItem('theme'); if (saved === 'light' || saved === 'dark') return saved; } catch {} return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; };
const readCachedComments = (): CommentRow[] => {
  try {
    const legacy = readJson<{ d?: unknown[] }>('cache', {});
    const raw = readJson<unknown>('cache-data', legacy.d || []);
    return normalizeComments(readCommentRows(raw));
  } catch { return []; }
};
function Dialog({ children, onClose, className = '', label }: { children: React.ReactNode; onClose: () => void; className?: string; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; if (!dialog) return; if (!dialog.open) dialog.showModal(); return () => { if (dialog.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className={className} aria-label={label} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === ref.current) onClose(); }}>{children}</dialog>;
}
const formatSyncTime = (timestamp: number, lang: Lang) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { timeZone: 'Asia/Amman', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp);

export default function App() {
  const location = useLocation(), navigate = useNavigate();
  const [lang, setLang] = useState<Lang>(() => { try { return localStorage.getItem('lang') === 'en' ? 'en' : 'ar'; } catch { return 'ar'; } });
  const [theme, setTheme] = useState(getSavedTheme);
  const t = { ...STRINGS[lang], ...EXTRA_STRINGS[lang] } as typeof STRINGS.ar & Record<string, string>;
  const labels = t as unknown as Record<string, string>;
  const view: View = (['follow', 'comments', 'posts', 'overview'].includes(location.pathname.split('/')[1] || '') ? location.pathname.split('/')[1] : 'follow') as View;
  const params = new URLSearchParams(location.search);
  const filters: Filters = { q: params.get('q') || '', tone: params.get('tone') || 'all', post: params.get('post') || 'all', cat: params.get('cat') || 'all', range: params.get('range') || 'all', sort: params.get('sort') || 'new' };
  const [items, setItems] = useState<CommentRow[]>(readCachedComments);
  const [syncedAt, setSyncedAt] = useState<number>(() => readJson('cache-time', readJson<{ t?: number }>('cache', {}).t || 0));
  const [loading, setLoading] = useState(false), [refreshing, setRefreshing] = useState(false), [stale, setStale] = useState(false);
  const [handled, setHandled] = useState<Set<string>>(() => new Set(readJson<string[]>('handled-local', readJson('done', []))));
  const [seen, setSeen] = useState<Set<string>>(() => new Set(readJson<string[]>('seen-local', readJson('seen', []))));
  const [manualReplies, setManualReplies] = useState<Set<string>>(() => new Set(readJson<string[]>('manual-replies-local', [])));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [commentDisplayMode, setCommentDisplayMode] = useState<'list' | 'table'>('list');
  const [toasts, setToasts] = useState<Toast[]>([]), [authOpen, setAuthOpen] = useState(false), [authValue, setAuthValue] = useState('');
  const [active, setActive] = useState<CommentRow | null>(null), [replyConfirm, setReplyConfirm] = useState<{ row: CommentRow; text: string } | null>(null), [bulkConfirm, setBulkConfirm] = useState<string[] | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({}), [searchInput, setSearchInput] = useState(filters.q);
  const [newCount, setNewCount] = useState(0);
  const authResolver = useRef<((value: string) => void) | null>(null), authPreviousFocus = useRef<HTMLElement | null>(null), loadingRef = useRef(false), searchRef = useRef<HTMLInputElement>(null);
  const toastId = useRef(0);
  const itemsRef = useRef(items), seenRef = useRef(seen);
  itemsRef.current = items; seenRef.current = seen;
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; document.documentElement.dataset.theme = theme; document.title = t.title; }, [lang, theme, t.title]);
  useEffect(() => { try { localStorage.setItem('lang', lang); } catch {} }, [lang]);
  useEffect(() => { try { localStorage.setItem('handled-local', JSON.stringify([...handled])); } catch {} }, [handled]);
  useEffect(() => { try { localStorage.setItem('seen-local', JSON.stringify([...seen])); } catch {} }, [seen]);
  useEffect(() => { try { localStorage.setItem('manual-replies-local', JSON.stringify([...manualReplies])); } catch {} }, [manualReplies]);
  useEffect(() => { setSearchInput(filters.q); }, [location.pathname, filters.q]);
  useEffect(() => { const legacy: Record<string, View> = { '/all': 'comments', '/follow': 'follow', '/posts': 'posts', '/overview': 'overview' }; const oldView = legacy[location.pathname]; if (oldView) navigate(`/${oldView}${location.search}`, { replace: true }); }, [location.pathname, location.search, navigate]);

  const notify = useCallback((message: string, kind?: Toast['kind'], action?: string, onAction?: () => void) => {
    const id = ++toastId.current; setToasts(previous => [...previous, { id, message, kind, action, onAction }]);
    window.setTimeout(() => setToasts(previous => previous.filter(toast => toast.id !== id)), action ? 6500 : 3600);
  }, []);
  const getKey = useCallback(async () => {
    let existing = ''; try { existing = sessionStorage.getItem('k') || ''; } catch {} if (existing) return existing;
    authPreviousFocus.current = document.activeElement as HTMLElement;
    return new Promise<string>(resolve => { authResolver.current = resolve; setAuthOpen(true); });
  }, []);
  const resolveAuth = useCallback((value: string) => { if (value) { try { sessionStorage.setItem('k', value); } catch {} } const resolve = authResolver.current; authResolver.current = null; setAuthOpen(false); setAuthValue(''); resolve?.(value); window.setTimeout(() => authPreviousFocus.current?.focus(), 0); }, []);
  const toggleTheme = () => setTheme(previous => { const next = previous === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('theme', next); } catch {} return next; });
  const load = useCallback(async (silent = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true; if (itemsRef.current.length === 0) setLoading(true); else if (silent) setRefreshing(true);
    try {
      const key = await getKey(); if (!key) throw new Error(lang === 'ar' ? STRINGS.ar.pin : STRINGS.en.pin);
      const { rows, comments: normalized } = await fetchComments(key);
      const oldIds = new Set(itemsRef.current.map(row => row.id));
      setItems(normalized); setSyncedAt(Date.now()); setStale(false);
      try { localStorage.setItem('cache-data', JSON.stringify(rows)); localStorage.setItem('cache-time', JSON.stringify(Date.now())); } catch {}
      if (!seenRef.current.size) { const initial = new Set(normalized.map(row => row.id)); setSeen(initial); localStorage.setItem('seen-local', JSON.stringify([...initial])); }
      const incoming = oldIds.size ? normalized.filter(row => !oldIds.has(row.id)).length : 0;
      if (incoming && silent) { setNewCount(incoming); notify(`${incoming} ${t.newComments}`, 'success', lang === 'ar' ? 'عرض' : 'Review', () => { navigate('/comments'); setNewCount(0); }); }
    } catch (error) {
      setStale(true);
      if (error instanceof Error && (error.message === STRINGS.en.pin || error.message === STRINGS.ar.pin || (error as Error & { status?: number }).status === 401 || (error as Error & { status?: number }).status === 403)) { try { sessionStorage.removeItem('k'); } catch {} }
      notify(itemsRef.current.length ? t.offline : `${t.fetchError}: ${error instanceof Error ? error.message : ''}`, 'error');
    } finally { loadingRef.current = false; setLoading(false); setRefreshing(false); }
  }, [getKey, lang, navigate, notify, t.fetchError, t.newComments, t.offline]);
  const loadRef = useRef(load); loadRef.current = load;
  useEffect(() => { void loadRef.current(); const timer = window.setInterval(() => { if (!document.hidden) void loadRef.current(true); }, 60_000); const onVisible = () => { if (!document.hidden) void loadRef.current(true); }; document.addEventListener('visibilitychange', onVisible); return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); }; }, []);
  useEffect(() => { const timer = window.setTimeout(() => { if (searchInput !== filters.q) updateFilters({ q: searchInput }); }, 180); return () => window.clearTimeout(timer); }, [searchInput]);

  const updateFilters = useCallback((patch: Partial<Filters>) => {
    const next = { ...filters, ...patch }, query = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => { if (value && value !== 'all' && !(key === 'sort' && value === 'new')) query.set(key, value); });
    navigate({ pathname: '/comments', search: query.toString() ? `?${query}` : '' }, { replace: true });
  }, [filters, navigate]);
  const goComments = useCallback((patch: Partial<Filters> = {}) => {
    const query = new URLSearchParams(); Object.entries({ ...{ q: '', tone: 'all', post: 'all', cat: 'all', range: 'all', sort: 'new' }, ...patch }).forEach(([key, value]) => { if (value && value !== 'all' && !(key === 'sort' && value === 'new')) query.set(key, value); });
    navigate({ pathname: '/comments', search: query.toString() ? `?${query}` : '' });
  }, [navigate]);
  const resetAllFilters = useCallback(() => { setSearchInput(''); goComments(); }, [goComments]);
  const needsFollowup = useCallback((row: CommentRow) => (row.tone === 'negative' || row.tone === 'critical') && !handled.has(row.id), [handled]);
  const allCommentCounts = useMemo(() => ({ all: items.length, positive: items.filter(row => row.tone === 'positive').length, negative: items.filter(row => row.tone === 'negative').length, critical: items.filter(row => row.tone === 'critical').length, auto: items.filter(row => row.auto).length }), [items]);
  const filtered = useMemo(() => {
    const limitMs: Record<string, number> = { '24': 864e5, '7': 6048e5, '30': 2592e6 };
    const query = filters.q.toLowerCase(), limit = limitMs[filters.range];
    const results = items.filter(row => {
      const category = `${row.cat} ${labels[row.cat] || row.cat}`;
      const searchable = `${row.id} ${row.text} ${row.user} ${row.summary} ${row.caption} ${category}`.toLowerCase();
      return (filters.tone === 'all' || (filters.tone === 'auto' ? row.auto : row.tone === filters.tone)) &&
        (filters.post === 'all' || row.post === filters.post) &&
        (filters.cat === 'all' || row.cat === filters.cat) &&
        (!query || searchable.includes(query)) &&
        (!limit || (row.ts && Date.now() - row.ts <= limit));
    });
    return filters.sort === 'old' ? [...results].reverse() : results;
  }, [items, filters.q, filters.tone, filters.post, filters.cat, filters.range, filters.sort, lang]);
  const activeFilterSummary = useMemo(() => {
    const active: { key: string; label: string; value: string }[] = [];
    if (filters.q) active.push({ key: 'q', label: t.searchFilter, value: filters.q });
    if (filters.tone !== 'all') active.push({ key: 'tone', label: t.sentiment, value: filters.tone === 'auto' ? t.autoShort : labels[filters.tone] || filters.tone });
    if (filters.cat !== 'all') active.push({ key: 'cat', label: t.category, value: labels[filters.cat] || filters.cat });
    if (filters.post !== 'all') {
      const caption = items.find(row => row.post === filters.post)?.caption;
      active.push({ key: 'post', label: t.post, value: caption ? `${caption.slice(0, 34)}…` : `${t.post} …${filters.post.slice(-5)}` });
    }
    if (filters.range !== 'all') active.push({ key: 'range', label: t.rangeLabel, value: ({ '24': t.last24, '7': t.last7, '30': t.last30 } as Record<string, string>)[filters.range] || filters.range });
    if (filters.sort !== 'new') active.push({ key: 'sort', label: t.sortLabel, value: t.oldest });
    return active;
  }, [filters.q, filters.tone, filters.cat, filters.post, filters.range, filters.sort, lang, items, t.post]);
  const postIds = useMemo(() => [...new Set(items.map(row => row.post).filter(Boolean))], [items]);
  const categories = useMemo(() => [...new Set(items.map(row => row.cat).filter(Boolean))].sort(), [items]);
  const postLabel = useCallback((id: string) => { const caption = items.find(row => row.post === id)?.caption; return caption ? `${caption.slice(0, 34)}${caption.length > 34 ? '…' : ''}` : `${t.post} …${id.slice(-5)}`; }, [items, t.post]);
  const markSeen = useCallback((id: string) => setSeen(previous => new Set(previous).add(id)), []);
  const changeHandled = useCallback((ids: string[], value: boolean, withUndo = true) => {
    const before = new Map(ids.map(id => [id, handled.has(id)]));
    setHandled(previous => { const next = new Set(previous); ids.forEach(id => value ? next.add(id) : next.delete(id)); return next; });
    setSelected(new Set());
    if (withUndo) notify(value ? `${ids.length} · ${t.handled}` : `${ids.length} · ${t.reopen}`, 'success', t.undo, () => setHandled(previous => { const next = new Set(previous); before.forEach((wasHandled, id) => wasHandled ? next.add(id) : next.delete(id)); return next; }));
  }, [handled, notify, t.handled, t.reopen, t.undo]);
  const activeFocus = useRef<HTMLElement | null>(null);
  const openComment = (row: CommentRow, trigger: HTMLElement) => { activeFocus.current = trigger; markSeen(row.id); setActive(row); };
  const openOverviewComment = (row: CommentRow) => { activeFocus.current = null; markSeen(row.id); setActive(row); };
  const closeComment = () => { setActive(null); window.setTimeout(() => activeFocus.current?.focus(), 0); };
  const sendReply = async () => {
    if (!replyConfirm || sendingReply) return;
    const { row, text } = replyConfirm; setSendingReply(true);
    try {
      const key = await getKey(); if (!key) throw new Error(t.pin);
      await postManualReply(key, { comment_id: row.id, post_id: row.post, username: row.user, reply_text: text });
      setManualReplies(previous => new Set(previous).add(row.id));
      setHandled(previous => new Set(previous).add(row.id));
      setDrafts(previous => ({ ...previous, [row.id]: '' })); markSeen(row.id); setReplyConfirm(null); notify(t.sent, 'success');
    } catch (error) { if (error instanceof Error && ((error as Error & { status?: number }).status === 401 || (error as Error & { status?: number }).status === 403)) { try { sessionStorage.removeItem('k'); } catch {} } setReplyConfirm(null); notify(`${t.sendError}: ${error instanceof Error ? error.message : ''}`, 'error'); setActive(row); }
    finally { setSendingReply(false); }
  };
  useEffect(() => { const handleKeys = (event: KeyboardEvent) => {
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag || '') || Boolean((document.activeElement as HTMLElement | null)?.isContentEditable);
    if (event.key === '/' && !event.altKey && !event.ctrlKey && !event.metaKey && !typing && !active && !authOpen && view !== 'comments') { event.preventDefault(); goComments(); window.setTimeout(() => searchRef.current?.focus(), 50); }
    else if (event.key === '/' && !event.altKey && !event.ctrlKey && !event.metaKey && !typing && !active && !authOpen) { event.preventDefault(); searchRef.current?.focus(); }
    else if (event.key === 'Escape' && tag === 'INPUT' && (document.activeElement as HTMLInputElement).type === 'search') { if (searchInput) { event.preventDefault(); setSearchInput(''); updateFilters({ q: '' }); } }
    else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && tag === 'TEXTAREA') {
      const commentId = (document.activeElement as HTMLTextAreaElement).dataset.commentId;
      const row = items.find(item => item.id === commentId) || (active?.id === commentId ? active : null);
      if (row) { const text = drafts[row.id] ?? row.reply; if (text.trim()) { event.preventDefault(); setReplyConfirm({ row, text: text.trim() }); } }
    }
  }; document.addEventListener('keydown', handleKeys); return () => document.removeEventListener('keydown', handleKeys); }, [active, authOpen, drafts, goComments, items, searchInput, updateFilters, view]);

  const navItems: { id: View; label: string; icon: string }[] = [
    { id: 'overview', label: t.overview, icon: '◫' }, { id: 'comments', label: t.comments, icon: '▤' }, { id: 'follow', label: t.follow, icon: '◉' }, { id: 'posts', label: t.posts, icon: '▦' }
  ];
  const names: Record<string, string> = { positive: t.positive, negative: t.negative, critical: t.critical, neutral: t.neutral, pending: t.pending };
  const renderPanel = (row: CommentRow) => <CommentPanel key={row.id} row={row} labels={labels} names={names} lang={lang} seen={seen} manualReplies={manualReplies} handled={handled} postLabel={postLabel} draft={drafts[row.id] ?? row.reply} onDraft={value => setDrafts(previous => ({ ...previous, [row.id]: value }))} onReply={(target, text) => { if (!text.trim()) { notify(t.emptyReply, 'warning'); return; } setReplyConfirm({ row: target, text: text.trim() }); }} onCopy={text => { void navigator.clipboard.writeText(text).then(() => notify(t.copyDone, 'success')).catch(() => notify(t.copyError, 'error')); }} onHandled={target => changeHandled([target.id], !handled.has(target.id))} />;

  const followList = items.filter(needsFollowup).sort((a, b) => Number(b.tone === 'critical') - Number(a.tone === 'critical'));
  return <div className="layout">
    <a className="skip-link" href="#main-content">{t.skipMain}</a>
    <aside className="sidebar">
      <Link to="/overview" className="brand"><span className="brand-mark">K</span><span><b>kkcaffee</b><small>{t.subtitle}</small></span></Link>
      <nav className="nav" aria-label={t.mainNavigation}>{navItems.map(item => <Link key={item.id} to={`/${item.id}`} className={view === item.id ? 'active' : ''} aria-current={view === item.id ? 'page' : undefined}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span className="nav-label">{item.label}</span>{item.id === 'follow' && followList.length > 0 && <b className="nav-count" aria-label={`${followList.length} ${t.needs}`}>{followList.length}</b>}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="sync-text" role="status" aria-live="polite"><span className={`sync-dot ${stale ? 'offline' : ''}`} aria-hidden="true" />{syncedAt ? `${t.updated} ${new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Amman' }).format(syncedAt)}` : t.loading}</div>{stale && <div className="stale-label">{t.stale}</div>}<button className="button primary full refresh-button" type="button" disabled={refreshing || loading} aria-busy={refreshing || loading} onClick={() => void load()}><span className="refresh-icon" aria-hidden="true">↻</span><span className="button-label">{refreshing ? t.updating : t.refresh}</span></button><div className="settings-row"><button className="button settings-button" type="button" aria-label={`${t.switchTheme}: ${theme === 'dark' ? t.themeLight : t.themeDark}`} aria-pressed={theme === 'dark'} title={t.switchTheme} onClick={toggleTheme}><span aria-hidden="true">◐</span><span className="setting-label">{t.theme}</span></button><button className="button settings-button" type="button" aria-label={t.language} title={`${t.switchLanguage}: ${t.language}`} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}><span aria-hidden="true">文</span><span className="setting-label">{t.language}</span></button></div></div>
    </aside>
    <main className="main-area" id="main-content" tabIndex={-1}>
      <header className="page-header"><div><div className="eyebrow">{t.brandEyebrow}</div><h1 id="page-title">{t[view]}</h1><p>{view === 'overview' ? t.subtitle : `${items.length} ${t.commentCount}`}</p></div><div className="avatar" aria-hidden="true">K</div></header>
      {stale && <div className="inline-alert" role="status" aria-live="polite" aria-atomic="true"><span aria-hidden="true">◌</span>{t.offline}{syncedAt ? ` · ${t.updated} ${formatSyncTime(syncedAt, lang)}` : ''}</div>}
      {newCount > 0 && <button className="new-banner" type="button" aria-live="polite" onClick={() => { navigate('/comments'); setNewCount(0); }}>✦ {newCount} {t.newComments} <span>{t.reviewComments} →</span></button>}
      {loading && items.length === 0 ? <section aria-label={t.loading} aria-busy="true"><div className="skeleton-grid" aria-hidden="true">{[0, 1, 2].map(key => <div key={key} className="skeleton" />)}</div><div className="skeleton wide" aria-hidden="true" /></section> : <>
        {view === 'follow' && (followList.length ? <FollowUpInbox rows={followList} labels={labels} names={names} lang={lang} handled={handled} renderDetails={renderPanel} /> : <section className="section-content"><div className="empty-state"><div className="empty-icon" aria-hidden="true">✓</div><h2>{t.followEmpty}</h2><button className="button primary" type="button" onClick={() => navigate('/comments')}>{t.comments}</button></div></section>)}
        {view === 'comments' && <section className="section-content">
          {activeFilterSummary.length > 0 && <div className="filter-summary" role="group" aria-label={t.activeFilters} aria-live="polite"><span className="filter-summary-title">{t.activeFilters}</span><div className="filter-summary-chips">{activeFilterSummary.map(filter => <span className="filter-summary-chip" key={filter.key}><b>{filter.label}:</b> {filter.value}</span>)}</div><button className="button reset-filters" type="button" onClick={resetAllFilters}>{t.resetAllFilters}</button></div>}
          <div className="filter-panel" role="search"><div className="search-wrap"><span aria-hidden="true">⌕</span><input ref={searchRef} type="search" value={searchInput} placeholder={t.search} onChange={event => setSearchInput(event.target.value)} aria-label={`${t.search} (${t.searchShortcut})`} aria-keyshortcuts="/" />{searchInput && <button className="clear-search" type="button" aria-label={t.clearSearch} onClick={() => { setSearchInput(''); updateFilters({ q: '' }); }}>×</button>}</div><span className="keyboard-hint" aria-hidden="true">{t.searchShortcut}</span><div className="filter-selects"><label><span>{t.rangeLabel}</span><select value={filters.range} onChange={event => updateFilters({ range: event.target.value })}><option value="all">{t.allTime}</option><option value="24">{t.last24}</option><option value="7">{t.last7}</option><option value="30">{t.last30}</option></select></label><label><span>{t.sortLabel}</span><select value={filters.sort} onChange={event => updateFilters({ sort: event.target.value })}><option value="new">{t.newest}</option><option value="old">{t.oldest}</option></select></label><label><span>{t.category}</span><select value={filters.cat} onChange={event => updateFilters({ cat: event.target.value })}><option value="all">{t.allCategories}</option>{categories.map(category => <option key={category} value={category}>{labels[category] || category}</option>)}</select></label></div></div>
          <div className="filter-chips" role="group" aria-label={t.sentiment}>{(['all', 'positive', 'negative', 'critical', 'auto'] as const).map(tone => <button type="button" key={tone} className="filter-chip" aria-pressed={filters.tone === tone} onClick={() => updateFilters({ tone })}>{tone === 'all' ? t.all : tone === 'auto' ? t.autoShort : names[tone]}<span aria-hidden="true">{allCommentCounts[tone]}</span></button>)}</div>
          <div className="post-filters" role="group" aria-label={t.allPosts}><button type="button" className={`post-chip ${filters.post === 'all' ? 'selected' : ''}`} aria-pressed={filters.post === 'all'} onClick={() => updateFilters({ post: 'all' })}>{t.allPosts}</button>{postIds.map(id => <button type="button" key={id} className={`post-chip ${filters.post === id ? 'selected' : ''}`} aria-pressed={filters.post === id} onClick={() => updateFilters({ post: id })}>{postLabel(id)}</button>)}</div>
          <div className="list-toolbar"><label className="select-all"><input type="checkbox" checked={filtered.length > 0 && filtered.every(row => selected.has(row.id))} onChange={event => setSelected(event.target.checked ? new Set([...selected, ...filtered.map(row => row.id)]) : new Set([...selected].filter(id => !filtered.some(row => row.id === id))))} />{t.selectAll}</label><span role="status" aria-live="polite" aria-atomic="true">{filtered.length} {t.commentCount}</span><div className="view-toggle" role="group" aria-label={t.comments}><button type="button" aria-pressed={commentDisplayMode === 'list'} onClick={() => setCommentDisplayMode('list')}><span aria-hidden="true">☷</span>{t.viewList}</button><button type="button" aria-pressed={commentDisplayMode === 'table'} onClick={() => setCommentDisplayMode('table')}><span aria-hidden="true">▦</span>{t.viewTable}</button></div></div>
          {filtered.length ? <CommentList rows={filtered} labels={labels} names={names} lang={lang} manualReplies={manualReplies} handled={handled} postLabel={postLabel} selected={selected} displayMode={commentDisplayMode} renderDetails={renderPanel} onToggle={(row, checked) => setSelected(previous => { const next = new Set(previous); checked ? next.add(row.id) : next.delete(row.id); return next; })} onOpen={openComment} /> : <div className="empty-state"><div className="empty-icon">⌕</div><h2>{t.noResults}</h2><button className="button" onClick={() => { setSearchInput(''); navigate('/comments'); }}>{t.clearFilters}</button></div>}
          {selected.size > 0 && <div className="bulk-bar visible" role="group" aria-label={t.selected} aria-live="polite"><span>{selected.size} {t.selected}</span><button className="button primary" type="button" onClick={() => setBulkConfirm([...selected])}>{t.markSelected}</button><button className="button" type="button" onClick={() => setSelected(new Set())}>{t.clearSelection}</button></div>}
        </section>}
        {view === 'posts' && <PostsView items={items} labels={labels} names={names} needsFollowup={needsFollowup} onOpenPost={postId => goComments({ post: postId })} />}
        {view === 'overview' && <Overview items={items} labels={labels} lang={lang} followCount={followList.length} onTone={tone => goComments({ tone })} onCategory={category => goComments({ cat: category })} onFollowup={() => navigate('/follow')} onComment={openOverviewComment} />}
      </>}
    </main>
    <div className="toast-stack" aria-live="polite" aria-relevant="additions" aria-atomic="false">{toasts.map(toast => <div key={toast.id} className={`toast ${toast.kind || ''}`} role={toast.kind === 'error' ? 'alert' : 'status'} aria-atomic="true"><span>{toast.message}</span>{toast.action && <button type="button" onClick={() => { toast.onAction?.(); setToasts(previous => previous.filter(item => item.id !== toast.id)); }}>{toast.action}</button>}<button type="button" aria-label={t.close} onClick={() => setToasts(previous => previous.filter(item => item.id !== toast.id))}>×</button></div>)}</div>
    {active && <Dialog onClose={closeComment} className="comment-dialog" label={t.commentDetails}><div className="dialog-heading"><div><span className="eyebrow">{t.commentDetails}</span><h2>{t.comments}</h2></div><button className="icon-button" type="button" aria-label={t.close} onClick={closeComment}>×</button></div>{renderPanel(active)}<div className="dialog-bottom"><button className="button" type="button" onClick={closeComment}>{t.close}</button></div></Dialog>}
    {replyConfirm && <Dialog onClose={() => { if (!sendingReply) setReplyConfirm(null); }} className="confirm-dialog" label={t.confirmReply}><div className="dialog-heading"><div><span className="eyebrow">{t.instagram}</span><h2>{t.confirmReply}</h2></div><button className="icon-button" type="button" aria-label={t.close} disabled={sendingReply} onClick={() => setReplyConfirm(null)}>×</button></div><blockquote>{replyConfirm.text}</blockquote><div className="dialog-bottom"><button className="button" type="button" disabled={sendingReply} onClick={() => setReplyConfirm(null)}>{t.cancel}</button><button className="button primary" type="button" disabled={sendingReply} onClick={() => void sendReply()}>{sendingReply ? t.sending : t.confirm}</button></div></Dialog>}
    {bulkConfirm && <Dialog onClose={() => setBulkConfirm(null)} className="confirm-dialog" label={t.markSelected}><div className="dialog-heading"><div><span className="eyebrow">{t.localOnly}</span><h2>{t.markSelected} · {bulkConfirm.length}</h2></div><button className="icon-button" type="button" aria-label={t.close} onClick={() => setBulkConfirm(null)}>×</button></div><p>{t.handled}</p><div className="dialog-bottom"><button className="button" type="button" onClick={() => setBulkConfirm(null)}>{t.cancel}</button><button className="button primary" type="button" onClick={() => { changeHandled(bulkConfirm, true); setBulkConfirm(null); }}>{t.confirm}</button></div></Dialog>}
    {authOpen && <Dialog onClose={() => resolveAuth('')} className="auth-dialog" label={t.secureAccess}><div className="dialog-heading"><div><span className="eyebrow">{t.secureAccess}</span><h2>{t.pin}</h2></div><button className="icon-button" type="button" aria-label={t.close} onClick={() => resolveAuth('')}>×</button></div><p>{t.pinHelp}</p><form onSubmit={event => { event.preventDefault(); if (authValue.trim()) resolveAuth(authValue.trim()); }}><label className="auth-input-label">{t.accessCode}<input autoFocus type="password" autoComplete="current-password" value={authValue} onChange={event => setAuthValue(event.target.value)} /></label><div className="dialog-bottom"><button className="button" type="button" onClick={() => resolveAuth('')}>{t.cancel}</button><button className="button primary" type="submit">{t.login}</button></div></form></Dialog>}
  </div>;
}
