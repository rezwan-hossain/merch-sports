// module/profile/components/admin/EventsList.tsx
"use client";

import { useState } from "react";
import type { AdminEvent } from "@/types/profile";
import {
  Calendar,
  MapPin,
  Users,
  Package,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Trash2,
  Eye,
  Loader2,
  Activity,
  AlertTriangle,
  CircleStop,
  CirclePlay,
} from "lucide-react";
import Link from "next/link";
import {
  toggleEventActive,
  deleteEvent,
  getAdminEvents,
  setEventRegistrationStatus,
} from "@/app/actions/admin";
import {
  REGISTRATION_STATUS_OPTIONS,
  isRegistrationStatus,
} from "@/lib/registration-status";

// Registration pill under the event name.
const REG_PILL: Record<string, string> = {
  OPEN: "bg-green-50 text-green-700 border-green-200",
  COMING_SOON: "bg-blue-50 text-blue-700 border-blue-200",
  SOLD_OUT: "bg-amber-50 text-amber-700 border-amber-200",
  CLOSED: "bg-gray-100 text-gray-600 border-gray-200",
};

type EventsListProps = {
  events: AdminEvent[];
  onEdit: (event: AdminEvent) => void;
  onViewOrders: (event: AdminEvent) => void; // ← NEW
  onViewActivity: (event: AdminEvent) => void;
  onRefresh: (events: AdminEvent[]) => void;
  /** Open "payments needing attention" per event id. */
  issueCounts?: Record<string, number>;
  onViewIssues?: (event: AdminEvent) => void;
};

export function EventsList({
  events,
  onEdit,
  onViewOrders, // ← NEW
  onViewActivity,
  onRefresh,
  issueCounts = {},
  onViewIssues,
}: EventsListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleToggle = async (eventId: string, currentActive: boolean) => {
    setLoadingId(eventId);
    await toggleEventActive(eventId, !currentActive);
    const { events: updated } = await getAdminEvents();
    onRefresh(updated);
    setLoadingId(null);
  };

  // One-click "End registration" / "Reopen registration" (with a confirm).
  const handleRegistration = async (event: AdminEvent) => {
    const closing = event.registrationStatus !== "CLOSED";
    const question = closing
      ? `End registration for "${event.name}"?\n\nThe event page will show "Registration closed" and no new orders can be placed. Runners who already paid are not affected. You can reopen it any time.`
      : `Reopen registration for "${event.name}"?\n\nPeople will be able to register and pay again.`;
    if (!confirm(question)) return;

    setLoadingId(event.id);
    const result = await setEventRegistrationStatus(event.id, closing ? "CLOSED" : "OPEN");
    if (!result.success) alert(result.error || "Couldn't update registration");
    const { events: updated } = await getAdminEvents();
    onRefresh(updated);
    setLoadingId(null);
  };

  const handleDelete = async (eventId: string, eventName: string) => {
    if (!confirm(`Delete "${eventName}"? This action cannot be undone.`))
      return;
    setLoadingId(eventId);
    await deleteEvent(eventId);
    const { events: updated } = await getAdminEvents();
    onRefresh(updated);
    setLoadingId(null);
  };

  if (events.length === 0) {
    return (
      <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center">
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg font-medium">No events yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Create your first event to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div
          key={event.id}
          className={`bg-white border rounded-xl overflow-hidden transition-all ${
            event.isActive
              ? "border-gray-200"
              : "border-red-200 bg-red-50/30 opacity-75"
          }`}
        >
          <div className="flex flex-col sm:flex-row">
            {/* Image */}
            <div className="relative w-full sm:w-36 h-28 sm:h-auto flex-shrink-0">
              <img
                src={event.bannerImage}
                alt={event.name}
                className="w-full h-full object-cover"
              />
              <span
                className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                  event.status === "ACTIVE"
                    ? "bg-green-500 text-white"
                    : event.status === "CANCELLED"
                      ? "bg-red-500 text-white"
                      : "bg-gray-500 text-white"
                }`}
              >
                {event.status}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">
                    {event.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {event.organizer.name} · {event.slug}
                  </p>
                  {event.registrationStatus && (
                    <span
                      className={`mt-1.5 inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                        REG_PILL[event.registrationStatus] ?? REG_PILL.CLOSED
                      }`}
                    >
                      Registration:{" "}
                      {isRegistrationStatus(event.registrationStatus)
                        ? REGISTRATION_STATUS_OPTIONS[event.registrationStatus].label
                        : event.registrationStatus}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {loadingId === event.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <>
                      <Link
                        href={`/events/${event.slug}`}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye size={15} />
                      </Link>

                      {/* Payments needing attention for this event */}
                      {onViewIssues && (issueCounts[event.id] ?? 0) > 0 && (
                        <button
                          onClick={() => onViewIssues(event)}
                          className="relative p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title={`${issueCounts[event.id]} payment${issueCounts[event.id] === 1 ? " needs" : "s need"} attention`}
                        >
                          <AlertTriangle size={15} />
                          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center px-1 text-[9px] font-bold bg-red-600 text-white rounded-full">
                            {issueCounts[event.id]}
                          </span>
                        </button>
                      )}

                      {/* ← NEW: View Orders Button */}
                      <button
                        onClick={() => onViewOrders(event)}
                        className="relative p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="View Orders"
                      >
                        <Users size={15} />
                        {event._count.orders > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center px-1 text-[9px] font-bold bg-blue-600 text-white rounded-full">
                            {event._count.orders}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => onViewActivity(event)}
                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        title="Activity Log"
                      >
                        <Activity size={15} />
                      </button>

                      {/* End / reopen registration (one click + confirm) */}
                      {event.registrationStatus === "CLOSED" ? (
                        <button
                          onClick={() => handleRegistration(event)}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                          title="Reopen registration"
                          aria-label="Reopen registration"
                        >
                          <CirclePlay size={15} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRegistration(event)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="End registration"
                          aria-label="End registration"
                        >
                          <CircleStop size={15} />
                        </button>
                      )}

                      <button
                        onClick={() => onEdit(event)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleToggle(event.id, event.isActive)}
                        className={`p-2 rounded-lg transition-colors cursor-pointer ${
                          event.isActive
                            ? "text-green-500 hover:bg-green-50"
                            : "text-red-400 hover:bg-red-50"
                        }`}
                        title={event.isActive ? "Deactivate" : "Activate"}
                      >
                        {event.isActive ? (
                          <ToggleRight size={15} />
                        ) : (
                          <ToggleLeft size={15} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(event.id, event.name)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(event.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {event.address}
                </span>
                <span className="flex items-center gap-1">
                  <Package size={12} />
                  {event.packages.length} packages
                </span>
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {event._count.orders} orders
                </span>
              </div>

              {/* Packages Pills */}
              {event.packages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {event.packages.map((pkg) => (
                    <span
                      key={pkg.id}
                      className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded-full font-medium"
                    >
                      {pkg.distance} — ৳{Number(pkg.price)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
