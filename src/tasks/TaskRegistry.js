// Maps a task "type" string to its Task class.
const types = new Map();

function register(type, TaskClass) {
  if (types.has(type)) throw new Error(`task type already registered: ${type}`);
  types.set(type, TaskClass);
}

function create(config, defaults = {}) {
  if (!config || typeof config !== 'object') throw new Error('"task" must be an object');
  const TaskClass = types.get(config.type);
  if (!TaskClass) throw new Error(`unknown task type: ${config.type}`);
  return TaskClass.fromConfig(config, defaults);
}

module.exports = { register, create, types: () => [...types.keys()] };
