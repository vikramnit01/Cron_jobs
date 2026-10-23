const fs = require('node:fs');
const path = require('node:path');

// Writes one JSON line per job execution to a file and to stdout.
class ExecutionLogger {
  constructor(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.stream = fs.createWriteStream(filePath, { flags: 'a' });
    // A disk error must not crash the scheduler. Lines still go to stdout.
    this.stream.on('error', (err) => {
      process.stderr.write(JSON.stringify({ level: 'error', msg: 'execution log write failed', error: err.message }) + '\n');
    });
  }

  log(record) {
    const line = JSON.stringify({ type: 'execution', ...record }) + '\n';
    this.stream.write(line);
    process.stdout.write(line);
  }

  close() {
    return new Promise((resolve) => this.stream.end(resolve));
  }
}

module.exports = ExecutionLogger;
