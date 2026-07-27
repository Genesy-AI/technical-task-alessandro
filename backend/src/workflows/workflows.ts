import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

// Verification talks to a third-party provider, so a single attempt needs room
// to be slow. Both the per-attempt timeout and the retry count must stay
// bounded: the Temporal default retry policy is unlimited attempts, so a
// too-short startToCloseTimeout makes every attempt time out and the workflow
// retries forever instead of ever reporting an outcome.
//
// The caller is a synchronous HTTP request, so the whole budget also has to fit
// inside a typical proxy read timeout (~60s). That leaves room for one retry on
// top of an attempt sized just above the provider's slowest response — raise
// SLOW_PROVIDER_DELAY_MS and these values together if the provider gets slower.
const SECOND_MS = 1000

export const VERIFY_EMAIL_ACTIVITY_OPTIONS = {
  startToCloseTimeout: 25 * SECOND_MS,
  retry: {
    initialInterval: 1 * SECOND_MS,
    backoffCoefficient: 2,
    maximumInterval: 10 * SECOND_MS,
    maximumAttempts: 2,
  },
}

// Backstop for the workflow as a whole. Must stay above the retry budget above
// (2 x 25s + 1s backoff = 51s), otherwise it fires first and the caller sees a
// generic timeout instead of the actual verification error.
export const VERIFY_EMAIL_WORKFLOW_EXECUTION_TIMEOUT_MS = 60 * SECOND_MS

const { verifyEmail } = proxyActivities<typeof activities>(VERIFY_EMAIL_ACTIVITY_OPTIONS)

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}
