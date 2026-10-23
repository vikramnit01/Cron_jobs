const test = require('node:test');
const assert = require('node:assert/strict');
const Executor = require('../src/executor/Executor');

const silent = { info() {}, warn() {}, error() {} };

function deferredTask() {
  let finish;
  const task = { execute: () => new Promise((r) => { finish = () => r({ status: 'SUCCESS' }); }) };
  return { task, finish: () => finish() };
}

test('runs jobs concurrently and logs each run', async () => {
  const records = [];
  const executor = new Executor({ executionLogger: { log: (r) => records.push(r) }, logger: silent });
  const a = deferredTask();
  const b = deferredTask();
  executor.submit({ id: 'a', task: a.task, taskType: 't' });
  executor.submit({ id: 'b', task: b.task, taskType: 't' });
  assert.equal(executor.active.size, 2);

  a.finish();
  b.finish();
  await executor.shutdown(1000);
  assert.deepEqual(records.map((r) => [r.job_id, r.status]).sort(), [['a', 'SUCCESS'], ['b', 'SUCCESS']]);
  assert.ok(records.every((r) => r.run_id && r.started_at));
});

test('skips a run while the same job is still running', async () => {
  const records = [];
  const executor = new Executor({ executionLogger: { log: (r) => records.push(r) }, logger: silent });
  const a = deferredTask();
  const job = { id: 'a', task: a.task, taskType: 't' };
  executor.submit(job);
  executor.submit(job);
  assert.equal(executor.active.size, 1);
  a.finish();
  await executor.shutdown(1000);
  assert.equal(records.length, 1);
});

test('a thrown error is logged as FAILURE', async () => {
  const records = [];
  const executor = new Executor({ executionLogger: { log: (r) => records.push(r) }, logger: silent });
  executor.submit({ id: 'e', task: { execute: async () => { throw new Error('boom'); } }, taskType: 't' });
  await executor.shutdown(1000);
  assert.equal(records[0].status, 'FAILURE');
  assert.equal(records[0].error, 'boom');
});

test('respects the concurrency limit', async () => {
  const executor = new Executor({ executionLogger: { log() {} }, logger: silent, maxConcurrency: 1 });
  const a = deferredTask();
  const b = deferredTask();
  executor.submit({ id: 'a', task: a.task });
  executor.submit({ id: 'b', task: b.task });
  assert.equal(executor.active.size, 1);
  assert.equal(executor.queue.length, 1);
  a.finish();
  await new Promise((r) => setImmediate(r));
  assert.equal(executor.active.size, 1);
  b.finish();
  await executor.shutdown(1000);
});
