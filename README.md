# kkcaffee comments dashboard

React + TypeScript dashboard for the existing n8n comment workflows.

## Local development

1. Use Node.js 20.19 or newer.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` only if you need to override the public webhook URLs.
4. Run `npm run dev`.

The Vite `VITE_` values are public browser configuration. Do not put access codes, API tokens, or other secrets in these variables. The dashboard asks for the existing access code in-app and retains it only in `sessionStorage` for the current tab session.

## Production build

Run `npm run build`; the static output is written to `dist/`. For Render Static Sites, use `npm ci` as the build command and `dist` as the publish directory. The application uses hash-based routes, so direct navigation and refresh do not require host rewrite rules.

## Existing n8n integration

- `GET https://dania04.app.n8n.cloud/webhook/comments`, with the existing `X-Dashboard-Key` header.
- `POST https://dania04.app.n8n.cloud/webhook/reply-comment`, with the same header and JSON `{comment_id, post_id, username, reply_text}`.
- No backend workflow or webhook is changed by this project.
- Handled state is stored in this browser only until the proposed shared-status API is implemented.
- Automatic replies count only when the GET row has an explicit `reply_source` of `automatic`/`auto` or the auto-specific `auto_replied` flag. A `reply_id` by itself is never used to identify an automatic reply; `action_required` and generic `already_replied` are not delivery confirmation. The screenshots do not show `reply_source` or `auto_replied`, so the current backend may not support accurate automatic-reply counts.
- Manual replies are treated as sent only when the existing reply endpoint returns JSON `{ "ok": true, "sent": true }`. HTTP 2xx without those confirmations, malformed JSON, and explicit false values are treated as failures. This matches the response shown in the supplied n8n screenshot; the live workflow has not been exercised from this environment.
- GET comments accepts a direct array, `{ "data": [...] }`, or a single comment object. Invalid response structures and failed refreshes do not replace the currently displayed comments.

Run `npm test` for the interaction and API contract checks.

See [the n8n proposal](docs/N8N-BACKEND-PROPOSAL.md) for the missing shared status and confirmed reply capabilities.
