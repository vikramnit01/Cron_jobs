const test = require('node:test');
const assert = require('node:assert/strict');
const { createSchedule } = require('../src/schedules/ScheduleFactory');
const OneTimeSchedule = require('../src/schedules/OneTimeSchedule');
const CronSchedule = require('../src/schedules/CronSchedule');

test('ISO 8601 creates a one-time schedule', () => {
  const s = createSchedule('2025-10-26T15:00:00Z');
  assert.ok(s instanceof OneTimeSchedule);
  assert.equal(s.nextRun(new Date('2025-10-26T14:00:00Z')).toISOString(), '2025-10-26T15:00:00.000Z');
  assert.equal(s.nextRun(new Date('2025-10-26T15:00:00Z')), null);
});

test('cron string creates a recurring schedule in UTC', () => {
  const s = createSchedule('*/5 * * * *');
  assert.ok(s instanceof CronSchedule);
  assert.equal(s.nextRun(new Date('2025-01-01T00:02:00Z')).toISOString(), '2025-01-01T00:05:00.000Z');
  assert.equal(s.nextRun(new Date('2025-01-01T00:05:00Z')).toISOString(), '2025-01-01T00:10:00.000Z');
});

test('invalid schedules throw', () => {
  assert.throws(() => createSchedule('not a schedule'));
  assert.throws(() => createSchedule('2025-13-45T99:00:00Z'));
  assert.throws(() => createSchedule(''));
  assert.throws(() => createSchedule(42));
});
