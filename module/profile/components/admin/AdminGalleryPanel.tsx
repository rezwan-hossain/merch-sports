// module/profile/components/admin/AdminGalleryPanel.tsx

"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  ImageIcon,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { ImageUpload } from "./ImageUpload";

import type { GalleryImage } from "@/types/gallery";
import {
  createGalleryImage,
  deleteGalleryImage,
  updateGalleryImage,
} from "@/app/actions/gallery";
import { ImageVpsUpload } from "./ImageVpsUpload";

type Props = {
  initialImages: GalleryImage[];
};

type FormData = {
  src: string;
  alt: string;
};

const emptyForm: FormData = { src: "", alt: "" };

export function AdminGalleryPanel({ initialImages }: Props) {
  const [images, setImages] = useState<GalleryImage[]>(initialImages);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ─── Toast Helper ─────────────────────────────────
  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Open Create Form ─────────────────────────────
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  // ─── Open Edit Form ───────────────────────────────
  const handleOpenEdit = (image: GalleryImage) => {
    setEditingId(image.id);
    setFormData({
      src: image.src,
      alt: image.alt ?? "",
    });
    setShowForm(true);
  };

  // ─── Close Form ───────────────────────────────────
  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  // ─── Submit (Create or Update) ────────────────────
  const handleSubmit = () => {
    if (!formData.src) {
      showToast("error", "Please upload or provide an image URL");
      return;
    }

    startTransition(async () => {
      if (editingId) {
        const result = await updateGalleryImage({
          id: editingId,
          src: formData.src,
          alt: formData.alt || undefined,
        });

        if (result.success) {
          setImages((prev) =>
            prev.map((img) =>
              img.id === editingId
                ? {
                    ...img,
                    src: formData.src,
                    alt: formData.alt.trim() || null,
                  }
                : img,
            ),
          );
          showToast("success", "Image updated successfully");
          handleCloseForm();
        } else {
          showToast("error", result.error);
        }
      } else {
        const result = await createGalleryImage({
          src: formData.src,
          alt: formData.alt || undefined,
        });

        if (result.success) {
          const newImage: GalleryImage = {
            id: result.data.id,
            src: formData.src,
            alt: formData.alt.trim() || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setImages((prev) => [newImage, ...prev]);
          showToast("success", "Image added to gallery");
          handleCloseForm();
        } else {
          showToast("error", result.error);
        }
      }
    });
  };

  // ─── Delete ───────────────────────────────────────
  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteGalleryImage({ id });

      if (result.success) {
        setImages((prev) => prev.filter((img) => img.id !== id));
        showToast("success", "Image removed from gallery");
        setDeletingId(null);
      } else {
        showToast("error", result.error);
        setDeletingId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 font-heading">
            Gallery Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {images.length} image{images.length !== 1 ? "s" : ""} in the gallery
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Add Image
        </button>
      </div>

      {/* ─── Toast ─── */}
      {toast && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
            toast.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {toast.message}
        </div>
      )}

      {/* ─── Create / Edit Form ─── */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              {editingId ? "Edit Image" : "Add New Image"}
            </h3>
            <button
              onClick={handleCloseForm}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Image *
            </label>
            {/* <ImageUpload
              value={formData.src}
              onChange={(url) => setFormData((prev) => ({ ...prev, src: url }))}
              bucket="gallery-images"
              folder="gallery"
              label="Upload Gallery Image"
              aspectRatio="aspect-[4/3]"
              maxSizeMB={10}
            /> */}
            <ImageVpsUpload
              value={formData.src}
              onChange={(url) => setFormData((prev) => ({ ...prev, src: url }))}
              folder="gallery"
              label="Upload Gallery Image"
              aspectRatio="aspect-[4/3]"
              maxSizeMB={10}
            />
          </div>

          {/* Alt Text */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Alt Text{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.alt}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, alt: e.target.value }))
              }
              placeholder="Describe the image for accessibility..."
              className="w-full h-11 px-4 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all placeholder:text-gray-400"
              maxLength={200}
            />
            <p className="text-xs text-gray-400 mt-1">
              {formData.alt.length}/200 characters
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={isPending || !formData.src}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {editingId ? "Update Image" : "Add to Gallery"}
            </button>
            <button
              onClick={handleCloseForm}
              disabled={isPending}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ─── Empty State ─── */}
      {images.length === 0 && !showForm && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-gray-500 mb-1">
            No gallery images yet
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Start by adding your first image to the gallery.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Add First Image
          </button>
        </div>
      )}

      {/* ─── Image Grid ─── */}
      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Image Preview */}
              <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                <img
                  src={image.src}
                  alt={image.alt ?? "Gallery image"}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(image)}
                    className="p-2.5 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setDeletingId(image.id)}
                    className="p-2.5 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-sm text-gray-700 font-medium truncate">
                  {image.alt || "No description"}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Added{" "}
                  {new Date(image.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              {/* ─── Delete Confirmation ─── */}
              {deletingId === image.id && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-10">
                  <Trash2 className="w-8 h-8 text-red-500 mb-2" />
                  <p className="text-sm font-bold text-gray-900 mb-1">
                    Delete this image?
                  </p>
                  <p className="text-xs text-gray-500 text-center mb-4">
                    This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(image.id)}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {isPending && (
                        <Loader2 size={12} className="animate-spin" />
                      )}
                      Delete
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      disabled={isPending}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
