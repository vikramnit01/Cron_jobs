const { EventEmitter } = require('node:events');

// Source of truth for loaded jobs. Emits:
//   'job:added'   (job)
//   'job:updated' (job)
//   'job:removed' (jobId)
class JobRegistry extends EventEmitter {
  #jobs = new Map();       // jobId → job
  #fileToJob = new Map();  // filePath → jobId

  upsert(filePath, job) {
    const owner = this.#jobs.get(job.id)?.sourceFile;
    if (owner && owner !== filePath) {
      throw new Error(`duplicate job_id "${job.id}", already defined in ${owner}`);
    }

    // The file now defines a different job_id: drop the old job first.
    const previousId = this.#fileToJob.get(filePath);
    if (previousId && previousId !== job.id) this.removeByFile(filePath);

    const existed = this.#jobs.has(job.id);
    this.#jobs.set(job.id, job);
    this.#fileToJob.set(filePath, job.id);
    this.emit(existed ? 'job:updated' : 'job:added', job);
  }

  removeByFile(filePath) {
    const jobId = this.#fileToJob.get(filePath);
    if (!jobId) return null;
    this.#fileToJob.delete(filePath);
    this.#jobs.delete(jobId);
    this.emit('job:removed', jobId);
    return jobId;
  }

  get(jobId) {
    return this.#jobs.get(jobId);
  }

  size() {
    return this.#jobs.size;
  }
}

module.exports = JobRegistry;
