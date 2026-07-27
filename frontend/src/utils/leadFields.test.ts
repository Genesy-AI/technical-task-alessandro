import { describe, it, expect } from 'vitest'
import { LEAD_FIELDS, LEAD_FIELD_GROUPS, previewTemplate, searchLeadFields } from './leadFields'

describe('LEAD_FIELDS', () => {
  // This literal is duplicated in backend/src/utils/leadFields.test.ts. There is no shared package
  // between the two projects, so this pair of assertions is what keeps the message-template field
  // list from silently diverging across the wire: changing one side fails the other side's test.
  it('matches the field list the backend can interpolate', () => {
    expect(LEAD_FIELDS.map((field) => field.key)).toEqual([
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
    expect(new Set(LEAD_FIELDS.map((field) => field.key)).size).toBe(LEAD_FIELDS.length)
  })

  it('puts every field in a known group', () => {
    LEAD_FIELDS.forEach((field) => {
      expect(LEAD_FIELD_GROUPS).toContain(field.group)
    })
  })

  it('gives every field a label and an example', () => {
    LEAD_FIELDS.forEach((field) => {
      expect(field.label.length).toBeGreaterThan(0)
      expect(field.example.length).toBeGreaterThan(0)
    })
  })
})

describe('searchLeadFields', () => {
  it('returns every field for an empty query', () => {
    expect(searchLeadFields('')).toHaveLength(LEAD_FIELDS.length)
    expect(searchLeadFields('   ')).toHaveLength(LEAD_FIELDS.length)
  })

  it('matches on the field key', () => {
    expect(searchLeadFields('linkedin').map((field) => field.key)).toEqual(['linkedinUrl'])
  })

  it('matches on the human label, not just the key', () => {
    expect(searchLeadFields('years at').map((field) => field.key)).toEqual(['yearsAtCompany'])
  })

  it('ignores case', () => {
    expect(searchLeadFields('COMPANY').map((field) => field.key)).toEqual(['companyName', 'yearsAtCompany'])
  })

  it('returns nothing when there is no match', () => {
    expect(searchLeadFields('salary')).toEqual([])
  })
})

describe('previewTemplate', () => {
  const lead = {
    firstName: 'John',
    lastName: 'Doe',
    companyName: 'Tech Corp',
    yearsAtCompany: 5,
    phone: null,
  }

  it('substitutes the values the lead has', () => {
    const result = previewTemplate('Hi {firstName}, {yearsAtCompany} years at {companyName}?', lead)

    expect(result.text).toBe('Hi John, 5 years at Tech Corp?')
    expect(result.missingFields).toEqual([])
    expect(result.unknownFields).toEqual([])
  })

  it('falls back to the field example and reports the field as missing', () => {
    const result = previewTemplate('Call {firstName} on {phone}', lead)

    expect(result.text).toBe('Call John on +1-555-0100')
    expect(result.missingFields).toEqual(['phone'])
  })

  it('treats every field as missing when there is no lead to preview', () => {
    const result = previewTemplate('Hi {firstName} at {companyName}')

    expect(result.text).toBe('Hi Ada at Analytical Engines Ltd')
    expect(result.missingFields).toEqual(['firstName', 'companyName'])
  })

  it('reports unknown tokens and leaves them untouched', () => {
    const result = previewTemplate('Hi {firstName}, {salary} and {frstName}', lead)

    expect(result.text).toBe('Hi John, {salary} and {frstName}')
    expect(result.unknownFields).toEqual(['salary', 'frstName'])
  })

  it('substitutes a repeated field everywhere', () => {
    const result = previewTemplate('{firstName}, hello {firstName}', lead)

    expect(result.text).toBe('John, hello John')
  })

  it('reports each problem field only once', () => {
    const result = previewTemplate('{phone} {phone} {salary} {salary}', lead)

    expect(result.missingFields).toEqual(['phone'])
    expect(result.unknownFields).toEqual(['salary'])
  })

  it('keeps a zero-year tenure instead of falling back to the example', () => {
    const result = previewTemplate('{yearsAtCompany} years', { yearsAtCompany: 0 })

    expect(result.text).toBe('0 years')
    expect(result.missingFields).toEqual([])
  })

  it('does not interpret $ patterns in lead values as replacement patterns', () => {
    const result = previewTemplate('at {companyName}', { companyName: 'A$&B Inc' })

    expect(result.text).toBe('at A$&B Inc')
  })

  it('handles a template with no tokens', () => {
    expect(previewTemplate('Just a plain message', lead).text).toBe('Just a plain message')
  })
})
