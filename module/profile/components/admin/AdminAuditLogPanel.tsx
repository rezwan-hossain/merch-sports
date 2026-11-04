// module/profile/components/admin/AdminAuditLogPanel.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { exportAuditLogs, getAuditLogs } from "@/app/actions/audit-log";
import type { AuditCategory, AuditEntry, AuditFilters } from "@/types/audit";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Download,
  Loader2,
  Search,
  User,
  X,
} from "lucide-react";

type Props = { events: { id: string; name: string }[] };

const CATEGORIES: { value: AuditCategory; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "attention", label: "Needs attention" },
  { value: "orders", label: "Orders" },
  { value: "payments", label: "Payments" },
  { value: "events", label: "Events & packages" },
  { value: "coupons", label: "Coupons" },
  { value: "content", label: "Homepage & team" },
  { value: "messages", label: "Emails & SMS" },
];

const ATTENTION = new Set([
  "payment.duplicate",
  "payment.paid_no_slot",
  "payment.amount_mismatch",
  "payment.unknown_status",
  "payment.paid_no_callback",
  "payment.gateway_error",
]);

// Chip style by what kind of change it was — colour plus the verb as text.
function chip(action: string) {
  const verb = action.split(".")[1] ?? action;
  if (action.startsWith("notification.")) {
    const [channel, status] = verb.split("_");
    const label = `${channel === "sms" ? "SMS" : "email"} ${status === "skipped" ? "not sent" : status}`;
    if (status === "failed") return { text: label, cls: "bg-red-50 text-red-700 border-red-200" };
    if (status === "sent") return { text: label, cls: "bg-green-50 text-green-700 border-green-200" };
    return { text: label, cls: "bg-gray-100 text-gray-700 border-gray-200" };
  }
  if (ATTENTION.has(action))
    return {
      text: "needs attention",
      cls: "bg-red-50 text-red-700 border-red-200",
    };
  if (
    /created|manual_created|duplicated|activated$/.test(verb) &&
    verb !== "deactivated"
  )
    return {
      text: verb.replace("_", " "),
      cls: "bg-green-50 text-green-700 border-green-200",
    };
  if (/deleted|cancelled|declined|deactivated|hold_expired/.test(verb))
    return {
      text: verb.replace("_", " "),
      cls: "bg-gray-100 text-gray-700 border-gray-200",
    };
  if (action.startsWith("payment.confirmed"))
    return {
      text: "paid",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    };
  return {
    text: verb.replace("_", " "),
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  };
}

const isSystem = (e: AuditEntry) => e.actorLabel.startsWith("System");

const dhakaDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
const dhakaTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  });

const show = (v: unknown) =>
  v === null || v === undefined || v === ""
    ? "—"
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v);

export function AdminAuditLogPanel({ events }: Props) {
  const [filters, setFilters] = useState<AuditFilters>({
    category: "all",
    eventId: "all",
    search: "",
  });
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const topRef = useRef<HTMLDivElement>(null);

  // Only sets state after the request returns; a newer request wins. The
  // server clamps the page, so we adopt the page it actually returned.
  const load = useCallback((f: AuditFilters, p: number, size: number) => {
    const seq = ++requestSeq.current;
    return getAuditLogs(f, p, size).then((res) => {
      if (seq !== requestSeq.current) return;
      setEntries(res.entries);
      setTotal(res.total);
      setPage(res.page);
      setPageSize(res.pageSize);
      setError(res.error ?? "");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    void load({ category: "all", eventId: "all", search: "" }, 1, 50);
  }, [load]);

  const goTo = (p: number, size = pageSize) => {
    setOpen(null);
    setLoading(true);
    void load(filters, p, size);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Search waits for typing to pause.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const update = (patch: Partial<AuditFilters>, debounce = false) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    // Any filter change starts again from page 1.
    const run = () => {
      setOpen(null);
      setLoading(true);
      void load(next, 1, pageSize);
    };
    if (debounce) searchTimer.current = setTimeout(run, 300);
    else run();
  };

  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<{ ok: boolean; text: string } | null>(null);

  // Everything matching the current filters, not just this page.
  const exportCsv = async () => {
    setExporting(true);
    setExportNote(null);
    const res = await exportAuditLogs(filters);
    setExporting(false);
    if (res.error) return setExportNote({ ok: false, text: res.error });
    if (res.entries.length === 0) return setExportNote({ ok: false, text: "Nothing to export for these filters." });

    const eventNames = new Map(events.map((e) => [e.id, e.name]));
    const esc = (v: unknown) => {
      const t = v === null || v === undefined ? "" : String(v);
      return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const val = (v: unknown) =>
      v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
    const header = [
      "Time (Dhaka)", "Actor", "Action", "What", "ID", "Event", "Summary",
      "Runner", "Runner phone", "Runner email", "Changes", "Request ID",
    ];
    const rows = res.entries.map((e) => [
      new Date(e.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }),
      e.actorLabel,
      e.action,
      e.entityType,
      e.entityId,
      e.eventId ? (eventNames.get(e.eventId) ?? e.eventId) : "",
      e.summary,
      e.subject?.name ?? "",
      e.subject?.phone ?? "",
      e.subject?.email ?? "",
      e.changes
        ? Object.entries(e.changes).map(([f, [b, a]]) => `${f}: ${val(b)} → ${val(a)}`).join("; ")
        : "",
      e.requestId ?? "",
    ]);
    // BOM so Excel reads Bangla and ৳ correctly.
    const csv = "\uFEFF" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}${filters.category !== "all" ? `-${filters.category}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNote({
      ok: true,
      text: res.truncated
        ? `Exported the newest ${res.entries.length.toLocaleString("en-IN")} of ${res.total.toLocaleString("en-IN")} entries — narrow the filters to get the rest.`
        : `Exported ${res.entries.length.toLocaleString("en-IN")} entries.`,
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  // Group by Dhaka calendar day, newest first.
  const groups: { day: string; items: AuditEntry[] }[] = [];
  for (const e of entries) {
    const day = dhakaDay(e.createdAt);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }
  const eventName = new Map(events.map((e) => [e.id, e.name]));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Audit Log</h2>
        <p className="text-sm text-gray-500 mt-1">
          Who changed what, and when. Admin changes, orders, payments and system
          actions.
        </p>
      </div>

      {/* Filters — one row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <label htmlFor="audit-search" className="sr-only">
            Search
          </label>
          <input
            id="audit-search"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value }, true)}
            placeholder="Search runner name, phone, email, order ID, coupon…"
            className="w-full h-9 pl-9 pr-8 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          {filters.search && (
            <button
              onClick={() => update({ search: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <label htmlFor="audit-event" className="sr-only">
          Event
        </label>
        <select
          id="audit-event"
          value={filters.eventId}
          onChange={(e) => update({ eventId: e.target.value })}
          className="h-9 max-w-[14rem] px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 cursor-pointer focus:outline-none focus:ring-1 focus:ring-gray-900"
        >
          <option value="all">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => update({})}
          disabled={loading}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          onClick={exportCsv}
          disabled={exporting || total === 0}
          className="h-9 flex items-center gap-1.5 px-3 rounded-lg border border-gray-200 bg-white text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Download every entry matching these filters"
        >
          {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          Export CSV
        </button>
      </div>
      {exportNote && (
        <p className={`text-xs font-medium ${exportNote.ok ? "text-green-700" : "text-red-600"}`}>{exportNote.text}</p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => update({ category: c.value })}
            aria-pressed={filters.category === c.value}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer ${
              filters.category === c.value
                ? c.value === "attention"
                  ? "bg-red-600 text-white"
                  : "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {c.value === "attention" && (
              <AlertTriangle size={11} className="inline -mt-0.5 mr-1" />
            )}
            {c.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Range + page size */}
      {total > 0 && (
        <div
          ref={topRef}
          className="flex flex-wrap items-center justify-between gap-2 scroll-mt-24"
        >
          <p className="text-xs text-gray-500 tabular-nums">
            Showing {num(rangeStart)}–{num(rangeEnd)} of {num(total)}{" "}
            {total === 1 ? "entry" : "entries"}
          </p>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            Per page
            <select
              id="audit-page-size"
              value={pageSize}
              onChange={(e) => goTo(1, Number(e.target.value))}
              className="h-8 px-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-900 cursor-pointer focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* List */}
      {loading && entries.length === 0 ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 bg-white border border-gray-200 rounded-xl"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
          <p className="text-gray-900 font-bold">Nothing logged yet</p>
          <p className="text-gray-400 text-sm mt-1">
            {filters.search ||
            filters.category !== "all" ||
            filters.eventId !== "all"
              ? "No entries match these filters."
              : "Entries appear here as soon as anyone changes something."}
          </p>
        </div>
      ) : (
        <div
          className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}
        >
          {groups.map((g) => (
            <section key={g.day}>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                {g.day}
              </h3>
              <ul className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                {g.items.map((e) => {
                  const c = chip(e.action);
                  const expanded = open === e.id;
                  const changeRows = e.changes ? Object.entries(e.changes) : [];
                  return (
                    <li key={e.id}>
                      <button
                        onClick={() => setOpen(expanded ? null : e.id)}
                        aria-expanded={expanded}
                        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <span className="text-xs text-gray-400 tabular-nums w-11 flex-shrink-0 pt-0.5">
                          {dhakaTime(e.createdAt)}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 ${c.cls}`}
                            >
                              {c.text}
                            </span>
                            <span className="text-[11px] text-gray-400 uppercase tracking-wider">
                              {e.entityType}
                            </span>
                            {e.eventId &&
                              eventName.get(e.eventId) &&
                              filters.eventId === "all" && (
                                <span className="text-[11px] text-gray-400 truncate">
                                  · {eventName.get(e.eventId)}
                                </span>
                              )}
                          </span>
                          <span className="block text-sm text-gray-900 mt-1 break-words">
                            {e.summary}
                          </span>
                          {e.subject && (
                            <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md bg-gray-50 border border-gray-100 px-2 py-1 text-xs">
                              <span className="font-semibold text-gray-900">
                                {e.subject.name}
                              </span>
                              {e.subject.phone && (
                                <span className="text-gray-600 tabular-nums select-all">
                                  {e.subject.phone}
                                </span>
                              )}
                              {e.subject.email && (
                                <span className="text-gray-600 break-all select-all">
                                  {e.subject.email}
                                </span>
                              )}
                              <span className="text-gray-400">
                                {e.subject.packageName}
                                {filters.eventId === "all" &&
                                  ` · ${e.subject.eventName}`}
                              </span>
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] text-gray-500 mt-1">
                            {isSystem(e) ? (
                              <Bot size={11} />
                            ) : (
                              <User size={11} />
                            )}
                            {e.actorLabel}
                          </span>
                        </span>
                        {expanded ? (
                          <ChevronDown
                            size={14}
                            className="text-gray-400 mt-1 flex-shrink-0"
                          />
                        ) : (
                          <ChevronRight
                            size={14}
                            className="text-gray-400 mt-1 flex-shrink-0"
                          />
                        )}
                      </button>

                      {expanded && (
                        <div className="px-4 pb-4 pl-[4.25rem] space-y-3">
                          {changeRows.length > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-100">
                                    <th className="font-bold py-1.5 pr-3">
                                      Field
                                    </th>
                                    <th className="font-bold py-1.5 pr-3">
                                      Before
                                    </th>
                                    <th className="font-bold py-1.5">After</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {changeRows.map(
                                    ([field, [before, after]]) => (
                                      <tr
                                        key={field}
                                        className="border-b border-gray-50 last:border-0 align-top"
                                      >
                                        <td className="py-1.5 pr-3 font-semibold text-gray-700 whitespace-nowrap">
                                          {field}
                                        </td>
                                        <td className="py-1.5 pr-3 text-gray-500 line-through decoration-gray-300 break-all">
                                          {show(before)}
                                        </td>
                                        <td className="py-1.5 text-gray-900 break-all">
                                          {show(after)}
                                        </td>
                                      </tr>
                                    ),
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                            {e.subject && (
                              <>
                                <dt className="text-gray-400">Order</dt>
                                <dd className="font-mono text-gray-700 break-all select-all">
                                  {e.subject.orderId}
                                  <span className="font-sans text-gray-400">
                                    {" "}
                                    · now {e.subject.orderStatus.toLowerCase()},
                                    payment{" "}
                                    {(
                                      e.subject.paymentStatus ?? "none"
                                    ).toLowerCase()}
                                  </span>
                                </dd>
                              </>
                            )}
                            <dt className="text-gray-400">Action</dt>
                            <dd className="font-mono text-gray-700">
                              {e.action}
                            </dd>
                            <dt className="text-gray-400">{e.entityType} ID</dt>
                            <dd className="font-mono text-gray-700 break-all select-all">
                              {e.entityId}
                            </dd>
                            {e.requestId && (
                              <>
                                <dt className="text-gray-400">Request</dt>
                                <dd
                                  className="font-mono text-gray-700 break-all select-all"
                                  title="Search this in Axiom to see the full request logs"
                                >
                                  {e.requestId}
                                </dd>
                              </>
                            )}
                            <dt className="text-gray-400">Exact time</dt>
                            <dd className="text-gray-700">
                              {new Date(e.createdAt).toLocaleString("en-GB", {
                                timeZone: "Asia/Dhaka",
                              })}{" "}
                              (Dhaka)
                            </dd>
                          </dl>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {totalPages > 1 && (
            <Pager
              page={page}
              totalPages={totalPages}
              disabled={loading}
              onPage={goTo}
            />
          )}
        </div>
      )}
    </div>
  );
}

const num = (n: number) => n.toLocaleString("en-IN");

// 1 … 4 5 6 … 20 — always first, last, and the current page's neighbours.
function pageList(page: number, totalPages: number): (number | "gap")[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (const p of sorted) {
    const prev = out[out.length - 1];
    if (typeof prev === "number" && p - prev === 2) out.push(prev + 1);
    else if (typeof prev === "number" && p - prev > 2) out.push("gap");
    out.push(p);
  }
  return out;
}

function Pager({
  page,
  totalPages,
  disabled,
  onPage,
}: {
  page: number;
  totalPages: number;
  disabled: boolean;
  onPage: (p: number) => void;
}) {
  const arrow =
    "h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed";
  return (
    <nav
      aria-label="Audit log pages"
      className="flex flex-wrap items-center justify-center gap-1"
    >
      <button onClick={() => onPage(1)} disabled={disabled || page <= 1} className={arrow} title="First page">
        <ChevronsLeft size={16} />
      </button>
      <button onClick={() => onPage(page - 1)} disabled={disabled || page <= 1} className={arrow} title="Previous page">
        <ChevronLeft size={16} />
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="w-6 text-center text-xs text-gray-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            disabled={disabled || p === page}
            aria-current={p === page ? "page" : undefined}
            className={`h-8 min-w-8 px-2 rounded-lg text-xs font-bold tabular-nums cursor-pointer disabled:cursor-default ${
              p === page
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button onClick={() => onPage(page + 1)} disabled={disabled || page >= totalPages} className={arrow} title="Next page">
        <ChevronRight size={16} />
      </button>
      <button onClick={() => onPage(totalPages)} disabled={disabled || page >= totalPages} className={arrow} title="Last page">
        <ChevronsRight size={16} />
      </button>
    </nav>
  );
}
