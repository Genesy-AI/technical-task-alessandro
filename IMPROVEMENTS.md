# Improvements

Notes on things that work today but would not scale well, each with the fix worth making.

## Country codes are a hardcoded list in the frontend

`frontend/src/utils/csvParser.ts` validates the CSV `countryCode` column against a literal set of
ISO 3166-1 alpha-2 codes, plus a small alias map for codes people type that are not ISO:

```ts
const ISO_3166_1_ALPHA_2 = new Set(`AD AE AF AG ... ZA ZM ZW`.split(/\s+/));

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  UK: "GB",
  EL: "GR",
};
```

This fixed the import bug (junk values such as `XXX`, `12` and empty strings no longer reach the
Country column) and it is fast and dependency-free, but it has real drawbacks:

- **It goes stale.** ISO 3166-1 changes — codes get added, withdrawn, or transitionally reserved
  (`AN` was removed in 2010, `SS` added in 2011, `XK` for Kosovo is still user-assigned). Keeping
  the list correct means a code change and a frontend deploy.
- **It lives on one side of the wire.** The backend (`POST /leads/bulk`) accepts and stores any
  string, so the guarantee only holds for leads created through the CSV import UI. Another client,
  a future integration, or a manual API call can still write junk.
- **It only answers one question.** The set can say whether a code exists, but not what the country
  is called, which region it belongs to, its dial code, or its flag — all of which the product will
  want as soon as the leads table gains filtering, grouping, or phone enrichment.
- **It is duplicated by construction.** Any other place that needs to validate or display a country
  (message composition, phone enrichment, reporting) has to import from this module or re-declare
  its own copy.

### Fix

Move the list into the database as a `country` reference table (`code`, `name`, `alpha3`,
`dialCode`, `region`, `deprecated`, `replacedBy`), seeded by a Prisma migration and exposed as
`GET /countries`. The backend validates against it on write, so the rule is enforced at the boundary
that matters instead of only in the UI; the frontend fetches it once and caches it with a long React
Query `staleTime`, since the data changes a few times per decade. Aliases (`UK` → `GB`, `EL` → `GR`)
become rows rather than a hand-maintained object, which also makes them reviewable by non-engineers.

A fetch failure must degrade gracefully — accept the value and warn — rather than block the import.
Everything stays behind the `normalizeCountryCode()` boundary the parser already calls, so this is a
change of data source, not of shape.

## "Verify emails" reports success regardless of the outcome

Verifying a single lead whose address turns out to be invalid shows a green **"Verified 1 email"**
toast, while the row next to it renders a red ❌. The toast and the table disagree about what just
happened.

The endpoint distinguishes four outcomes, and the UI collapses them into one:

| Outcome      | Where it lands in the response          | What the user is told        |
| ------------ | --------------------------------------- | ---------------------------- |
| Confirmed    | `results[]` with `emailVerified: true`  | "Verified N emails" ✅       |
| Rejected     | `results[]` with `emailVerified: false` | "Verified N emails" ✅       |
| Failed       | `errors[]` with a message               | nothing at all               |
| Already done | `skipped[]`                             | "skipped N already verified" |

Two separate problems:

- **`verifiedCount` counts leads processed, not addresses confirmed.** It is incremented once per
  workflow that returns, whatever it returns (`backend/src/index.ts`), so a batch of entirely invalid
  emails still reports "Verified 5 emails". `formatVerificationSummary()` in
  `frontend/src/utils/leadVerification.ts` faithfully renders a number that does not mean what its
  name says.
- **`errors[]` is never read.** The backend populates it per lead — workflow timeout, activity
  failure, database write failure — and the frontend drops it on the floor. The mutation's `onError`
  handler does not cover this: per-lead failures still return `200`, so a lead that failed to verify
  is indistinguishable from one that was never selected. `emailVerified` stays `null`, the row keeps
  showing ❓, and nothing explains why.

### Fix

Derive the counts from the arrays the response already carries, and match the toast severity to the
outcome. Split `verifiedCount` into `confirmedCount` / `rejectedCount` / `failedCount`, then pick
`toast.success` when everything was confirmed, `toast.error` when everything failed, and a neutral
`toast` for the mixed case: _"2 verified, 1 invalid, 1 failed"_. Name the lead in failures, since
"1 failed" is not actionable: _"Could not verify John Doe: workflow timed out"_. Drop or rename
`verifiedCount` — a field whose name contradicts its value is how this bug survived in the first
place.

Once a verification status column is worth a migration, move the failure reason into the row
(`emailVerificationError`, or a `verificationAttempt` table if the history matters). The toast says
what happened, the row says why and survives being dismissed.

## The frontend and backend disagree about two endpoints

`api.leads.create` and `api.leads.update` cannot succeed as written. Neither is called from a
component today, so nothing surfaces it — but the optimistic-update machinery in
`frontend/src/api/mutations/useApiMutation.ts` is built around `create`, so the first screen that
uses it inherits a broken call.

- **Method mismatch.** `frontend/src/api/modules/leads.ts:18` declares `update` as `put`, and the
  backend only registers `app.patch('/leads/:id')` (`backend/src/index.ts:72`). Express answers 404.
- **Field-name mismatch.** `LeadsCreateInput` sends `{ firstName, lastName, email }`, while
  `POST /leads` destructures `req.body.name` (`backend/src/index.ts:37`) and returns 400 when it is
  missing. `PATCH /leads/:id` has the same disagreement.
- **`PATCH` writes the string `"undefined"`.** `backend/src/index.ts:80-82` calls `String(name)` and
  `String(email)` unconditionally, so a partial update stringifies the missing field instead of
  leaving it alone. There is no `try`/`catch` either, so an unknown id becomes a 500 rather than a 404.

### Fix

Repair the three call sites now and cover both endpoints with supertest: rename the fields, change
`put` to `patch`, and have `PATCH` build its `data` object from the keys actually present.

Then remove the class of bug rather than this instance of it. Define each endpoint's input and output
once — zod schemas in a shared package — and derive both the Express handler's validation and the
typed client from them, so a method or field rename breaks the build instead of returning 404 at
runtime. That also retires `frontend/src/api/types/leads/*`, hand-written mirrors of the Prisma model
that have already drifted once (`emailVerified` was missing from `getMany` until this branch added
it). Worth doing before a second client — a mobile app, an integration, a partner — exists, because
at that point hand-synced types stop being a nuisance and start being an outage.

## Bulk import does not survive a large file

The import path works for the sample CSVs and breaks in several independent ways as files grow.

- **The dedupe query scales with the file.** `backend/src/index.ts:219` builds one `AND` clause per
  valid row inside a single `OR`, so a 5,000-row CSV produces a 5,000-branch query — past SQLite's
  parameter limit, and a sequential scan on any engine, since nothing is indexed.
- **Dedupe is case-sensitive on one side only.** The query matches `firstName`/`lastName` exactly
  (`index.ts:219`) while the comparison set lowercases both (`index.ts:225-231`), so `john doe` in
  the database and `John Doe` in the CSV take different paths through the same check.
- **Duplicates inside one file are not collapsed.** Only pre-existing rows are filtered out, so the
  same person listed twice in one upload is inserted twice.
- **Inserts are a loop of individual `create` calls with no transaction** (`index.ts:237-249`), so a
  failure halfway leaves a partially imported file and no way to tell how far it got.
- **The request body is capped at 100 KB.** `express.json()` (`index.ts:10`) uses its default limit,
  so a moderately large CSV is rejected with a bare 413 before any of the above matters.
- **The frontend never checks file size.** `MAX_UPLOAD_FILE_SIZE` exists in
  `frontend/src/api/utils.ts:4` and is referenced nowhere. `FileReader.readAsText` loads the whole
  file into memory and `Papa.parse` runs synchronously on the main thread, so the UI freezes for the
  duration.

### Fix

Chunk the import end to end. Parse with Papa's streaming/worker mode so the UI stays responsive and
rows arrive incrementally, then post in batches of ~500 with a progress bar and a cancel button.
Server side: dedupe by an indexed key (`email`, or a normalized `firstName_lastName`) in one `IN`
query per batch, insert with `createMany` inside a transaction, and return per-batch counts. Enforce
a row cap and an explicit `express.json({ limit })`, so the failure mode is a message rather than a 413.

The chunk boundary is where the row cap, the progress bar, the cancel button and the transaction all
want to live anyway, and every failure above disappears at the same time. Add the `email` index in
the same migration — the dedupe query is why the endpoint is slow, not the inserts.

## Verification blocks the request and runs one lead at a time

`POST /leads/verify-emails` awaits each workflow in sequence inside the HTTP handler
(`backend/src/index.ts:324-349`). With the per-attempt timeout at 25s, twenty selected leads can hold
a request open for minutes — longer than a typical proxy read timeout, and with no partial result if
the client gives up. Two smaller problems sit alongside it:

- **`Date.now()` in the workflow id** (`index.ts:328`) defeats Temporal's deduplication: a user who
  clicks twice, or a client that retries, starts a second run against the same lead and pays the
  provider twice.
- **The worker shares the API process** (`index.ts:372`). A worker crash takes the HTTP server with
  it, the two cannot be scaled or deployed independently, and neither shuts down gracefully on
  `SIGTERM`.

### Fix

Make the endpoint asynchronous and batch-shaped: start a single `verifyLeadsWorkflow(leadIds)` and
return `202` with a workflow id. The workflow fans out over leads with bounded concurrency and writes
each result as it lands, so rows update progressively instead of after one long wait, and a dropped
connection costs nothing. Give it a deterministic workflow id (`verify-leads-<hash>`) with an
explicit `WorkflowIdReusePolicy`, so a double click joins the run in flight rather than starting a
second one.

Split the worker into its own entrypoint (`src/worker/main.ts`) with its own `pnpm dev:worker` script
and graceful shutdown on both sides. Independent of the endpoint change, and the smaller of the two.

## Data model and environment

- **`prisma/dev.db` is committed.** A binary in git conflicts on every branch that touches it and
  drifts from the migration history. Gitignore it and add a seed script (`prisma/seed.ts`) so a fresh
  clone gets data from `pnpm migrate:dev && pnpm seed`.
- **`backend/.env.sample` advertises a MySQL `DATABASE_URL` that nothing reads** — `schema.prisma:6`
  hardcodes `file:./dev.db`. Move the URL into the env var, keeping SQLite as the default value; a
  sample that does not work is worse than none.
- **No indexes and no unique constraint.** Make `email` unique — the API happily creates duplicates
  that only the CSV path filters — and index the key the dedupe lookup matches on.
- **`lastName` is `String` (non-null) in the schema** but `LeadsGetManyOutput` types it
  `string | null` and the CSV parser treats it as optional. The type should follow the column.
- **`emailVerified Boolean?` carries no timestamp, provider, or reason,** so a verification from six
  months ago is indistinguishable from one from this morning, and a failure cannot be explained in
  the UI. Add the timestamp and reason alongside the verification status column above.

## Validation and API hygiene

No endpoint validates its input. `leadIds.map((id) => Number(id))` turns `"abc"` into `NaN` and lets
Prisma raise it as a 500; `String(name)` accepts an object and stores `[object Object]`. The
`optionalString`/`optionalInt` helpers added on this branch are a local patch for one endpoint — a
zod schema per route, shared with the generated client (see the contract section), replaces all of
them and produces 400s with useful messages instead of 500s.

Add, in this order: an Express error-handling middleware (every handler currently does its own
`try`/`catch` and `console.error`), structured logging with a request id, a real CORS origin instead
of `*`, rate limiting on the bulk endpoints, and `helmet`. None of these matter for a local demo; all
of them are table stakes the moment it is deployed anywhere.

## Frontend state and rendering

- **Selection is never reconciled with the data.** `selectedLeads` (`LeadsList.tsx:101`) holds ids,
  and nothing prunes them when a refetch removes a lead, so a stale id can be sent with the next bulk
  action. Intersect the selection with the current rows on every render, and fix `isAllSelected`
  (`LeadsList.tsx:173`), which is `true` for an empty list because `0 === 0`.
- **The table renders every row.** No pagination on `GET /leads`, no virtualization, no sort, no
  filter, no search. Paginate server-side rather than windowing on the client, since the query
  already returns the entire table over the wire.
- **Modals have no focus management.** `CsvImportModal` and `MessageTemplateModal` render through a
  portal and handle Escape, but neither traps focus nor sets `role="dialog"`/`aria-modal`, so a
  keyboard user tabs straight out of the dialog into the page behind it.

## The message is the one column you cannot read

The Message cell is `max-w-xs truncate` with a `title` tooltip (`LeadsList.tsx`), so a generated
message shows about its first six words. A tooltip is not a reading surface: it needs a hover, it
vanishes on move, its text cannot be selected or copied, and touch users never see it at all. The
message is the artifact the whole enrichment flow exists to produce, and it is the only column whose
value cannot actually be read.

### Fix

Keep a one-line preview in the cell and add a **View** button that opens the message in a modal:
full text with `whitespace-pre-wrap`, the lead's name in the header, a copy button, and previous/next
controls to walk through the selection without closing. Rows with no message show a subdued "No
message yet" with the generate action inline, instead of the same `-` used for every other empty
field — an ungenerated message is a prompt to act, not a blank.

## The generate modal hides the messages it is about to overwrite

Enrich → Generate Messages always opens on an empty textarea, whatever is selected. If the selected
leads already have messages, nothing says so, and submitting replaces every one of them with no
warning, no view of what is being replaced, and no undo.

### Fix

Read the selected leads' messages when the modal opens — they are already in the
`['leads', 'getMany']` cache, so this costs no request — and show the current state above the
template field:

- **All selected leads share the same message:** show it as the current message and prefill the
  editor with it, so the user edits what exists instead of retyping it.
- **They differ:** one row saying _"Selected leads have 3 different messages"_, expandable to the
  per-lead list, and no prefill — silently picking one lead's message would be a guess.
- **Some have none:** _"4 of 7 selected leads have no message yet"_, so the split is visible before
  the destructive action rather than after it.

Then make the overwrite explicit: when any selected lead already has a message, the submit button
reads _"Replace 5 messages"_ and the line above it says so. Storing the template that produced a
message (a `messageTemplate` column) makes the prefill exact rather than reconstructed, and makes
"regenerate with the same template" possible — worth adding when the modal starts prefilling.

## Other UI gaps

- **Bulk delete has no confirmation.** `handleDeleteSelected` (`LeadsList.tsx`) fires the mutation
  straight from the button; a mis-click on a 200-lead selection is unrecoverable. Add a confirm
  dialog naming the count, or an undo window on the toast (the delete is soft for a few seconds
  before it is sent).
- **"Guess Gender" is a dead action that looks live.** It sits in the Enrich menu and always answers
  with `toast.error('Gender guessing feature is not yet implemented')`. Disable it with a "Coming
  soon" tooltip, or remove it until it does something.
- **The error state reloads the page.** `window.location.reload()` throws away the selection and
  every other piece of app state to recover from one failed query; `leads.refetch()` does the same
  job in place.
- **The Enrich dropdown is a div, not a menu.** It does not close on outside click or Escape, has no
  `role="menu"`/`aria-expanded`, and cannot be driven with arrow keys. A headless menu primitive
  (Radix, Headless UI) fixes behaviour and semantics together.
- **The table has twelve columns and no way to manage them.** No sort, no filter, no search, no
  column visibility, and the Name column scrolls out of view horizontally because nothing is sticky.
  Pin the checkbox and Name columns, and make sorting server-side alongside the pagination noted
  above.
- **No per-row actions.** Everything is a bulk action gated on a checkbox, so viewing, editing, or
  deleting one lead means selecting it first. A row-level menu (view, edit, delete) is the shortest
  path for the single-lead case.
- **Verification gives no per-row feedback.** During a run only the menu item says "Verifying...";
  the rows keep their ❓ until every workflow has finished. Mark the leads in flight so progress is
  visible where the result will land — which is also what the batched, progressive verification
  above is designed to deliver.
- **The template preview only ever renders the first selected lead** (`previewLead` in
  `LeadsList.tsx`). With a mixed selection, the lead most likely to be missing a field is the one you
  cannot preview. Let the user step through the selection in the preview header.
- **Invalid CSV rows are a dead end.** The import preview marks a row invalid and explains why, then
  offers nothing to do about it: no inline fix, no "download the rejected rows" to correct and
  re-upload. Duplicates are counted in the summary but not flagged on the rows they affect.

## Nothing enforces the tests

There is no `.github/` directory, so the suites on both sides run only when someone remembers. Add a
single workflow — install, lint, typecheck, test, build, for backend and frontend.

Two gaps in what the tests cover, once there is somewhere to run them:

- **No HTTP-level tests.** The utils are well covered, the endpoints are not tested at all — which is
  exactly where the contract mismatches and the missing validation above live. Use `supertest`
  against the Express app, with a temp SQLite file per run.
- **No end-to-end test.** The flow that matters (import a CSV → verify emails → generate messages)
  crosses both apps and Temporal, and nothing exercises it. One Playwright spec over that path would
  have caught the two bugs fixed on this branch.
