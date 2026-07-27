import { TemplateField } from './leadFields'

export interface Lead {
  firstName: string
  lastName?: string | null
  email?: string | null
  phone?: string | null
  linkedinUrl?: string | null
  jobTitle?: string | null
  companyName?: string | null
  yearsAtCompany?: number | null
  countryCode?: string | null
}

export function generateMessageFromTemplate(template: string, lead: Lead): string {
  let message = template

  const availableFields: Record<TemplateField, string | number | null | undefined> = {
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    linkedinUrl: lead.linkedinUrl,
    jobTitle: lead.jobTitle,
    companyName: lead.companyName,
    yearsAtCompany: lead.yearsAtCompany,
    countryCode: lead.countryCode,
  }

  const templateVariables = template.match(/\{(\w+)\}/g) || []

  for (const variable of templateVariables) {
    const fieldName = variable.slice(1, -1)

    if (fieldName in availableFields) {
      const fieldValue = availableFields[fieldName as TemplateField]

      // Deliberately explicit rather than a truthiness check: yearsAtCompany can legitimately be 0.
      if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
        throw new Error(`Missing required field: ${fieldName}`)
      }

      // A replacer function, not a string: otherwise a value containing `$&` or `$1` would be
      // interpreted as a replacement pattern and corrupt the message.
      message = message.replace(new RegExp(`\\{${fieldName}\\}`, 'g'), () => String(fieldValue))
    } else {
      throw new Error(`Unknown field in template: ${fieldName}`)
    }
  }

  return message
}
