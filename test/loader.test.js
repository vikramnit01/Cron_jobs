const test = require('node:test');
const assert = require('node:assert/strict');
const { parseJob } = require('../src/loader/JobLoader');
const ExecuteCommandTask = require('../src/tasks/ExecuteCommandTask');

const valid = {
  job_id: 'report-001',
  description: 'Generate the daily sales report.',
  schedule: '0 * * 1 *',
  task: { type: 'execute_command', command: 'echo hi' },
};

test('parses a valid job', () => {
  const job = parseJob(valid, { sourceFile: '/x/daily-report.json' });
  assert.equal(job.id, 'report-001');
  assert.equal(job.taskType, 'execute_command');
  assert.ok(job.task instanceof ExecuteCommandTask);
  assert.equal(job.sourceFile, '/x/daily-report.json');
});

test('rejects invalid jobs', () => {
  assert.throws(() => parseJob({ ...valid, job_id: '' }), /job_id/);
  assert.throws(() => parseJob({ ...valid, task: { type: 'unknown' } }), /unknown task type/);
  assert.throws(() => parseJob({ ...valid, task: { type: 'execute_command' } }), /command/);
  assert.throws(() => parseJob({ ...valid, schedule: 'bad' }), /schedule/);
  assert.throws(() => parseJob([]), /JSON object/);
});

test('execute_command reports SUCCESS and FAILURE by exit code', async () => {
  const ok = await ExecuteCommandTask.fromConfig({ command: 'echo hello' }).execute();
  assert.equal(ok.status, 'SUCCESS');
  assert.equal(ok.details.stdout, 'hello');

  const fail = await ExecuteCommandTask.fromConfig({ command: 'exit 3' }).execute();
  assert.equal(fail.status, 'FAILURE');
  assert.equal(fail.details.exitCode, 3);
});

test('execute_command fails on timeout and kills child processes', async () => {
  const marker = `jobsched-timeout-${process.pid}`;
  const res = await ExecuteCommandTask.fromConfig({
    command: `sleep 30 & echo ${marker} > /dev/null; sleep 5`,
    timeout_ms: 200,
  }).execute();
  assert.equal(res.status, 'FAILURE');
  assert.equal(res.details.timedOut, true);

  // The background "sleep 30" must be gone too.
  const { execSync } = require('node:child_process');
  const survivors = execSync('ps -eo pgid=,args=').toString().split('\n').filter((l) => l.includes('sleep 30'));
  assert.deepEqual(survivors.filter((l) => !l.includes('grep')), []);
});

test('execute_command runs in the configured cwd', async () => {
  const res = await ExecuteCommandTask.fromConfig({ command: 'pwd', cwd: '/tmp' }).execute();
  assert.equal(res.details.stdout, '/tmp');
});
