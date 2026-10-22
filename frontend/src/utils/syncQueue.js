import { getPendingSyncJobs, removeSyncJob, db } from './db';

let isFlushing = false;

/**
 * Flush pending offline mutations in FIFO order
 */
export async function flushPendingSyncQueue(apiFetch) {
  if (isFlushing) return { inProgress: true };
  isFlushing = true;

  try {
    const jobs = await getPendingSyncJobs();
    if (jobs.length === 0) {
      isFlushing = false;
      return { flushedCount: 0, remainingCount: 0 };
    }

    let flushedCount = 0;

    for (const job of jobs) {
      try {
        const options = {
          method: job.method || 'POST',
        };

        if (job.body) {
          options.body = typeof job.body === 'string' ? job.body : JSON.stringify(job.body);
        }

        const res = await apiFetch(job.endpoint, options);

        if (res && !res.error) {
          await removeSyncJob(job.id);
          flushedCount++;
        } else if (res && res.status >= 400 && res.status < 500) {
          // Client error — remove to prevent poison pill
          console.warn(`Removing invalid offline sync job [${job.endpoint}]:`, res);
          await removeSyncJob(job.id);
        } else {
          // Network error or server 502/503 — increment retry
          const current = await db.pendingSync.get(job.id);
          if (current) {
            if (current.retryCount >= 5) {
              await removeSyncJob(job.id);
            } else {
              await db.pendingSync.update(job.id, { retryCount: current.retryCount + 1 });
            }
          }
          break; // Stop flushing until backend is stable
        }
      } catch (err) {
        console.error('Error executing offline sync job:', err);
        break;
      }
    }

    const remaining = await getPendingSyncJobs();
    isFlushing = false;
    return { flushedCount, remainingCount: remaining.length };
  } catch (err) {
    console.error('Failed to flush sync queue:', err);
    isFlushing = false;
    return { error: err.message };
  }
}
