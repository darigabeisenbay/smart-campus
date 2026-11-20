// Fictional demo data. One room, no database, no login.
// All times are campus local time written as "YYYY-MM-DDTHH:MM".

export const ROOM = Object.freeze({
  id: 'A-101',
  label: 'Room A-101 (Group Study Room)',
  openingHour: 8,  // 08:00
  closingHour: 20, // 20:00
  maxDurationMinutes: 240
});

export const BOOKINGS = Object.freeze([
  Object.freeze({ id: 'b1', start: '2026-11-23T09:00', end: '2026-11-23T10:30', holder: 'Robotics Club (fictional)' }),
  Object.freeze({ id: 'b2', start: '2026-11-23T13:00', end: '2026-11-23T14:00', holder: 'Study Group 7 (fictional)' }),
  Object.freeze({ id: 'b3', start: '2026-11-25T10:00', end: '2026-11-25T12:00', holder: 'Thesis Seminar (fictional)' })
]);

export const BLOCKED_PERIODS = Object.freeze([
  Object.freeze({ start: '2026-11-24T08:00', end: '2026-11-24T20:00', reason: 'Maintenance (fictional)' })
]);
