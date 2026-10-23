const { EventEmitter } = require('node:events');
const { watch } = require('chokidar');

// Watches a directory for *.json files. Emits:
//   'upsert' (filePath)  file added or changed
//   'remove' (filePath)  file deleted
//   'ready'  ()          initial scan finished
class DirectoryWatcher extends EventEmitter {
  constructor(dir, { settleMs = 300 } = {}) {
    super();
    this.dir = dir;
    this.settleMs = settleMs;
    this.watcher = null;
  }

  start() {
    this.watcher = watch(this.dir, {
      depth: 0,
      ignoreInitial: false, // existing files are reported as 'add' on startup
      ignored: (p, stats) => stats?.isFile() && !p.endsWith('.json'),
      // Wait until the file stops changing, so half-written files are not parsed.
      awaitWriteFinish: { stabilityThreshold: this.settleMs, pollInterval: 50 },
    });

    this.watcher
      .on('add', (p) => this.emit('upsert', p))
      .on('change', (p) => this.emit('upsert', p))
      .on('unlink', (p) => this.emit('remove', p))
      .on('ready', () => this.emit('ready'))
      .on('error', (err) => this.emit('error', err));
  }

  async stop() {
    if (this.watcher) await this.watcher.close();
  }
}

module.exports = DirectoryWatcher;
