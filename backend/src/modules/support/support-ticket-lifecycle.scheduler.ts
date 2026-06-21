import { auditLogService } from '../audit-logs/audit-log.service';
import { supportTicketLifecycleService } from './support-ticket-lifecycle.service';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let running = false;

const syncOnce = async () => {
  if (running) return { closedCount: 0 };
  running = true;
  try {
    const result = await supportTicketLifecycleService.closeExpiredResolvedTickets();
    if (result.closedCount > 0) {
      await auditLogService.recordAuditLogBestEffort({
        actorRole: 'system',
        action: 'support_ticket.auto_close',
        targetType: 'SupportTicket',
        targetId: 'support-ticket-lifecycle-scheduler',
        reason: 'Automatic close after reopen window expired',
        after: result,
      });
    }
    return result;
  } catch (error) {
    console.error('Support ticket lifecycle scheduler failed:', error instanceof Error ? error.message : String(error));
    return { closedCount: 0 };
  } finally {
    running = false;
  }
};

const start = () => {
  if (process.env.SUPPORT_TICKET_LIFECYCLE_SCHEDULER === 'false' || timer) return;
  const configured = Number(process.env.SUPPORT_TICKET_LIFECYCLE_INTERVAL_MS);
  const intervalMs = Number.isFinite(configured) && configured >= 60_000 ? configured : DEFAULT_INTERVAL_MS;
  timer = setInterval(() => void syncOnce(), intervalMs);
  timer.unref?.();
  void syncOnce();
  console.log(`Support ticket lifecycle scheduler started with interval ${intervalMs}ms`);
};

const stop = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};

export const supportTicketLifecycleScheduler = { start, stop, syncOnce };
