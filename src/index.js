const fs = require('node:fs');
const config = require('./config');
const logger = require('./logging/logger');
const ExecutionLogger = require('./logging/ExecutionLogger');
const JobRegistry = require('./registry/JobRegistry');
const Scheduler = require('./scheduler/Scheduler');
const Executor = require('./executor/Executor');
const DirectoryWatcher = require('./watcher/DirectoryWatcher');
const { loadJobFile } = require('./loader/JobLoader');

function main() {
  fs.mkdirSync(config.jobsDir, { recursive: true });

  const executionLogger = new ExecutionLogger(config.executionLogFile);
  const registry = new JobRegistry();
  const executor = new Executor({ executionLogger, logger, maxConcurrency: config.maxConcurrency });
  const scheduler = new Scheduler({ registry, executor, logger });
  const watcher = new DirectoryWatcher(config.jobsDir, { settleMs: config.fileSettleMs });

  // Per-file event counter. A slow load is dropped if a newer event arrived for that file.
  const fileSeq = new Map();
  const nextSeq = (filePath) => {
    const seq = (fileSeq.get(filePath) ?? 0) + 1;
    fileSeq.set(filePath, seq);
    return seq;
  };

  // File added or changed: parse and upsert. On error, keep the previous version.
  watcher.on('upsert', async (filePath) => {
    const seq = nextSeq(filePath);
    try {
      const job = await loadJobFile(filePath, {
        taskDefaults: { timeoutMs: config.defaultTimeoutMs, cwd: config.commandCwd },
      });
      if (fileSeq.get(filePath) !== seq) return;
      registry.upsert(filePath, job);
    } catch (err) {
      if (fileSeq.get(filePath) !== seq) return;
      logger.error('failed to load job file', { file: filePath, error: err.message });
    }
  });
  watcher.on('remove', (filePath) => {
    nextSeq(filePath);
    registry.removeByFile(filePath);
  });
  watcher.on('ready', () => logger.info('initial scan complete', { jobsDir: config.jobsDir }));
  watcher.on('error', (err) => logger.error('watcher error', { error: err.message }));

  watcher.start();
  logger.info('scheduler started', { jobsDir: config.jobsDir, executionLog: config.executionLogFile });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutting down', { signal });
    await watcher.stop();
    scheduler.stop();
    const clean = await executor.shutdown(config.shutdownTimeoutMs);
    if (!clean) logger.warn('shutdown timeout, some runs did not finish');
    await executionLogger.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
