// module/profile/components/admin/OrderCard.tsx
"use client";

import { useState } from "react";
import type { EventOrder } from "@/types/profile";
import { updateOrderStatus } from "@/app/actions/admin";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Mail,
  Phone,
  CreditCard,
  User,
  Loader2,
  MoreHorizontal,
  Shirt,
  Heart,
  Users,
  Hash,
  UserX,
  Pencil,
} from "lucide-react";
import { EditRegistrationForm } from "./EditRegistrationForm";
import { OrderDeliveries } from "./OrderDeliveries";
import { gatewayLabel } from "@/lib/payment/gateway-label";

type Props = {
  order: EventOrder;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (
    orderId: string,
    orderStatus: string,
    paymentStatus: string,
  ) => void;
  /** Called after registration details were edited, so the list can reload. */
  onDetailsSaved?: () => void;
};

// ─── Status Configs ─────────────────────────────────
const ORDER_STATUS: Record<
  string,
  { icon: typeof CheckCircle; color: string; bg: string; label: string }
> = {
  CONFIRMED: {
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    label: "Confirmed",
  },
  PENDING: {
    icon: Clock,
    color: "text-yellow-600",
    bg: "bg-yellow-50 border-yellow-200",
    label: "Pending",
  },
  CANCELLED: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    label: "Cancelled",
  },
};

const PAYMENT_STATUS: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  PAID: { color: "text-green-700", bg: "bg-green-100", label: "Paid" },
  PENDING: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Pending" },
  FAILED: { color: "text-red-700", bg: "bg-red-100", label: "Failed" },
  REFUNDED: {
    color: "text-orange-700",
    bg: "bg-orange-100",
    label: "Refunded",
  },
};

export function OrderCard({
  order,
  expanded,
  onToggle,
  onStatusChange,
  onDetailsSaved,
}: Props) {
  const [showActions, setShowActions] = useState(false);
  const [updating, setUpdating] = useState(false);

  const isGuest = order.user.isGuest;

  const orderConfig = ORDER_STATUS[order.status] || ORDER_STATUS.PENDING;
  const paymentConfig = order.payment
    ? PAYMENT_STATUS[order.payment.status] || PAYMENT_STATUS.PENDING
    : null;

  const OrderIcon = orderConfig.icon;

  // Use registration name if available, fallback to user name
  const displayName =
    order.registration?.fullName ||
    [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") ||
    order.user.email.split("@")[0] ||
    "Guest";

  const userInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const displayEmail = isGuest
    ? (order.registration?.email ?? "—")
    : order.user.email;

  const orderAmount = order.payment?.amount || order.package.price * order.qty;
  // "ShurjoPay" / "SSLCommerz" (null = never reached a gateway)
  const gateway = gatewayLabel(order.payment?.paymentGateway, order.source);

  const cardBg = expanded
    ? isGuest
      ? "bg-amber-50 border-amber-200"
      : orderConfig.bg
    : "border-gray-200 bg-white";

  const [editing, setEditing] = useState(false);

  const handleStatusChange = async (
    newOrderStatus: string,
    newPaymentStatus: string,
  ) => {
    setUpdating(true);
    setShowActions(false);

    const result = await updateOrderStatus(
      order.id,
      newOrderStatus,
      newPaymentStatus,
    );

    if (result.success) {
      onStatusChange(order.id, newOrderStatus, newPaymentStatus);
    }

    setUpdating(false);
  };

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${cardBg}`}
    >
      {/* ─── Header Row ─── */}
      <div
        onClick={onToggle}
        className="flex flex-wrap items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors sm:flex-nowrap"
      >
        {/* Avatar */}
        <div className="flex-shrink-0 relative">
          {order.user.image ? (
            <img
              src={order.user.image}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div
              className={`w-9 h-9 rounded-full border flex items-center justify-center ${
                isGuest
                  ? "bg-amber-100 border-amber-200"
                  : "bg-gray-100 border-gray-200"
              }`}
            >
              <span
                className={`text-xs font-bold ${
                  isGuest ? "text-amber-600" : "text-gray-500"
                }`}
              >
                {userInitials}
              </span>
            </div>
          )}

          {/* Guest indicator dot */}
          {/* {isGuest && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center">
              <UserX size={7} className="text-white" />
            </span>
          )} */}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-900 truncate">
              {displayName}
            </p>
            <span className="px-1.5 py-0.5 text-[10px] bg-indigo-50 text-indigo-600 rounded-full font-bold flex-shrink-0">
              {order.package.distance}
            </span>

            {/* Guest badge */}
            {isGuest && (
              <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded-full font-bold flex-shrink-0 border border-amber-200">
                Guest
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">
              {order.package.name}
              {order.qty > 1 ? ` × ${order.qty}` : ""}
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400">
              {new Date(order.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Amount + Statuses — own line on phones (under the name), same line from sm up */}
        <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:flex-shrink-0 sm:flex-nowrap sm:gap-2">
          <span className="text-sm font-bold text-gray-900">
            ৳{orderAmount.toLocaleString()}
          </span>

          {/* Order Status */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${orderConfig.bg} ${orderConfig.color}`}
          >
            <OrderIcon size={11} />
            {orderConfig.label}
          </span>

          {/* Payment Status */}
          {paymentConfig && (
            <span
              className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${paymentConfig.bg} ${paymentConfig.color}`}
            >
              {paymentConfig.label}
            </span>
          )}

          {/* Payment gateway (ShurjoPay / SSLCommerz) — online orders that reached one */}
          {order.source !== "MANUAL" && gateway && (
            <span
              className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                gateway === "SSLCommerz"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-teal-50 text-teal-700 border-teal-200"
              }`}
              title={`Payment gateway: ${gateway}`}
            >
              {gateway}
            </span>
          )}

          {order.source === "MANUAL" && (
            <span
              className="px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 rounded-full"
              title="Registered manually by an admin"
            >
              Manual
            </span>
          )}

          {expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </div>

      {/* ─── Expanded Details ─── */}
      {expanded && (
        <div className="border-t border-gray-200/60 px-4 pb-4 pt-3 space-y-4">
          {/* ─── Guest Notice ─── */}
          {isGuest && (
            <div className="flex items-center gap-2 p-2.5 bg-amber-100 border border-amber-200 rounded-lg ">
              <UserX size={14} className="text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700 font-medium">
                Guest checkout — no account associated with this order
              </p>
            </div>
          )}
          {order.adminNote && (
            <p className="text-xs text-gray-500 italic mt-2 whitespace-pre-line break-words">
              Note: {order.adminNote}
            </p>
          )}
          {/* ─── Contact Info ─── */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Contact
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600">
              {/* Email — real email for guests, user email for real users */}
              {displayEmail !== "—" && (
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-gray-400" />
                  <a
                    href={`mailto:${displayEmail}`}
                    className="hover:text-gray-900 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {displayEmail}
                  </a>
                </span>
              )}

              {(order.registration?.phone || order.user.phone) && (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} className="text-gray-400" />
                  <a
                    href={`tel:${order.registration?.phone || order.user.phone}`}
                    className="hover:text-gray-900 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {order.registration?.phone || order.user.phone}
                  </a>
                </span>
              )}
              <span className="text-gray-400">
                {new Date(order.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
          {/* ─── Registration Details ─── */}
          {order.registration && editing && (
            <EditRegistrationForm
              registration={order.registration}
              orderId={order.id}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                onDetailsSaved?.();
              }}
            />
          )}
          {order.registration && !editing && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Registration Details
                  {order.registration.bibNumber && (
                    <span className="ml-2 normal-case tracking-normal text-gray-500">
                      · BIB {order.registration.bibNumber}
                    </span>
                  )}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                  title="Fix name, t-shirt size, contacts, BIB…"
                >
                  <Pencil size={11} />
                  Edit
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  {
                    icon: User,
                    label: "Gender",
                    value: order.registration.gender,
                  },
                  {
                    icon: Shirt,
                    label: "T-Shirt",
                    value: order.registration.tshirtSize,
                  },
                  {
                    icon: Users,
                    label: "Age Category",
                    value: order.registration.ageCategory,
                  },
                  {
                    icon: Heart,
                    label: "Blood Group",
                    value: order.registration.bloodGroup,
                  },
                  {
                    icon: Hash,
                    label: "Runner Type",
                    value: order.registration.runnerCategory,
                  },
                  ...(order.registration.communityName
                    ? [
                        {
                          icon: Users,
                          label: "Community",
                          value: order.registration.communityName,
                        },
                      ]
                    : []),
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100"
                  >
                    <item.icon
                      size={12}
                      className="text-gray-400 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wider">
                        {item.label}
                      </p>
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {item.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Emergency Contact */}
              {order.registration.emergencyContactName && (
                <div className="mt-2 p-2 bg-red-50/50 rounded-lg border border-red-100">
                  <p className="text-[9px] text-red-400 uppercase tracking-wider font-bold mb-0.5">
                    Emergency Contact
                  </p>
                  <p className="text-xs text-gray-700">
                    {order.registration.emergencyContactName}
                    {order.registration.emergencyContactNumber && (
                      <>
                        {" · "}
                        <a
                          href={`tel:${order.registration.emergencyContactNumber}`}
                          className="text-red-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {order.registration.emergencyContactNumber}
                        </a>
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
          {/* ─── Package & Payment ─── */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Package & Payment
            </p>
            <div className="p-3 bg-white rounded-lg border border-gray-100 space-y-2">
              {/* Package Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 text-[10px] bg-indigo-50 text-indigo-600 rounded-full font-bold">
                    {order.package.distance}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {order.package.name}
                  </span>
                  {order.qty > 1 && (
                    <span className="text-xs text-gray-400">× {order.qty}</span>
                  )}
                </div>
                <span className="text-sm font-bold text-gray-900">
                  ৳{(order.package.price * order.qty).toLocaleString()}
                </span>
              </div>

              {/* Payment Info */}
              {order.payment && (
                <>
                  <div className="border-t border-dashed border-gray-200 pt-2">
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                      {order.payment.paymentMethod && (
                        <span className="flex items-center gap-1">
                          <CreditCard size={12} className="text-gray-400" />
                          {order.payment.paymentMethod}
                          {gateway && gateway.toLowerCase() !== order.payment.paymentMethod.toLowerCase() &&
                            ` via ${gateway}`}
                        </span>
                      )}
                      {order.payment.transactionId && (
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Hash size={12} className="text-gray-400" />
                          {order.payment.transactionId}
                        </span>
                      )}
                      {order.payment.paymentId && (
                        <span className="text-gray-400 font-mono text-[11px]">
                          ID: {order.payment.paymentId}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between pt-2 border-t border-dashed border-gray-200">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Amount Charged
                    </span>
                    <span className="text-base font-bold text-gray-900">
                      ৳{Number(order.payment.amount).toLocaleString()}{" "}
                      <span className="text-xs font-normal text-gray-400">
                        {order.payment.currency}
                      </span>
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* ─── Emails / SMS sent for this order ─── */}
          <OrderDeliveries orderId={order.id} canResend={order.status === "CONFIRMED"} />

          {/* ─── Status Actions ─── */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Update Status
            </p>

            <div className="relative">
              {updating ? (
                <Loader2 size={16} className="animate-spin text-gray-400" />
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowActions(!showActions);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <MoreHorizontal size={13} />
                    Change Status
                  </button>

                  {showActions && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowActions(false);
                        }}
                      />

                      {/* Dropdown */}
                      <div className="absolute right-0 bottom-full mb-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1.5">
                        {/* Confirm + Mark Paid */}
                        {order.status !== "CONFIRMED" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange("CONFIRMED", "PAID");
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 transition-colors cursor-pointer"
                          >
                            <CheckCircle size={14} />
                            Confirm & Mark Paid
                          </button>
                        )}

                        {/* Mark Payment as Paid Only */}
                        {order.payment?.status !== "PAID" &&
                          order.status === "CONFIRMED" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange("CONFIRMED", "PAID");
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 transition-colors cursor-pointer"
                            >
                              <CreditCard size={14} />
                              Mark as Paid
                            </button>
                          )}

                        {/* Set to Pending */}
                        {order.status !== "PENDING" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange("PENDING", "PENDING");
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-yellow-700 hover:bg-yellow-50 transition-colors cursor-pointer"
                          >
                            <Clock size={14} />
                            Set to Pending
                          </button>
                        )}

                        <div className="border-t border-gray-100 my-1" />

                        {/* Cancel Order */}
                        {order.status !== "CANCELLED" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  "Cancel this order? Slots will be freed.",
                                )
                              ) {
                                handleStatusChange("CANCELLED", "FAILED");
                              }
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <XCircle size={14} />
                            Cancel Order
                          </button>
                        )}

                        {/* Refund */}
                        {order.payment?.status === "PAID" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Mark this order as refunded?")) {
                                handleStatusChange("CANCELLED", "REFUNDED");
                              }
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-orange-700 hover:bg-orange-50 transition-colors cursor-pointer"
                          >
                            <AlertCircle size={14} />
                            Refund
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
