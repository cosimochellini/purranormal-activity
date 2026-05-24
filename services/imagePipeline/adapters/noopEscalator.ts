import type { EscalatorPort } from '../ports'

/**
 * Silent escalator used by tests. Keeps the pipeline call signature
 * uniform between prod and test without forcing every test file to
 * stand up its own Telegram mock.
 */
export const noopEscalator: EscalatorPort = {
  async alert() {
    // intentionally empty
  },
}
