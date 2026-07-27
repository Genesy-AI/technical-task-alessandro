import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SLOW_PROVIDER_DELAY_MS, verifyEmail } from './utils'

describe('verifyEmail', () => {
  it('rejects the known-bad address', async () => {
    await expect(verifyEmail('john.doe@example.com')).resolves.toBe(false)
  })

  it('rejects plus-addressed emails', async () => {
    await expect(verifyEmail('bob+newsletter@example.com')).resolves.toBe(false)
  })

  it('accepts a plain address', async () => {
    await expect(verifyEmail('bob@example.com')).resolves.toBe(true)
  })

  describe('slow provider path', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('answers after the simulated provider delay instead of never settling', async () => {
      const pending = verifyEmail('jane.smith@example.com')

      await vi.advanceTimersByTimeAsync(SLOW_PROVIDER_DELAY_MS)

      await expect(pending).resolves.toBe(true)
    })
  })
})
