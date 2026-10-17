// module/profile/components/admin/EventForm.tsx
"use client";

import { useState } from "react";
import {
  REGISTRATION_STATUSES,
  REGISTRATION_STATUS_OPTIONS,
  isRegistrationStatus,
} from "@/lib/registration-status";
import type {
  AdminEvent,
  AdminOrganizer,
  EventFormData,
  PackageFormData,
} from "@/types/profile";
import {
  createEvent,
  updateEvent,
  addPackage,
  getAdminEvents,
  createOrganizer,
} from "@/app/actions/admin";
import { ImageUpload } from "./ImageUpload";
import { EditablePackageRow } from "./EditablePackageRow";
import Input from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Loader2, Plus, Save, X } from "lucide-react";
import dynamic from "next/dynamic";
import { ImageVpsUpload } from "./ImageVpsUpload";

const RichTextEditor = dynamic(
  () =>
    import("./RichTextEditor").then((mod) => ({
      default: mod.RichTextEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="h-10 bg-gray-50 border-b border-gray-200 animate-pulse" />
        <div className="h-[200px] bg-white animate-pulse" />
      </div>
    ),
  },
);

type EventFormProps = {
  event: AdminEvent | null;
  organizers: AdminOrganizer[];
  onSuccess: (events: AdminEvent[]) => void;
  onCancel: () => void;
};

export function EventForm({
  event,
  organizers,
  onSuccess,
  onCancel,
}: EventFormProps) {
  const isEditing = !!event;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Event form
  const [form, setForm] = useState<EventFormData>({
    name: event?.name || "",
    slug: event?.slug || "",
    date: event?.date ? new Date(event.date).toISOString().split("T")[0] : "",
    // time: event?.time
    //   ? new Date(event.time).toLocaleTimeString("en-GB", {
    //       hour: "2-digit",
    //       minute: "2-digit",
    //     })
    //   : "",
    // <input type="time"> needs 24h "HH:mm"; event times are stored as UTC
    // wall-clock time (see formatEventTimeUTC), so read the UTC hours/minutes.
    time: event?.time ? new Date(event.time).toISOString().slice(11, 16) : "",
    address: event?.address || "",
    eventType: event?.eventType || "LIVE",
    description: event?.description || "",
    shortDesc: event?.shortDesc || "",
    bannerImage: event?.bannerImage || "",
    thumbImage: event?.thumbImage || "",
    minPackagePrice: event?.minPackagePrice?.toString() || "",
    organizerId: event?.organizerId?.toString() || "",
    status: event?.status || "ACTIVE",
    registrationStatus: event?.registrationStatus || "OPEN",
  });

  // Packages
  const [packages, setPackages] = useState(event?.packages || []);
  const [newPackage, setNewPackage] = useState<PackageFormData>({
    name: "",
    distance: "",
    price: "",
    availableSlots: "",
  });
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [pkgLoading, setPkgLoading] = useState<number | null>(null);

  // New organizer
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [newOrg, setNewOrg] = useState({
    name: "",
    email: "",
    phone: "",
    logo: "",
  });
  const [orgList, setOrgList] = useState(organizers);

  const updateField = (field: keyof EventFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
    setSuccess(false);

    if (field === "name") {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
      setForm((prev) => ({ ...prev, slug }));
    }
  };

  // ─── Refresh packages from server ─────────────────
  const refreshPackages = async () => {
    if (!event) return;
    const { events } = await getAdminEvents();
    const updated = events.find((e: any) => e.id === event.id);
    if (updated) {
      setPackages(updated.packages);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const required: (keyof EventFormData)[] = [
      "name",
      "slug",
      "date",
      "time",
      "address",
      "description",
      "bannerImage",
      "organizerId",
    ];
    for (const field of required) {
      if (!form[field]) {
        setError(`${field} is required`);
        return;
      }
    }

    setLoading(true);

    const safeForm = JSON.parse(JSON.stringify(form));

    let result;
    if (isEditing && event) {
      result = await updateEvent(event.id, safeForm);
    } else {
      result = await createEvent(safeForm);
    }

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSuccess(true);
    const { events } = await getAdminEvents();
    onSuccess(events);
  };

  const handleAddPackage = async () => {
    if (!event) return;
    if (
      !newPackage.name ||
      !newPackage.distance ||
      !newPackage.price ||
      !newPackage.availableSlots
    ) {
      setError("All package fields are required");
      return;
    }

    setPkgLoading(-1);
    setError("");
    const safeArgs = JSON.parse(JSON.stringify(newPackage));
    const result = await addPackage(event.id, safeArgs);

    if (result.error) {
      setError(result.error);
    } else {
      await refreshPackages();
      setNewPackage({ name: "", distance: "", price: "", availableSlots: "" });
      setShowAddPackage(false);
    }
    setPkgLoading(null);
  };

  const handleCreateOrganizer = async () => {
    if (!newOrg.name) return;
    const safeArgs = JSON.parse(JSON.stringify(newOrg));
    const result = await createOrganizer(safeArgs);
    if (result.error) {
      setError(result.error);
    } else {
      setOrgList((prev) => [
        ...prev,
        {
          id: result.organizerId!,
          name: newOrg.name,
          email: newOrg.email,
          phone: newOrg.phone,
          logo: newOrg.logo,
        },
      ]);
      setForm((prev) => ({
        ...prev,
        organizerId: String(result.organizerId),
      }));
      setShowNewOrg(false);
      setNewOrg({ name: "", email: "", phone: "", logo: "" });
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        {isEditing ? "Edit Event" : "Create New Event"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name & Slug */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Event Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g. Dhaka City Marathon 2026"
              className="h-11 border border-gray-200 bg-gray-50 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Slug <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.slug}
              onChange={(e) => updateField("slug", e.target.value)}
              placeholder="dhaka-city-marathon-2026"
              className="h-11 border border-gray-200 bg-gray-50 rounded-lg"
            />
          </div>
        </div>

        {/* Date, Time, Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => updateField("date", e.target.value)}
              className="h-11 border border-gray-200 bg-gray-50 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Time <span className="text-red-500">*</span>
            </label>
            <Input
              type="time"
              value={form.time}
              onChange={(e) => updateField("time", e.target.value)}
              className="h-11 border border-gray-200 bg-gray-50 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Event Type
            </label>
            <Select
              value={form.eventType}
              onValueChange={(val) => updateField("eventType", val)}
            >
              <SelectTrigger className="h-11 rounded-lg border border-gray-200 bg-gray-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200">
                <SelectItem value="LIVE">Live</SelectItem>
                <SelectItem value="VIRTUAL">Virtual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Address <span className="text-red-500">*</span>
          </label>
          <Input
            value={form.address}
            onChange={(e) => updateField("address", e.target.value)}
            placeholder="Hatirjheel, Dhaka, Bangladesh"
            className="h-11 border border-gray-200 bg-gray-50 rounded-lg"
          />
        </div>

        {/* Organizer */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Organizer <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setShowNewOrg(!showNewOrg)}
              className="text-xs text-neon-lime font-bold uppercase tracking-wider hover:underline cursor-pointer"
            >
              {showNewOrg ? "Cancel" : "+ New Organizer"}
            </button>
          </div>

          {showNewOrg ? (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
              <Input
                value={newOrg.name}
                onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                placeholder="Organizer name"
                className="h-10 border border-gray-200 bg-white rounded-lg"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={newOrg.email}
                  onChange={(e) =>
                    setNewOrg({ ...newOrg, email: e.target.value })
                  }
                  placeholder="Email (optional)"
                  className="h-10 border border-gray-200 bg-white rounded-lg"
                />
                <Input
                  value={newOrg.phone}
                  onChange={(e) =>
                    setNewOrg({ ...newOrg, phone: e.target.value })
                  }
                  placeholder="Phone (optional)"
                  className="h-10 border border-gray-200 bg-white rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateOrganizer}
                className="text-xs font-bold bg-gray-900 text-white px-4 py-2 rounded-lg cursor-pointer"
              >
                Create Organizer
              </button>
            </div>
          ) : (
            <Select
              value={form.organizerId}
              onValueChange={(val) => updateField("organizerId", val)}
            >
              <SelectTrigger className="h-11 rounded-lg border border-gray-200 bg-gray-50">
                <SelectValue placeholder="Select organizer" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200">
                {orgList.map((org) => (
                  <SelectItem key={org.id} value={String(org.id)}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {/* Short Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Short Description{" "}
              <span className="text-gray-400 font-normal normal-case">
                (optional)
              </span>
            </label>
            <span
              className={`text-[10px] font-medium ${
                form.shortDesc.length > 255
                  ? "text-red-500"
                  : form.shortDesc.length > 200
                    ? "text-yellow-500"
                    : "text-gray-400"
              }`}
            >
              {form.shortDesc.length}/255
            </span>
          </div>
          <input
            value={form.shortDesc}
            onChange={(e) => {
              if (e.target.value.length <= 255) {
                updateField("shortDesc", e.target.value);
              }
            }}
            placeholder="Brief one-liner for cards and previews..."
            className="w-full h-11 px-3 border border-gray-200 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
          />
        </div>

        {/* Description */}
        {/* <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={4}
            placeholder="Describe your event..."
            className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
        </div> */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Description <span className="text-red-500">*</span>
          </label>
          <RichTextEditor
            value={form.description}
            onChange={(html) => updateField("description", html)}
            placeholder="Write your full event description..."
          />
        </div>

        {/* Images */}
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Banner Image <span className="text-red-500">*</span>
            </label>
            {/* <ImageUpload
              value={form.bannerImage}
              onChange={(url) => updateField("bannerImage", url)}
              bucket="event-images"
              folder="banners"
              label="Upload Banner Image"
              aspectRatio="aspect-[16/7]"
              maxSizeMB={5}
            /> */}

            <ImageVpsUpload
              value={form.bannerImage}
              onChange={(url) => updateField("bannerImage", url)}
              folder="banners"
              aspectRatio="aspect-[16/7]"
              maxSizeMB={5}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Thumbnail Image{" "}
              <span className="text-gray-400 font-normal normal-case">
                (optional)
              </span>
            </label>
            {/* <ImageUpload
              value={form.thumbImage}
              onChange={(url) => updateField("thumbImage", url)}
              bucket="event-images"
              folder="thumbnails"
              label="Upload Thumbnail"
              aspectRatio="aspect-square"
              maxSizeMB={2}
            /> */}
            <ImageVpsUpload
              value={form.thumbImage}
              onChange={(url) => updateField("thumbImage", url)}
              folder="thumbnails"
              aspectRatio="aspect-square"
              maxSizeMB={2}
            />
          </div>
        </div>

        {/* Min Package Price & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Min Package Price
            </label>
            <Input
              type="number"
              value={form.minPackagePrice}
              onChange={(e) => updateField("minPackagePrice", e.target.value)}
              placeholder="500"
              className="h-11 border border-gray-200 bg-gray-50 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Status
            </label>
            <Select
              value={form.status}
              onValueChange={(val) => updateField("status", val)}
            >
              <SelectTrigger className="h-11 rounded-lg border border-gray-200 bg-gray-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200">
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Registration
            </label>
            <Select
              value={form.registrationStatus}
              onValueChange={(val) => updateField("registrationStatus", val)}
            >
              <SelectTrigger className="h-11 rounded-lg border border-gray-200 bg-gray-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200">
                {REGISTRATION_STATUSES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {REGISTRATION_STATUS_OPTIONS[v].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-[11px] text-gray-500">
              {isRegistrationStatus(form.registrationStatus)
                ? REGISTRATION_STATUS_OPTIONS[form.registrationStatus].help
                : ""}
            </p>
          </div>
        </div>

        {!isEditing && (
          <h2 className="text-[20px] text-gray-400 mt-2 text-center">
            You can add Event packages after you create the event.
          </h2>
        )}

        {/* ─── Packages Section (Edit Mode Only) ─── */}
        {isEditing && (
          <div className="border-t border-gray-200 pt-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Packages ({packages.length})
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Click the edit icon to modify a package inline
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPackage(!showAddPackage)}
                className="text-xs font-bold text-neon-lime uppercase tracking-wider hover:underline cursor-pointer flex items-center gap-1"
              >
                {showAddPackage ? (
                  <>
                    <X size={12} /> Cancel
                  </>
                ) : (
                  <>
                    <Plus size={12} /> Add Package
                  </>
                )}
              </button>
            </div>

            {/* Add Package Form */}
            {showAddPackage && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                  New Package
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Input
                    value={newPackage.name}
                    onChange={(e) =>
                      setNewPackage({ ...newPackage, name: e.target.value })
                    }
                    placeholder="Name (e.g. 5K Fun Run)"
                    className="h-10 border border-gray-200 bg-white rounded-lg"
                  />
                  <Input
                    value={newPackage.distance}
                    onChange={(e) =>
                      setNewPackage({
                        ...newPackage,
                        distance: e.target.value,
                      })
                    }
                    placeholder="Distance (e.g. 5K)"
                    className="h-10 border border-gray-200 bg-white rounded-lg"
                  />
                  <Input
                    type="number"
                    value={newPackage.price}
                    onChange={(e) =>
                      setNewPackage({ ...newPackage, price: e.target.value })
                    }
                    placeholder="Price"
                    className="h-10 border border-gray-200 bg-white rounded-lg"
                  />
                  <Input
                    type="number"
                    value={newPackage.availableSlots}
                    onChange={(e) =>
                      setNewPackage({
                        ...newPackage,
                        availableSlots: e.target.value,
                      })
                    }
                    placeholder="Slots"
                    className="h-10 border border-gray-200 bg-white rounded-lg"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddPackage}
                  disabled={pkgLoading === -1}
                  className="mt-3 flex items-center gap-2 text-xs font-bold bg-gray-900 text-white px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {pkgLoading === -1 && (
                    <Loader2 size={12} className="animate-spin" />
                  )}
                  Add Package
                </button>
              </div>
            )}

            {/* ─── Editable Package Rows ─── */}
            {packages.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
                <p className="text-sm text-gray-400">No packages yet</p>
                <p className="text-xs text-gray-300 mt-1">
                  Add a package to get started
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {packages.map((pkg) => (
                  <EditablePackageRow
                    key={pkg.id}
                    pkg={pkg}
                    onUpdate={refreshPackages}
                    onDelete={() =>
                      setPackages((prev) => prev.filter((p) => p.id !== pkg.id))
                    }
                  />
                ))}
              </div>
            )}

            {/* Packages Summary */}
            {packages.length > 0 && (
              <div className="mt-4 flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    <span className="font-bold text-gray-700">
                      {packages.length}
                    </span>{" "}
                    packages
                  </span>
                  <span>
                    <span className="font-bold text-gray-700">
                      {packages.reduce((sum, p) => sum + p.availableSlots, 0)}
                    </span>{" "}
                    total slots
                  </span>
                  <span>
                    <span className="font-bold text-gray-700">
                      {packages.reduce((sum, p) => sum + p.usedSlots, 0)}
                    </span>{" "}
                    used
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Price range:{" "}
                  <span className="font-bold text-gray-700">
                    ৳
                    {Math.min(
                      ...packages.map((p) => Number(p.price)),
                    ).toLocaleString()}
                  </span>
                  {" – "}
                  <span className="font-bold text-gray-700">
                    ৳
                    {Math.max(
                      ...packages.map((p) => Number(p.price)),
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <p className="text-green-600 text-sm font-medium">
              Event {isEditing ? "updated" : "created"} successfully!
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 text-sm font-bold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer uppercase tracking-wider"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEditing ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditing ? "Update Event" : "Create Event"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
