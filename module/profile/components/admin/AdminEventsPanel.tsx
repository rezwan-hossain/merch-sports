// module/profile/components/admin/AdminEventsPanel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminEvent, AdminOrganizer } from "@/types/profile";
import { EventForm } from "./EventForm";
import { Plus, ArrowLeft } from "lucide-react";
import { EventsList } from "./EventsList";
import { EventStatsBar } from "./EventStatsBar";
import { EventFilters } from "./EventFilters";
import { EventOrdersModal } from "./EventOrdersModal";
import { EventActivityModal } from "./EventActivityModal";
import { PaymentIssuesBanner } from "./PaymentIssuesBanner";
import { GatewayAlertBanner } from "./GatewayAlertBanner";
import { PaymentIssuesModal } from "./PaymentIssuesModal";
import { getPaymentIssues } from "@/app/actions/payment-issues";
import type { PaymentIssue } from "@/types/payment-issues";

type AdminEventsPanelProps = {
  initialEvents: AdminEvent[];
  initialOrganizers: AdminOrganizer[];
};

type View = "list" | "create" | "edit";

export function AdminEventsPanel({
  initialEvents,
  initialOrganizers,
}: AdminEventsPanelProps) {
  const [view, setView] = useState<View>("list");
  const [events, setEvents] = useState(initialEvents);
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const [filteredEvents, setFilteredEvents] = useState(initialEvents);
  const [viewOrdersEvent, setViewOrdersEvent] = useState<AdminEvent | null>(
    null,
  );
  const [viewActivityEvent, setViewActivityEvent] = useState<AdminEvent | null>(
    null,
  );

  // Payments needing attention — loaded once, shared by the banner (totals),
  // the event rows (per-event badge) and the review window.
  const [paymentIssues, setPaymentIssues] = useState<PaymentIssue[] | null>(null);
  const [issuesFor, setIssuesFor] = useState<string | null>(null); // "all" | eventId | null (closed)
  const loadIssues = useCallback(
    () => getPaymentIssues().then(({ issues }) => setPaymentIssues(issues)),
    [],
  );
  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);
  const issueCounts: Record<string, number> = {};
  for (const i of paymentIssues ?? []) {
    issueCounts[i.event.id] = (issueCounts[i.event.id] ?? 0) + 1;
  }

  const handleCreate = () => {
    setEditingEvent(null);
    setView("create");
  };

  const handleEdit = (event: AdminEvent) => {
    setEditingEvent(event);
    setView("edit");
  };

  const handleBack = () => {
    setView("list");
    setEditingEvent(null);
  };

  const handleSuccess = (updatedEvents: AdminEvent[]) => {
    setEvents(updatedEvents);
    setView("list");
    setEditingEvent(null);
    setFilteredEvents(updatedEvents);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        {view === "list" ? (
          <>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Manage Events</h2>
              <p className="text-sm text-gray-500 mt-1">
                {events.length} event{events.length !== 1 ? "s" : ""} total
              </p>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 bg-gray-900 text-white font-bold uppercase tracking-wider text-xs rounded-lg px-5 py-3 hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <Plus size={16} />
              Create Event
            </button>
          </>
        ) : (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            Back to Events
          </button>
        )}
      </div>

      {/* Content */}
      {view === "list" && (
        <>
          {/* Online payments can't start (ShurjoPay refusing / unreachable) */}
          <GatewayAlertBanner />

          {/* Payments the automatic handling leaves to a person */}
          <PaymentIssuesBanner
            issues={paymentIssues}
            onOpen={() => setIssuesFor("all")}
          />

          {/* Stats */}
          <EventStatsBar events={events} />

          {/* Filters */}
          <EventFilters events={events} onFilter={setFilteredEvents} />

          <EventsList
            // events={events}
            events={filteredEvents}
            onEdit={handleEdit}
            onViewOrders={setViewOrdersEvent}
            onViewActivity={setViewActivityEvent}
            issueCounts={issueCounts}
            onViewIssues={(event) => setIssuesFor(event.id)}
            onRefresh={handleSuccess}
          />
        </>
      )}

      {(view === "create" || view === "edit") && (
        <EventForm
          event={editingEvent}
          organizers={initialOrganizers}
          onSuccess={handleSuccess}
          onCancel={handleBack}
        />
      )}

      {/* Orders Modal */}
      {viewOrdersEvent && (
        <EventOrdersModal
          event={viewOrdersEvent}
          onClose={() => setViewOrdersEvent(null)}
        />
      )}

      {/* Payments needing attention */}
      {issuesFor && (
        <PaymentIssuesModal
          events={events.map((e) => ({ id: e.id, name: e.name }))}
          initialEventId={issuesFor}
          onClose={() => {
            setIssuesFor(null);
            void loadIssues();
          }}
        />
      )}

      {/* Activity Modal */}
      {viewActivityEvent && (
        <EventActivityModal
          event={viewActivityEvent}
          onClose={() => setViewActivityEvent(null)}
        />
      )}
    </div>
  );
}
