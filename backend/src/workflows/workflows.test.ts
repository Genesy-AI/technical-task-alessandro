import { describe, expect, it } from 'vitest'
import { SLOW_PROVIDER_DELAY_MS } from './activities/utils'
import { VERIFY_EMAIL_ACTIVITY_OPTIONS, VERIFY_EMAIL_WORKFLOW_EXECUTION_TIMEOUT_MS } from './workflows'

/**
 * Guards the configuration that caused email verification to hang: a
 * startToCloseTimeout shorter than the provider's slowest response made every
 * attempt time out, and Temporal's default retry policy (unlimited attempts)
 * then retried it forever, so the workflow never reported success or failure.
 */
describe('verifyEmail activity options', () => {
  const { startToCloseTimeout, retry } = VERIFY_EMAIL_ACTIVITY_OPTIONS

  it('allows a single attempt to outlast the slowest provider response', () => {
    expect(startToCloseTimeout).toBeGreaterThan(SLOW_PROVIDER_DELAY_MS)
  })

  it('caps the retries so a failing activity eventually surfaces an error', () => {
    expect(retry.maximumAttempts).toBeGreaterThan(1)
    expect(retry.maximumAttempts).toBeLessThanOrEqual(5)
  })

  const { maximumAttempts, initialInterval, backoffCoefficient, maximumInterval } = retry

  const worstCaseBackoffMs = Array.from({ length: maximumAttempts - 1 }, (_, attempt) =>
    Math.min(initialInterval * backoffCoefficient ** attempt, maximumInterval)
  ).reduce((total, wait) => total + wait, 0)

  const worstCaseMs = maximumAttempts * startToCloseTimeout + worstCaseBackoffMs

  it('exhausts its retries before the workflow backstop fires', () => {
    // If the backstop fired first the caller would see a generic workflow
    // timeout instead of the real verification error.
    expect(worstCaseMs).toBeLessThan(VERIFY_EMAIL_WORKFLOW_EXECUTION_TIMEOUT_MS)
  })

  it('answers within a proxy read timeout, since the caller is a sync HTTP request', () => {
    expect(VERIFY_EMAIL_WORKFLOW_EXECUTION_TIMEOUT_MS).toBeLessThanOrEqual(60 * 1000)
  })
})
