const root = process.argv[2];
const { validateExplanation } = await import(`${root}/src/explain/validateExplanation.js`);
const { checkAvailability } = await import(`${root}/src/availability.js`);
const { createRateLimiter } = await import(`${root}/src/server.js`);
const base = { room: 'Room A-101 (Group Study Room)', start: '2026-11-23T10:00', end: '2026-11-23T11:00' };
const ov = { ...base, isAvailable: false, reasonCode: 'OVERLAP' };
const av = { ...base, start: '2026-11-23T11:00', end: '2026-11-23T12:00', isAvailable: true, reasonCode: 'AVAILABLE' };
console.log('## P2 validator bypass');
for (const [f, t] of [[ov, 'This time overlaps an existing booking, but the room is vacant so just walk in.'],
  [ov, 'This time overlaps an existing booking, yet nobody will stop you from using it.'],
  [ov, 'This time overlaps an existing booking; contact the front desk to override it.'],
  [av, 'This room is free from 11:00 to 12:00, but it might be busy.'],
  [ov, 'This time overlaps an existing booking, please come by anyway.']]) console.log(JSON.stringify(validateExplanation(t, f)), '|', t);
console.log('## P3 coupling to demo data');
console.log(JSON.stringify(validateExplanation('There is an overlapping booking; still, the space is ready for your group.', ov)));
console.log('## P4 malformed data silently ignored');
const now = '2026-11-20T09:00', req = { start: '2026-11-23T10:00', end: '2026-11-23T11:00' };
console.log('good booking  ', JSON.stringify(checkAvailability(req, { now, bookings: [{ start: '2026-11-23T09:00', end: '2026-11-23T10:30' }], blocked: [] })));
console.log('bad end "10:3"', JSON.stringify(checkAvailability(req, { now, bookings: [{ start: '2026-11-23T09:00', end: '2026-11-23T10:3' }], blocked: [] })));
console.log('bad blocked   ', JSON.stringify(checkAvailability({ start: '2026-11-24T10:00', end: '2026-11-24T11:00' }, { now, bookings: [], blocked: [{ start: '2026-11-24T08:00', end: '2026-11-24 20:00' }] })));
console.log('## P5 rate-limit wipe');
const allow = createRateLimiter({ perMinute: 2, now: () => 0 });
console.log('victim', allow('a'), allow('a'), allow('a'));
for (let i = 0; i < 10001; i++) allow(`x${i}`);
console.log('after 10,001 other keys, over-limit client allowed again?', allow('a'), allow('a'));
