// module/profile/components/admin/HeroForm.tsx
"use client";

import { useState } from "react";
import { createHero, updateHero, getAllHeroes } from "@/app/actions/homepage";
import { ImageUpload } from "./ImageUpload";
import { ToggleSwitch } from "./ToggleSwitch";
import Input from "@/components/ui/input";
import { Check, Loader2, Save, Monitor, Smartphone } from "lucide-react";
import { HeroFormData, HeroSectionData } from "@/types/homepage";
import { ImageVpsUpload } from "./ImageVpsUpload";

type Props = {
  hero: HeroSectionData | null;
  onSuccess: (heroes: HeroSectionData[]) => void;
  onCancel: () => void;
};

export function HeroForm({ hero, onSuccess, onCancel }: Props) {
  const isEditing = !!hero;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<HeroFormData>({
    title: hero?.title || "",
    desktopImage: hero?.desktopImage || "",
    mobileImage: hero?.mobileImage || "",
    slug: hero?.slug || "",
    eventDate: hero?.eventDate
      ? new Date(hero.eventDate).toISOString().slice(0, 16)
      : "",
    showCountdown: hero?.showCountdown ?? true,
    countdownColor: hero?.countdownColor || "#374151",
    showSlugButton: hero?.showSlugButton ?? true,
  });

  const updateField = <K extends keyof HeroFormData>(
    field: K,
    value: HeroFormData[K],
  ) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
    setError("");
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!form.title) {
      setError("Title is required");
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(form.countdownColor)) {
      setError("Countdown color must be a hex color like #374151");
      return;
    }
    if (!form.desktopImage) {
      setError("Desktop image is required");
      return;
    }

    setLoading(true);
    const safeForm = JSON.parse(JSON.stringify(form));

    const result =
      isEditing && hero
        ? await updateHero(hero.id, safeForm)
        : await createHero(safeForm);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSuccess(true);
    const { heroes } = await getAllHeroes();
    onSuccess(heroes);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        {isEditing ? "Edit Hero Section" : "Create Hero Section"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="e.g. Run Beyond Your Limits"
            className="h-11 border border-gray-200 bg-gray-50 rounded-lg"
          />
        </div>

        {/* Images */}
        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
            Background Images
          </p>
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Desktop */}
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Monitor size={12} className="text-gray-400" />
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Desktop <span className="text-red-500">*</span>
                </label>
              </div>
              {/* <ImageUpload
                value={form.desktopImage}
                onChange={(url) => updateField("desktopImage", url)}
                bucket="event-images"
                folder="hero"
                label="Desktop Image"
                aspectRatio="aspect-[16/9]"
                maxSizeMB={5}
              /> */}
              <ImageVpsUpload
                value={form.desktopImage}
                onChange={(url) => updateField("desktopImage", url)}
                folder="hero"
                label="Desktop Image"
                aspectRatio="aspect-[16/9]"
                maxSizeMB={5}
              />
            </div>

            {/* Mobile */}
            <div className="w-full sm:w-41 flex-shrink-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Smartphone size={12} className="text-gray-400" />
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Mobile{" "}
                  <span className="text-gray-400 font-normal normal-case">
                    (optional)
                  </span>
                </label>
              </div>
              {/* <ImageUpload
                value={form.mobileImage}
                onChange={(url) => updateField("mobileImage", url)}
                bucket="event-images"
                folder="hero"
                label="Mobile"
                aspectRatio="aspect-[9/16]"
                maxSizeMB={3}
              /> */}
              <ImageVpsUpload
                value={form.mobileImage}
                onChange={(url) => updateField("mobileImage", url)}
                folder="hero"
                label="Mobile"
                aspectRatio="aspect-[9/16]"
                maxSizeMB={3}
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            If no mobile image is set, desktop image is used on all devices.
          </p>
        </div>

        {/* Slug (Button Link) */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Button Link / Slug{" "}
            <span className="text-gray-400 font-normal normal-case">
              (optional)
            </span>
          </label>
          <Input
            value={form.slug}
            onChange={(e) => updateField("slug", e.target.value)}
            placeholder="e.g. /events/dhaka-marathon-2026 or /register"
            className="h-11 border border-gray-200 bg-gray-50 rounded-lg"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            The "Register Now" button will link to this URL
          </p>
        </div>

        {/* Event Date */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Event Date & Time{" "}
            <span className="text-gray-400 font-normal normal-case">
              (for countdown)
            </span>
          </label>
          <Input
            type="datetime-local"
            value={form.eventDate}
            onChange={(e) => updateField("eventDate", e.target.value)}
            className="h-11 border border-gray-200 bg-gray-50 rounded-lg"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Display Options
          </p>
          <ToggleSwitch
            label="Show Countdown Timer"
            description="Countdown to event date on the hero"
            checked={form.showCountdown}
            onChange={(val) => updateField("showCountdown", val)}
          />
          {form.showCountdown && (
            <div className="flex items-center justify-between gap-4 p-3 border border-gray-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Countdown Color
                </p>
                <p className="text-xs text-gray-500">
                  Color of the countdown numbers and labels
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.countdownColor}
                  onChange={(e) =>
                    updateField("countdownColor", e.target.value)
                  }
                  className="h-9 w-12 cursor-pointer rounded border border-gray-200 bg-white p-0.5"
                  aria-label="Countdown color"
                />
                <Input
                  value={form.countdownColor}
                  onChange={(e) =>
                    updateField("countdownColor", e.target.value)
                  }
                  maxLength={7}
                  className="h-9 w-24 border border-gray-200 bg-gray-50 rounded-lg font-mono text-xs uppercase"
                />
              </div>
            </div>
          )}
          <ToggleSwitch
            label="Show Register Button"
            description="CTA button linking to the slug URL"
            checked={form.showSlugButton}
            onChange={(val) => updateField("showSlugButton", val)}
          />
        </div>

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
              Hero {isEditing ? "updated" : "created"} successfully!
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
                {isEditing ? "Update" : "Create"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
