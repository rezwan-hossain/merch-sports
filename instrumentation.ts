// instrumentation.ts
//
// Runs once when the Next.js server starts. Used to start the background sweep
// that releases expired checkout slot holds (see lib/slot-hold.ts).
//
// Why a timer and not only the sweep inside placeOrder: the event page is
// cached and disables "Register" at 0 slots, so a package filled with abandoned
// holds would never receive the checkout traffic that triggers the lazy sweep —
// it would stay "sold out" forever. This timer frees those slots without any
// visitor. The app runs as a single PM2 instance, so exactly one timer runs.
//
// The page's own cache (cacheLife "hours") then picks up the freed slots on its
// next revalidation; checkout itself always sees the live count.

// Holds last 24 hours (SLOT_HOLD_MS), so checking hourly is plenty: an
// abandoned slot comes back at most ~1 hour after its hold expires.
const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Payments whose callback never confirmed them are checked with ShurjoPay far
// more often — a runner who paid shouldn't wait an hour for confirmation.
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Dev hot reload can call register() again — keep a single timer.
  const g = globalThis as typeof globalThis & { __slotHoldSweep?: boolean };
  if (g.__slotHoldSweep) return;
  g.__slotHoldSweep = true;

  const { releaseExpiredHolds } = await import("./lib/slot-hold");
  const { purgeOldVisitors } = await import("./lib/page-views");
  const { logger } = await import("./lib/logger");
  const { reconcilePendingPayments } = await import("./lib/payment-reconcile");
  const { checkPaymentConfig } = await import("./lib/payment-config");

  // Say so loudly at boot if payments can't be confirmed with this setup.
  const config = checkPaymentConfig();
  if (config.block || config.warnings.length > 0) {
    const bootLog = logger.child({ action: "payment:config_check" });
    if (config.block) bootLog.error({ configProblem: config.block }, "payment:config_invalid");
    for (const w of config.warnings) bootLog.warn({ configWarning: w }, "payment:config_warning");
    await bootLog.flush();
    console.error(
      `\n⚠️  PAYMENT CONFIG ${config.block ? "PROBLEM" : "WARNING"}: ${config.block ?? config.warnings.join(" ")}\n`,
    );
  }

  // ── Payment reconciler: confirm paid orders whose callback was lost ──
  let reconciling = false;
  const reconcile = async () => {
    if (reconciling) return;
    reconciling = true;
    const log = logger.child({ action: "payment:reconcile" });
    try {
      const counts = await reconcilePendingPayments({ log });
      if (counts.CONFIRMED > 0 || counts.PAID_NO_SLOT > 0 || counts.NEEDS_REVIEW > 0) {
        log.warn({ counts }, "reconcile:recovered_lost_callbacks");
      }
    } catch (err) {
      log.error({ err }, "reconcile:run_failed");
    } finally {
      reconciling = false;
      await log.flush();
    }
  };
  setInterval(reconcile, RECONCILE_INTERVAL_MS).unref();
  setTimeout(reconcile, 45_000).unref();
  const { verifyShurjoPayPayment, SP_CODE } = await import("./lib/payment/shurjopay");

  // Before releasing an order that reached ShurjoPay, ask ShurjoPay whether it
  // was actually paid (the callback can be lost). Throws on API errors, which
  // makes the sweep skip that order until the next run.
  const verifyGatewayPayment = async (spOrderId: string) => {
    const items = await verifyShurjoPayPayment(spOrderId);
    return items.some((i) => Number(i.sp_code) === SP_CODE.SUCCESS)
      ? ("PAID" as const)
      : ("NOT_PAID" as const);
  };

  let running = false;
  const sweep = async () => {
    if (running) return; // never overlap two sweeps
    running = true;
    const log = logger.child({ action: "slotHold:sweep" });
    try {
      // Page-view privacy: anonymous visitor hashes are kept for 2 days only.
      await purgeOldVisitors().catch((err) => log.error({ err }, "pageviews:purge_failed"));

      const { slugs, parked } = await releaseExpiredHolds({
        verifyGatewayPayment,
        limit: 50, // bounds gateway calls per run; the rest go next run
      });
      if (slugs.length > 0) {
        log.info({ releasedSlugs: slugs }, "slots:expired_holds_released");
      }
      for (const orderId of parked) {
        // Paid at the gateway but the callback never arrived. The slot stays
        // held; an admin must confirm the order and notify the customer.
        log.error({ orderId }, "payment:RECONCILE_REQUIRED — paid, no callback");
      }
    } catch (err) {
      log.error({ err }, "slots:sweep_failed");
    } finally {
      running = false;
      await log.flush();
    }
  };

  setInterval(sweep, SWEEP_INTERVAL_MS).unref();
  // First pass shortly after boot (also clears holds that expired while down).
  setTimeout(sweep, 30_000).unref();
}
