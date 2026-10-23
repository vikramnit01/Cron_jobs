const path = require('node:path');

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

module.exports = {
  jobsDir: path.resolve(process.env.JOBS_DIR || './jobs.d'),
  executionLogFile: path.resolve(process.env.EXECUTION_LOG || './logs/executions.log'),
  // Working directory for commands. Relative paths in job commands resolve from here.
  commandCwd: path.resolve(process.env.COMMAND_CWD || '.'),
  maxConcurrency: int(process.env.MAX_CONCURRENCY, 10),
  defaultTimeoutMs: int(process.env.DEFAULT_TIMEOUT_MS, 5 * 60 * 1000),
  shutdownTimeoutMs: int(process.env.SHUTDOWN_TIMEOUT_MS, 30 * 1000),
  fileSettleMs: int(process.env.FILE_SETTLE_MS, 300),
};
