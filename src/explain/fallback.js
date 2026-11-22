// Deterministic explanation used when the model is disabled, fails, times out or returns invalid output.
import { reasonFor, UNKNOWN_REASON_TEXT } from '../reasons.js';

export function fallbackExplanation(reasonCode) {
  return reasonFor(reasonCode)?.fallback ?? UNKNOWN_REASON_TEXT;
}
