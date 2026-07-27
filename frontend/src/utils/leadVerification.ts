export type VerifiableLead = {
  id: number
  emailVerified: boolean | null
}

/**
 * Only a confirmed address (`true`) is a final result. A lead that has never
 * been verified (`null`) or whose verification came back negative (`false`) is
 * still eligible: a rejection can come from a transient provider answer, so the
 * user is allowed to retry it.
 *
 * Mirrors the same rule on the backend (`backend/src/utils/leadVerification.ts`);
 * the frontend copy only decides whether the action is offered, the backend
 * copy is what actually enforces the skip.
 */
export function isEligibleForVerification(lead: VerifiableLead): boolean {
  return lead.emailVerified !== true
}

/**
 * Whether "Verify Email" should be offered for the current selection: there has
 * to be at least one selected lead whose email isn't confirmed yet.
 */
export function hasLeadsToVerify(leads: VerifiableLead[], selectedLeadIds: number[]): boolean {
  const selected = new Set(selectedLeadIds)

  return leads.some((lead) => selected.has(lead.id) && isEligibleForVerification(lead))
}

const pluralize = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

/**
 * Builds the toast text for a verify run, which is a partial success whenever
 * the selection mixed already-verified leads in with new ones.
 */
export function formatVerificationSummary({
  verifiedCount,
  skippedCount,
}: {
  verifiedCount: number
  skippedCount: number
}): string {
  if (verifiedCount === 0 && skippedCount === 0) {
    return 'No emails to verify'
  }

  if (verifiedCount === 0) {
    return `Skipped ${pluralize(skippedCount, 'email')}, already verified`
  }

  const verified = `Verified ${pluralize(verifiedCount, 'email')}`

  return skippedCount === 0 ? verified : `${verified}, skipped ${skippedCount} already verified`
}
