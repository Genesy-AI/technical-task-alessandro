/**
 * The lead fields that can be referenced from a message template as `{fieldName}`, grouped by the
 * area of the lead they describe.
 *
 * This registry is the single source of truth for the message composer: the picker, its search, and
 * the live preview are all derived from it, so adding a field is one entry here rather than an edit
 * in each of them. The key list is mirrored by `backend/src/utils/leadFields.ts`; the literal
 * assertions in the two `leadFields.test.ts` files fail if the sides ever drift apart.
 */
export type LeadFieldGroup = 'Contact' | 'Company' | 'Location'

export interface LeadFieldDefinition {
  /** Token name, e.g. `firstName` for `{firstName}`. Must match the backend field name. */
  key: string
  label: string
  group: LeadFieldGroup
  /** Stand-in used by the preview when the previewed lead has no value for this field. */
  example: string
}

export const LEAD_FIELD_GROUPS: LeadFieldGroup[] = ['Contact', 'Company', 'Location']

export const LEAD_FIELDS: LeadFieldDefinition[] = [
  { key: 'firstName', label: 'First name', group: 'Contact', example: 'Ada' },
  { key: 'lastName', label: 'Last name', group: 'Contact', example: 'Lovelace' },
  { key: 'email', label: 'Email', group: 'Contact', example: 'ada@example.com' },
  { key: 'phone', label: 'Phone', group: 'Contact', example: '+1-555-0100' },
  {
    key: 'linkedinUrl',
    label: 'LinkedIn URL',
    group: 'Contact',
    example: 'https://www.linkedin.com/in/ada-lovelace',
  },
  { key: 'jobTitle', label: 'Job title', group: 'Company', example: 'CTO' },
  { key: 'companyName', label: 'Company', group: 'Company', example: 'Analytical Engines Ltd' },
  { key: 'yearsAtCompany', label: 'Years at company', group: 'Company', example: '5' },
  { key: 'countryCode', label: 'Country', group: 'Location', example: 'GB' },
]

const LEAD_FIELDS_BY_KEY = new Map(LEAD_FIELDS.map((field) => [field.key, field]))

/** Fields whose key or label contains `query`. An empty query matches everything. */
export const searchLeadFields = (query: string): LeadFieldDefinition[] => {
  const candidate = query.trim().toLowerCase()
  if (!candidate) return LEAD_FIELDS

  return LEAD_FIELDS.filter(
    (field) => field.key.toLowerCase().includes(candidate) || field.label.toLowerCase().includes(candidate)
  )
}

/**
 * Any object that may carry lead field values — in practice a lead straight from the API. Values
 * are untyped because only the registry keys are ever read, and the caller should not have to
 * narrow a whole lead (`emailVerified`, `id`, …) to hand one over.
 */
export type LeadFieldValues = Record<string, unknown>

export interface TemplatePreview {
  text: string
  /** Tokens that are not lead fields. The backend rejects the whole template for these. */
  unknownFields: string[]
  /** Known fields the previewed lead has no value for. Those leads are skipped with an error. */
  missingFields: string[]
}

// Deliberately identical to the backend's template regex in utils/messageGenerator.ts, so what the
// preview substitutes is exactly what the server will substitute.
const TEMPLATE_TOKEN = /\{(\w+)\}/g

/**
 * Renders `template` against `lead`, falling back to each field's example where the lead has no
 * value, and reports the problems that would make the backend refuse a lead. Never throws — this
 * runs on every keystroke.
 */
export const previewTemplate = (template: string, lead?: LeadFieldValues): TemplatePreview => {
  const unknownFields = new Set<string>()
  const missingFields = new Set<string>()
  let text = template

  for (const token of template.match(TEMPLATE_TOKEN) || []) {
    const key = token.slice(1, -1)
    const field = LEAD_FIELDS_BY_KEY.get(key)

    if (!field) {
      unknownFields.add(key)
      continue
    }

    const value = lead?.[key]
    const isMissing = value === null || value === undefined || value === ''
    if (isMissing) missingFields.add(key)

    const replacement = isMissing ? field.example : String(value)
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), () => replacement)
  }

  return {
    text,
    unknownFields: [...unknownFields],
    missingFields: [...missingFields],
  }
}
