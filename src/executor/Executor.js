const { randomUUID } = require('node:crypto');

// Runs jobs with a global concurrency limit.
// A job is skipped if its previous run is still active (no overlap per job).
class Executor {
  constructor({ executionLogger, logger, maxConcurrency = 10 }) {
    this.executionLogger = executionLogger;
    this.logger = logger;
    this.maxConcurrency = maxConcurrency;
    this.runningJobs = new Set();  // jobIds with an active run
    this.active = new Set();       // promises of active runs
    this.queue = [];               // waiting for a free slot
    this.accepting = true;
  }

  submit(job, scheduledFor = new Date()) {
    if (!this.accepting) return;
    if (this.runningJobs.has(job.id) || this.queue.some((q) => q.job.id === job.id)) {
      this.logger.warn('previous run still active, run skipped', { jobId: job.id });
      return;
    }
    this.queue.push({ job, scheduledFor });
    this.#drain();
  }

  #drain() {
    while (this.queue.length > 0 && this.active.size < this.maxConcurrency) {
      const { job, scheduledFor } = this.queue.shift();
      const run = this.#run(job, scheduledFor).finally(() => {
        this.active.delete(run);
        this.runningJobs.delete(job.id);
        this.#drain();
      });
      this.runningJobs.add(job.id);
      this.active.add(run);
    }
  }

  async #run(job, scheduledFor) {
    const runId = randomUUID();
    const startedAt = new Date();
    let result;
    try {
      result = await job.task.execute({ jobId: job.id, runId });
    } catch (err) {
      result = { status: 'FAILURE', details: { error: err.message } };
    }
    const finishedAt = new Date();

    this.executionLogger.log({
      job_id: job.id,
      run_id: runId,
      task_type: job.taskType,
      scheduled_for: scheduledFor.toISOString(),
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt - startedAt,
      status: result.status,
      ...result.details,
    });
  }

  /** Stop accepting work and wait for active runs, up to timeoutMs. */
  async shutdown(timeoutMs) {
    this.accepting = false;
    this.queue = [];
    if (this.active.size === 0) return true;
    let timer;
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); });
    const done = Promise.allSettled([...this.active]).then(() => true);
    const finished = await Promise.race([done, timeout]);
    clearTimeout(timer);
    return finished;
  }
}

module.exports = Executor;
