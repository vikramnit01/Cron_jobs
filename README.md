# Job Scheduler

In-memory job scheduler. It watches a folder of JSON job files and runs each job on its schedule.

## Run

```
npm install
npm start                 # watches ./jobs.d
JOBS_DIR=/etc/chronoflow/jobs.d npm start
npm test
```

| Variable | Default | Use |
|---|---|---|
| `JOBS_DIR` | `./jobs.d` | Folder with job files |
| `EXECUTION_LOG` | `./logs/executions.log` | One JSON line per run |
| `COMMAND_CWD` | current folder | Working folder for commands |
| `MAX_CONCURRENCY` | `10` | Max runs at the same time |
| `DEFAULT_TIMEOUT_MS` | `300000` | Command timeout |
| `SHUTDOWN_TIMEOUT_MS` | `30000` | Wait for running jobs on SIGTERM |
| `FILE_SETTLE_MS` | `300` | Wait for a file to stop changing |

## Job file

```json
{
  "job_id": "report-001",
  "description": "Generate the daily sales report.",
  "schedule": "0 * * 1 *",
  "task": { "type": "execute_command", "command": "echo hi", "timeout_ms": 60000, "cwd": "/opt/app" }
}
```

`schedule` is an ISO 8601 timestamp with offset (one-time) or a cron string (recurring, UTC, optional seconds field).
`timeout_ms` and `cwd` are optional.

## Flow

1. The watcher reports each `*.json` file as added, changed or removed.
2. The loader parses the file. The registry stores the job and emits `job:added`, `job:updated` or `job:removed`.
3. The scheduler keeps **one min-heap for all jobs** and **one `setTimeout`** for the earliest entry.
4. When the timer fires, every due job goes to the executor. Cron jobs are pushed back with their next time.
5. The executor runs tasks in parallel and writes one log line per run.

Remove and update use versions: each heap entry holds `{ runAt, jobId, version }`. An entry whose version is no longer current is skipped.

## Add a task type

1. Create `src/tasks/HttpRequestTask.js` that extends `Task` and implements `fromConfig()` and `execute()`.
2. Register it in `src/tasks/index.js`.

No scheduler change is needed.

## Example jobs

| File | Job | Schedule | Command |
|---|---|---|---|
| `jobs.d/daily-report.json` | `report-001` | `0 2 * * *` (daily, 02:00 UTC) | `scripts/generate_sales_report.js`: writes a JSON report to `data/reports/` |
| `jobs.d/onetime-cleanup.json` | `cleanup-xyz` | `2026-12-31T02:00:00Z` (once) | `scripts/cleanup_stale_data.js`: deletes everything in `data/stale-data/` |

The report uses simulated sales data. Commands use paths relative to `COMMAND_CWD`, so start the service from the project folder or set `COMMAND_CWD`.

## Behaviour

- Missed runs are skipped. After a pause, a cron job runs once and continues from the current time.
- A run is skipped if the previous run of the same job is still active.
- A command that passes its timeout is killed with all its child processes and logged as `FAILURE`.
- An invalid file is logged and ignored. If a valid job file becomes invalid, the previous version keeps running.
- A one-time timestamp in the past is not scheduled.
- Run one instance only. Two instances run every job twice.

## Security

Job files run shell commands as the service user. Only trusted users may write to the jobs folder.
