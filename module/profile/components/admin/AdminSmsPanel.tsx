// module/profile/components/admin/AdminSmsPanel.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SmsBalanceBanner } from "./SmsBalanceBanner";
import {
  getSmsSettings,
  saveDefaultSmsTemplate,
  saveEventSmsTemplate,
  sendTestSms,
} from "@/app/actions/sms-settings";
import {
  SMS_PLACEHOLDERS,
  renderSmsTemplate,
  sampleSmsVars,
  smsParts,
  validateSmsTemplate,
  type SmsPlaceholder,
} from "@/lib/sms-template";
import { CheckCircle2, Loader2, MessageSquare, RotateCcw, Save, Send } from "lucide-react";

type Settings = Awaited<ReturnType<typeof getSmsSettings>>;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  });

// ─── Editor: placeholders, textarea, live preview, counter ───
function TemplateEditor({
  id,
  value,
  onChange,
  eventName,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  eventName?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const preview = renderSmsTemplate(value, sampleSmsVars(eventName));
  const { chars, parts, unicode } = smsParts(preview);
  const errors = validateSmsTemplate(value);

  const insert = (key: SmsPlaceholder) => {
    const el = ref.current;
    const token = `{${key}}`;
    if (!el) return onChange(value + token);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
          Insert
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(Object.keys(SMS_PLACEHOLDERS) as SmsPlaceholder[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => insert(k)}
              title={SMS_PLACEHOLDERS[k]}
              className="px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-[11px] font-mono text-gray-700 hover:bg-gray-100 cursor-pointer"
            >
              {`{${k}}`}
            </button>
          ))}
        </div>
        <label htmlFor={id} className="sr-only">Message template</label>
        <textarea
          id={id}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={7}
          className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y"
        />
        <p className="mt-1 text-[11px] text-gray-500">
          A line is left out when all its placeholders are empty (e.g. no BIB yet).
        </p>
        {errors.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {errors.map((e) => (
              <li key={e} className="text-xs text-red-600 font-medium">{e}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
          Preview · sample runner
        </p>
        <div className="rounded-2xl bg-gray-100 p-4">
          <div className="max-w-[18rem] rounded-2xl rounded-bl-md bg-white border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 whitespace-pre-wrap break-words shadow-sm">
            {preview || <span className="text-gray-400">Nothing to send</span>}
          </div>
        </div>
        <p className={`mt-2 text-xs tabular-nums ${parts > 2 ? "text-amber-700 font-semibold" : "text-gray-500"}`}>
          {chars} characters · {parts} SMS part{parts === 1 ? "" : "s"}
          {unicode && " · Unicode (Bangla/emoji: 70 characters per part)"}
          {parts > 2 && " — each part is charged separately"}
        </p>
      </div>
    </div>
  );
}

// ─── Test send ───
function TestSend({ template, eventId }: { template: string; eventId: string | null }) {
  const [phone, setPhone] = useState("");
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    setBusy(true);
    setResult(null);
    const res = await sendTestSms(template, phone, eventId);
    setBusy(false);
    setSure(false);
    setResult(res.success ? { ok: true, text: `Sent to ${phone}.` } : { ok: false, text: res.error ?? "Failed" });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
      <label htmlFor={`test-${eventId ?? "default"}`} className="text-xs text-gray-500">
        Send a test to
      </label>
      <input
        id={`test-${eventId ?? "default"}`}
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          setSure(false);
        }}
        placeholder="01712345678"
        inputMode="tel"
        className="h-9 w-40 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      {sure ? (
        <>
          <button
            onClick={send}
            disabled={busy}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold uppercase tracking-wider text-white bg-gray-900 hover:bg-gray-800 cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Yes, send 1 real SMS
          </button>
          <button onClick={() => setSure(false)} className="h-9 px-2 text-xs text-gray-500 hover:text-gray-700 cursor-pointer">
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={() => setSure(true)}
          disabled={!phone.trim() || validateSmsTemplate(template).length > 0}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-700 border border-gray-200 hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={12} />
          Send test
        </button>
      )}
      {result && (
        <span className={`text-xs font-medium ${result.ok ? "text-green-700" : "text-red-600"}`}>{result.text}</span>
      )}
    </div>
  );
}

// ─── Panel ───
export function AdminSmsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [defaultText, setDefaultText] = useState("");
  const [eventId, setEventId] = useState("");
  const [eventText, setEventText] = useState("");
  const [eventCustom, setEventCustom] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");

  const applySettings = useCallback((s: Settings, keepEventId?: string) => {
    setSettings(s);
    setError(s.error ?? "");
    const current = s.defaultTemplate ?? s.builtin;
    setDefaultText(current);
    const ev = s.events.find((e) => e.id === keepEventId) ?? s.events[0];
    setEventId(ev?.id ?? "");
    setEventCustom(!!ev?.template);
    setEventText(ev?.template ?? current);
  }, []);

  useEffect(() => {
    void getSmsSettings().then((s) => applySettings(s));
  }, [applySettings]);

  const reload = async (keepEventId?: string) => applySettings(await getSmsSettings(), keepEventId);

  const done = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 4000);
  };

  if (!settings) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-100 rounded" />
        <div className="h-72 bg-white border border-gray-200 rounded-xl" />
        <div className="h-72 bg-white border border-gray-200 rounded-xl" />
      </div>
    );
  }

  const currentDefault = settings.defaultTemplate ?? settings.builtin;
  const defaultDirty = defaultText.trim() !== currentDefault.trim();
  const defaultValid = validateSmsTemplate(defaultText).length === 0;

  const selected = settings.events.find((e) => e.id === eventId);
  const eventSaved = selected?.template ?? null;
  const eventDirty = eventCustom ? eventText.trim() !== (eventSaved ?? "").trim() : eventSaved !== null;
  const eventValid = !eventCustom || validateSmsTemplate(eventText).length === 0;

  const saveDefault = async (value: string | null) => {
    setSaving(value === null ? "default-reset" : "default");
    setError("");
    const res = await saveDefaultSmsTemplate(value);
    setSaving(null);
    if (!res.success) return setError(res.error ?? "Failed to save");
    await reload(eventId);
    done(value === null ? "Default message reset to the built-in text." : "Default message saved.");
  };

  const saveEvent = async () => {
    setSaving("event");
    setError("");
    const res = await saveEventSmsTemplate(eventId, eventCustom ? eventText : null);
    setSaving(null);
    if (!res.success) return setError(res.error ?? "Failed to save");
    await reload(eventId);
    done(eventCustom ? `Custom message saved for ${selected?.name}.` : `${selected?.name} now uses the default message.`);
  };

  const btn =
    "flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-400" /> SMS Messages
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          The SMS a runner gets when their payment is confirmed.
        </p>
      </div>

      {/* Credit left on the SMS account (warns when low / empty) */}
      <SmsBalanceBanner alwaysShow />

      {flash && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-green-700 text-sm font-medium">{flash}</p>
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Default */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Default confirmation SMS</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Used for every event that doesn&apos;t have its own message.{" "}
              {settings.defaultTemplate
                ? `Last changed ${fmtDate(settings.defaultUpdatedAt!)}.`
                : "Currently the built-in text."}
            </p>
          </div>
        </header>

        <TemplateEditor id="sms-default" value={defaultText} onChange={setDefaultText} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => saveDefault(defaultText)}
            disabled={!defaultDirty || !defaultValid || !!saving}
            className={`${btn} text-white bg-gray-900 hover:bg-gray-800`}
          >
            {saving === "default" ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save default
          </button>
          {defaultDirty && (
            <button onClick={() => setDefaultText(currentDefault)} className={`${btn} text-gray-600 hover:bg-gray-50`}>
              Undo changes
            </button>
          )}
          {settings.defaultTemplate && (
            <button
              onClick={() => saveDefault(null)}
              disabled={!!saving}
              className={`${btn} text-gray-600 border border-gray-200 hover:bg-gray-50 ml-auto`}
              title="Go back to the original message"
            >
              {saving === "default-reset" ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Use built-in text
            </button>
          )}
        </div>

        <TestSend template={defaultText} eventId={null} />
      </section>

      {/* Per event */}
      {settings.events.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <header>
            <h3 className="text-sm font-bold text-gray-900">Message for one event</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Give an event its own text, e.g. its kit-collection details.
            </p>
          </header>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="sms-event" className="sr-only">Event</label>
            <select
              id="sms-event"
              value={eventId}
              onChange={(e) => {
                const ev = settings.events.find((x) => x.id === e.target.value);
                setEventId(e.target.value);
                setEventCustom(!!ev?.template);
                setEventText(ev?.template ?? currentDefault);
              }}
              className="h-9 max-w-full sm:max-w-xs px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 cursor-pointer focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              {settings.events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.template ? " · custom" : ""}
                </option>
              ))}
            </select>

            <div className="flex rounded-lg border border-gray-200 p-0.5" role="group" aria-label="Which message">
              {[
                { custom: false, label: "Use default" },
                { custom: true, label: "Custom message" },
              ].map((o) => (
                <button
                  key={o.label}
                  onClick={() => {
                    setEventCustom(o.custom);
                    if (o.custom && !eventSaved) setEventText(currentDefault);
                  }}
                  aria-pressed={eventCustom === o.custom}
                  className={`px-3 h-8 rounded-md text-xs font-semibold cursor-pointer ${
                    eventCustom === o.custom ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {eventCustom ? (
            <TemplateEditor id="sms-event-text" value={eventText} onChange={setEventText} eventName={selected?.name} />
          ) : (
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs text-gray-600 mb-2">
                Runners of this event get the default message:
              </p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {renderSmsTemplate(currentDefault, sampleSmsVars(selected?.name))}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={saveEvent}
              disabled={!eventDirty || !eventValid || !!saving}
              className={`${btn} text-white bg-gray-900 hover:bg-gray-800`}
            >
              {saving === "event" ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {eventCustom ? "Save for this event" : "Switch to default"}
            </button>
          </div>

          {eventCustom && <TestSend template={eventText} eventId={eventId} />}
        </section>
      )}
    </div>
  );
}
