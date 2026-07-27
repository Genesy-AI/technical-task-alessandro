import { fileURLToPath } from 'node:url'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { VERIFY_EMAIL_ACTIVITY_OPTIONS, verifyEmailWorkflow } from './workflows'

const workflowsPath = fileURLToPath(new URL('./workflows.ts', import.meta.url))

/**
 * End-to-end guard for the "email verification hangs forever" bug.
 *
 * These run against Temporal's time-skipping test server, so a workflow that
 * would wait minutes in production resolves instantly here — but a workflow
 * that retries *forever* still never resolves, which is exactly the regression
 * we want to catch.
 */
describe('verifyEmailWorkflow (integration)', () => {
  let testEnv: TestWorkflowEnvironment

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping()
  }, 120_000)

  afterAll(async () => {
    await testEnv?.teardown()
  })

  async function runWith(email: string, verifyEmail: (email: string) => Promise<boolean>): Promise<boolean> {
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-verify-email',
      workflowsPath,
      activities: { verifyEmail },
    })

    return worker.runUntil(
      testEnv.client.workflow.execute(verifyEmailWorkflow, {
        taskQueue: 'test-verify-email',
        workflowId: `test-verify-email-${email}`,
        args: [email],
      })
    )
  }

  it('returns the activity result for a valid email', async () => {
    await expect(runWith('valid@example.com', async () => true)).resolves.toBe(true)
  })

  it('returns false when the provider rejects the email', async () => {
    await expect(runWith('rejected@example.com', async () => false)).resolves.toBe(false)
  })

  it('completes for a provider slower than the old 1s timeout', async () => {
    // The activity runs for real (only workflow timers are skipped), so this
    // stays short. workflows.test.ts is what pins startToCloseTimeout above the
    // provider's true worst case.
    let attempts = 0
    const slowVerify = async () => {
      attempts += 1
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      return true
    }

    await expect(runWith('slow@example.com', slowVerify)).resolves.toBe(true)
    expect(attempts).toBe(1)
  }, 60_000)

  it('gives up with a failure instead of retrying forever when the activity keeps failing', async () => {
    let attempts = 0
    const alwaysFails = async () => {
      attempts += 1
      throw new Error('provider unavailable')
    }

    await expect(runWith('broken@example.com', alwaysFails)).rejects.toThrow()
    expect(attempts).toBe(VERIFY_EMAIL_ACTIVITY_OPTIONS.retry.maximumAttempts)
  }, 60_000)
})
