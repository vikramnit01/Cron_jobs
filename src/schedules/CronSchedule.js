const { CronExpressionParser } = require('cron-parser');
const Schedule = require('./Schedule');

// All cron expressions are evaluated in UTC.
class CronSchedule extends Schedule {
  constructor(expression) {
    super();
    this.expression = expression;
    // Parse once to fail fast on invalid input.
    CronExpressionParser.parse(expression, { tz: 'UTC' });
  }

  nextRun(after) {
    const expr = CronExpressionParser.parse(this.expression, { currentDate: after, tz: 'UTC' });
    return expr.next().toDate();
  }

  toString() {
    return `cron "${this.expression}"`;
  }
}

module.exports = CronSchedule;
