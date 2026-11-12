export type Sentiment = 'positive' | 'negative' | 'critical' | 'neutral' | 'pending';
export type ReplySource = 'automatic' | 'manual' | 'unknown';
export type View = 'follow' | 'comments' | 'posts' | 'overview';
export type CommentRow = {
  id: string;
  user: string;
  text: string;
  tone: Sentiment;
  cat: string;
  summary: string;
  reply: string;
  post: string;
  caption: string;
  url: string;
  ts: number;
  replySource: ReplySource;
  auto: boolean;
};

export type ReplyRequest = {
  comment_id: string;
  post_id: string;
  username: string;
  reply_text: string;
};

export type ReplyResult = { ok: true; sent: true };
