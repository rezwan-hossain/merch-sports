// lib/notification-log.ts
//
// Delivery log: every confirmation email/SMS attempt is recorded against its
// order (in the audit log, action "notification.<channel>_<status>"), so an
// admin can answer "did they get it?" per order. Never throws.
//
// ⚠️ Not a "use server" file — called only from trusted server code.

import { audit, SYSTEM } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export type DeliveryChannel = "email" | "sms";
export type DeliveryStatus = "sent" | "failed" | "skipped";

export async function recordDelivery(entry: {
  orderId: string;
  eventId?: string | null;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  to: string | null;
  /** Why it failed or was skipped. */
  reason?: string | null;
  /** Provider reference (Resend message id) or raw gateway reply. */
  providerRef?: string | null;
  /** The SMS text that was sent (emails are too long to store). */
  message?: string | null;
  /** Extra context, e.g. "resent by admin@…". */
  note?: string | null;
}): Promise<void> {
  const label = entry.channel === "email" ? "Email" : "SMS";
  const verb =
    entry.status === "sent" ? "sent to" : entry.status === "failed" ? "FAILED to" : "not sent to";
  const to = entry.to ?? "no address";

  await audit({
    actor: SYSTEM.notifier,
    action: `notification.${entry.channel}_${entry.status}`,
    entityType: "order",
    entityId: entry.orderId,
    eventId: entry.eventId ?? null,
    summary: `Confirmation ${label} ${verb} ${to}${entry.reason ? ` — ${entry.reason}` : ""}${entry.note ? ` · ${entry.note}` : ""}`,
    changes: {
      channel: [null, entry.channel],
      status: [null, entry.status],
      to: [null, entry.to],
      ...(entry.reason ? { reason: [null, entry.reason] } : {}),
      ...(entry.providerRef ? { providerRef: [null, entry.providerRef.slice(0, 300)] } : {}),
      ...(entry.message ? { message: [null, entry.message] } : {}),
    },
  });
}

export type LastSmsDelivery = {
  /** The most recent real SMS attempt (skipped ones don't count). */
  status: "sent" | "failed";
  at: string;
  /** Why it failed — the gateway's reason (no phone number). */
  reason: string | null;
  /** Failed attempts since the last successful SMS. */
  failuresInARow: number;
  /** When an SMS last went through, or null if never (in the log). */
  lastSentAt: string | null;
};

/**
 * Did the last confirmation SMS actually go out? The SMS wallet can show
 * money while every send still fails (e.g. gateway code 1007 "Not Enough
 * Balance in this ssbd Account"), so this looks at real results instead.
 */
export async function getLastSmsDelivery(): Promise<LastSmsDelivery | null> {
  const [latest, lastSent] = await Promise.all([
    prisma.auditLog.findFirst({
      where: { action: { in: ["notification.sms_sent", "notification.sms_failed"] } },
      orderBy: { createdAt: "desc" },
      select: { action: true, createdAt: true, changes: true },
    }),
    prisma.auditLog.findFirst({
      where: { action: "notification.sms_sent" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  if (!latest) return null;

  const failed = latest.action === "notification.sms_failed";
  const changes = (latest.changes ?? {}) as Record<string, [unknown, unknown]>;
  const reason = typeof changes.reason?.[1] === "string" ? (changes.reason[1] as string) : null;

  const failuresInARow = failed
    ? await prisma.auditLog.count({
        where: {
          action: "notification.sms_failed",
          ...(lastSent && { createdAt: { gt: lastSent.createdAt } }),
        },
      })
    : 0;

  return {
    status: failed ? "failed" : "sent",
    at: latest.createdAt.toISOString(),
    reason,
    failuresInARow,
    lastSentAt: lastSent?.createdAt.toISOString() ?? null,
  };
}
