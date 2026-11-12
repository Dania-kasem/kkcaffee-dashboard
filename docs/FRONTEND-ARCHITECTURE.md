# Frontend audit and architecture

## Existing app before migration

The workspace contained a single RTL HTML file with embedded CSS and JavaScript. It already implemented four views (follow-up, all comments, posts, and overview), Arabic and English labels, dark mode, sentiment/search/post/time filters, a URL hash state, per-comment reply editing, Instagram reply submission, a local handled marker with undo, cached comments, a 60-second refresh, new-comment notices, keyboard shortcuts, and small-screen navigation.

The main reliability and product issues were:

- The monolithic file coupled rendering, API calls, routing, and storage.
- The handled webhook URL was empty, so handled changes were only stored in browser storage even though the UI could be read as a shared workflow state.
- `action_required="auto_reply"` was accepted as proof that a reply had been sent, which can overstate the automation result.
- A reply API success was not persisted as a reply status in the visible comments read contract.
- API endpoints were fixed constants, and filters had limited search coverage and no clear device-local status label.
- Data refresh needed more explicit error/stale feedback and a status-safe loading experience.

## API contracts retained

These contracts come from the existing frontend source and the provided screenshots, not direct access to n8n:

| Operation | Current contract used by the frontend |
|---|---|
| Read comments | `GET /webhook/comments`, header `X-Dashboard-Key`; accepts a direct array, `{ "data": [...] }`, or a single comment object. Rows are validated before replacing application state. A failed or malformed refresh preserves already displayed comments. Visible rows contain `comment_id`, `username`, `comment_text`, `sentiment`, `category`, `summary`, `suggested_reply`, post fields, and `timestamp`. |
| Send a reply | `POST /webhook/reply-comment`, header `X-Dashboard-Key`, JSON `{ "comment_id": string, "post_id": string, "username": string, "reply_text": string }`. The method, URL, header, and payload are unchanged. Based on the supplied response screenshot, success requires JSON `{ "ok": true, "sent": true }`; HTTP 2xx alone is not accepted. |
| Handled state | No endpoint is configured. Existing `DONE_API_URL` was empty and state used browser `localStorage`. The React version keeps it device-local and says so in the UI. |

The frontend has not changed the current request methods, paths, header, or reply body. It allows endpoint URL overrides through public Vite environment variables; those variables must not contain secrets.

### Reply source and delivery limitations

The frontend uses `reply_source` when present (`automatic`/`auto` or `manual`), and recognizes the explicitly auto-specific `auto_replied` signal when no source is supplied. It never infers an automatic reply from `reply_id`, since a manual reply can also have an ID, and it does not treat `action_required` or generic `already_replied` as proof. The supplied GET row/schema screenshots do not show `reply_source` or `auto_replied`; consequently comments without an explicit automatic signal remain unclassified and the automatic-reply count can understate actual automation. The current API evidence also does not show persisted manual reply metadata on GET rows.

Manual reply submission validates the screenshot's `ok` and `sent` response flags and reports an error if either is absent/false. This validates the workflow's response claim, not delivery independently at Instagram. Live delivery and the actual response body have not been tested against the hosted n8n instance.

## Workflow interpretation from screenshots

- `Webhook2` is shown as the authenticated GET `comments` endpoint. Its visible path is `Get row(s) in sheet` then `Respond to Webhook2`.
- `Webhook1` is shown as authenticated POST `reply-comment`; it calls Graph API via `HTTP Request2` and returns `{ok:true,sent:true}`.
- The larger canvas shows a webhook-driven comment path with a comment fetch, LLM classification, branching, a manager/Telegram branch for strong problems, an auto-reply branch, and a sheet append.
- A separate scheduled path fetches media and comments, filters/limits them, classifies them, routes replies, and writes rows using an append-or-update node.
- The screenshots do not establish exact workflow names, credentials, full field mappings, or whether every write is connected to the dashboard. Those details remain unverified.

## Chosen architecture

- Vite builds a static React + TypeScript app.
- React components and hooks own rendering and UI state; React Router hash routes preserve direct links and query filters on static hosting without adding rewrite configuration.
- Local hooks handle comments, dialogs, drafts, toasts, filters, cache, and selection. No global state library was added because the app has one dashboard shell and one comments dataset.
- CSS is isolated in `src/styles.css`; there is no component or icon package.
- `src/App.tsx` maps the existing normalized row fields and owns the integration boundary. `src/main.tsx` starts React.
- `docs/N8N-BACKEND-PROPOSAL.md` separates requested backend changes from the frontend implementation.
