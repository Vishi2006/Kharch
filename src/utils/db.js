import Dexie from 'dexie';

export const db = new Dexie('KharchDB');

// Define database schema
db.version(2).stores({
  paymentAttempts: 'paymentAttemptId, status, initiatedAt',
  transactions: '_id, spaceId, type, date, createdAt',
  spaces: '_id, name, isDefault',
  dashboardCache: 'spaceId, updatedAt',
  notificationEvents: '_id, idempotencyKey, status, timestamp',
  pendingSync: '++id, endpoint, method, timestamp, retryCount',
});

// Upgrade to v3: Add merchantMappings store for VPA auto-memory
db.version(3).stores({
  paymentAttempts: 'paymentAttemptId, status, initiatedAt',
  transactions: '_id, spaceId, type, date, createdAt',
  spaces: '_id, name, isDefault',
  dashboardCache: 'spaceId, updatedAt',
  notificationEvents: '_id, idempotencyKey, status, timestamp',
  pendingSync: '++id, endpoint, method, timestamp, retryCount',
  merchantMappings: '++id, identifierKey, canonicalTitle, spaceId, lastUsedAt',
});

// Helper: Cache spaces
export async function cacheSpaces(spaces) {
  try {
    await db.spaces.clear();
    await db.spaces.bulkPut(spaces);
  } catch (err) {
    console.error('Dexie cacheSpaces error:', err);
  }
}

// Helper: Get cached spaces
export async function getCachedSpaces() {
  try {
    return await db.spaces.toArray();
  } catch (err) {
    console.error('Dexie getCachedSpaces error:', err);
    return [];
  }
}

// Helper: Cache dashboard data for a space
export async function cacheDashboard(spaceId, data) {
  try {
    await db.dashboardCache.put({
      spaceId: String(spaceId),
      data,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error('Dexie cacheDashboard error:', err);
  }
}

// Helper: Get cached dashboard data
export async function getCachedDashboard(spaceId) {
  try {
    const record = await db.dashboardCache.get(String(spaceId));
    return record ? record.data : null;
  } catch (err) {
    console.error('Dexie getCachedDashboard error:', err);
    return null;
  }
}

// Helper: Enqueue an offline sync job
export async function enqueueSync(endpoint, method = 'POST', body = null) {
  try {
    return await db.pendingSync.add({
      endpoint,
      method,
      body: typeof body === 'object' && body !== null ? JSON.stringify(body) : body,
      timestamp: Date.now(),
      retryCount: 0,
    });
  } catch (err) {
    console.error('Dexie enqueueSync error:', err);
  }
}

// Helper: Get pending sync jobs (FIFO)
export async function getPendingSyncJobs() {
  try {
    return await db.pendingSync.orderBy('id').toArray();
  } catch (err) {
    console.error('Dexie getPendingSyncJobs error:', err);
    return [];
  }
}

// Helper: Remove synced job
export async function removeSyncJob(id) {
  try {
    await db.pendingSync.delete(id);
  } catch (err) {
    console.error('Dexie removeSyncJob error:', err);
  }
}
