// Base class. A schedule answers one question: when is the next run after `after`?
class Schedule {
  /** @returns {Date|null} next run strictly after `after`, or null if none. */
  nextRun(after) { // eslint-disable-line no-unused-vars
    throw new Error('nextRun() not implemented');
  }

  toString() {
    return this.constructor.name;
  }
}

module.exports = Schedule;
