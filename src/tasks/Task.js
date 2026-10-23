// Base class for all task types. To add a new type:
//   1. Extend Task and implement fromConfig() and execute().
//   2. Register it in tasks/index.js.
class Task {
  /** Build a task from the "task" object in the job file. Throw on invalid config. */
  static fromConfig(config) { // eslint-disable-line no-unused-vars
    throw new Error('fromConfig() not implemented');
  }

  /**
   * Run the task once.
   * @param {{ jobId: string, runId: string }} ctx
   * @returns {Promise<{ status: 'SUCCESS'|'FAILURE', details?: object }>}
   */
  async execute(ctx) { // eslint-disable-line no-unused-vars
    throw new Error('execute() not implemented');
  }
}

module.exports = Task;
