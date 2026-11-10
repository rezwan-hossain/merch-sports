// scripts/check-services.mjs
//
// One-command health check for the outside services checkout depends on.
// Run it on the server after a deploy, a server move, or when payments/SMS
// stop working:
//
//   npm run check:services                    # everything except sending SMS
//   npm run check:services -- --sms 01XXXXXXXXX   # also send one test SMS
//
// It loads .env exactly the way Next.js does (@next/env), so it sees the same
// values the app sees. It never prints secrets — only their length/shape.
// Read-only: no database writes, no payments, and an SMS only with --sms.

import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");

const cwd = process.cwd();
const preset = new Set(Object.keys(process.env)); // set before .env loads
loadEnvConfig(cwd, false, { info() {}, error() {} });
const env = process.env;

let problems = 0;
const ok = (msg) => console.log(`  ✅ ${msg}`);
const bad = (msg, fix) => {
  problems++;
  console.log(`  ❌ ${msg}`);
  if (fix) console.log(`     → ${fix}`);
};
const warn = (msg, fix) => {
  console.log(`  ⚠️  ${msg}`);
  if (fix) console.log(`     → ${fix}`);
};
const section = (title) =>
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
const shape = (v) => v.replace(/[A-Za-z0-9]/g, "x");

async function fetchJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: null, text: text.slice(0, 200) };
  }
}

// ─── 1. .env files ─────────────────────────────────────────
section(".env files");

const envFiles = [
  ".env",
  ".env.production",
  ".env.local",
  ".env.production.local",
].filter((f) => existsSync(`${cwd}/${f}`));
if (envFiles.length === 0)
  bad("No .env file found in " + cwd, "Copy your .env to this folder.");
else ok(`Found: ${envFiles.join(", ")}`);

for (const file of envFiles) {
  const raw = readFileSync(`${cwd}/${file}`, "utf8");
  if (raw.includes("\r")) {
    bad(`${file} has Windows line endings`, `sed -i 's/\\r$//' ${file}`);
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    const quoted = /^(["']).*\1\s*$/.test(value);
    if (!quoted && /[#$\s]/.test(value.trim())) {
      bad(
        `${file}: ${key} contains # or $ or a space but is not quoted — Next.js will cut or change it`,
        `Write it as ${key}="...value..."`,
      );
    }
  }
}

const required = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "SHURJOPAY_API_URL",
  "SHURJOPAY_USERNAME",
  "SHURJOPAY_PASSWORD",
  "SHURJOPAY_CALLBACK_URL",
  "SHURJOPAY_PREFIX",
  "SMS_API_KEY",
  "SMS_SENDER_ID",
  "RESEND_API_KEY",
];
const missing = required.filter((k) => !env[k]);
if (missing.length)
  bad(
    `Missing: ${missing.join(", ")}`,
    "Add them to .env (see .env.demo for names).",
  );
else ok("All required variables are set");

const overridden = required.filter((k) => preset.has(k));
if (overridden.length) {
  warn(
    `Set outside .env (shell or PM2), so .env is IGNORED for: ${overridden.join(", ")}`,
    "If these are stale: pm2 delete nextjs-app && pm2 start ecosystem.config.js && pm2 save",
  );
}

// ─── 2. ShurjoPay ──────────────────────────────────────────
section("ShurjoPay (payment)");

// Codes actually seen from this store's ShurjoPay responses (login + payment
// verification). Unknown codes fall through to "contact ShurjoPay support".
const SP_CODES = {
  // Login (get_token)
  1064: [
    "Invalid credentials",
    "Username/password wrong — check SHURJOPAY_USERNAME / SHURJOPAY_PASSWORD (quoted?).",
  ],
  1069: [
    "Inactive Store User",
    "Your merchant account is deactivated at ShurjoPay. Contact ShurjoPay support to reactivate it.",
  ],
};

if (env.SHURJOPAY_API_URL && env.SHURJOPAY_USERNAME && env.SHURJOPAY_PASSWORD) {
  const pass = env.SHURJOPAY_PASSWORD;
  console.log(
    `  url: ${env.SHURJOPAY_API_URL} | password length ${pass.length}, shape ${shape(pass)}`,
  );
  if (/sandbox/.test(env.SHURJOPAY_API_URL)) {
    warn(
      "Using the SANDBOX url — real payments won't work",
      "Live url: https://engine.shurjopayment.com",
    );
  }
  try {
    const { status, data, text } = await fetchJson(
      `${env.SHURJOPAY_API_URL}/api/get_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: env.SHURJOPAY_USERNAME,
          password: pass,
        }),
      },
    );
    if (data?.token) {
      ok(`Login works (store_id ${data.store_id})`);
    } else {
      const code = Number(data?.sp_code);
      const [meaning, fix] = SP_CODES[code] ?? [
        data?.message || text || `HTTP ${status}`,
        "Send this code/message and the server IP below to ShurjoPay support.",
      ];
      bad(
        `ShurjoPay refused login: sp_code ${data?.sp_code ?? "-"} "${data?.message ?? meaning}" (${meaning})`,
        fix,
      );
    }
  } catch (err) {
    bad(
      `Can't reach ShurjoPay: ${err.message}`,
      "Network/DNS/firewall problem on this server.",
    );
  }
}

// ─── 3. Callback URL ───────────────────────────────────────
section("Payment callback URL");

if (env.SHURJOPAY_CALLBACK_URL) {
  try {
    const cb = new URL(env.SHURJOPAY_CALLBACK_URL);
    const site = env.NEXT_PUBLIC_SITE_URL
      ? new URL(env.NEXT_PUBLIC_SITE_URL)
      : null;
    if (/localhost|127\.0\.0\.1/.test(cb.hostname)) {
      bad(
        `Callback points to ${cb.hostname} — paid orders will stay pending`,
        "Use https://<your-domain>/api/payment/shurjopay/callback",
      );
    } else if (cb.protocol !== "https:") {
      bad("Callback is not https", "Use https://");
    } else if (site && site.hostname !== cb.hostname) {
      warn(
        `Callback host (${cb.hostname}) differs from site (${site.hostname})`,
        "Make sure that's intended.",
      );
    } else {
      ok(env.SHURJOPAY_CALLBACK_URL);
    }
    if (!cb.pathname.endsWith("/api/payment/shurjopay/callback")) {
      warn(
        `Unexpected callback path: ${cb.pathname}`,
        "Expected /api/payment/shurjopay/callback",
      );
    }
  } catch {
    bad("SHURJOPAY_CALLBACK_URL is not a valid URL");
  }
}

// ─── 3b. SSLCommerz ────────────────────────────────────────
section("SSLCommerz (payment)");

if (env.SSLCOMMERZ_ENABLED !== "true") {
  console.log('  (switched off — set SSLCOMMERZ_ENABLED="true" to offer it at checkout)');
}
if (env.SSLCOMMERZ_STORE_ID || env.SSLCOMMERZ_ENABLED === "true") {
  // Only the domain is used (same as lib/payment/sslcommerz/config.ts).
  const rawApi = (env.SSLCOMMERZ_API_URL || "https://sandbox.sslcommerz.com").trim();
  let api;
  try {
    api = new URL(rawApi).origin;
  } catch {
    api = rawApi.replace(/\/$/, "");
  }
  if (api !== rawApi.replace(/\/$/, "")) {
    warn(`SSLCOMMERZ_API_URL has a path — only the domain is used: ${api}`, `Set it to just ${api}`);
  }
  const live = !/sandbox/i.test(api);
  console.log(`  url: ${api} (${live ? "LIVE" : "sandbox"})`);
  if (!env.SSLCOMMERZ_STORE_ID || !env.SSLCOMMERZ_STORE_PASSWORD) {
    bad("SSLCOMMERZ_STORE_ID / SSLCOMMERZ_STORE_PASSWORD missing");
  } else {
    // Read-only: looking up a made-up tran_id proves the store login works.
    try {
      const { data, text } = await fetchJson(
        `${api}/validator/api/merchantTransIDvalidationAPI.php?tran_id=HEALTHCHECK` +
          `&store_id=${encodeURIComponent(env.SSLCOMMERZ_STORE_ID)}` +
          `&store_passwd=${encodeURIComponent(env.SSLCOMMERZ_STORE_PASSWORD)}&format=json`,
      );
      if (data?.APIConnect === "DONE") ok("Store login works");
      else
        bad(
          `SSLCommerz refused the store login: APIConnect ${data?.APIConnect ?? text ?? "?"}`,
          data?.APIConnect === "INACTIVE"
            ? "The store is inactive — contact SSLCommerz support."
            : "Check SSLCOMMERZ_STORE_ID / SSLCOMMERZ_STORE_PASSWORD (quoted?) and that the url matches the store (sandbox vs live).",
        );
    } catch (err) {
      bad(`Can't reach SSLCommerz: ${err.message}`, "Network/DNS/firewall problem on this server.");
    }
  }
  try {
    const site = new URL(env.NEXT_PUBLIC_SITE_URL || "");
    if (live && (site.protocol !== "https:" || /localhost|127\.0\.0\.1/.test(site.hostname))) {
      bad(`Live SSLCommerz but NEXT_PUBLIC_SITE_URL is ${site.origin}`, "Payments would never be confirmed — set your public https domain.");
    } else {
      ok(`Customers return to ${site.origin}/api/payment/sslcommerz/…`);
    }
  } catch {
    bad("NEXT_PUBLIC_SITE_URL is not a valid URL (SSLCommerz needs it)");
  }
}

// ─── 4. SMS ────────────────────────────────────────────────
section("SMS gateway");

const smsIdx = process.argv.indexOf("--sms");
const smsTo = smsIdx > -1 ? process.argv[smsIdx + 1] : null;

if (env.SMS_API_KEY) {
  if (existsSync(`${cwd}/.env.demo`)) {
    const demoKey = readFileSync(`${cwd}/.env.demo`, "utf8").match(
      /^SMS_API_KEY=["']?([^"'\r\n]*)/m,
    )?.[1];
    if (demoKey && demoKey === env.SMS_API_KEY) {
      bad(
        "SMS_API_KEY is the same as in .env.demo — probably not your real key",
        "Copy the key from your SMS panel.",
      );
    }
  }
  if (!smsTo) {
    console.log(
      "  (skipped sending — run with --sms 01XXXXXXXXX to send one test SMS)",
    );
  } else {
    try {
      const { data, text } = await fetchJson(
        env.SMS_API_URL || "http://139.99.39.237/api/smsapi",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: env.SMS_API_KEY,
            senderid: env.SMS_SENDER_ID,
            number: smsTo,
            message: "Test SMS from server check",
          }),
        },
      );
      const code = Number(data?.response_code);
      const hide = (s) => String(s ?? "").replaceAll(env.SMS_API_KEY, "<key>");
      if (code === 202) ok(`Test SMS sent to ${smsTo}`);
      else
        bad(
          `SMS rejected: code ${data?.response_code ?? "-"} ${hide(data?.error_message || text)}`,
          code === 1032
            ? "Whitelist the server IP below in your SMS panel."
            : code === 1011
              ? "API key not recognised — copy the right key from your SMS panel."
              : code === 1007
                ? "Top up SMS balance."
                : "See the code list at the top of lib/sms.ts.",
        );
    } catch (err) {
      bad(`Can't reach SMS gateway: ${err.message}`);
    }
  }
}

// ─── 5. Email (Resend) ─────────────────────────────────────
section("Email (Resend)");

if (env.RESEND_API_KEY) {
  try {
    const { status, data } = await fetchJson("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
    });
    if (status === 200) ok(`Key works (${data?.data?.length ?? 0} domain(s))`);
    // A send-only key can't list domains but is still valid.
    else if (data?.name === "restricted_api_key")
      ok("Key works (send-only key)");
    else
      bad(
        `Resend refused the key: ${data?.message || `HTTP ${status}`}`,
        "Check RESEND_API_KEY.",
      );
  } catch (err) {
    bad(`Can't reach Resend: ${err.message}`);
  }
}

// ─── Summary ───────────────────────────────────────────────
section("Server");
try {
  const ip = (
    await (
      await fetch("https://api.ipify.org", {
        signal: AbortSignal.timeout(5000),
      })
    ).text()
  ).trim();
  console.log(
    `  Public IP: ${ip}  (give this to ShurjoPay / SMS provider for whitelisting)`,
  );
} catch {
  console.log("  Public IP: unknown");
}

console.log(
  problems === 0
    ? "\n✅ All checks passed.\n"
    : `\n❌ ${problems} problem${problems === 1 ? "" : "s"} found — fix the ❌ lines above.\n`,
);
if (problems === 0 && overridden.length === 0) {
  console.log(
    "If the site still fails but this passes, restart the app: pm2 restart nextjs-app --update-env\n",
  );
}
process.exitCode = problems === 0 ? 0 : 1;
