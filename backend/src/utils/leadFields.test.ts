import { describe, it, expect } from 'vitest'
import { TEMPLATE_FIELDS } from './leadFields'

describe('TEMPLATE_FIELDS', () => {
  // This literal is duplicated in frontend/src/utils/leadFields.test.ts. There is no shared package
  // between the two projects, so this pair of assertions is what keeps the message-template field
  // list from silently diverging across the wire: changing one side fails the other side's test.
  it('matches the field list the frontend picker offers', () => {
    expect([...TEMPLATE_FIELDS]).toEqual([
      'firstName',
      'lastName',
      'email',
      'phone',
      'linkedinUrl',
      'jobTitle',
      'companyName',
      'yearsAtCompany',
      'countryCode',
    ])
  })

  it('has no duplicate keys', () => {
    expect(new Set(TEMPLATE_FIELDS).size).toBe(TEMPLATE_FIELDS.length)
  })
})
