/**
 * Worst case the simulated provider can take to answer. The workflow's
 * startToCloseTimeout must stay above this, otherwise every attempt times out
 * and the workflow retries without ever producing an outcome.
 */
export const SLOW_PROVIDER_DELAY_MS = 20000;

export async function verifyEmail(email: string): Promise<boolean> {
    if (email.includes('john.doe')) {
        return false;
    }

    if (email.includes('jane.smith')) {
        await new Promise((resolve) => setTimeout(resolve, SLOW_PROVIDER_DELAY_MS));
    }

    if (/\+/.test(email)) {
        return false;
    }

    return true;
}