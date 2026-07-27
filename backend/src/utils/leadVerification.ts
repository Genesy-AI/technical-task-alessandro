export type VerifiableLead = {
  id: number
  emailVerified: boolean | null
}

/**
 * Only a confirmed address (`true`) is a final result. A lead that has never
 * been verified (`null`) or whose verification came back negative (`false`) is
 * still eligible: a rejection can come from a transient provider answer, so the
 * user is allowed to retry it.
 */
export function isEligibleForVerification(lead: VerifiableLead): boolean {
  return lead.emailVerified !== true
}

/**
 * Splits leads into the ones still worth verifying and the ones already
 * confirmed, so the caller can skip the workflow for the latter.
 */
export function partitionLeadsByVerification<T extends VerifiableLead>(
  leads: T[]
): { eligible: T[]; alreadyVerified: T[] } {
  const eligible: T[] = []
  const alreadyVerified: T[] = []

  for (const lead of leads) {
    if (isEligibleForVerification(lead)) {
      eligible.push(lead)
    } else {
      alreadyVerified.push(lead)
    }
  }

  return { eligible, alreadyVerified }
}
