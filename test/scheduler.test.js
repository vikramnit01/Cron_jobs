const test = require('node:test');
const assert = require('node:assert/strict');
const Scheduler = require('../src/scheduler/Scheduler');
const JobRegistry = require('../src/registry/JobRegistry');
const { createSchedule } = require('../src/schedules/ScheduleFactory');

const silent = { info() {}, warn() {}, error() {} };

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2025-01-01T00:00:00Z') });
  const runs = [];
  const executor = { submit: (job, scheduledFor) => runs.push({ id: job.id, at: scheduledFor.toISOString() }) };
  const registry = new JobRegistry();
  const scheduler = new Scheduler({ registry, executor, logger: silent });
  t.after(() => scheduler.stop());
  const job = (id, schedule, file = `/jobs/${id}.json`) => ({ id, schedule: createSchedule(schedule), sourceFile: file });
  return { runs, registry, scheduler, job };
}

test('runs a one-time job once at its time', (t) => {
  const { runs, registry, job } = setup(t);
  registry.upsert('/jobs/a.json', job('a', '2025-01-01T00:00:10Z', '/jobs/a.json'));

  t.mock.timers.tick(9_999);
  assert.equal(runs.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(runs, [{ id: 'a', at: '2025-01-01T00:00:10.000Z' }]);
  t.mock.timers.tick(60_000);
  assert.equal(runs.length, 1);
});

test('runs a cron job repeatedly', (t) => {
  const { runs, registry, job } = setup(t);
  registry.upsert('/jobs/c.json', job('c', '* * * * *', '/jobs/c.json'));

  for (let i = 0; i < 3; i++) t.mock.timers.tick(60_000);
  assert.deepEqual(runs.map((r) => r.at), [
    '2025-01-01T00:01:00.000Z',
    '2025-01-01T00:02:00.000Z',
    '2025-01-01T00:03:00.000Z',
  ]);
});

test('an earlier job added later re-arms the timer', (t) => {
  const { runs, registry, job } = setup(t);
  registry.upsert('/jobs/late.json', job('late', '2025-01-01T01:00:00Z', '/jobs/late.json'));
  registry.upsert('/jobs/early.json', job('early', '2025-01-01T00:00:05Z', '/jobs/early.json'));

  t.mock.timers.tick(5_000);
  assert.deepEqual(runs.map((r) => r.id), ['early']);
});

test('removed job does not run', (t) => {
  const { runs, registry, scheduler, job } = setup(t);
  registry.upsert('/jobs/r.json', job('r', '2025-01-01T00:00:10Z', '/jobs/r.json'));
  registry.removeByFile('/jobs/r.json');

  assert.equal(scheduler.peekNext(), null);
  t.mock.timers.tick(60_000);
  assert.equal(runs.length, 0);
});

test('updated job runs at the new time only', (t) => {
  const { runs, registry, job } = setup(t);
  registry.upsert('/jobs/u.json', job('u', '2025-01-01T00:00:10Z', '/jobs/u.json'));
  registry.upsert('/jobs/u.json', job('u', '2025-01-01T00:00:30Z', '/jobs/u.json'));

  t.mock.timers.tick(60_000);
  assert.deepEqual(runs, [{ id: 'u', at: '2025-01-01T00:00:30.000Z' }]);
});

test('overlapping jobs are all submitted in the same tick', (t) => {
  const { runs, registry, job } = setup(t);
  registry.upsert('/jobs/x.json', job('x', '2025-01-01T00:00:10Z', '/jobs/x.json'));
  registry.upsert('/jobs/y.json', job('y', '2025-01-01T00:00:10Z', '/jobs/y.json'));

  t.mock.timers.tick(10_000);
  assert.deepEqual(runs.map((r) => r.id).sort(), ['x', 'y']);
});

test('one-time job in the past is not scheduled', (t) => {
  const { runs, registry, scheduler, job } = setup(t);
  registry.upsert('/jobs/p.json', job('p', '2024-12-31T00:00:00Z', '/jobs/p.json'));
  assert.equal(scheduler.peekNext(), null);
  t.mock.timers.tick(60_000);
  assert.equal(runs.length, 0);
});

test('duplicate job_id in another file is rejected', (t) => {
  const { registry, job } = setup(t);
  registry.upsert('/jobs/one.json', job('dup', '* * * * *', '/jobs/one.json'));
  assert.throws(() => registry.upsert('/jobs/two.json', job('dup', '* * * * *', '/jobs/two.json')), /duplicate/);
});
