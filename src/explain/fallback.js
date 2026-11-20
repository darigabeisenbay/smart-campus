// Deterministic explanation used when the model is disabled, fails, times out or returns invalid output.

const TEXT = Object.freeze({
  AVAILABLE: 'This room is free for the selected time, because no booking rule blocks it.',
  OVERLAP: 'This room is not available because the selected time overlaps an existing booking.',
  ROOM_BLOCKED: 'This room is not available because it is blocked for bookings during the selected time.',
  INVALID_TIME: 'This request is not valid: the end must be after the start, on the same day, and within the maximum length.',
  PAST_TIME: 'This room cannot be booked for the selected time because the start time is already in the past.',
  OUTSIDE_OPENING_HOURS: 'This room is not available because the selected time is outside the room\'s opening hours.'
});

export function fallbackExplanation(reasonCode) {
  return TEXT[reasonCode] ?? 'The booking rules decided the status shown above.';
}
