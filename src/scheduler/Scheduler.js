const MinHeap = require('./MinHeap');

const MAX_TIMEOUT = 2 ** 31 - 1; // setTimeout limit (~24.8 days)

// One timer, armed for the earliest heap entry.
// Heap entries are { runAt, jobId, version }. Add/update push a new entry with a
// new version. Remove only deletes the version. Stale entries are skipped on pop.
class Scheduler {
  constructor({ registry, executor, logger, now = () => Date.now() }) {
    this.registry = registry;
    this.executor = executor;
    this.logger = logger;
    this.now = now;
    this.heap = new MinHeap((a, b) => a.runAt - b.runAt);
    this.jobVersions = new Map(); // jobId → current version
    this.timer = null;
    this.stopped = false;

    registry.on('job:added', (job) => this.#upsert(job, 'added'));
    registry.on('job:updated', (job) => this.#upsert(job, 'updated'));
    registry.on('job:removed', (jobId) => this.#remove(jobId));
  }

  #upsert(job, action) {
    const version = (this.jobVersions.get(job.id) ?? 0) + 1;
    this.jobVersions.set(job.id, version);

    const runAt = job.schedule.nextRun(new Date(this.now()));
    if (!runAt) {
      this.logger.warn('job has no future run, not scheduled', { jobId: job.id, schedule: String(job.schedule) });
      this.#arm();
      return;
    }

    this.heap.push({ runAt: runAt.getTime(), jobId: job.id, version });
    this.logger.info(`job ${action}`, { jobId: job.id, schedule: String(job.schedule), nextRun: runAt.toISOString() });
    this.#arm();
  }

  #remove(jobId) {
    this.jobVersions.delete(jobId); // its heap entries are now stale
    this.logger.info('job removed', { jobId });
    this.#arm();
  }

  #isLive(entry) {
    return this.jobVersions.get(entry.jobId) === entry.version;
  }

  #arm() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.stopped) return;

    while (this.heap.size() > 0 && !this.#isLive(this.heap.peek())) this.heap.pop();
    const top = this.heap.peek();
    if (!top) return;

    const delay = Math.min(Math.max(top.runAt - this.now(), 0), MAX_TIMEOUT);
    this.timer = setTimeout(() => this.#tick(), delay);
  }

  #tick() {
    const now = this.now();
    while (this.heap.size() > 0 && this.heap.peek().runAt <= now) {
      const entry = this.heap.pop();
      if (!this.#isLive(entry)) continue;

      const job = this.registry.get(entry.jobId);
      this.executor.submit(job, new Date(entry.runAt));

      // Compute from max(runAt, now) so missed runs are skipped, not replayed.
      const next = job.schedule.nextRun(new Date(Math.max(entry.runAt, now)));
      if (next) {
        this.heap.push({ runAt: next.getTime(), jobId: job.id, version: entry.version });
      } else {
        this.jobVersions.delete(job.id); // one-time job is done
      }
    }
    this.#arm();
  }

  /** Earliest live entry, for status and tests. */
  peekNext() {
    const live = this.heap.items.filter((e) => this.#isLive(e));
    return live.sort((a, b) => a.runAt - b.runAt)[0] ?? null;
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = null;
  }
}

module.exports = Scheduler;
