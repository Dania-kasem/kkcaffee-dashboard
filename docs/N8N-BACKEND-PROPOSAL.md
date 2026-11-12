# n8n backend proposal (manual changes only)

This guide is based only on the supplied workflow screenshots and current frontend code. No n8n workflow was accessed or changed. Confirm actual workflow names, sheet IDs, credential header names, and node configuration in n8n before following the steps.

## What the screenshots and frontend establish

- The dashboard currently calls `GET /webhook/comments` with the `X-Dashboard-Key` request header. The screenshot for `Webhook2` shows a `GET` webhook protected by Header Auth, followed by `Get row(s) in sheet`, then `Respond to Webhook2`. The response rows shown in the UI include fields such as `row_number`, `username`, `comment_text`, `comment_id`, `sentiment`, `category`, `summary`, `suggested_reply`, `action_required`, `post_id`, `post_url`, `parent_id`, and `timestamp`.
- Manual replies currently call `POST /webhook/reply-comment` with `X-Dashboard-Key` and JSON `{ "comment_id", "post_id", "username", "reply_text" }`. The screenshot shows `Webhook1` → `HTTP Request2` → `Respond to Webhook1`, protected by Header Auth and with CORS allowing `https://kkcaffee-dashboard.onrender.com`. The response screenshot shows `{ "ok": true, "sent": true }`.
- The larger workflow screenshot shows a webhook comment pipeline and a scheduled pipeline. Both appear to classify comments and write sheet rows. The scheduled path includes a Graph API media/comments fetch, filters, an LLM chain, a reply branch, and an append-or-update sheet node. The screenshot does not expose the workflow names, exact sheet mappings, or whether those writes currently record successful replies.
- `action_required: "auto_reply"` describes a requested action; by itself it does not prove that Instagram accepted a reply. The visible sheet columns do not show a confirmed reply ID/source/time or a shared handled flag.

Before implementation, verify the exact request header accepted by the current Header Auth credential. The source frontend uses `X-Dashboard-Key`; the screenshots do not show the Header Auth credential's configured header name.

---

## Proposal A: shared handled status across devices

### 1. Feature requiring backend support

Persist the dashboard's handled/reopened state in the same data store that supplies `GET /comments`, so all authorized dashboard users see the same state.

### 2. Why the current API is insufficient

The current GET response has no confirmed handled field in the screenshot, and the frontend has no configured persistence endpoint. Browser-only storage cannot synchronize across devices. The React frontend currently labels this state as device-local and does not claim it is globally saved.

### 3. Existing workflow involved

The `GET /comments` workflow appears to be `Webhook2` → `Get row(s) in sheet` → `Respond to Webhook2`. Keep this route and its response contract. The workflow name and exact sheet are not visible in the supplied screenshot.

### 4. Nodes to add or modify

**New nodes/workflow:**

1. Add a new authenticated `POST` Webhook at `/comments/handled` (or another agreed path) with the same Header Auth credential and allowed dashboard origin.
2. Add a Code or Edit Fields node to validate and normalize the request.
3. Add Google Sheets lookup/update operations using the existing comments sheet and `comment_id` as the lookup key. The exact node count depends on whether the installed Google Sheets node can look up and update rows in one operation.
4. Add a Respond to Webhook node that returns an explicit JSON result.

**Existing nodes to modify:** None are required if the existing comments sheet can be updated by the new route and the GET node returns the added fields. If the GET node explicitly selects columns rather than returning all columns, add the new status columns to its output mapping without changing existing fields or names.

**Existing nodes to leave untouched:** Existing comment-ingest workflows, automatic-reply branches, current `POST /reply-comment`, and existing Google Sheets writes. Do not replace or disable them.

### 5. Manual implementation steps

1. Back up the current comments sheet and note its exact worksheet/tab and `comment_id` column.
2. Add columns `handled`, `handled_at`, and `handled_by` (text/boolean, ISO-8601 timestamp, and authenticated user label respectively). If there is no user identity in the current auth setup, omit `handled_by` rather than inventing one.
3. Create the new `POST /comments/handled` webhook using Header Auth. Allow the production dashboard origin `https://kkcaffee-dashboard.onrender.com`; add the development origin only if local development requires it.
4. Validate a non-empty array of string IDs (set a sensible maximum batch size, such as 100) and a boolean `done`. Reject malformed bodies before touching the sheet.
5. For every `comment_id`, find the matching row and update only the handled columns. A `done: true` request writes `handled=true` and an ISO timestamp; `done: false` writes `handled=false` and clears `handled_at`. Do not use a client supplied row number.
6. Return a count and the IDs actually updated. Treat missing IDs as not found; do not report them as updated.
7. Add the new columns to the existing `GET /comments` response while preserving all current fields and the array response format.
8. Test the new route in n8n test mode with the cases below before activating it.

### 6. Request fields and data types

| Field | Type | Requirement |
|---|---|---|
| `ids` | `string[]` | Required, non-empty, unique comment IDs |
| `done` | `boolean` | Required; `true` handles, `false` reopens |

### 7. Request example

```json
{"ids":["18116979971274802","18119503496052108"],"done":true}
```

### 8. Response example

```json
{"ok":true,"updated":2,"not_found":[],"done":true}
```

The GET endpoint would add `handled`, `handled_at`, and optionally `handled_by` to each row. Existing fields and their meanings remain unchanged.

### 9. Error handling

- Return `400` for missing/invalid IDs, non-boolean `done`, or an oversized request.
- Return `401`/`403` for missing or invalid Header Auth credentials.
- Return `404` or a successful response with `not_found` populated for unknown IDs; choose one contract and use it consistently.
- Return `500` for sheet lookup/update failures. Do not return `{ok:true}` unless every reported update succeeded.
- Avoid logging access codes or full comment text.

### 10. Backward compatibility

This is an additive route and additive GET fields. Existing GET consumers can ignore new fields. Existing reply and ingestion workflows remain unchanged. The dashboard should only switch handled state to shared mode after this route is active and tested.

### 11. Test the modified workflow

1. POST one existing ID with `done:true`, then GET `/comments` and confirm the row has `handled:true` and an ISO timestamp.
2. POST the same ID with `done:false` and confirm the row reopens.
3. Submit two IDs and verify the returned `updated` count.
4. Submit an unknown ID, malformed JSON, empty IDs, a string instead of a boolean, and an unauthenticated request. Confirm appropriate failures and no unintended sheet changes.
5. Call the original GET route without new parameters and confirm its prior fields/shape remain available.

### 12. Verify existing automation remains functional

Run the existing incoming-comment and scheduled-comment workflows with their normal test inputs. Confirm they still append/update comment rows with their existing mappings, still post replies where configured, and still deliver the pre-existing GET response fields. Compare a few rows before and after; the new handled route should only write its own status columns.

---

## Proposal B: confirmed automatic and manual reply status

### 1. Feature requiring backend support

Show a trustworthy automatic-reply badge/filter/statistic and distinguish successful dashboard replies from replies merely proposed by the classifier.

### 2. Why the current API is insufficient

The classifier emits `action_required`, and that value is not proof of a successful Graph API reply. The displayed sheet schema does not include a confirmed reply status. The manual reply endpoint response confirms `sent: true` in the screenshot, but the current comments GET rows do not show a persisted reply source or reply ID.

### 3. Existing workflows involved

- `GET /comments`: `Webhook2` → `Get row(s) in sheet` → `Respond to Webhook2`.
- Manual reply route: `Webhook1` (`/reply-comment`) → `HTTP Request2` → `Respond to Webhook1`.
- Automatic reply: the visible main webhook and scheduled workflow each contain an LLM/classification branch, a Graph API reply request, and a Google Sheets append/update node. Their names and exact wiring must be confirmed in n8n.

### 4. Nodes to add or modify

**New nodes:** None are required if existing write nodes can accept added fields and the current Graph API response contains the reply ID.

**Existing nodes to modify after confirming workflow wiring:**

1. In each automatic-reply flow, extend the row mapping after the Graph API reply succeeds to write `reply_status="sent"`, `reply_source="automatic"`, `reply_id`, and `replied_at`.
2. In the manual `/reply-comment` workflow, add a Google Sheets lookup/update after `HTTP Request2` succeeds, keyed by `comment_id`, writing the same fields with `reply_source="manual"`.
3. Add those reply fields to the existing `GET /comments` rows. Preserve all current keys.
4. Optionally add `reply_status="failed"` through a separate error path only if it can be recorded without masking the Graph API error.

**Existing nodes to leave untouched:** LLM prompt/classification logic, current Graph API URL/authentication, existing trigger nodes, and existing response fields. Do not treat `action_required` as reply status. Avoid changing how comments are selected for replies.

### 5. Manual implementation steps

1. Confirm which sheet columns are currently written by the visible append/append-or-update nodes and whether each automatic workflow uses the same comments sheet.
2. Add `reply_status`, `reply_source`, `reply_id`, and `replied_at` columns to that sheet. Keep `action_required` unchanged.
3. In each automatic branch, map these fields only from the successful HTTP Request response. Set source to `automatic`; set status to `sent`; map the Graph response ID; use an ISO-8601 timestamp. Do not write `sent` before the Graph request succeeds.
4. In `/reply-comment`, after `HTTP Request2` returns success, use a Google Sheets lookup/update node keyed by `comment_id` and write the fields with source `manual`. If the comment is not found, retain the successful Instagram send result and report a separate persistence warning/error field rather than falsely claiming the reply failed.
5. Keep the existing response keys `ok` and `sent`; add optional `reply_status`, `reply_source`, `reply_id`, and `replied_at` fields only after confirming downstream callers tolerate additive fields.
6. Include the added columns in `GET /comments` while preserving its existing array/row contract.

### 6. Input fields and data types

The existing manual request remains unchanged: `comment_id`, `post_id`, `username`, and `reply_text` are strings. No new frontend input is needed. Persisted output fields:

| Field | Type | Values |
|---|---|---|
| `reply_status` | string | `sent` (optionally `failed` only when reliably captured) |
| `reply_source` | string | `automatic` or `manual` |
| `reply_id` | string | ID returned by Graph API, when present |
| `replied_at` | string | ISO-8601 timestamp |

### 7. Existing request example (unchanged)

```json
{"comment_id":"18116979971274802","post_id":"17921678985461014","username":"ha_962.02","reply_text":"يسعدنا إنه عجبك ❤️"}
```

### 8. Response example (additive)

```json
{"ok":true,"sent":true,"reply_status":"sent","reply_source":"manual","reply_id":"180834179970720044","replied_at":"2026-11-10T18:25:00.000Z"}
```

For automatic replies, the comments GET row would expose the same fields with `reply_source:"automatic"`. Rows without confirmed fields must remain unconfirmed.

### 9. Error handling

- Preserve the current non-2xx Graph API failure behavior and never write `reply_status="sent"` on failure.
- Validate `comment_id` and non-empty `reply_text` before posting.
- Preserve Header Auth and the existing CORS origin.
- Separate Instagram send failure from sheet persistence failure; avoid returning success as though the row was saved when it was not.
- Do not log reply text, credentials, or access tokens.

### 10. Backward compatibility

The manual request body and current response keys remain intact. New response and GET fields are additive. Existing LLM outputs, triggers, and Graph API calls remain in place. Do not rename or reinterpret `action_required`.

### 11. Test the modified workflow

1. Run a manual reply against a controlled test comment. Confirm the API response remains `ok:true, sent:true` and now includes confirmed status metadata.
2. Verify the comments GET row contains `reply_source:"manual"`, a reply ID, and a parseable timestamp.
3. Run a test automatic positive comment through each automatic reply path. Confirm status is written only after the Graph API node succeeds.
4. Force or simulate a Graph API failure in test mode and confirm no `sent` status is written.
5. Test a successful Instagram reply followed by a sheet-update failure; confirm the result clearly identifies the persistence problem without retrying the Instagram reply automatically.
6. Confirm comments with only `action_required:"auto_reply"` and no reply metadata do not appear in the confirmed auto-reply filter.

### 12. Verify existing automation remains functional

Run the Meta webhook/test event and the scheduled workflow independently. Verify each still receives comments, classifies them, follows its existing filter and limit behavior, posts only its previously eligible replies, and writes all existing sheet fields unchanged. Compare existing columns before and after; only the new reply metadata columns and additive response fields should differ.

---

## Information needed to make the mapping exact

Before editing any node, please share the exact names of the spreadsheet and worksheet, the Header Auth header name, and a sanitized successful `GET /comments` response row that includes all available reply fields. For the automatic branch, also share the Google Sheets node mappings immediately after the Graph API reply request. The screenshots do not reveal those configurations, so this proposal intentionally avoids guessing them.
