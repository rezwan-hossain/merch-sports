// module/profile/components/admin/TeamMemberForm.tsx
"use client";

import { useState } from "react";
import type {
  TeamMember,
  TeamMemberFormData,
  TeamCategory,
} from "@/types/team";
import {
  createTeamMember,
  updateTeamMember,
  getAllTeamMembers,
} from "@/app/actions/team";
import { ImageUpload } from "./ImageUpload";
import Input from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  Loader2,
  Save,
  Linkedin,
  Twitter,
  Github,
  Instagram,
  Facebook,
} from "lucide-react";
import { ImageVpsUpload } from "./ImageVpsUpload";

type Props = {
  member: TeamMember | null;
  onSuccess: (members: TeamMember[]) => void;
  onCancel: () => void;
};

const CATEGORY_OPTIONS: {
  value: TeamCategory;
  label: string;
  description: string;
}[] = [
  {
    value: "ADMIN",
    label: "Leadership",
    description: "Core team leaders and founders",
  },
  {
    value: "ADVISOR",
    label: "Advisor",
    description: "Strategic advisors and mentors",
  },
  {
    value: "ORGANIZER",
    label: "Organizer",
    description: "Event organizers and coordinators",
  },
];

export function TeamMemberForm({ member, onSuccess, onCancel }: Props) {
  const isEditing = !!member;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<TeamMemberFormData>({
    name: member?.name || "",
    role: member?.role || "",
    bio: member?.bio || "",
    image: member?.image || "",
    category: member?.category || "ADVISOR",
    sortOrder: member?.sortOrder?.toString() || "0",
    linkedinUrl: member?.linkedinUrl || "",
    twitterUrl: member?.twitterUrl || "",
    githubUrl: member?.githubUrl || "",
    instagramUrl: member?.instagramUrl || "",
    facebookUrl: member?.facebookUrl || "",
  });

  const updateField = (field: keyof TeamMemberFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: form.name.trim(),
        role: form.role.trim() || undefined,
        bio: form.bio.trim() || undefined,
        image: form.image || undefined,
        category: form.category as TeamCategory,
        sortOrder: parseInt(form.sortOrder) || 0,
        linkedinUrl: form.linkedinUrl.trim() || undefined,
        twitterUrl: form.twitterUrl.trim() || undefined,
        githubUrl: form.githubUrl.trim() || undefined,
        instagramUrl: form.instagramUrl.trim() || undefined,
        facebookUrl: form.facebookUrl.trim() || undefined,
      };

      let result;
      if (isEditing && member) {
        result = await updateTeamMember(member.id, {
          ...payload,
          role: payload.role || null,
          bio: payload.bio || null,
          image: payload.image || null,
          linkedinUrl: payload.linkedinUrl || null,
          twitterUrl: payload.twitterUrl || null,
          githubUrl: payload.githubUrl || null,
          instagramUrl: payload.instagramUrl || null,
          facebookUrl: payload.facebookUrl || null,
        });
      } else {
        result = await createTeamMember(payload);
      }

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setSuccess(true);
      const { members } = await getAllTeamMembers();
      onSuccess(members as TeamMember[]);
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        {isEditing ? "Edit Team Member" : "Add Team Member"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name & Role */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g. Sarah Rahman"
              className="h-11 border border-gray-200 bg-gray-50 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Role{" "}
              <span className="text-gray-400 font-normal normal-case">
                (optional)
              </span>
            </label>
            <Input
              value={form.role}
              onChange={(e) => updateField("role", e.target.value)}
              placeholder="e.g. Founder & CEO"
              className="h-11 border border-gray-200 bg-gray-50 rounded-lg"
            />
          </div>
        </div>

        {/* Category & Sort Order */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Category
            </label>
            <Select
              value={form.category}
              onValueChange={(val) => updateField("category", val)}
            >
              <SelectTrigger className="h-11 rounded-lg border border-gray-200 bg-gray-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200">
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-gray-400">
                        {option.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Sort Order
            </label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => updateField("sortOrder", e.target.value)}
              placeholder="0"
              className="h-11 border border-gray-200 bg-gray-50 rounded-lg"
              min="0"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Lower numbers appear first
            </p>
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Bio{" "}
            <span className="text-gray-400 font-normal normal-case">
              (optional)
            </span>
          </label>
          <textarea
            value={form.bio}
            onChange={(e) => updateField("bio", e.target.value)}
            rows={3}
            placeholder="Brief description about the team member..."
            className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
        </div>

        {/* Image */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Profile Image{" "}
            <span className="text-gray-400 font-normal normal-case">
              (optional)
            </span>
          </label>
          {/* <ImageUpload
            value={form.image}
            onChange={(url) => updateField("image", url)}
            bucket="team-images"
            folder="profiles"
            label="Upload Profile Image"
            aspectRatio="aspect-square"
            maxSizeMB={2}
          /> */}
          <ImageVpsUpload
            value={form.image}
            onChange={(url) => updateField("image", url)}
            folder="profiles"
            label="Upload Profile Image"
            aspectRatio="aspect-square"
            maxSizeMB={2}
          />
        </div>

        {/* Social Links */}
        <div className="border-t border-gray-200 pt-5 mt-5">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4">
            Social Links{" "}
            <span className="text-gray-400 font-normal normal-case">
              (all optional)
            </span>
          </h3>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Linkedin size={14} className="text-blue-600" />
              </div>
              <Input
                value={form.linkedinUrl}
                onChange={(e) => updateField("linkedinUrl", e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className="h-10 flex-1 border border-gray-200 bg-gray-50 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                <Twitter size={14} className="text-sky-500" />
              </div>
              <Input
                value={form.twitterUrl}
                onChange={(e) => updateField("twitterUrl", e.target.value)}
                placeholder="https://twitter.com/username"
                className="h-10 flex-1 border border-gray-200 bg-gray-50 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Github size={14} className="text-gray-700" />
              </div>
              <Input
                value={form.githubUrl}
                onChange={(e) => updateField("githubUrl", e.target.value)}
                placeholder="https://github.com/username"
                className="h-10 flex-1 border border-gray-200 bg-gray-50 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center">
                <Instagram size={14} className="text-pink-600" />
              </div>
              <Input
                value={form.instagramUrl}
                onChange={(e) => updateField("instagramUrl", e.target.value)}
                placeholder="https://instagram.com/username"
                className="h-10 flex-1 border border-gray-200 bg-gray-50 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Facebook size={14} className="text-indigo-600" />
              </div>
              <Input
                value={form.facebookUrl}
                onChange={(e) => updateField("facebookUrl", e.target.value)}
                placeholder="https://facebook.com/username"
                className="h-10 flex-1 border border-gray-200 bg-gray-50 rounded-lg"
              />
            </div>
          </div>
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
              Team member {isEditing ? "updated" : "added"} successfully!
            </p>
          </div>
        )}

        {/* Actions */}
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
                {isEditing ? "Updating..." : "Adding..."}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditing ? "Update Member" : "Add Member"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
