# Improvements

Notes on things that work today but would not scale well, with the options considered and a
recommendation for each.

## Country codes are a hardcoded list in the frontend

`frontend/src/utils/csvParser.ts` validates the CSV `countryCode` column against a literal set of
ISO 3166-1 alpha-2 codes, plus a small alias map for codes people type that are not ISO:

```ts
const ISO_3166_1_ALPHA_2 = new Set(`AD AE AF AG ... ZA ZM ZW`.split(/\s+/))

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  UK: 'GB',
  EL: 'GR',
}
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

### Options

**1. Reference table in the database (recommended).** Add a `country` table (`code`, `name`,
`alpha3`, `dialCode`, `region`, `deprecated`, `replacedBy`) seeded by a Prisma migration, expose it
as `GET /countries`, and have the frontend fetch it once and cache it (React Query with a long
`staleTime`, since the data changes a few times per decade). The backend validates against the same
table on write, so the rule is enforced at the boundary that matters instead of only in the UI.
Aliases (`UK` → `GB`, `EL` → `GR`) become rows rather than a hand-maintained object, which also
makes them reviewable by non-engineers. Costs: one migration, one endpoint, a seed script, and a
loading state on the import screen — a fetch failure must degrade gracefully (accept the value and
warn) rather than block the import.

**2. A maintained npm package** such as `i18n-iso-countries` or `world-countries`. Cheapest change:
swap the literal set for a package lookup and get names, alpha-3 and translations for free. Updates
still require a dependency bump and a deploy, and the data is still frontend-only unless the backend
imports the same package — but it removes the hand-maintained list and is a strictly better version
of what exists today.

**3. `Intl.DisplayNames`,** already in the browser and in Node, no dependency at all:
`new Intl.DisplayNames(['en'], { type: 'region' }).of('XX')` returns `'XX'` for an unknown code and a
country name for a known one, so "did it resolve?" doubles as validation. Attractive for the
zero-dependency story, but the exact set is ICU-version dependent, so the same CSV can validate
differently across browsers and Node versions — bad for a rule that decides what gets imported.

**4. A third-party API** (REST Countries, GeoNames). Always current and rich, but it puts a network
call from an external provider on the critical path of a CSV import, which then needs caching, a
timeout, and a fallback — at which point you have effectively built option 1 with an extra failure
mode. Worth it only if the product needs data the reference table cannot hold (live currency rates,
population, geography).

### Recommendation

Ship option 1: a seeded `country` table, served by the API, cached in the frontend, and enforced by
the backend on write. Fetch the list once at import time and fall back to accepting the value with a
warning if the request fails, so the import keeps working when the API does not. If the roadmap is
tight, option 2 is a low-effort intermediate step that leaves the door open for option 1, since both
end up behind the same `normalizeCountryCode()` boundary that the parser already calls.

## "Verify emails" reports success regardless of the outcome

Verifying a single lead whose address turns out to be invalid shows a green **"Verified 1 email"**
toast, while the row next to it renders a red ❌. The toast and the table disagree about what just
happened.

The endpoint distinguishes four outcomes, and the UI collapses them into one:

| Outcome        | Where it lands in the response          | What the user is told |
| -------------- | --------------------------------------- | --------------------- |
| Confirmed      | `results[]` with `emailVerified: true`   | "Verified N emails" ✅ |
| Rejected       | `results[]` with `emailVerified: false`  | "Verified N emails" ✅ |
| Failed         | `errors[]` with a message                | nothing at all        |
| Already done   | `skipped[]`                              | "skipped N already verified" |

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

### Options

**1. Derive the counts from the arrays and match toast severity to the outcome (recommended).** The
response already carries everything needed — `results[]` has `emailVerified` per lead and `errors[]`
has `leadId`, `leadName` and `error` — so this is a frontend change plus retiring the misleading
field. Split into `confirmedCount` / `rejectedCount` / `failedCount`, then pick the toast by
severity: `toast.success` when everything was confirmed, `toast.error` when everything failed, and
`toast` (neutral) for the mixed case, e.g. _"2 verified, 1 invalid, 1 failed"_. Failures name the
lead, since "1 failed" without a name is not actionable: _"Could not verify John Doe: workflow
timed out"_. `verifiedCount` should either be dropped or renamed `processedCount`, because leaving a
field whose name contradicts its value is how this bug survived in the first place.

**2. One toast per lead.** Precise and trivially attributable, but a bulk action over a 50-lead
selection produces 50 toasts. Reasonable only if bulk verification is capped at a handful of leads,
which it is not.

**3. Move the detail into the table, keep the toast as a summary.** Add a verification status column
carrying the failure reason (tooltip or expandable cell) so the outcome lives next to the lead it
belongs to and survives the toast being dismissed. Strictly better as a permanent record, and it
composes with option 1 rather than competing with it — the toast says what happened, the row says
why. Costs a schema field (`emailVerificationError`, or a small `verificationAttempt` table if the
history matters) since the reason currently exists only in the HTTP response.

**4. A job/results panel.** Treat a bulk verify as a job with a persisted result set the user can
reopen. The right end state once enrichment grows beyond email verification (phone, gender), but far
more than this bug needs today.

### Recommendation

Ship option 1 — it is contained, needs no schema change, and removes the direct contradiction between
the toast and the table. Fix the naming at the same time: `verifiedCount` meaning "processed" is the
root cause, not the copy. Follow with option 3 when the verification status column is worth a
migration, since a toast is a poor home for an error the user will want to act on after it fades.
