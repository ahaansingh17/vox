# @vox-ai-app/scheduler

Cron-based job scheduler for Vox — schedule recurring agent runs, heartbeats, and timed tasks with timezone support.

## Install

```sh
npm install @vox-ai-app/scheduler
```

## Exports

| Export                       | Contents                              |
| ---------------------------- | ------------------------------------- |
| `@vox-ai-app/scheduler`      | All scheduler exports                 |
| `@vox-ai-app/scheduler/cron` | Job scheduling, cancellation, listing |

## Usage

```js
import { scheduleJob, cancelJob, listJobs, computeNextRun } from '@vox-ai-app/scheduler'

const job = scheduleJob(
  'daily-check',
  { expr: '0 9 * * *', tz: 'America/New_York' },
  (id, meta) => {
    console.log(`Job ${id} fired at ${meta.firedAt}`)
  }
)

console.log(listJobs())
cancelJob('daily-check')
```

Schedule persistence is handled by the app layer via `@vox-ai-app/storage/schedules`.

## API

### Cron

| Function         | Description                                     |
| ---------------- | ----------------------------------------------- |
| `scheduleJob`    | Schedule a cron job with handler callback       |
| `cancelJob`      | Cancel a job by ID                              |
| `cancelAllJobs`  | Cancel all running jobs                         |
| `getJob`         | Get job details by ID                           |
| `listJobs`       | List all active jobs with next run times        |
| `computeNextRun` | Compute the next run time for a cron expression |

`scheduleJob` options:

```js
scheduleJob(
  id,
  {
    expr: '0 9 * * 1-5',
    tz: 'America/New_York',
    runImmediately: false,
    onError: (err) => {}
  },
  handler
)
```

## Dependencies

- [croner](https://github.com/hexagon/croner) ^9.0.0

## License

MIT
