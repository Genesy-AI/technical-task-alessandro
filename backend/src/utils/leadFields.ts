/**
 * Canonical list of lead fields that can be referenced from a message template as `{fieldName}`.
 *
 * This is the single source of truth for the backend. The frontend mirrors it in
 * `frontend/src/utils/leadFields.ts` (which adds UI metadata: label, group, example). The two lists
 * are kept in sync by a literal assertion in each side's test file — see `leadFields.test.ts`.
 * Adding a field means adding it here, in the frontend registry, and in both tests.
 */
export const TEMPLATE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'linkedinUrl',
  'jobTitle',
  'companyName',
  'yearsAtCompany',
  'countryCode',
] as const

export type TemplateField = (typeof TEMPLATE_FIELDS)[number]
