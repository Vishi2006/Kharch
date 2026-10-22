import Dexie from 'dexie';

export const db = new Dexie('KharchDB');

// Define database schema
db.version(1).stores({
  paymentAttempts: 'paymentAttemptId, status, initiatedAt', // Primary key and indexed props
  // Phase 5 will add transactions, spaces, pendingSync, notificationEvents
});
