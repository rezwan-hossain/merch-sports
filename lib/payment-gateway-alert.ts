// lib/payment-gateway-alert.ts
//
// When a payment can't even start (ShurjoPay refuses our login, returns no
// checkout link, or can't be reached), record it in the audit log in plain
// words — what the code means and WHO to contact — so an admin knows at once
// whether to call ShurjoPay or the developer.
//
// ⚠️ Not a "use server" file — called only from trusted server code.

import { prisma } from "@/lib/prisma";
import { audit, SYSTEM } from "@/lib/audit";

export const GATEWAY_ERROR_ACTION = "payment.gateway_error";

/** Repeats of the same problem within this window aren't logged again. */
const DEDUPE_MS = 30 * 60 * 1000;

export type GatewayStage =
  | "login" // get_token refused
  | "create_payment" // no checkout_url
  | "unreachable" // network / timeout / HTTP error
  | "config"; // our own setup would make payments unconfirmable

export type Contact = "ShurjoPay support" | "Developer";

export type GatewayAdvice = {
  meaning: string;
  contact: Contact;
  fix: string;
};

// Codes seen from this store's ShurjoPay responses. Anything else falls back
// to "contact ShurjoPay support with the code".
const SP_CODE_ADVICE: Record<number, GatewayAdvice> = {
  1064: {
    meaning: "ShurjoPay says the username or password is wrong",
    contact: "Developer",
    fix: "Check SHURJOPAY_USERNAME / SHURJOPAY_PASSWORD in the server .env (values with # or $ must be in double quotes), then run npm run check:services. If they're correct, ask ShurjoPay whether the password was changed.",
  },
  1069: {
    meaning: "Your ShurjoPay merchant account (store user) is deactivated",
    contact: "ShurjoPay support",
    fix: "Ask ShurjoPay to reactivate the store user and tell you why it was deactivated. Nothing on the website can fix this.",
  },
};

const STAGE_LABEL: Record<GatewayStage, string> = {
  login: "ShurjoPay login failed",
  create_payment: "ShurjoPay didn't return a payment page",
  unreachable: "Can't reach ShurjoPay",
  config: "Payment setup problem",
};

export function explainGatewayFailure(
  stage: GatewayStage,
  spCode: number | null,
): GatewayAdvice {
  if (spCode !== null && SP_CODE_ADVICE[spCode]) return SP_CODE_ADVICE[spCode];
  switch (stage) {
    case "unreachable":
      return {
        meaning: "The server couldn't connect to ShurjoPay (network, DNS, firewall, or ShurjoPay is down)",
        contact: "Developer",
        fix: "Run npm run check:services on the server. If the server's internet is fine, ShurjoPay may be down — ask ShurjoPay support.",
      };
    case "config":
      return {
        meaning: "The payment settings on the server would make payments impossible to confirm",
        contact: "Developer",
        fix: "Fix the payment settings in the server .env (see the message), then restart the app.",
      };
    default:
      return {
        meaning: "ShurjoPay refused the request",
        contact: "ShurjoPay support",
        fix: "Send ShurjoPay the code and message above and ask what it means for your store.",
      };
  }
}

/**
 * Write a "payment can't start" entry to the audit log. Never throws.
 * The same stage + code is logged at most once per 30 minutes.
 */
export async function reportGatewayFailure(args: {
  stage: GatewayStage;
  spCode?: string | number | null;
  message?: string | null;
  orderId: string;
  eventId?: string | null;
}): Promise<void> {
  try {
    const code = Number(args.spCode);
    const spCode = Number.isFinite(code) && args.spCode !== "" && args.spCode != null ? code : null;
    const message = (args.message ?? "").trim().slice(0, 120) || null;
    const advice = explainGatewayFailure(args.stage, spCode);

    const head = `${STAGE_LABEL[args.stage]}${spCode !== null ? ` · sp_code ${spCode}` : ""}`;

    const recent = await prisma.auditLog.findFirst({
      where: {
        action: GATEWAY_ERROR_ACTION,
        summary: { startsWith: head },
        createdAt: { gte: new Date(Date.now() - DEDUPE_MS) },
      },
      select: { id: true },
    });
    if (recent) return;

    await audit({
      actor: SYSTEM.shurjopay,
      action: GATEWAY_ERROR_ACTION,
      entityType: "payment",
      entityId: args.orderId,
      eventId: args.eventId ?? null,
      summary: `${head}${message ? ` "${message}"` : ""} — ${advice.meaning}. Contact: ${advice.contact}. ${advice.fix} Runners can't pay until this is fixed.`,
      changes: {
        stage: [null, args.stage],
        sp_code: [null, spCode],
        contact: [null, advice.contact],
      },
    });
  } catch {
    // audit() already never throws; this guards the dedupe query.
  }
}

export type GatewayAlert = {
  at: string;
  stage: GatewayStage;
  spCode: number | null;
  summary: string;
} & GatewayAdvice;

/**
 * The latest gateway failure, if payments still look broken: logged in the
 * last 6 hours and no ShurjoPay session has started successfully since.
 */
export async function getActiveGatewayAlert(): Promise<GatewayAlert | null> {
  const latest = await prisma.auditLog.findFirst({
    where: {
      action: GATEWAY_ERROR_ACTION,
      createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, summary: true, changes: true },
  });
  if (!latest) return null;

  // A payment session started after the failure → gateway works again.
  const recovered = await prisma.payment.findFirst({
    where: { paymentId: { not: null }, updatedAt: { gt: latest.createdAt } },
    select: { id: true },
  });
  if (recovered) return null;

  const ch = (latest.changes ?? {}) as Record<string, [unknown, unknown]>;
  const stage = (ch.stage?.[1] as GatewayStage) ?? "login";
  const spCode = typeof ch.sp_code?.[1] === "number" ? (ch.sp_code[1] as number) : null;

  return {
    at: latest.createdAt.toISOString(),
    stage,
    spCode,
    summary: latest.summary,
    ...explainGatewayFailure(stage, spCode),
  };
}
