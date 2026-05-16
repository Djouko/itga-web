"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ImageIcon,
  Video,
  Mic,
  X,
  Globe,
  Film,
  Loader2,
  Check,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/store";
import { PostService } from "@/lib/services/post-service";
import { cn } from "@/lib/utils";
import { getActingCompanyId } from "@/lib/company-acting";

type MediaType = "image" | "video" | "audio" | null;

interface MediaFile {
  file: File;
  preview: string;
}

const createTypes = [
  { id: "post", label: "Publication", icon: Globe },
  { id: "reel", label: "Reel", icon: Film },
];

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { interests } = useSettingsStore();
  const mode = searchParams.get("mode");
  const companyIdParam = Number(searchParams.get("companyId"));
  const actingCompanyId = typeof window !== "undefined" ? getActingCompanyId() : null;
  const effectiveCompanyId =
    mode === "company" && Number.isFinite(companyIdParam) && companyIdParam > 0
      ? companyIdParam
      : actingCompanyId ?? 0;
  const isCompanyMode = Number.isFinite(effectiveCompanyId) && effectiveCompanyId > 0;

  const [activeType, setActiveType] = useState("post");
  const [description, setDescription] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [selectedInterests, setSelectedInterests] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const canPublish = description.trim().length > 0 || mediaFiles.length > 0;

  const handleFileSelect = useCallback((files: FileList | null, type: MediaType) => {
    if (!files || files.length === 0) return;

    if (type === "video" || type === "audio") {
      const file = files[0];
      if (file.size > 20 * 1024 * 1024) {
        setError("Le fichier ne doit pas dépasser 20 Mo.");
        return;
      }
      setMediaFiles([{ file, preview: URL.createObjectURL(file) }]);
      setMediaType(type);
    } else {
      const newFiles: MediaFile[] = [];
      for (let i = 0; i < Math.min(files.length, 10); i++) {
        const file = files[i];
        if (file.size > 20 * 1024 * 1024) {
          setError("Chaque fichier ne doit pas dépasser 20 Mo.");
          return;
        }
        newFiles.push({ file, preview: URL.createObjectURL(file) });
      }
      setMediaFiles(newFiles);
      setMediaType("image");
    }
    setError(null);
  }, []);

  const removeMedia = useCallback((index: number) => {
    setMediaFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) setMediaType(null);
      return updated;
    });
  }, []);

  const removeAllMedia = useCallback(() => {
    mediaFiles.forEach((m) => URL.revokeObjectURL(m.preview));
    setMediaFiles([]);
    setMediaType(null);
  }, [mediaFiles]);

  const toggleInterest = useCallback((id: number) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const extractHashtags = (text: string): string => {
    const matches = text.match(/#[a-zA-Z0-9_]+/g);
    return matches ? matches.map((t) => t.slice(1)).join(",") : "";
  };

  const handleSubmit = useCallback(async () => {
    if (!user || isSubmitting || !canPublish) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("user_id", String(user.id));
      if (isCompanyMode) {
        formData.append("company_id", String(effectiveCompanyId));
      }

      if (description.trim()) {
        formData.append("desc", description.trim());
      }

      const tags = extractHashtags(description);
      if (tags) {
        formData.append("tags", tags);
      }

      if (selectedInterests.length > 0) {
        formData.append("interest_ids", selectedInterests.join(","));
      }

      if (mediaFiles.length > 0 && mediaType) {
        const contentTypeMap = { image: 0, video: 1, audio: 2 };
        formData.append("content_type", String(contentTypeMap[mediaType]));
        mediaFiles.forEach((m) => {
          formData.append("content[]", m.file);
        });
      }

      const res = isCompanyMode
        ? await PostService.addCompanyPost(formData)
        : await PostService.addPost(formData);

      if (res.status) {
        mediaFiles.forEach((m) => URL.revokeObjectURL(m.preview));
        router.push(isCompanyMode ? `/company/${effectiveCompanyId}` : "/feed");
      } else {
        setError(res.message || "Erreur lors de la publication.");
      }
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    }
    setIsSubmitting(false);
  }, [user, isSubmitting, canPublish, description, selectedInterests, mediaFiles, mediaType, isCompanyMode, effectiveCompanyId, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-card">
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files, "image")}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files, "video")}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files, "audio")}
      />

      {/* Header */}
      <header className="sticky top-0 z-20 glass-header border-b border-border/20">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-bg-light transition-all duration-200 text-text-light hover:text-text-main cursor-pointer active:scale-95"
          >
            <X size={20} />
          </button>
          <div className="flex gap-1.5 bg-bg-light rounded-xl p-1">
            {createTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setActiveType(type.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer",
                    activeType === type.id
                      ? "bg-gradient-to-r from-primary to-cyan text-white shadow-sm"
                      : "text-text-light hover:text-text-dark"
                  )}
                >
                  <Icon size={14} />
                  {type.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canPublish || isSubmitting}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-[0.97]",
              canPublish && !isSubmitting
                ? "bg-gradient-to-r from-primary to-cyan text-white hover:shadow-lg hover:shadow-primary/20"
                : "bg-bg-light text-text-light/50 cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Publier"
            )}
          </button>
        </div>
        {isCompanyMode && (
          <div className="px-4 pb-3">
            <div className="rounded-xl border border-cyan/25 bg-cyan/10 px-3 py-2 text-xs font-semibold text-cyan">
              Publication en mode entreprise
            </div>
          </div>
        )}
      </header>

      {activeType === "post" ? (
        <div className="p-4 animate-fadeIn">
          {/* Error */}
          {error && (
            <div className="mb-3 px-4 py-2.5 bg-red/5 border border-red/20 rounded-xl text-sm text-red font-medium">
              {error}
            </div>
          )}

          {/* Compose Area */}
          <div className="flex gap-3">
            <Avatar src={user.profile} alt={user.full_name} size={42} />
            <div className="flex-1">
              <textarea
                placeholder="Quoi de neuf ?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border-none bg-transparent resize-none text-[15px] text-text-main placeholder:text-text-light/50 focus:outline-none min-h-[120px] leading-relaxed"
                autoFocus
              />
            </div>
          </div>

          {/* Hashtag/Mention preview */}
          {description && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {description.match(/#[a-zA-Z0-9_]+/g)?.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-magenta/10 text-magenta text-xs font-medium">
                  {tag}
                </span>
              ))}
              {description.match(/@[a-zA-Z0-9_]+/g)?.map((mention, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-navy/10 text-navy text-xs font-medium">
                  {mention}
                </span>
              ))}
            </div>
          )}

          {/* Media Preview */}
          {mediaFiles.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text-light">
                  {mediaType === "image" ? `${mediaFiles.length} photo${mediaFiles.length > 1 ? "s" : ""}` : mediaType === "video" ? "1 vidéo" : "1 audio"}
                </span>
                <button
                  onClick={removeAllMedia}
                  className="text-xs text-red font-semibold hover:underline cursor-pointer"
                >
                  Tout supprimer
                </button>
              </div>
              {mediaType === "image" && (
                <div className="grid grid-cols-3 gap-2">
                  {mediaFiles.map((m, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden aspect-square ring-1 ring-border/20">
                      <img src={m.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                      <button
                        onClick={() => removeMedia(i)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer hover:bg-red/80 hover:scale-110"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {mediaType === "video" && mediaFiles[0] && (
                <div className="relative rounded-xl overflow-hidden bg-black/5">
                  <video src={mediaFiles[0].preview} controls className="w-full max-h-[300px] rounded-xl" />
                </div>
              )}
              {mediaType === "audio" && mediaFiles[0] && (
                <div className="rounded-xl bg-gradient-to-br from-primary/5 to-cyan/5 border border-primary/10 p-4">
                  <audio src={mediaFiles[0].preview} controls className="w-full" />
                  <p className="text-xs text-text-light mt-2 truncate">{mediaFiles[0].file.name}</p>
                </div>
              )}
            </div>
          )}

          {/* Media Actions */}
          <div className="flex items-center gap-1 mt-4 pt-4 border-t border-border/20">
            <button
              onClick={() => { if (!mediaType || mediaType === "image") imageInputRef.current?.click(); }}
              disabled={!!mediaType && mediaType !== "image"}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer active:scale-95",
                !!mediaType && mediaType !== "image"
                  ? "text-text-light/30 cursor-not-allowed"
                  : "text-text-light hover:bg-bg-light hover:text-primary"
              )}
            >
              <ImageIcon size={18} />
              <span className="text-xs font-medium">Photo</span>
            </button>
            <button
              onClick={() => { if (!mediaType) videoInputRef.current?.click(); }}
              disabled={!!mediaType}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer active:scale-95",
                !!mediaType
                  ? "text-text-light/30 cursor-not-allowed"
                  : "text-text-light hover:bg-bg-light hover:text-primary"
              )}
            >
              <Video size={18} />
              <span className="text-xs font-medium">Vidéo</span>
            </button>
            <button
              onClick={() => { if (!mediaType) audioInputRef.current?.click(); }}
              disabled={!!mediaType}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer active:scale-95",
                !!mediaType
                  ? "text-text-light/30 cursor-not-allowed"
                  : "text-text-light hover:bg-bg-light hover:text-primary"
              )}
            >
              <Mic size={18} />
              <span className="text-xs font-medium">Audio</span>
            </button>
          </div>

          {/* Interest Selection */}
          {interests.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-text-light mb-2">Centres d&apos;intérêt (optionnel)</p>
              <div className="flex flex-wrap gap-1.5">
                {interests.map((interest) => {
                  const isSelected = selectedInterests.includes(interest.id);
                  return (
                    <button
                      key={interest.id}
                      onClick={() => toggleInterest(interest.id)}
                      className={cn(
                        "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
                        isSelected
                          ? "bg-primary text-white shadow-sm shadow-primary/20"
                          : "bg-bg-light text-text-dark hover:bg-primary/10 hover:text-primary"
                      )}
                    >
                      {isSelected && <Check size={12} />}
                      {interest.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-fadeIn">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-cyan/10 border border-primary/20 flex items-center justify-center mb-4">
            <Film size={40} className="text-primary" />
          </div>
          <h3 className="text-lg font-bold text-text-main mb-2">Créer un Reel</h3>
          <p className="text-sm text-text-light max-w-xs mb-6">
            Téléversez une vidéo courte et ajoutez musique, description et hashtags.
          </p>
          <button
            onClick={() => videoInputRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-cyan text-white rounded-full font-semibold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 cursor-pointer active:scale-95"
          >
            <Video size={16} />
            Téléverser une vidéo
          </button>
        </div>
      )}
    </div>
  );
}
