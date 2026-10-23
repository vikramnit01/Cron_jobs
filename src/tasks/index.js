// Registers the built-in task types. Add new types here.
const TaskRegistry = require('./TaskRegistry');

TaskRegistry.register('execute_command', require('./ExecuteCommandTask'));
// TaskRegistry.register('http_request', require('./HttpRequestTask'));

module.exports = TaskRegistry;
