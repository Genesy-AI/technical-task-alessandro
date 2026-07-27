import { describe, expect, it } from 'vitest'
import { isEligibleForVerification, partitionLeadsByVerification } from './leadVerification'

describe('isEligibleForVerification', () => {
  it('is eligible when no verification has run yet', () => {
    expect(isEligibleForVerification({ id: 1, emailVerified: null })).toBe(true)
  })

  it('is still eligible after a rejection, so the user can retry', () => {
    expect(isEligibleForVerification({ id: 1, emailVerified: false })).toBe(true)
  })

  it('is not eligible once the email was confirmed', () => {
    expect(isEligibleForVerification({ id: 1, emailVerified: true })).toBe(false)
  })
})

describe('partitionLeadsByVerification', () => {
  it('splits a mixed batch into work to do and work to skip', () => {
    const unverified = { id: 1, emailVerified: null }
    const confirmed = { id: 2, emailVerified: true }
    const rejected = { id: 3, emailVerified: false }

    const { eligible, alreadyVerified } = partitionLeadsByVerification([unverified, confirmed, rejected])

    expect(eligible).toEqual([unverified, rejected])
    expect(alreadyVerified).toEqual([confirmed])
  })

  it('skips everything when every lead is already confirmed', () => {
    const leads = [
      { id: 1, emailVerified: true },
      { id: 2, emailVerified: true },
    ]

    const { eligible, alreadyVerified } = partitionLeadsByVerification(leads)

    expect(eligible).toEqual([])
    expect(alreadyVerified).toEqual(leads)
  })

  it('keeps every lead eligible when none has been confirmed', () => {
    const leads = [
      { id: 1, emailVerified: null },
      { id: 2, emailVerified: false },
    ]

    const { eligible, alreadyVerified } = partitionLeadsByVerification(leads)

    expect(eligible).toEqual(leads)
    expect(alreadyVerified).toEqual([])
  })

  it('handles an empty batch', () => {
    expect(partitionLeadsByVerification([])).toEqual({ eligible: [], alreadyVerified: [] })
  })

  it('preserves the extra fields the caller needs downstream', () => {
    const lead = { id: 1, emailVerified: null, email: 'bob@example.com', firstName: 'Bob' }

    const { eligible } = partitionLeadsByVerification([lead])

    expect(eligible[0].email).toBe('bob@example.com')
  })
})
