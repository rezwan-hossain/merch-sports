// lib/payment-verify.ts
//
// Asks ShurjoPay what happened to a payment session, robustly:
//   - retries a failed or empty answer (ShurjoPay can take a moment to settle
//     right after the customer pays),
//   - caps each attempt so a slow gateway can't hold the customer's redirect,
//   - picks the SUCCESS entry when the answer has several (never blindly [0]).
//
// The answer is one of three states, and only the first two are final:
//   PAID      — ShurjoPay has a successful payment (sp_code 1000)
//   NOT_PAID  — ShurjoPay says cancelled (1002) or declined (1001)
//   UNSURE    — error, empty answer, or any other code: do NOT treat as failed
//
// ⚠️ Not a "use server" file — called only from trusted server code.

import {
  verifyShurjoPayPayment,
  SP_CODE,
  type ShurjoPayVerificationItem,
} from "@/lib/shurjopay";

export type VerifyResult =
  | { state: "PAID"; item: ShurjoPayVerificationItem }
  | { state: "NOT_PAID"; item: ShurjoPayVerificationItem; code: number }
  | {
      state: "UNSURE";
      reason: "error" | "empty" | "unknown_code";
      item?: ShurjoPayVerificationItem;
      code?: number;
    };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`verify timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function classify(items: ShurjoPayVerificationItem[]): VerifyResult {
  if (items.length === 0) return { state: "UNSURE", reason: "empty" };

  const paid = items.find((i) => Number(i.sp_code) === SP_CODE.SUCCESS);
  if (paid) return { state: "PAID", item: paid };

  const first = items[0];
  const code = Number(first.sp_code);
  if (code === SP_CODE.CANCELLED_BY_CUSTOMER || code === SP_CODE.DECLINED_BY_BANK) {
    return { state: "NOT_PAID", item: first, code };
  }
  return { state: "UNSURE", reason: "unknown_code", item: first, code };
}

/**
 * @param attempts  total tries (default 3)
 * @param timeoutMs per-attempt cap (default 10s)
 */
export async function verifyPayment(
  spOrderId: string,
  opts: { attempts?: number; timeoutMs?: number; onRetry?: (n: number, why: string) => void } = {},
): Promise<VerifyResult> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const timeoutMs = opts.timeoutMs ?? 10_000;
  let last: VerifyResult = { state: "UNSURE", reason: "error" };

  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(1000 * i); // 1s, 2s, …
    try {
      last = classify(await withTimeout(verifyShurjoPayPayment(spOrderId), timeoutMs));
    } catch {
      last = { state: "UNSURE", reason: "error" };
    }
    // PAID / NOT_PAID are final; an unknown code is ShurjoPay's real answer
    // for now, so retrying immediately won't change it.
    if (last.state !== "UNSURE" || last.reason === "unknown_code") return last;
    if (i < attempts - 1) opts.onRetry?.(i + 1, last.reason);
  }
  return last;
}
