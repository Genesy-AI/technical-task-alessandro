export type LeadsVerifyEmailsInput = {
  leadIds: number[]
}

export type LeadsVerifyEmailsOutput = {
  success: boolean
  /** Leads actually run through verification by this request. */
  verifiedCount: number
  /** Leads left untouched because they already had a verification outcome. */
  skippedCount: number
  results: Array<{
    leadId: number
    emailVerified: boolean | null
  }>
  skipped: Array<{
    leadId: number
    emailVerified: boolean | null
  }>
  errors: Array<{
    leadId: number
    leadName: string
    error: string
  }>
}
