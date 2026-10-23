// Starts the real service and changes job files while it runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

async function waitFor(check, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('timed out waiting for condition');
}

function readRuns(logFile) {
  if (!fs.existsSync(logFile)) return [];
  return fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

const jobFile = (command) => JSON.stringify({
  job_id: 'e2e-job',
  schedule: '* * * * * *', // every second
  task: { type: 'execute_command', command },
});

test('add, update and delete a job file while the service runs', { timeout: 30000 }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobsched-e2e-'));
  const jobsDir = path.join(dir, 'jobs');
  const logFile = path.join(dir, 'executions.log');
  const file = path.join(jobsDir, 'e2e.json');
  fs.mkdirSync(jobsDir);

  const service = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js')], {
    env: { ...process.env, JOBS_DIR: jobsDir, EXECUTION_LOG: logFile, FILE_SETTLE_MS: '50' },
    stdio: 'ignore',
  });
  t.after(() => {
    service.kill('SIGTERM');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Add
  fs.writeFileSync(file, jobFile('echo v1'));
  await waitFor(() => readRuns(logFile).some((r) => r.stdout === 'v1' && r.status === 'SUCCESS'));

  // Update
  fs.writeFileSync(file, jobFile('echo v2'));
  await waitFor(() => readRuns(logFile).some((r) => r.stdout === 'v2'));

  // Delete: no new runs after a short settle period
  fs.unlinkSync(file);
  await new Promise((r) => setTimeout(r, 1500));
  const countAfterDelete = readRuns(logFile).length;
  await new Promise((r) => setTimeout(r, 2500));
  assert.equal(readRuns(logFile).length, countAfterDelete);
});
