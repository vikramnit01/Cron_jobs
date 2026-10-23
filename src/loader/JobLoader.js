const fs = require('node:fs/promises');
const { createSchedule } = require('../schedules/ScheduleFactory');
const TaskRegistry = require('../tasks');

// Turns a parsed job definition into a Job object. Throws on invalid input.
function parseJob(definition, { sourceFile, taskDefaults } = {}) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    throw new Error('job definition must be a JSON object');
  }
  const { job_id: id, description = '', schedule, task } = definition;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error('"job_id" must be a non-empty string');
  }
  if (typeof description !== 'string') throw new Error('"description" must be a string');

  return {
    id,
    description,
    schedule: createSchedule(schedule),
    task: TaskRegistry.create(task, taskDefaults),
    taskType: task.type,
    sourceFile,
  };
}

async function loadJobFile(filePath, options = {}) {
  const text = await fs.readFile(filePath, 'utf8');
  let definition;
  try {
    definition = JSON.parse(text);
  } catch (err) {
    throw new Error(`invalid JSON: ${err.message}`);
  }
  return parseJob(definition, { ...options, sourceFile: filePath });
}

module.exports = { parseJob, loadJobFile };
