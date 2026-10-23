const { spawn } = require('node:child_process');
const Task = require('./Task');

const MAX_OUTPUT = 4096; // keep the last 4 KB of stdout/stderr for the log

class ExecuteCommandTask extends Task {
  constructor({ command, timeoutMs, cwd }) {
    super();
    this.command = command;
    this.timeoutMs = timeoutMs;
    this.cwd = cwd;
  }

  static fromConfig(config, defaults = {}) {
    if (typeof config.command !== 'string' || config.command.trim() === '') {
      throw new Error('execute_command: "command" must be a non-empty string');
    }
    const timeoutMs = config.timeout_ms ?? defaults.timeoutMs;
    if (timeoutMs !== undefined && (!Number.isInteger(timeoutMs) || timeoutMs <= 0)) {
      throw new Error('execute_command: "timeout_ms" must be a positive integer');
    }
    const cwd = config.cwd ?? defaults.cwd;
    if (cwd !== undefined && typeof cwd !== 'string') {
      throw new Error('execute_command: "cwd" must be a string');
    }
    return new ExecuteCommandTask({ command: config.command, timeoutMs, cwd });
  }

  execute() {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let timer = null;
      const keepTail = (buf, chunk) => (buf + chunk).slice(-MAX_OUTPUT);

      // detached: the command gets its own process group, so a timeout
      // kills the shell and every process it started.
      const child = spawn(this.command, { shell: true, cwd: this.cwd, detached: true });
      child.stdout.on('data', (c) => { stdout = keepTail(stdout, c); });
      child.stderr.on('data', (c) => { stderr = keepTail(stderr, c); });

      if (this.timeoutMs) {
        timer = setTimeout(() => {
          timedOut = true;
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            // group already exited
          }
        }, this.timeoutMs);
      }

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ status: 'FAILURE', details: { error: err.message } });
      });
      child.on('close', (exitCode, signal) => {
        clearTimeout(timer);
        resolve({
          status: exitCode === 0 && !timedOut ? 'SUCCESS' : 'FAILURE',
          details: { exitCode, signal, timedOut, stdout: stdout.trim(), stderr: stderr.trim() },
        });
      });
    });
  }
}

module.exports = ExecuteCommandTask;
