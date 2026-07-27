import Papa from 'papaparse'

export interface CsvLead {
  firstName: string
  lastName: string
  email: string
  phone?: string
  linkedinUrl?: string
  jobTitle?: string
  companyName?: string
  yearsAtCompany?: number
  countryCode?: string
  isValid: boolean
  errors: string[]
  warnings: string[]
  rowIndex: number
}

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// ISO 3166-1 alpha-2. Anything outside this set is dropped instead of being stored as-is,
// otherwise junk from the CSV ("XXX", "12", mojibake) ends up rendered in the Country column.
const ISO_3166_1_ALPHA_2 = new Set(
  `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
   BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
   CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
   DE DJ DK DM DO DZ
   EC EE EG EH ER ES ET
   FI FJ FK FM FO FR
   GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
   HK HM HN HR HT HU
   ID IE IL IM IN IO IQ IR IS IT
   JE JM JO JP
   KE KG KH KI KM KN KP KR KW KY KZ
   LA LB LC LI LK LR LS LT LU LV LY
   MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
   NA NC NE NF NG NI NL NO NP NR NU NZ
   OM
   PA PE PF PG PH PK PL PM PN PR PS PT PW PY
   QA
   RE RO RS RU RW
   SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
   TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
   UA UG UM US UY UZ
   VA VC VE VG VI VN VU
   WF WS
   YE YT
   ZA ZM ZW`.split(/\s+/)
)

// Codes people type that are not ISO but map unambiguously to one.
const COUNTRY_CODE_ALIASES: Record<string, string> = {
  UK: 'GB',
  EL: 'GR',
}

/**
 * Returns the ISO 3166-1 alpha-2 code for `value`, or undefined when the value is
 * empty or not a country code. Never throws: an unrecognized value is not an import error.
 */
export const normalizeCountryCode = (value?: string): string | undefined => {
  const candidate = value?.trim().toUpperCase()
  if (!candidate) return undefined

  const resolved = COUNTRY_CODE_ALIASES[candidate] ?? candidate
  return ISO_3166_1_ALPHA_2.has(resolved) ? resolved : undefined
}

// A profile handle is 3-100 chars of letters, digits and hyphens — enough to tell "ada-lovelace"
// apart from a sentence someone typed into the wrong column.
const LINKEDIN_HANDLE = /^[a-zA-Z0-9-]{3,100}$/

/**
 * Returns a canonical `https://…linkedin.com/…` URL for `value`, or undefined when the value is
 * empty or not recognizable as a LinkedIn profile. Never throws: like normalizeCountryCode, an
 * unrecognized value is a warning, not an import error.
 *
 * Accepts a full URL with or without a scheme, a `in/handle` path, or a bare profile handle.
 */
export const normalizeLinkedinUrl = (value?: string): string | undefined => {
  const candidate = value?.trim()
  if (!candidate) return undefined

  if (candidate.toLowerCase().includes('linkedin.com')) {
    return /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`
  }

  const handle = candidate.replace(/^\/?in\//i, '').replace(/\/$/, '')
  return LINKEDIN_HANDLE.test(handle) ? `https://www.linkedin.com/in/${handle}` : undefined
}

/**
 * Returns the number of years for `value`, or undefined when the value is empty or not a whole
 * number of years. Never throws.
 */
export const parseYearsAtCompany = (value?: string): number | undefined => {
  const candidate = value?.trim()
  if (!candidate) return undefined

  const parsed = Number(candidate)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

export const parseCsv = (content: string): CsvLead[] => {
  if (!content?.trim()) {
    throw new Error('CSV content cannot be empty')
  }

  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
    transformHeader: (header) => header.trim().toLowerCase(),
    quoteChar: '"',
  })

  if (parseResult.errors.length > 0) {
    const criticalErrors = parseResult.errors.filter(
      (error) => error.type === 'Delimiter' || error.type === 'Quotes' || error.type === 'FieldMismatch'
    )
    if (criticalErrors.length > 0) {
      throw new Error(`CSV parsing failed: ${criticalErrors[0].message}`)
    }
  }

  if (!parseResult.data || parseResult.data.length === 0) {
    throw new Error('CSV file appears to be empty or contains no valid data')
  }

  const data: CsvLead[] = []

  parseResult.data.forEach((row, index) => {
    if (Object.values(row).every((value) => !value)) return

    const lead: Partial<CsvLead> = { rowIndex: index + 2 }
    let rawCountryCode = ''
    let rawYearsAtCompany = ''
    let rawLinkedinUrl = ''

    Object.entries(row).forEach(([header, value]) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z]/g, '')
      const trimmedValue = value?.trim() || ''

      switch (normalizedHeader) {
        case 'firstname':
          lead.firstName = trimmedValue
          break
        case 'lastname':
          lead.lastName = trimmedValue
          break
        case 'email':
          lead.email = trimmedValue
          break
        // Several header spellings map to one field: the sample exports use `phoneNumber` and
        // `yearsInRole`, and every provider names these columns differently. Aliasing here keeps
        // the stored field names stable no matter what a customer's export calls them.
        case 'phone':
        case 'phonenumber':
        case 'phonenmbr':
          lead.phone = trimmedValue || undefined
          break
        case 'linkedin':
        case 'linkedinurl':
        case 'linkedinprofile':
          rawLinkedinUrl = trimmedValue
          lead.linkedinUrl = normalizeLinkedinUrl(trimmedValue)
          break
        case 'jobtitle':
          lead.jobTitle = trimmedValue || undefined
          break
        case 'years':
        case 'yearsinrole':
        case 'yearsincompany':
        case 'yearsatcompany':
          rawYearsAtCompany = trimmedValue
          lead.yearsAtCompany = parseYearsAtCompany(trimmedValue)
          break
        case 'countrycode':
          rawCountryCode = trimmedValue
          lead.countryCode = normalizeCountryCode(trimmedValue)
          break
        case 'companyname':
          lead.companyName = trimmedValue || undefined
          break
      }
    })

    const warnings: string[] = []
    if (rawCountryCode && !lead.countryCode) {
      warnings.push(`Unrecognized country code "${rawCountryCode.slice(0, 20)}" was ignored`)
    }
    if (rawYearsAtCompany && lead.yearsAtCompany === undefined) {
      warnings.push(`Unrecognized years at company "${rawYearsAtCompany.slice(0, 20)}" was ignored`)
    }
    if (rawLinkedinUrl && !lead.linkedinUrl) {
      warnings.push(`Unrecognized LinkedIn URL "${rawLinkedinUrl.slice(0, 40)}" was ignored`)
    }

    const errors: string[] = []
    if (!lead.firstName?.trim()) {
      errors.push('First name is required')
    }
    if (!lead.lastName?.trim()) {
      errors.push('Last name is required')
    }
    if (!lead.email?.trim()) {
      errors.push('Email is required')
    } else if (!isValidEmail(lead.email)) {
      errors.push('Invalid email format')
    }

    data.push({
      ...lead,
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email || '',
      isValid: errors.length === 0,
      errors,
      warnings,
    } as CsvLead)
  })

  return data
}
