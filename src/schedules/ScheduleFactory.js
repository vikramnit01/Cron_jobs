const OneTimeSchedule = require('./OneTimeSchedule');
const CronSchedule = require('./CronSchedule');

// ISO 8601 date-time with an explicit offset, e.g. 2025-10-26T15:00:00Z.
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

function createSchedule(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('"schedule" must be a non-empty string');
  }
  const text = value.trim();

  if (ISO_8601.test(text)) {
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) throw new Error(`invalid ISO 8601 timestamp: ${text}`);
    return new OneTimeSchedule(date);
  }

  try {
    return new CronSchedule(text);
  } catch (err) {
    throw new Error(`schedule is neither ISO 8601 nor a valid cron string: ${text} (${err.message})`);
  }
}

module.exports = { createSchedule };
