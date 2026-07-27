import { describe, it, expect } from 'vitest'
import {
  parseCsv,
  isValidEmail,
  normalizeCountryCode,
  normalizeLinkedinUrl,
  parseYearsAtCompany,
} from './csvParser'

describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
    expect(isValidEmail('first.last+tag@example.org')).toBe(true)
    expect(isValidEmail('123@456.com')).toBe(true)
  })

  it('should return false for invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('test.example.com')).toBe(false)
    expect(isValidEmail('test@.com')).toBe(false)
    expect(isValidEmail('test@example')).toBe(false)
  })
})

describe('normalizeCountryCode', () => {
  it('should return valid ISO 3166-1 alpha-2 codes', () => {
    expect(normalizeCountryCode('US')).toBe('US')
    expect(normalizeCountryCode('ES')).toBe('ES')
    expect(normalizeCountryCode('TV')).toBe('TV')
    expect(normalizeCountryCode('IT')).toBe('IT')
  })

  it('should uppercase and trim before matching', () => {
    expect(normalizeCountryCode('us')).toBe('US')
    expect(normalizeCountryCode(' fr ')).toBe('FR')
    expect(normalizeCountryCode('De')).toBe('DE')
  })

  it('should map known non-ISO aliases', () => {
    expect(normalizeCountryCode('UK')).toBe('GB')
    expect(normalizeCountryCode('uk')).toBe('GB')
    expect(normalizeCountryCode('EL')).toBe('GR')
  })

  it('should return undefined for empty values', () => {
    expect(normalizeCountryCode('')).toBeUndefined()
    expect(normalizeCountryCode('   ')).toBeUndefined()
    expect(normalizeCountryCode(undefined)).toBeUndefined()
  })

  it('should return undefined for values that are not country codes', () => {
    expect(normalizeCountryCode('XXX')).toBeUndefined()
    expect(normalizeCountryCode('12')).toBeUndefined()
    expect(normalizeCountryCode('U')).toBeUndefined()
    expect(normalizeCountryCode('USA')).toBeUndefined()
    expect(normalizeCountryCode('United States')).toBeUndefined()
    expect(normalizeCountryCode('Ã‰Ã±')).toBeUndefined()
    expect(normalizeCountryCode('ðºð¸')).toBeUndefined()
    expect(normalizeCountryCode('-')).toBeUndefined()
    expect(normalizeCountryCode('U S')).toBeUndefined()
  })
})

describe('normalizeLinkedinUrl', () => {
  it('should return undefined for empty values', () => {
    expect(normalizeLinkedinUrl(undefined)).toBeUndefined()
    expect(normalizeLinkedinUrl('')).toBeUndefined()
    expect(normalizeLinkedinUrl('   ')).toBeUndefined()
  })

  it('should keep a full URL as is', () => {
    expect(normalizeLinkedinUrl('https://www.linkedin.com/in/ada-lovelace')).toBe(
      'https://www.linkedin.com/in/ada-lovelace'
    )
    expect(normalizeLinkedinUrl('http://linkedin.com/company/analytical-engines')).toBe(
      'http://linkedin.com/company/analytical-engines'
    )
  })

  it('should add a scheme when one is missing', () => {
    expect(normalizeLinkedinUrl('www.linkedin.com/in/ada-lovelace')).toBe(
      'https://www.linkedin.com/in/ada-lovelace'
    )
    expect(normalizeLinkedinUrl('linkedin.com/in/ada-lovelace')).toBe('https://linkedin.com/in/ada-lovelace')
  })

  it('should expand a bare profile handle', () => {
    expect(normalizeLinkedinUrl('ada-lovelace')).toBe('https://www.linkedin.com/in/ada-lovelace')
    expect(normalizeLinkedinUrl('in/ada-lovelace')).toBe('https://www.linkedin.com/in/ada-lovelace')
    expect(normalizeLinkedinUrl('/in/ada-lovelace/')).toBe('https://www.linkedin.com/in/ada-lovelace')
  })

  it('should return undefined for values that are not LinkedIn profiles', () => {
    expect(normalizeLinkedinUrl('not a url')).toBeUndefined()
    expect(normalizeLinkedinUrl('https://twitter.com/ada')).toBeUndefined()
    expect(normalizeLinkedinUrl('ad')).toBeUndefined()
    expect(normalizeLinkedinUrl('ada@example.com')).toBeUndefined()
  })
})

describe('parseYearsAtCompany', () => {
  it('should return undefined for empty values', () => {
    expect(parseYearsAtCompany(undefined)).toBeUndefined()
    expect(parseYearsAtCompany('')).toBeUndefined()
    expect(parseYearsAtCompany('   ')).toBeUndefined()
  })

  it('should parse whole numbers of years', () => {
    expect(parseYearsAtCompany('5')).toBe(5)
    expect(parseYearsAtCompany(' 15 ')).toBe(15)
  })

  it('should treat zero as a real value, not as missing', () => {
    expect(parseYearsAtCompany('0')).toBe(0)
  })

  it('should return undefined for values that are not whole years', () => {
    expect(parseYearsAtCompany('abc')).toBeUndefined()
    expect(parseYearsAtCompany('about 3')).toBeUndefined()
    expect(parseYearsAtCompany('2.5')).toBeUndefined()
    expect(parseYearsAtCompany('-3')).toBeUndefined()
  })
})

describe('parseCsv', () => {
  it('should throw error for empty content', () => {
    expect(() => parseCsv('')).toThrow('CSV content cannot be empty')
    expect(() => parseCsv('   ')).toThrow('CSV content cannot be empty')
  })

  it('should throw error for CSV with only headers', () => {
    const csv = 'firstName,lastName,email'
    expect(() => parseCsv(csv)).toThrow('CSV file appears to be empty or contains no valid data')
  })

  it('should throw error for malformed CSV content', () => {
    const malformedCsv = `firstName,lastName,email
"John,Doe,john@example.com,extra"field`
    expect(() => parseCsv(malformedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with mismatched field count', () => {
    const mismatchedCsv = `firstName,lastName,email
John,Doe,john@example.com,ExtraField,AnotherExtra
Jane,Smith`
    expect(() => parseCsv(mismatchedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with critical delimiter issues', () => {
    const noDelimiterCsv = `firstName lastName email
John Doe john@example.com`
    expect(() => parseCsv(noDelimiterCsv)).toThrow()
  })

  it('should parse valid CSV with all required fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode,companyName
John,Doe,john.doe@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      jobTitle: 'Developer',
      countryCode: 'US',
      companyName: 'Tech Corp',
      isValid: true,
      errors: [],
      warnings: [],
      rowIndex: 2,
    })
  })

  describe('country codes', () => {
    it('should keep valid country codes and normalize their casing', () => {
      const csv = `firstName,lastName,email,countryCode
John,Doe,john@example.com,US
Jane,Smith,jane@example.com,es
Bob,Johnson,bob@example.com, tv `

      const result = parseCsv(csv)

      expect(result.map((lead) => lead.countryCode)).toEqual(['US', 'ES', 'TV'])
      expect(result.every((lead) => lead.isValid)).toBe(true)
      expect(result.every((lead) => lead.warnings.length === 0)).toBe(true)
    })

    it('should drop values that are not country codes but still import the lead', () => {
      const csv = `firstName,lastName,email,countryCode
John,Doe,john@example.com,XXX
Jane,Smith,jane@example.com,12
Bob,Johnson,bob@example.com,United States
Amy,Stein,amy@example.com,Ã‰Ã±`

      const result = parseCsv(csv)

      expect(result).toHaveLength(4)
      result.forEach((lead) => {
        expect(lead.countryCode).toBeUndefined()
        expect(lead.isValid).toBe(true)
        expect(lead.errors).toEqual([])
      })
      expect(result[0].warnings).toEqual(['Unrecognized country code "XXX" was ignored'])
      expect(result[1].warnings).toEqual(['Unrecognized country code "12" was ignored'])
      expect(result[2].warnings).toEqual(['Unrecognized country code "United States" was ignored'])
    })

    it('should truncate very long values in the warning message', () => {
      const csv = `firstName,lastName,email,countryCode
John,Doe,john@example.com,${'X'.repeat(50)}`

      const result = parseCsv(csv)

      expect(result[0].warnings).toEqual([`Unrecognized country code "${'X'.repeat(20)}" was ignored`])
      expect(result[0].isValid).toBe(true)
    })

    it('should not warn when the country code is empty or missing', () => {
      const csv = `firstName,lastName,email,countryCode
John,Doe,john@example.com,
Jane,Smith,jane@example.com,   `

      const result = parseCsv(csv)

      expect(result).toHaveLength(2)
      result.forEach((lead) => {
        expect(lead.countryCode).toBeUndefined()
        expect(lead.warnings).toEqual([])
        expect(lead.isValid).toBe(true)
      })
    })

    it('should map non-ISO aliases used in the wild', () => {
      const csv = `firstName,lastName,email,countryCode
John,Doe,john@example.com,UK`

      const result = parseCsv(csv)

      expect(result[0].countryCode).toBe('GB')
      expect(result[0].warnings).toEqual([])
    })

    it('should keep country warnings independent from validation errors', () => {
      const csv = `firstName,lastName,email,countryCode
,Doe,invalid-email,XXX`

      const result = parseCsv(csv)

      expect(result[0].isValid).toBe(false)
      expect(result[0].errors).toContain('First name is required')
      expect(result[0].errors).toContain('Invalid email format')
      expect(result[0].warnings).toEqual(['Unrecognized country code "XXX" was ignored'])
    })

    it('should import a mixed file where only some rows have usable country codes', () => {
      const csv = `firstName,lastName,email,jobTitle,countryCode,companyName,yearsInRole,phoneNumber
Iñaki,Álvarez,inaki@example.com,Restaurant manager,ES,Rogers Inc,10,+1-648-901-1274
Gabrielle,Ray,gabrielle@example.com,Secretary,XXX,Ray LLC,15,
Amanda,James,amanda@example.com,Research officer,12,Page-Bond,15,
James,Ford,james@example.com,Games developer,,,10,`

      const result = parseCsv(csv)

      expect(result).toHaveLength(4)
      expect(result.every((lead) => lead.isValid)).toBe(true)
      expect(result.map((lead) => lead.countryCode)).toEqual(['ES', undefined, undefined, undefined])
      expect(result[0].lastName).toBe('Álvarez')
      expect(result[1].warnings).toHaveLength(1)
      expect(result[3].warnings).toEqual([])
    })
  })

  describe('phone, years at company and LinkedIn', () => {
    it('should import the column names used by the sample exports', () => {
      const csv = `firstName,lastName,email,jobTitle,countryCode,companyName,yearsInRole,phoneNumber
Chad,Smith,chad@example.com,Child psychotherapist,TV,Global Tech Solutions,2,+1-280-754-0462x2154`

      const result = parseCsv(csv)

      expect(result[0].phone).toBe('+1-280-754-0462x2154')
      expect(result[0].yearsAtCompany).toBe(2)
      expect(result[0].warnings).toEqual([])
      expect(result[0].isValid).toBe(true)
    })

    it('should accept the alternative header spellings for each field', () => {
      const csv = `firstName,lastName,email,phone,yearsAtCompany,linkedin
Ada,Lovelace,ada@example.com,555-0100,7,ada-lovelace`

      const result = parseCsv(csv)

      expect(result[0].phone).toBe('555-0100')
      expect(result[0].yearsAtCompany).toBe(7)
      expect(result[0].linkedinUrl).toBe('https://www.linkedin.com/in/ada-lovelace')
    })

    it('should keep phone numbers exactly as written', () => {
      const csv = `firstName,lastName,email,phoneNumber
Leslie,Andrews,leslie@example.com,(731)123-9702
Emily,Decker,emily@example.com,063.430.8860x4762
Ronald,Roy,ronald@example.com,7549075690`

      const result = parseCsv(csv)

      expect(result.map((lead) => lead.phone)).toEqual(['(731)123-9702', '063.430.8860x4762', '7549075690'])
      expect(result.every((lead) => lead.warnings.length === 0)).toBe(true)
    })

    it('should warn and drop unusable years and LinkedIn values without failing the row', () => {
      const csv = `firstName,lastName,email,yearsInRole,linkedin
John,Doe,john@example.com,about three,not a profile`

      const result = parseCsv(csv)

      expect(result[0].isValid).toBe(true)
      expect(result[0].yearsAtCompany).toBeUndefined()
      expect(result[0].linkedinUrl).toBeUndefined()
      expect(result[0].warnings).toEqual([
        'Unrecognized years at company "about three" was ignored',
        'Unrecognized LinkedIn URL "not a profile" was ignored',
      ])
    })

    it('should not warn when the new columns are empty', () => {
      const csv = `firstName,lastName,email,phoneNumber,yearsInRole,linkedin
John,Doe,john@example.com,,,`

      const result = parseCsv(csv)

      expect(result[0].phone).toBeUndefined()
      expect(result[0].yearsAtCompany).toBeUndefined()
      expect(result[0].linkedinUrl).toBeUndefined()
      expect(result[0].warnings).toEqual([])
    })

    it('should keep a zero-year tenure', () => {
      const csv = `firstName,lastName,email,yearsInRole
Zoe,Newman,zoe@example.com,0`

      const result = parseCsv(csv)

      expect(result[0].yearsAtCompany).toBe(0)
      expect(result[0].warnings).toEqual([])
    })
  })

  it('should handle missing required fields and mark as invalid', () => {
    const csv = `firstName,lastName,email
,Smith,john@example.com
John,,john@example.com
John,Smith,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)

    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('First name is required')

    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('Last name is required')

    expect(result[2].isValid).toBe(false)
    expect(result[2].errors).toContain('Email is required')
  })

  it('should validate email format', () => {
    const csv = `firstName,lastName,email
John,Doe,invalid-email
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Invalid email format')
    expect(result[1].isValid).toBe(true)
  })

  it('should handle CSV with quoted values', () => {
    const csv = `firstName,lastName,email,jobTitle
"John","Doe","john.doe@example.com","Software Engineer"`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john.doe@example.com')
    expect(result[0].jobTitle).toBe('Software Engineer')
  })

  it('should skip empty rows', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,,
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].firstName).toBe('John')
    expect(result[1].firstName).toBe('Jane')
  })

  it('should handle case-insensitive headers', () => {
    const csv = `FIRSTNAME,LASTNAME,EMAIL,JOBTITLE,COUNTRYCODE,COMPANYNAME
John,Doe,john@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].jobTitle).toBe('Developer')
  })

  it('should handle missing optional fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode
John,Doe,john@example.com,,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].jobTitle).toBeUndefined()
    expect(result[0].countryCode).toBeUndefined()
    expect(result[0].isValid).toBe(true)
  })

  it('should preserve row index correctly', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
Jane,Smith,jane@example.com
Bob,Johnson,bob@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].rowIndex).toBe(2)
    expect(result[1].rowIndex).toBe(3)
    expect(result[2].rowIndex).toBe(4)
  })

  it('should handle multiple validation errors per lead', () => {
    const csv = `firstName,lastName,email
 , ,invalid-email`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toHaveLength(3)
    expect(result[0].errors).toContain('First name is required')
    expect(result[0].errors).toContain('Last name is required')
    expect(result[0].errors).toContain('Invalid email format')
  })

  it('should handle extra columns not in header mapping', () => {
    const csv = `firstName,lastName,email,unknownColumn
John,Doe,john@example.com,someValue`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })

  it('should handle mixed valid and invalid leads', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,Smith,invalid-email
Jane,Johnson,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].isValid).toBe(true)
    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('First name is required')
    expect(result[1].errors).toContain('Invalid email format')
    expect(result[2].isValid).toBe(true)
  })

  it('should handle whitespace in fields', () => {
    const csv = `firstName,lastName,email
 John , Doe , john@example.com `

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })
})
