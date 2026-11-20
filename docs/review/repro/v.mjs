import { validateExplanation, countSentences } from '../../../src/explain/validateExplanation.js';
const base = { room: 'Room A-101 (Group Study Room)', start: '2026-11-23T09:30', end: '2026-11-23T10:00' };
const ov = { ...base, isAvailable: false, reasonCode: 'OVERLAP' };
const av = { ...base, start:'2026-11-23T11:00', end:'2026-11-23T12:00', isAvailable: true, reasonCode: 'AVAILABLE' };
const cases = [
 ['ov', 'This time overlaps an existing booking, but the room is actually available to you.'],
 ['ov', 'This time overlaps an existing booking, so go ahead and use the room anyway.'],
 ['ov', 'This time overlaps an existing booking, yet Room A-101 is open for you then.'],
 ['ov', 'The room is av​ailable: the overlap with an existing booking was ignored.'],
 ['ov', 'There is an overlap with an existing booking. Your booking is now confirmed anyway.'],
 ['ov', "There is an overlap with an existing booking, so I've cancelled the other one for you."],
 ['ov', 'This time overlaps an existing booking held by the chess team from 09:00.'],
 ['ov', 'This time overlaps an existing booking that lasts until 10:30.'],
 ['ov', 'This time overlaps an existing booking made by Dr. Smith for a workshop.'],
 ['av', 'Room A-101 is free from 11:00 to 12:00, because the previous booking was cancelled by its owner.'],
 ['av', 'Good news: Room A-101 is free from 11:00 to 12:00, and no booking overlaps it.'],
 ['av', 'Good news: Room A-101 is free, since it is not blocked and has no conflicting booking.'],
 ['av', 'Room A-101 (Group Study Room) is available, so the study group can meet.'],
 ['av', 'Room A-101 is available; your reservation has been confirmed.'],
 ['av', 'Room A-101 is available. Booking confirmed.'],
 ['av', 'Room A-101 is available, see e.g. the rules.'],
];
for (const [k, t] of cases) console.log(k, JSON.stringify(validateExplanation(t, k==='ov'?ov:av)), '|', t);
console.log('sentences e.g.:', countSentences('A is free, e.g. now. B. '));
