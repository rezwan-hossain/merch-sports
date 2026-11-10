# ShurjoPay payments

Our main payment gateway (the second one, SSLCommerz, lives in `lib/payment/sslcommerz`).
Everything that talks to ShurjoPay is in **`index.ts`** in this folder.

## The flow — steps ①–⑧

The comments in the code use the same numbers, so you can search for e.g. `⑦`
to find that step.

| Step | What happens | Where in our code |
|---|---|---|
| **①** Request Token | Our server logs in to ShurjoPay | `index.ts` → `getShurjoPayToken()` → `POST {API}/api/get_token` |
| **②** Return Token | ShurjoPay answers with a `token` + `store_id` (no token = login refused) | `index.ts` → `getShurjoPayToken()` |
| **③** Create Payment | We ask for a payment page for this order, using the token | `index.ts` → `createShurjoPayPayment()` → `POST {API}/api/secret-pay` |
| **④** Return checkout_url | ShurjoPay answers with `checkout_url` + `sp_order_id` | `index.ts` → `createShurjoPayPayment()` |
| **⑤** Redirect Customer to Payment Page | The browser goes to `checkout_url`; the runner pays (bKash, Nagad, card…) | `module/checkout/pages/CheckoutPage.tsx` |
| **⑥** Customer back to us | ShurjoPay sends the browser to our `return_url` with `?order_id=<sp_order_id>` | `app/api/payment/shurjopay/callback/route.ts` → `GET` |
| **⑦** Verify Payment | We ask ShurjoPay what really happened to that `sp_order_id` | `lib/payment-verify.ts` → `verifyPayment()` → `index.ts` → `verifyShurjoPayPayment()` → `POST {API}/api/verification` |
| **⑧** Redirect Customer to our page | Success, failed, or "confirming…" page | `callback/route.ts` |

```
 Checkout button
   │
   ▼
 placeOrder()                                   app/actions/checkout.ts
   │  order PENDING + slot held for 24h
   ▼
 initiateShurjoPayPayment()                     app/actions/payment.ts
   │  checks: settings ok? earlier attempt already paid? keep the slot
   │  ① ② getShurjoPayToken()      ─────►  ShurjoPay  /api/get_token
   │       ◄── token + store_id
   │  ③ ④ createShurjoPayPayment()  ─────►  ShurjoPay  /api/secret-pay
   │       ◄── checkout_url + sp_order_id
   │  save sp_order_id in Payment.paymentId
   ▼
 ⑤ browser → checkout_url → runner pays on ShurjoPay
   │
   ▼
 ⑥ browser ──► /api/payment/shurjopay/callback?order_id=<sp_order_id>
   │
   ▼
 ⑦ verifyPayment(sp_order_id)  ─────►  ShurjoPay  /api/verification
   │      sp_code 1000 → checks ok → order CONFIRMED → email + SMS
   │      sp_code 1001 / 1002 → payment FAILED, slot freed
   │      anything else → stays PENDING
   ▼
 ⑧ /payment/success  or  /payment/failed  or  /payment/processing
```

**ShurjoPay has no IPN** (no server-to-server notice like SSLCommerz). If the
customer closes the tab after paying, ⑥ never arrives — the safety nets below
run ⑦ for us instead.

## Where is the code? (quick map)

Search for the text in the last column (VS Code: `Ctrl+Shift+F`).

| Step | File | Search for |
|---|---|---|
| Runner clicks Pay | `module/checkout/pages/CheckoutPage.tsx` | `initiateShurjoPayPayment(paymentArgs)` |
| Create the order + hold the slot | `app/actions/checkout.ts` | `export async function placeOrder` |
| Start the payment | `app/actions/payment.ts` | `export async function initiateShurjoPayPayment` |
| ① ② Token | `app/actions/payment.ts` → `index.ts` | `Step 1: ① Request Token` → `// ① Request Token` |
| ③ ④ Payment page | `app/actions/payment.ts` → `index.ts` | `Step 2: ③ Create Payment` → `// ③ Create Payment` |
| Save the attempt | `app/actions/payment.ts` | `Step 3: Update payment record` |
| ⑤ Redirect to payment page | `module/checkout/pages/CheckoutPage.tsx` | `window.location.href = paymentResult.checkoutUrl` |
| ⑥ Customer back to us | `app/api/payment/shurjopay/callback/route.ts` | `export async function GET` |
| ⑦ Verify (with retries) | `lib/payment-verify.ts` | `export async function verifyPayment` |
| ⑦ The ShurjoPay call | `index.ts` | `// ⑦ Verify Payment` |
| ⑧ Act on the result | `app/api/payment/shurjopay/callback/route.ts` | `// ⑧ From here on` |
| Confirm the order (race-safe) | `lib/slot-hold.ts` | `export async function confirmPaidOrder` |
| Email + SMS | `lib/order-confirmation.ts` | `export async function runPostPaymentSteps` |

## Step by step, with the code

**Before ①: the order** — `app/actions/checkout.ts` → `placeOrder()`
Creates the order (PENDING), its registration and payment rows, and holds the
package slot for 24 hours (`Order.holdExpiresAt`, `lib/slot-hold.ts`).

**Start the payment** — `app/actions/payment.ts` → `initiateShurjoPayPayment()`
Before talking to ShurjoPay it checks:
- the settings are safe (`lib/payment-config.ts` — live ShurjoPay must never send
  customers back to `localhost`);
- an earlier attempt for this order wasn't already paid (`reconcileOrder()` — if it
  was, it confirms that one instead of charging twice);
- the runner's slot is still held (refreshes the 24h hold, or takes the slot back).

**① Request Token → ② Return Token** — `index.ts` → `getShurjoPayToken()`
```ts
// ① Request Token
const { data } = await axios.post(`${BASE_URL}/api/get_token`, { username, password });
// ② Return Token (data.token is empty when ShurjoPay refused the login)
return data;
```
No token → the runner sees "Payment gateway unavailable" and an admin alert is
written with ShurjoPay's `sp_code` (`reportGatewayFailure()` → red banner in admin).

**③ Create Payment → ④ Return checkout_url** — `index.ts` → `createShurjoPayPayment()`
```ts
// ③ Create Payment
const { data } = await axios.post(`${BASE_URL}/api/secret-pay`, {
  token, store_id, prefix, amount, currency: "BDT",
  order_id: orderId, value1: orderId,          // our order id
  return_url: CALLBACK_URL, cancel_url: CALLBACK_URL,  // ⑥ comes back here
  customer_name, customer_phone, customer_email, client_ip, …
}, { headers: { Authorization: `Bearer ${token}` } });
// ④ Return checkout_url (+ sp_order_id)
return data;
```
Then `payment.ts` saves `sp_order_id` in `Payment.paymentId` (and
`paymentGateway: "shurjopay"`) and returns `checkout_url`.

**⑤ Redirect Customer to Payment Page** — `CheckoutPage.tsx`
```ts
window.location.href = paymentResult.checkoutUrl;
```

**⑥ Customer back to us** — `callback/route.ts` → `GET`
ShurjoPay redirects the browser to `SHURJOPAY_CALLBACK_URL?order_id=<sp_order_id>`
(paid **or** cancelled — both use the same URL). A `POST` version reads the id from
the body and then runs the same `GET` code.

**⑦ Verify Payment** — `lib/payment-verify.ts` → `verifyPayment()`
We **never trust the URL**. We ask ShurjoPay ourselves:
```ts
const verified = await verifyPayment(spOrderId, { attempts: 3, timeoutMs: 10_000 });
// → index.ts → verifyShurjoPayPayment() → POST {API}/api/verification
```
It retries a failed or empty answer (ShurjoPay can take a moment right after
paying) and turns ShurjoPay's answer into one of three states:

| State | When | Final? |
|---|---|---|
| `PAID` | ShurjoPay has a successful entry (`sp_code` 1000) | ✅ |
| `NOT_PAID` | `sp_code` 1001 (declined) or 1002 (cancelled) | ✅ |
| `UNSURE` | error, empty answer, or any other code | ❌ — never treated as failed |

**⑧ Act on the result and redirect** — `callback/route.ts`

| ShurjoPay says | What we do | Customer lands on |
|---|---|---|
| 1000 success, amount + order match | `confirmPaidOrder()` → order CONFIRMED → coupon usage + email + SMS (after the redirect) | `/payment/success` |
| 1000 but paid less / wrong order | Not confirmed; slot kept; audit "NEEDS REVIEW" → admin Payment issues | `/payment/failed?reason=unknown_status` |
| 1000 but the slot is gone (hold expired + sold out, or admin cancelled) | Audit "REFUND NEEDED" → admin Payment issues | `/payment/failed?reason=paid_no_slot` |
| 1002 cancelled by customer | Payment FAILED, slot freed now (`releaseHold()`) | `/payment/failed?reason=cancelled` |
| 1001 declined by bank | Payment FAILED, slot freed now | `/payment/failed?reason=declined` |
| any other code | Stays PENDING; audit `payment.unknown_status` | `/payment/processing` |
| ShurjoPay unreachable | Stays PENDING | `/payment/processing` |

The "confirming your payment…" page (`/payment/processing`) keeps asking until the
payment settles.

## Things to know

- **Never trust the callback URL.** Anyone can open `…/callback?order_id=…`. Only
  ⑦ (asking ShurjoPay) decides anything.
- **A callback for an older attempt can't hurt a newer one.** If the runner retried
  (new `sp_order_id`), a late "cancelled" for the old attempt doesn't fail or release
  the new one. A late *success* for the old attempt is still honoured.
- **Paid twice?** If a second payment succeeds for an order that's already paid,
  it's flagged "REFUND NEEDED" (`payment.duplicate`) in admin → Payment issues.
- **Confirming is race-safe.** `confirmPaidOrder()` only lets one caller flip the
  payment to PAID, so a refresh or the reconciler running at the same moment can't
  send the email/SMS twice.

### Two token functions, on purpose

`index.ts` asks for a token in two places, and they behave differently:

| | `getShurjoPayToken()` (checkout, ①) | `getVerificationToken()` (⑦) |
|---|---|---|
| Login refused | **returns** ShurjoPay's reply (no token) | **throws** |
| Why | so checkout can show "Payment gateway unavailable" and record the `sp_code` | so a ShurjoPay outage counts as "unsure", never as "not paid" (which would cancel paid orders) |

Don't merge them.

## If the callback never arrives

Customers close tabs. ShurjoPay has no IPN, so these run ⑦ for us:

| Safety net | When | Where |
|---|---|---|
| "Confirming your payment…" page | while the runner waits; asks ShurjoPay at most every 15s | `app/actions/payment-status.ts` → `getPaymentProgress()` |
| Reconciler | every 5 minutes; PENDING online orders from the last 3 days | `instrumentation.ts` → `lib/payment-reconcile.ts` |
| Hold sweep | every hour; holds older than 24h | `instrumentation.ts` → `releaseExpiredHolds()` in `lib/slot-hold.ts` |

The hourly sweep **only frees a slot after ShurjoPay confirms it wasn't paid**. If
ShurjoPay says it *was* paid, the order is parked for an admin instead
(`payment.paid_no_callback` in admin → Payment issues).

Orders older than the reconciler's 3 days are never confirmed automatically — an
admin confirms them from **admin → Payment issues** (which runs ⑦ again before
confirming).

## Settings (`.env`)

```
SHURJOPAY_API_URL="https://engine.shurjopayment.com"     # sandbox: https://sandbox.shurjopayment.com
SHURJOPAY_USERNAME="..."
SHURJOPAY_PASSWORD="..."           # ⚠️ always in double quotes — it contains # and $
SHURJOPAY_PREFIX="..."
SHURJOPAY_CALLBACK_URL="https://www.merchcommunication.com/api/payment/shurjopay/callback"
```

- Values with `#`, `$` or spaces **must be in double quotes**, or Next.js cuts them
  short and ShurjoPay answers "Invalid credentials".
- `SHURJOPAY_CALLBACK_URL` must be the public **https** domain. The code refuses to
  start a live payment that would send customers back to `localhost`.

## When it breaks

Run this on the server — it logs in to ShurjoPay and explains the answer:

```bash
npm run check:services
```

| `sp_code` / message | Meaning | Who fixes it |
|---|---|---|
| 1064 "Invalid credentials" | Username/password wrong — or not quoted in `.env` | Developer (check `.env`) |
| 1069 "Inactive Store User" | The merchant account is deactivated | ShurjoPay support |
| No answer / network error | Server can't reach ShurjoPay | Developer / hosting |

The same problems show as a red banner in admin and in the audit log
(`payment.gateway_error`), with who to contact.

After changing `.env`: `pm2 restart nextjs-app --update-env`.
After changing code: `./deploy.sh` (restart alone doesn't rebuild).

## Files

| File | What it does | Steps |
|---|---|---|
| `lib/payment/shurjopay/index.ts` | Every call to ShurjoPay: token, create payment, verify; `SP_CODE` | ① ② ③ ④ ⑦ |
| `app/actions/payment.ts` | Starts a payment (the checkout button) | ① – ④ |
| `module/checkout/pages/CheckoutPage.tsx` | Sends the browser to ShurjoPay | ⑤ |
| `app/api/payment/shurjopay/callback/route.ts` | Where ShurjoPay sends customers back to | ⑥ ⑦ ⑧ |
| `lib/payment-verify.ts` | Asks ShurjoPay with retries; PAID / NOT_PAID / UNSURE | ⑦ |
| `lib/payment-reconcile.ts` | Confirms paid orders whose callback was lost | ⑦ |
| `lib/payment-config.ts` | Refuses unsafe settings (live → localhost) | — |
| `lib/payment-gateway-alert.ts` | Admin alert when payments can't start | — |
| `scripts/check-services.mjs` | `npm run check:services` | — |
