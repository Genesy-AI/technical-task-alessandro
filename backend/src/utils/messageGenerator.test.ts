import { describe, it, expect } from 'vitest'
import { generateMessageFromTemplate, Lead } from './messageGenerator'

describe('generateMessageFromTemplate', () => {
  const fullLead: Lead = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-280-754-0462x2154',
    linkedinUrl: 'https://www.linkedin.com/in/john-doe',
    jobTitle: 'Software Engineer',
    companyName: 'Tech Corp',
    yearsAtCompany: 5,
    countryCode: 'US',
  }

  const partialLead: Lead = {
    firstName: 'Jane',
    lastName: null,
    email: 'jane@example.com',
    phone: null,
    linkedinUrl: undefined,
    jobTitle: undefined,
    companyName: '',
    yearsAtCompany: null,
    countryCode: 'CA',
  }

  const minimalLead: Lead = {
    firstName: 'Bob',
  }

  describe('successful message generation', () => {
    it('should replace single field in template', () => {
      const template = 'Hello {firstName}!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello John!')
    })

    it('should replace multiple different fields in template', () => {
      const template = 'Hi {firstName} {lastName}, welcome to {companyName}!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hi John Doe, welcome to Tech Corp!')
    })

    it('should replace the same field multiple times', () => {
      const template = 'Hello {firstName}, how are you {firstName}?'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello John, how are you John?')
    })

    it('should handle template with all available fields', () => {
      const template =
        'Name: {firstName} {lastName}, Email: {email}, Phone: {phone}, LinkedIn: {linkedinUrl}, Job: {jobTitle} at {companyName} for {yearsAtCompany} years, Country: {countryCode}'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe(
        'Name: John Doe, Email: john.doe@example.com, Phone: +1-280-754-0462x2154, LinkedIn: https://www.linkedin.com/in/john-doe, Job: Software Engineer at Tech Corp for 5 years, Country: US'
      )
    })

    it('should handle template with no field placeholders', () => {
      const template = 'This is a static message with no placeholders.'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('This is a static message with no placeholders.')
    })

    it('should handle empty template', () => {
      const template = ''
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('')
    })

    it('should handle complex message template', () => {
      const template =
        'Dear {firstName},\n\nI hope this message finds you well. I noticed you work at {companyName} as a {jobTitle}. I would love to connect with you.\n\nBest regards!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe(
        'Dear John,\n\nI hope this message finds you well. I noticed you work at Tech Corp as a Software Engineer. I would love to connect with you.\n\nBest regards!'
      )
    })
  })

  describe('error handling for missing fields', () => {
    it('should throw error when field is null', () => {
      const template = 'Hello {firstName} {lastName}!'
      expect(() => generateMessageFromTemplate(template, partialLead)).toThrow(
        'Missing required field: lastName'
      )
    })

    it('should throw error when field is undefined', () => {
      const template = 'Your job title is {jobTitle}'
      expect(() => generateMessageFromTemplate(template, partialLead)).toThrow(
        'Missing required field: jobTitle'
      )
    })

    it('should throw error when field is empty string', () => {
      const template = 'You work at {companyName}'
      expect(() => generateMessageFromTemplate(template, partialLead)).toThrow(
        'Missing required field: companyName'
      )
    })

    it('should throw error when field does not exist on lead', () => {
      const template = 'Hello {firstName}, your last name is {lastName}'
      expect(() => generateMessageFromTemplate(template, minimalLead)).toThrow(
        'Missing required field: lastName'
      )
    })

    it('should throw error when phone is null', () => {
      const template = 'Can I call you on {phone}?'
      expect(() => generateMessageFromTemplate(template, partialLead)).toThrow(
        'Missing required field: phone'
      )
    })

    it('should throw error when linkedinUrl is undefined', () => {
      const template = 'Found you at {linkedinUrl}'
      expect(() => generateMessageFromTemplate(template, partialLead)).toThrow(
        'Missing required field: linkedinUrl'
      )
    })

    it('should throw error when yearsAtCompany is null', () => {
      const template = '{yearsAtCompany} years in the role'
      expect(() => generateMessageFromTemplate(template, partialLead)).toThrow(
        'Missing required field: yearsAtCompany'
      )
    })
  })

  describe('numeric and literal-safe field values', () => {
    it('should interpolate a numeric field value', () => {
      const template = '{firstName} has been there {yearsAtCompany} years'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('John has been there 5 years')
    })

    it('should treat yearsAtCompany of 0 as present, not missing', () => {
      const newJoiner: Lead = { firstName: 'Zoe', yearsAtCompany: 0 }
      const template = '{firstName} just joined ({yearsAtCompany} years)'
      const result = generateMessageFromTemplate(template, newJoiner)
      expect(result).toBe('Zoe just joined (0 years)')
    })

    it('should not interpret $ patterns in field values as replacement patterns', () => {
      const trickyLead: Lead = { firstName: 'John', companyName: 'A$&B Inc' }
      const template = 'Hi {firstName} from {companyName}'
      const result = generateMessageFromTemplate(template, trickyLead)
      expect(result).toBe('Hi John from A$&B Inc')
    })
  })

  describe('handling of unknown and invalid fields', () => {
    it('should throw error for unknown field in template', () => {
      const template = 'Hello {firstName} {unknownField}!'
      expect(() => generateMessageFromTemplate(template, fullLead)).toThrow(
        'Unknown field in template: unknownField'
      )
    })

    it('should ignore invalid field patterns with hyphens', () => {
      const template = 'Hello {first-name}!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello {first-name}!')
    })

    it('should ignore invalid field patterns with spaces', () => {
      const template = 'Hello {first name}!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello {first name}!')
    })
  })

  describe('edge cases and malformed templates', () => {
    it('should handle malformed brackets (single opening bracket)', () => {
      const template = 'Hello {firstName'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello {firstName')
    })

    it('should handle malformed brackets (single closing bracket)', () => {
      const template = 'Hello firstName}'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello firstName}')
    })

    it('should ignore empty brackets', () => {
      const template = 'Hello {} {firstName}!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello {} John!')
    })

    it('should handle nested brackets', () => {
      const template = 'Hello {{firstName}}!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello {John}!')
    })

    it('should handle brackets with numbers', () => {
      const template = 'Hello {firstName123}!'
      expect(() => generateMessageFromTemplate(template, fullLead)).toThrow(
        'Unknown field in template: firstName123'
      )
    })

    it('should handle case sensitivity', () => {
      const template = 'Hello {FirstName}!'
      expect(() => generateMessageFromTemplate(template, fullLead)).toThrow(
        'Unknown field in template: FirstName'
      )
    })
  })

  describe('performance and large templates', () => {
    it('should handle template with many field replacements', () => {
      const template = Array(100).fill('{firstName}').join(' ')
      const result = generateMessageFromTemplate(template, fullLead)
      const expected = Array(100).fill('John').join(' ')
      expect(result).toBe(expected)
    })

    it('should handle very long field values', () => {
      const longLead: Lead = {
        firstName: 'A'.repeat(1000),
        companyName: 'B'.repeat(500),
      }
      const template = 'Name: {firstName}, Company: {companyName}'
      const result = generateMessageFromTemplate(template, longLead)
      expect(result).toBe(`Name: ${'A'.repeat(1000)}, Company: ${'B'.repeat(500)}`)
    })
  })

  describe('special characters and encoding', () => {
    it('should handle special characters in field values', () => {
      const specialLead: Lead = {
        firstName: 'José',
        companyName: 'Café & Co.',
        email: 'josé@café.com',
      }
      const template = 'Hello {firstName} from {companyName}! Email: {email}'
      const result = generateMessageFromTemplate(template, specialLead)
      expect(result).toBe('Hello José from Café & Co.! Email: josé@café.com')
    })

    it('should handle emojis in field values', () => {
      const emojiLead: Lead = {
        firstName: 'John 😊',
        companyName: 'TechCorp 🚀',
      }
      const template = 'Hi {firstName} from {companyName}!'
      const result = generateMessageFromTemplate(template, emojiLead)
      expect(result).toBe('Hi John 😊 from TechCorp 🚀!')
    })
  })
})
