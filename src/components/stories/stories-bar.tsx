"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Plus, X, Trash2, ChevronLeft, ChevronRight, Pause, Play, ImagePlus, Loader2 } from "lucide-react";
import { Avatar, VerifyBadge } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import { StoryService } from "@/lib/services/story-service";
import { companyModeEventName, getActingCompanyId, getCompanyFromStorage } from "@/lib/company-acting";
import type { Company, User, Story } from "@/lib/types";
import { cn, addBaseURL, formatTimeAgo } from "@/lib/utils";

const STORY_DURATION = 5000; // 5s per story (image)

function storyActorCompanyId(user?: User | null): number | null {
  return user?.profile_type === "company" ? (user.owned_company?.id ?? user.id) : null;
}

function storyActorKey(user?: User | null): string {
  const companyId = storyActorCompanyId(user);
  return companyId ? `company:${companyId}` : `user:${user?.id ?? 0}`;
}

function storyActorName(user?: User | null): string {
  return user?.profile_type === "company" ? (user.owned_company?.name ?? user.full_name) : (user?.full_name ?? "");
}

function storyActorUsername(user?: User | null): string {
  return user?.profile_type === "company" ? `company-${storyActorCompanyId(user) ?? user?.id ?? 0}` : (user?.username ?? "");
}

function storyActorAvatar(user?: User | null): string | null {
  return user?.profile_type === "company" ? (user.owned_company?.logo ?? user.profile) : (user?.profile ?? null);
}

function storyActorHref(user?: User | null): string {
  const companyId = storyActorCompanyId(user);
  return companyId ? `/company/${companyId}` : `/profile/${user?.id ?? 0}`;
}

function isStoryActorVerified(user?: User | null): boolean {
  if (user?.profile_type === "company") return (user.owned_company?.is_verified ?? 0) === 1 || user.is_verified >= 2;
  return (user?.is_verified ?? 0) >= 2;
}

function companyToStoryUser(company: Company, stories: Story[] = []): User {
  return {
    id: company.id,
    identity: company.email,
    full_name: company.name,
    username: `company-${company.id}`,
    email: company.email,
    bio: company.description,
    profile: company.logo,
    background_image: null,
    interest_ids: null,
    block_user_ids: null,
    saved_post_ids: null,
    saved_reel_ids: null,
    saved_music_ids: null,
    followers: company.followers_count ?? 0,
    following: 0,
    is_verified: company.is_verified === 1 ? 2 : 0,
    is_block: company.is_suspended,
    is_push_notifications: 1,
    is_invited_to_room: 0,
    is_moderator: 0,
    device_token: company.device_token,
    device_type: null,
    headline: company.sector,
    about: company.description,
    experience: null,
    education: null,
    skills: null,
    location: [company.city, company.country].filter(Boolean).join(" ") || null,
    website: company.website,
    pronouns: null,
    created_at: company.created_at,
    updated_at: company.updated_at,
    profile_type: "company",
    owned_company: company,
    stories,
  };
}

/* ═══════════════════════════════════════════════════════════════
   STORIES BAR — horizontal scrollable list on feed
   ═══════════════════════════════════════════════════════════════ */
export function StoriesBar() {
  const { user: me } = useAuthStore();
  const [storyUsers, setStoryUsers] = useState<User[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [actingCompanyId, setActingCompanyId] = useState<number | null>(null);

  useEffect(() => {
    const syncMode = () => setActingCompanyId(getActingCompanyId());
    syncMode();
    window.addEventListener(companyModeEventName(), syncMode);
    return () => window.removeEventListener(companyModeEventName(), syncMode);
  }, []);

  const fetchStories = useCallback(async () => {
    if (!me) return;
    try {
      const res = await StoryService.fetchStories(me.id, actingCompanyId ?? undefined);
      if (res.status && res.data) {
        setStoryUsers(res.data.filter((u) => u.stories && u.stories.length > 0));
      }
    } catch { /* silent */ }
  }, [me, actingCompanyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchStories();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchStories]);

  const openStory = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  }, []);

  const handleViewerClose = useCallback(() => {
    setViewerOpen(false);
    fetchStories(); // refresh to update watched status
  }, [fetchStories]);

  const isWatched = useCallback(
    (user: User) => {
      if (!me || !user.stories) return true;
      const viewerId = actingCompanyId ?? me.id;
      return user.stories.every((s) => {
        const viewIds = ((actingCompanyId ? s.view_by_company_ids : s.view_by_user_ids) ?? "")
          .split(",")
          .filter(Boolean);
        return viewIds.includes(String(viewerId));
      });
    },
    [me, actingCompanyId],
  );

  const activeCompany = actingCompanyId ? getCompanyFromStorage() : null;
  const activeCompanyStoryUser = actingCompanyId
    ? storyUsers.find((u) => storyActorCompanyId(u) === actingCompanyId)
    : undefined;
  const myStoryActor = actingCompanyId && activeCompany
    ? (activeCompanyStoryUser ?? companyToStoryUser(activeCompany))
    : me;
  const myStoryActorKey = storyActorKey(myStoryActor);
  const myStories = actingCompanyId ? (activeCompanyStoryUser?.stories ?? []) : (me?.stories ?? []);
  const hasMyStories = myStories.length > 0;

  return (
    <>
      <div className="card overflow-hidden">
        <div className="flex gap-2 p-3 overflow-x-auto scrollbar-hide">
          {/* My story */}
          <div className="flex flex-col items-center gap-1 shrink-0 w-[66px]">
            {hasMyStories ? (
              <button
                onClick={() => {
                  if (!myStoryActor) return;
                  const meWithStories = { ...myStoryActor, stories: myStories };
                  const actorKey = storyActorKey(meWithStories);
                  setStoryUsers((prev) => {
                    const withoutMe = prev.filter((u) => storyActorKey(u) !== actorKey);
                    return [meWithStories, ...withoutMe];
                  });
                  setTimeout(() => openStory(0), 0);
                }}
                className="relative cursor-pointer"
              >
                <div
                  className={cn(
                    "w-[56px] h-[56px] rounded-full p-[2.5px]",
                    myStoryActor && isWatched(myStoryActor) ? "bg-black/10" : "bg-gradient-to-br from-primary to-cyan",
                  )}
                >
                  <div className="w-full h-full rounded-full bg-card p-[2px]">
                    <Avatar src={storyActorAvatar(myStoryActor)} alt={storyActorName(myStoryActor)} size={46} />
                  </div>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <Plus size={14} className="text-primary" />
                </div>
              </button>
            ) : (
              <button onClick={() => setCreateOpen(true)} className="relative cursor-pointer group">
                <div className="w-[56px] h-[56px] rounded-full border-2 border-dashed border-primary/40 group-hover:border-primary transition-colors flex items-center justify-center bg-bg-light/50">
                  <Avatar src={storyActorAvatar(myStoryActor)} alt={storyActorName(myStoryActor)} size={46} />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-card flex items-center justify-center">
                  <Plus size={14} className="text-primary" />
                </div>
              </button>
            )}
            <span className="text-[11px] font-medium text-text-light truncate w-full text-center">
              {actingCompanyId ? "Story entreprise" : "Ma story"}
            </span>
          </div>

          {/* Other users */}
          {storyUsers
            .filter((u) => storyActorKey(u) !== myStoryActorKey)
            .map((user, i) => (
              <button
                key={storyActorKey(user)}
                onClick={() => {
                  // Find actual index including potential "me" at 0
                  const idx = storyUsers.findIndex((u) => storyActorKey(u) === storyActorKey(user));
                  openStory(idx >= 0 ? idx : i);
                }}
                className="flex flex-col items-center gap-1 shrink-0 w-[66px] cursor-pointer"
              >
                <div
                  className={cn(
                    "w-[56px] h-[56px] rounded-full p-[2.5px] transition-all",
                    isWatched(user) ? "bg-black/10" : "bg-gradient-to-br from-primary to-cyan",
                  )}
                >
                  <div className="w-full h-full rounded-full bg-card p-[2px]">
                    <Avatar src={storyActorAvatar(user)} alt={storyActorName(user)} size={46} />
                  </div>
                </div>
                <span className="text-[11px] font-medium text-text-dark truncate w-full text-center">
                  {user.profile_type === "company" ? storyActorName(user) : user.username}
                </span>
              </button>
            ))}
        </div>
      </div>

      {/* Create Story Modal */}
      {createOpen && (
        <CreateStoryModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            fetchStories();
          }}
        />
      )}

      {/* Story Viewer Overlay */}
      {viewerOpen && storyUsers.length > 0 && (
        <StoryViewer
          users={storyUsers}
          initialUserIndex={viewerIndex}
          onClose={handleViewerClose}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STORY VIEWER — full screen overlay with progress bars
   ═══════════════════════════════════════════════════════════════ */
function StoryViewer({
  users,
  initialUserIndex,
  onClose,
}: {
  users: User[];
  initialUserIndex: number;
  onClose: () => void;
}) {
  const { user: me } = useAuthStore();
  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [actingCompanyId, setActingCompanyId] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentUser = users[userIndex];
  const stories = useMemo(() => currentUser?.stories ?? [], [currentUser?.stories]);
  const currentStory = stories[storyIndex];
  const currentStoryId = currentStory?.id;
  const currentStoryUserViewIds = currentStory?.view_by_user_ids;
  const currentStoryCompanyViewIds = currentStory?.view_by_company_ids;
  const currentStoryDuration = currentStory?.duration;
  const currentStoryType = currentStory?.type;
  const isMyStory = actingCompanyId
    ? storyActorCompanyId(currentUser) === actingCompanyId
    : currentUser?.profile_type !== "company" && currentUser?.id === me?.id;

  useEffect(() => {
    const syncMode = () => setActingCompanyId(getActingCompanyId());
    syncMode();
    window.addEventListener(companyModeEventName(), syncMode);
    return () => window.removeEventListener(companyModeEventName(), syncMode);
  }, []);

  // Mark story as viewed
  useEffect(() => {
    if (!me || !currentStory) return;
    const viewIds = ((actingCompanyId ? currentStoryCompanyViewIds : currentStoryUserViewIds) ?? "")
      .split(",")
      .filter(Boolean);
    const viewerId = actingCompanyId ?? me.id;
    if (!viewIds.includes(String(viewerId))) {
      StoryService.viewStory(me.id, currentStory.id, actingCompanyId ?? undefined).catch(() => {});
    }
  }, [me, currentStory, currentStoryId, currentStoryUserViewIds, currentStoryCompanyViewIds, actingCompanyId]);

  const goNext = useCallback(() => {
    if (storyIndex < stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (userIndex < users.length - 1) {
      setUserIndex((i) => i + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }, [storyIndex, stories.length, userIndex, users.length, onClose]);

  // Auto-advance timer
  useEffect(() => {
    if (!currentStoryId || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const isVideo = currentStoryType === 1;
    const duration = isVideo
      ? (currentStoryDuration ?? 10) * 1000
      : STORY_DURATION;

    const resetTimer = setTimeout(() => setProgress(0), 0);
    const interval = 50; // update every 50ms
    let elapsed = 0;

    timerRef.current = setInterval(() => {
      elapsed += interval;
      setProgress(Math.min(elapsed / duration, 1));
      if (elapsed >= duration) {
        goNext();
      }
    }, interval);

    return () => {
      clearTimeout(resetTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userIndex, storyIndex, isPaused, currentStoryId, currentStoryDuration, currentStoryType, goNext]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (userIndex > 0) {
      setUserIndex((i) => i - 1);
      setStoryIndex(0);
    }
  }, [storyIndex, userIndex]);

  const handleDelete = useCallback(async () => {
    if (!me || !currentStory) return;
    if (!confirm("Supprimer cette story ?")) return;
    try {
      const res = await StoryService.deleteStory(me.id, currentStory.id, actingCompanyId ?? undefined);
      if (res.status) {
        // Remove from local list
        const newStories = stories.filter((s) => s.id !== currentStory.id);
        if (newStories.length === 0) {
          // No more stories for this user, go to next user or close
          if (userIndex < users.length - 1) {
            setUserIndex((i) => i + 1);
            setStoryIndex(0);
          } else {
            onClose();
          }
        } else {
          setStoryIndex((i) => Math.min(i, newStories.length - 1));
        }
      }
    } catch { /* silent */ }
  }, [me, currentStory, stories, userIndex, users.length, onClose, actingCompanyId]);

  // Handle tap zones: left = prev, right = next, center = pause/play
  const handleAreaClick = useCallback(
    (zone: "left" | "right") => {
      if (zone === "left") goPrev();
      else goNext();
    },
    [goPrev, goNext],
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  if (!currentStory) return null;

  const contentUrl = addBaseURL(currentStory.content);
  const isVideo = currentStory.type === 1;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      {/* Navigation arrows (desktop) */}
      {userIndex > 0 && (
        <button
          onClick={() => { setUserIndex((i) => i - 1); setStoryIndex(0); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>
      )}
      {userIndex < users.length - 1 && (
        <button
          onClick={() => { setUserIndex((i) => i + 1); setStoryIndex(0); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
        >
          <ChevronRight size={20} className="text-white" />
        </button>
      )}

      {/* Story container (phone-sized) */}
      <div className="relative w-full max-w-[420px] h-full max-h-[100dvh] bg-black overflow-hidden">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-40 flex gap-1 px-3 pt-3">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{
                  width:
                    i < storyIndex
                      ? "100%"
                      : i === storyIndex
                        ? `${progress * 100}%`
                        : "0%",
                  transition: i === storyIndex ? "none" : "width 0.3s",
                }}
              />
            </div>
          ))}
        </div>

        {/* User info header */}
        <div className="absolute top-6 left-0 right-0 z-40 flex items-center gap-3 px-4 py-2">
          <Link href={storyActorHref(currentUser)} onClick={onClose}>
            <Avatar src={storyActorAvatar(currentUser)} alt={storyActorName(currentUser)} size={36} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <Link
                href={storyActorHref(currentUser)}
                onClick={onClose}
                className="text-white font-bold text-sm hover:underline truncate"
              >
                {storyActorName(currentUser)}
              </Link>
              {isStoryActorVerified(currentUser) && <VerifyBadge size={14} />}
            </div>
            <p className="text-white/60 text-xs">
              @{storyActorUsername(currentUser)} · {formatTimeAgo(currentStory.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaused((p) => !p)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
            >
              {isPaused ? <Play size={14} className="text-white" /> : <Pause size={14} className="text-white" />}
            </button>
            {isMyStory && (
              <button
                onClick={handleDelete}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-red/30 transition-colors cursor-pointer"
              >
                <Trash2 size={14} className="text-white" />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isVideo ? (
          <video
            ref={videoRef}
            src={contentUrl}
            className="w-full h-full object-contain"
            autoPlay
            playsInline
            muted={false}
            onPause={() => setIsPaused(true)}
            onPlay={() => setIsPaused(false)}
          />
        ) : (
          <img
            src={contentUrl}
            alt=""
            className="w-full h-full object-contain"
          />
        )}

        {/* Tap zones */}
        <div className="absolute inset-0 z-30 flex">
          <div className="w-1/3 h-full" onClick={() => handleAreaClick("left")} />
          <div className="w-1/3 h-full" onMouseDown={() => setIsPaused(true)} onMouseUp={() => setIsPaused(false)} />
          <div className="w-1/3 h-full" onClick={() => handleAreaClick("right")} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CREATE STORY MODAL — upload image or video as a story
   ═══════════════════════════════════════════════════════════════ */
function CreateStoryModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user: me } = useAuthStore();
  const [actingCompanyId, setActingCompanyId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const syncMode = () => setActingCompanyId(getActingCompanyId());
    syncMode();
    window.addEventListener(companyModeEventName(), syncMode);
    return () => window.removeEventListener(companyModeEventName(), syncMode);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const isVid = selected.type.startsWith("video/");
    setIsVideo(isVid);
    setFile(selected);
    setError(null);

    const objectUrl = URL.createObjectURL(selected);
    setPreview(objectUrl);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!me || !file) return;
    setIsUploading(true);
    setError(null);

    try {
      let duration: number | undefined;
      if (isVideo && videoPreviewRef.current) {
        duration = Math.ceil(videoPreviewRef.current.duration);
      }

      const type = isVideo ? 1 : 0;
      const res = await StoryService.createStory(me.id, file, type, duration, actingCompanyId ?? undefined);

      if (res.status) {
        onCreated();
      } else {
        setError(res.message || "Erreur lors de la publication.");
      }
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setIsUploading(false);
    }
  }, [me, file, isVideo, onCreated, actingCompanyId]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
          <h2 className="text-base font-bold text-text-main">
            {actingCompanyId ? "Nouvelle story entreprise" : "Nouvelle story"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-bg-light flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} className="text-text-light" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {!preview ? (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-[9/16] max-h-[400px] rounded-xl border-2 border-dashed border-primary/30 hover:border-primary flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer bg-bg-light/50 hover:bg-primary/5"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ImagePlus size={28} className="text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-text-main">Choisir une photo ou vidéo</p>
                  <p className="text-xs text-text-light mt-1">JPG, PNG, MP4, MOV</p>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/avi"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-full aspect-[9/16] max-h-[400px] rounded-xl overflow-hidden bg-black flex items-center justify-center">
                {isVideo ? (
                  <video
                    ref={videoPreviewRef}
                    src={preview}
                    className="w-full h-full object-contain"
                    controls
                    playsInline
                  />
                ) : (
                  <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                )}
              </div>

              {error && (
                <p className="text-xs text-red font-medium text-center">{error}</p>
              )}

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setError(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-border-light text-sm font-semibold text-text-dark hover:bg-bg-light transition-colors cursor-pointer"
                >
                  Changer
                </button>
                <button
                  onClick={handlePublish}
                  disabled={isUploading}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Publication...
                    </>
                  ) : (
                    "Publier"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
