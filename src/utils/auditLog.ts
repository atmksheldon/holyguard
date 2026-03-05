import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { logger } from './logger';

interface AuditLogEntry {
  action: string;
  performedBy: string;
  targetId: string;
  targetType: string;
  details?: string;
  metadata?: Record<string, any>;
}

/**
 * Write an immutable audit log entry to the admin_logs collection.
 * Fails silently to avoid blocking the primary action.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await addDoc(collection(db, 'admin_logs'), {
      ...entry,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    logger.warn('[AuditLog] Failed to write audit log:', error);
  }
}
