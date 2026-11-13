// module/profile/components/admin/EventOrdersModal.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { gatewayLabel } from "@/lib/payment/gateway-label";
import {
  getEventOrdersPaged,
  getEventOrdersForExport,
} from "@/app/actions/event-orders";
import type {
  AdminEvent,
  EventOrder,
  OrderFilterState,
  OrderStats,
} from "@/types/profile";
import { OrderStatsRow } from "./OrderStatsRow";
import { OrderFilters } from "./OrderFilters";
import { OrderCard } from "./OrderCard";
import { ManualRegistrationForm } from "./ManualRegistrationForm";
import {
  X,
  Loader2,
  ShoppingBag,
  Download,
  RefreshCw,
  UserPlus,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type View = "list" | "create";

type Props = {
  event: AdminEvent;
  onClose: () => void;
  /** Open straight into the manual registration form. */
  initialView?: View;
};

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

const DEFAULT_FILTERS: OrderFilterState = {
  search: "",
  paymentStatus: "all",
  orderStatus: "all",
  source: "all",
  sortBy: "newest",
};

const formatBirthDate = (date: Date | string): string => {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

/** RFC-4180 escaping — quote only when needed, double any inner quotes. */
const esc = (value: unknown): string => {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function EventOrdersModal({ event, onClose, initialView }: Props) {
  const [view, setView] = useState<View>(initialView ?? "list");

  // ─── Server-driven list state ────────────────────
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [total, setTotal] = useState(0); // rows matching the current filters
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<OrderStats | null>(null);

  const [firstLoad, setFirstLoad] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderFilterState>(DEFAULT_FILTERS);

  // Typing shouldn't fire a request per keystroke. Dropdowns and page clicks
  // are instant; only the search box waits.
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);
  // Guards against a slow early request landing after a newer one.
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(filters.search),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [filters.search]);

  // ─── Load a page (orders + total + stats in one call) ───
  const loadPage = useCallback(async () => {
    const id = ++requestId.current;
    setFetching(true);

    const result = await getEventOrdersPaged(event.id, {
      search: debouncedSearch,
      paymentStatus: filters.paymentStatus,
      orderStatus: filters.orderStatus,
      source: filters.source,
      sortBy: filters.sortBy,
      page,
      pageSize: PAGE_SIZE,
    });

    // A newer request already started — throw this result away.
    if (id !== requestId.current) return;

    setError(result.error ?? "");
    setOrders(result.orders);
    setTotal(result.total);
    if (result.stats) setStats(result.stats);
    setFetching(false);
    setFirstLoad(false);
  }, [
    event.id,
    debouncedSearch,
    filters.paymentStatus,
    filters.orderStatus,
    filters.source,
    filters.sortBy,
    page,
  ]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  // ─── Close on Escape ─────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (view === "create") setView("list");
      else onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, view]);

  // ─── Prevent body scroll ─────────────────────────
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // ─── Handlers ────────────────────────────────────

  // Changing a filter must send you back to page 1 — page 4 of the old
  // result set is meaningless against the new one. Both setters run in the
  // same handler so React batches them into a single fetch.
  const handleFilterChange = (next: OrderFilterState) => {
    setFilters(next);
    setPage(1);
  };

  const handleRefresh = () => void loadPage();

  const handleManualSuccess = async () => {
    setView("list");
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    await loadPage();
  };

  // Update the row immediately so it feels instant, then resync from the
  // server — the status counts and revenue totals have moved too.
  const handleStatusChange = (
    orderId: string,
    newOrderStatus: string,
    newPaymentStatus: string,
  ) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: newOrderStatus,
              payment: o.payment
                ? { ...o.payment, status: newPaymentStatus }
                : null,
            }
          : o,
      ),
    );
    void loadPage();
  };

  // ─── CSV Export ───────────────────────────────────
  // Pulls every row matching the current filters, not just this page.
  const exportCSV = async () => {
    setExporting(true);

    const { orders: all, error: exportError } = await getEventOrdersForExport(
      event.id,
      {
        search: debouncedSearch,
        paymentStatus: filters.paymentStatus,
        orderStatus: filters.orderStatus,
        source: filters.source,
        sortBy: filters.sortBy,
      },
    );

    if (exportError) {
      setError(exportError);
      setExporting(false);
      return;
    }

    const headers = [
      "Order ID",
      "Source",
      "BIB Number",
      "Order Status",
      "Registration Name",
      "User Email",
      "Registration Email",
      "Phone",
      "Gender",
      "Age Category",
      "Birth Date",
      "Blood Group",
      "T-Shirt Size",
      "Runner Category",
      "Community",
      "Package",
      "Distance",
      "Qty",
      "Package Price",
      "Payment Amount",
      "Payment Status",
      "Payment Method",
      "Payment Gateway",
      "Transaction ID",
      "Emergency Contact",
      "Emergency Phone",
      "Admin Note",
      "Order Date",
    ];

    const rows = all.map((order) => [
      order.id,
      order.source,
      order.registration?.bibNumber || "",
      order.status,
      order.registration?.fullName || "",
      order.user.email,
      order.registration?.email || "",
      order.registration?.phone || order.user.phone || "",
      order.registration?.gender || "",
      order.registration?.ageCategory || "",
      order.registration?.birthDate
        ? formatBirthDate(order.registration.birthDate)
        : "",
      order.registration?.bloodGroup || "",
      order.registration?.tshirtSize || "",
      order.registration?.runnerCategory || "",
      order.registration?.communityName || "",
      order.package.name,
      order.package.distance,
      order.qty,
      order.package.price,
      order.payment?.amount ?? "",
      order.payment?.status || "N/A",
      order.payment?.paymentMethod || "",
      gatewayLabel(order.payment?.paymentGateway, order.source) || "",
      order.payment?.transactionId || "",
      order.registration?.emergencyContactName || "",
      order.registration?.emergencyContactNumber || "",
      order.adminNote || "",
      new Date(order.createdAt).toISOString(),
    ]);

    const csv = [
      headers.map(esc).join(","),
      ...rows.map((r) => r.map(esc).join(",")),
    ].join("\r\n");

    const BOM = "\uFEFF"; // makes Excel read it as UTF-8
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.slug}-orders-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setExporting(false);
  };

  // ─── Derived ─────────────────────────────────────
  const isCreating = view === "create";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  // stats.total is the whole event; total is the filtered count. The two
  // together tell us whether an empty list means "no orders" or "no matches".
  const eventHasNoOrders = stats !== null && stats.total === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop — inert while the form is open so a stray click can't throw
          away a half-filled registration. */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isCreating ? undefined : onClose}
      />

      <div
        ref={modalRef}
        className="relative bg-white rounded-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col shadow-2xl"
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          {isCreating ? (
            <button
              onClick={() => setView("list")}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
              Back to orders
            </button>
          ) : (
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-900 truncate">
                {event.name}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Order Management ·{" "}
                {stats ? `${stats.total.toLocaleString()} total orders` : "…"}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {!isCreating && (
              <>
                <button
                  onClick={() => setView("create")}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer uppercase tracking-wider"
                  title="Register a participant manually"
                >
                  <UserPlus size={13} />
                  Manual
                </button>

                <button
                  onClick={handleRefresh}
                  disabled={fetching}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  title="Refresh orders"
                >
                  <RefreshCw
                    size={16}
                    className={fetching ? "animate-spin" : ""}
                  />
                </button>

                {total > 0 && (
                  <button
                    onClick={exportCSV}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer uppercase tracking-wider disabled:opacity-50"
                    title={`Export all ${total.toLocaleString()} matching orders`}
                  >
                    {exporting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    CSV
                  </button>
                )}
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isCreating ? (
            <ManualRegistrationForm
              event={event}
              onCancel={() => setView("list")}
              onSuccess={handleManualSuccess}
            />
          ) : firstLoad ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">Loading orders...</p>
            </div>
          ) : eventHasNoOrders ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <ShoppingBag className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-900 font-bold text-lg">No orders yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Orders appear here once people register
              </p>
              <button
                onClick={() => setView("create")}
                className="mt-5 flex items-center gap-2 px-5 py-3 bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <UserPlus size={14} />
                Register someone manually
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-xs font-medium">{error}</p>
                </div>
              )}

              <OrderStatsRow stats={stats} />

              <OrderFilters
                filters={filters}
                onChange={handleFilterChange}
                resultCount={total}
                totalCount={stats?.total ?? total}
              />

              {total === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 font-medium">
                    No orders match your filters
                  </p>
                  <button
                    onClick={() => handleFilterChange(DEFAULT_FILTERS)}
                    className="text-sm text-gray-900 font-bold mt-2 hover:underline cursor-pointer"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                // Dim rather than blank while a page loads — the list doesn't
                // jump and the admin keeps their place.
                <div
                  className={`space-y-3 transition-opacity ${
                    fetching ? "opacity-50" : "opacity-100"
                  }`}
                >
                  {orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onDetailsSaved={() => void loadPage()}
                      expanded={expandedOrder === order.id}
                      onToggle={() =>
                        setExpandedOrder(
                          expandedOrder === order.id ? null : order.id,
                        )
                      }
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Footer ─── */}
        {!isCreating && !firstLoad && !eventHasNoOrders && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0 bg-gray-50/50 rounded-b-2xl">
            <p className="text-xs text-gray-400 whitespace-nowrap">
              {rangeStart}–{rangeEnd} of {total.toLocaleString()}
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || fetching}
                  className="p-1.5 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-bold text-gray-600 px-2 tabular-nums">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || fetching}
                  className="p-1.5 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            <p className="text-xs font-bold text-gray-600 whitespace-nowrap">
              Paid: ৳{(stats?.paidRevenue ?? 0).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
