const Schedule = require('./Schedule');

class OneTimeSchedule extends Schedule {
  constructor(runAt) {
    super();
    this.runAt = runAt;
  }

  nextRun(after) {
    return this.runAt.getTime() > after.getTime() ? this.runAt : null;
  }

  toString() {
    return `once at ${this.runAt.toISOString()}`;
  }
}

module.exports = OneTimeSchedule;
