import { describe, expect, it } from 'vitest'
import { formatVerificationSummary, hasLeadsToVerify, isEligibleForVerification } from './leadVerification'

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

describe('hasLeadsToVerify', () => {
  const leads = [
    { id: 1, emailVerified: null },
    { id: 2, emailVerified: true },
    { id: 3, emailVerified: false },
  ]

  it('offers the action when an unverified lead is selected', () => {
    expect(hasLeadsToVerify(leads, [1])).toBe(true)
  })

  it('offers the action when the selection mixes confirmed and unverified leads', () => {
    expect(hasLeadsToVerify(leads, [1, 2])).toBe(true)
  })

  it('offers the action for a rejected lead, so the user can retry it', () => {
    expect(hasLeadsToVerify(leads, [3])).toBe(true)
  })

  it('offers the action when the selection mixes confirmed and rejected leads', () => {
    expect(hasLeadsToVerify(leads, [2, 3])).toBe(true)
  })

  it('hides the action only when every selected lead is already confirmed', () => {
    expect(hasLeadsToVerify(leads, [2])).toBe(false)
  })

  it('hides the action when nothing is selected', () => {
    expect(hasLeadsToVerify(leads, [])).toBe(false)
  })

  it('ignores selected ids that are not in the loaded list', () => {
    expect(hasLeadsToVerify(leads, [99])).toBe(false)
  })

  it('hides the action when no leads are loaded', () => {
    expect(hasLeadsToVerify([], [1])).toBe(false)
  })
})

describe('formatVerificationSummary', () => {
  it('reports a single verified email', () => {
    expect(formatVerificationSummary({ verifiedCount: 1, skippedCount: 0 })).toBe('Verified 1 email')
  })

  it('reports several verified emails', () => {
    expect(formatVerificationSummary({ verifiedCount: 3, skippedCount: 0 })).toBe('Verified 3 emails')
  })

  it('reports the skipped leads alongside the verified ones', () => {
    expect(formatVerificationSummary({ verifiedCount: 2, skippedCount: 1 })).toBe(
      'Verified 2 emails, skipped 1 already verified'
    )
  })

  it('says nothing was verified when the whole selection was already done', () => {
    expect(formatVerificationSummary({ verifiedCount: 0, skippedCount: 2 })).toBe(
      'Skipped 2 emails, already verified'
    )
  })

  it('handles an empty run', () => {
    expect(formatVerificationSummary({ verifiedCount: 0, skippedCount: 0 })).toBe('No emails to verify')
  })
})
