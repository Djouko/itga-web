"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Share2,
  Play,
  Flag,
  Trash2,
  Bookmark,
  BookmarkCheck,
  Music2,
  Eye,
  Send,
  X,
  ChevronDown,
  Loader2,
  BadgeCheck,
  MoreHorizontal,
  Pencil,
  Copy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Avatar, VerifyBadge } from "@/components/ui/avatar";
import { MentionProfileLink } from "@/components/text/mention-profile-link";
import { useAuthStore, useSettingsStore, useTranslation } from "@/lib/store";
import { ReelService } from "@/lib/services/reel-service";
import { UserService } from "@/lib/services/user-service";
import type { Reel, ReelComment, User } from "@/lib/types";
import { cn, formatCount, addBaseURL, formatTimeAgo } from "@/lib/utils";
import { getActingCompanyId } from "@/lib/company-acting";
import { getReportReasonsWithFallback } from "@/lib/report-reasons";

/* ─── Constants ─── */
const REELS_PAGE_SIZE = 20; // Match mobile (Limits.pagination = 20)
const COMMENTS_PAGE_SIZE = 20;
const MAX_REELS_RANDOM_REFILL_ATTEMPTS = 4;
const REEL_TYPE_FOLLOWING = 0;
const REEL_TYPE_FOR_YOU = 1;

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
function dedupeReelsById(items: Reel[]) {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function debugReels(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[ITGA][reels] ${message}`, payload ?? {});
}

type ReelTabKey = "forYou" | "following";

interface ReelTabData {
  reels: Reel[];
  isLoading: boolean;
  currentIndex: number;
  loaded: boolean;
}

function createEmptyTabData(): ReelTabData {
  return {
    reels: [],
    isLoading: true,
    currentIndex: 0,
    loaded: false,
  };
}

function createInitialTabData(): Record<ReelTabKey, ReelTabData> {
  return {
    forYou: createEmptyTabData(),
    following: createEmptyTabData(),
  };
}

export default function ReelsPage() {
  const { user: me } = useAuthStore();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialReelId = searchParams.get("id");
  const filterHashtag = searchParams.get("hashtag");
  const filterMusicId = searchParams.get("music");
  const isFilterMode = !!filterHashtag || !!filterMusicId;

  const [activeTab, setActiveTab] = useState<"forYou" | "following">("forYou");
  const [tabData, setTabData] = useState<Record<ReelTabKey, ReelTabData>>(createInitialTabData);
  const [isMuted, setIsMuted] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const tabDataRef = useRef<Record<ReelTabKey, ReelTabData>>(createInitialTabData());
  const fetchStateRef = useRef<Record<ReelTabKey, { isFetching: boolean; gen: number }>>({
    forYou: { isFetching: false, gen: 0 },
    following: { isFetching: false, gen: 0 },
  });

  const activeData = tabData[activeTab];
  const reels = activeData.reels;
  const isLoading = activeData.isLoading;
  const currentIndex = activeData.currentIndex;

  useEffect(() => {
    tabDataRef.current = tabData;
  }, [tabData]);

  const setTabValue = useCallback((tab: ReelTabKey, patch: Partial<ReelTabData>) => {
    setTabData((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        ...patch,
      },
    }));
  }, []);

  const resetTabData = useCallback(() => {
    setTabData(createInitialTabData());
    fetchStateRef.current = {
      forYou: { isFetching: false, gen: 0 },
      following: { isFetching: false, gen: 0 },
    };
  }, []);

  // ── Fetch reels (supports explore, hashtag, music modes) ──
  const fetchTabReels = useCallback(
    async (tab: ReelTabKey, options?: { start?: number; reset?: boolean; background?: boolean }) => {
      if (!me) return;
      const { start, reset = false, background = false } = options ?? {};
      const fetchState = fetchStateRef.current[tab];
      if (!reset && fetchState.isFetching) return;

      const gen = ++fetchState.gen;
      fetchState.isFetching = true;
      if (!background) {
        setTabValue(tab, { isLoading: true });
      }

      const currentIndexForTab = tabDataRef.current[tab].currentIndex;
      const reelTypeForTab = tab === "following" ? REEL_TYPE_FOLLOWING : REEL_TYPE_FOR_YOU;

      try {
        let workingReels = reset ? [] : tabDataRef.current[tab].reels;
        let nextReels = workingReels;
        let attempt = 0;
        let madeProgress = false;
        const isExploreMode = !filterHashtag && !filterMusicId;
        const actingCompanyId = getActingCompanyId() ?? undefined;

        debugReels("fetch:start", {
          tab,
          reset,
          currentCount: workingReels.length,
          currentIndex: currentIndexForTab,
          isExploreMode,
        });

        while (attempt <= MAX_REELS_RANDOM_REFILL_ATTEMPTS) {
          let res;
          const requestStart = isExploreMode && reelTypeForTab === REEL_TYPE_FOR_YOU
            ? (reset && attempt === 0 ? 0 : workingReels.length)
            : (attempt === 0 ? (start ?? workingReels.length) : workingReels.length);

          if (filterHashtag) {
            res = await ReelService.fetchReelsByHashtag(me.id, filterHashtag, requestStart, REELS_PAGE_SIZE, actingCompanyId);
          } else if (filterMusicId) {
            res = await ReelService.fetchReelsByMusic(me.id, Number(filterMusicId), requestStart, REELS_PAGE_SIZE, actingCompanyId);
          } else {
            const excludedReelIds = isExploreMode ? workingReels.map((reel) => reel.id) : undefined;
            res = await ReelService.fetchReelsOnExplore(me.id, reelTypeForTab, requestStart, REELS_PAGE_SIZE, excludedReelIds, actingCompanyId);
          }

          // Stale response (tab switched while fetching) — discard
          if (gen !== fetchStateRef.current[tab].gen) return;

          if (!res.status || !res.data) {
            if (reset) {
              setTabValue(tab, {
                reels: [],
                loaded: true,
                currentIndex: 0,
              });
            }
            break;
          }

          const incoming = dedupeReelsById(res.data);
          const existingIds = new Set(workingReels.map((reel) => reel.id));
          const unseenReels = incoming.filter((reel) => !existingIds.has(reel.id));

          debugReels("fetch:batch", {
            tab,
            reset,
            attempt,
            requestStart,
            excludedCount: isExploreMode ? workingReels.length : 0,
            rawCount: res.data.length,
            dedupedCount: incoming.length,
            unseenCount: unseenReels.length,
            currentCount: workingReels.length,
            currentIndex: currentIndexForTab,
          });

          if (reset && attempt === 0) {
            nextReels = incoming;
            madeProgress = incoming.length > 0;
            break;
          }

          if (unseenReels.length > 0) {
            nextReels = [...workingReels, ...unseenReels];
            workingReels = nextReels;
            madeProgress = true;
            break;
          }

          if (!isExploreMode || reelTypeForTab !== REEL_TYPE_FOR_YOU || incoming.length === 0) {
            break;
          }

          attempt += 1;
        }

        // Mobile-like fallback for For You: keep refilling even when unseen unique reels are exhausted.
        if (!madeProgress && !reset && isExploreMode && reelTypeForTab === REEL_TYPE_FOR_YOU) {
          try {
            const refillRes = await ReelService.fetchReelsOnExplore(
              me.id,
              reelTypeForTab,
              workingReels.length,
              REELS_PAGE_SIZE,
              undefined,
              actingCompanyId,
            );

            if (gen !== fetchStateRef.current[tab].gen) return;

            if (refillRes.status && Array.isArray(refillRes.data) && refillRes.data.length > 0) {
              nextReels = [...workingReels, ...refillRes.data];
              madeProgress = true;
              debugReels("fetch:mobile-refill", {
                tab,
                reset,
                appendedCount: refillRes.data.length,
                nextCount: nextReels.length,
                currentIndex: currentIndexForTab,
              });
            }
          } catch {
            // Keep current tab data if fallback fails.
          }
        }

        if (madeProgress || reset) {
          debugReels("fetch:commit", {
            tab,
            reset,
            nextCount: nextReels.length,
            addedCount: Math.max(0, nextReels.length - (reset ? 0 : tabDataRef.current[tab].reels.length)),
            currentIndex: currentIndexForTab,
          });
          setTabValue(tab, {
            reels: nextReels,
            loaded: true,
            currentIndex: reset ? 0 : tabDataRef.current[tab].currentIndex,
          });
        } else {
          debugReels("fetch:no-progress", {
            tab,
            reset,
            currentCount: workingReels.length,
            currentIndex: currentIndexForTab,
          });
        }
      } catch {
        if (gen !== fetchStateRef.current[tab].gen) return;
      }
      if (gen === fetchStateRef.current[tab].gen) {
        fetchStateRef.current[tab].isFetching = false;
        setTabValue(tab, { isLoading: false, loaded: true });
      }
    },
    [filterHashtag, filterMusicId, me, setTabValue],
  );

  // ── Fetch single reel by ID (from profile link) ──
  const fetchInitialReel = useCallback(async () => {
    if (!me || !initialReelId) return;
    try {
      const res = await ReelService.fetchReelById(me.id, Number(initialReelId), getActingCompanyId() ?? undefined);
      if (res.status && res.data) {
        setTabValue("forYou", {
          reels: [res.data],
          isLoading: false,
          currentIndex: 0,
          loaded: true,
        });
      }
    } catch { /* silent */ }
    setTabValue("forYou", { isLoading: false, loaded: true });
  }, [initialReelId, me, setTabValue]);

  // Initial load — mirror Flutter by preloading both explore tabs
  useEffect(() => {
    if (!me) return;

    const timer = window.setTimeout(() => {
      resetTabData();
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }

      if (initialReelId) {
        setActiveTab("forYou");
        fetchInitialReel();
      } else if (isFilterMode) {
        setActiveTab("forYou");
        fetchTabReels("forYou", { start: 0, reset: true });
      } else {
        fetchTabReels("forYou", { start: 0, reset: true });
        fetchTabReels("following", { start: 0, reset: true, background: true });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchInitialReel, fetchTabReels, initialReelId, isFilterMode, me, resetTabData]);

  useEffect(() => {
    if (isFilterMode || initialReelId) return;

    const container = containerRef.current;
    if (container) {
      container.scrollTop = tabDataRef.current[activeTab].currentIndex * container.clientHeight;
    }

    if (!tabDataRef.current[activeTab].loaded && !fetchStateRef.current[activeTab].isFetching) {
      const timer = window.setTimeout(() => {
        fetchTabReels(activeTab, { start: 0, reset: true });
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeTab, fetchTabReels, initialReelId, isFilterMode]);

  // ── Infinite scroll: fetch more when near end ──
  useEffect(() => {
    if (currentIndex >= reels.length - 3 && !fetchStateRef.current[activeTab].isFetching && reels.length > 0) {
      debugReels("near-end:trigger", {
        tab: activeTab,
        currentIndex,
        reelsLength: reels.length,
      });
      const timer = window.setTimeout(() => {
        fetchTabReels(activeTab, { start: tabDataRef.current[activeTab].reels.length });
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeTab, currentIndex, fetchTabReels, reels.length]);

  // ── Tab switch ──
  const handleTabSwitch = useCallback((tab: "forYou" | "following") => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  }, [activeTab]);

  // ── Update reel in list (for optimistic updates) ──
  const updateReel = useCallback((reelId: number, updater: (reel: Reel) => Reel) => {
    setTabData((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        reels: prev[activeTab].reels.map((r) => (r.id === reelId ? updater(r) : r)),
      },
    }));
  }, [activeTab]);

  // ── Remove reel from list ──
  const removeReel = useCallback((reelId: number) => {
    setTabData((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        reels: prev[activeTab].reels.filter((r) => r.id !== reelId),
      },
    }));
  }, [activeTab]);

  return (
    <div className="relative h-[100dvh] bg-black overflow-hidden">
      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        {isFilterMode ? (
          <div className="flex items-center gap-3 pt-4 pb-2 px-4 pointer-events-auto">
            <Link href="/reels" className="text-white/80 hover:text-white">
              <ChevronDown size={22} className="rotate-90" />
            </Link>
            <span className="text-white font-bold text-sm truncate">
              {filterHashtag ? `#${filterHashtag}` : "Reels"}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6 pt-4 pb-2 pointer-events-auto">
            <button
              onClick={() => handleTabSwitch("following")}
              className={cn(
                "text-sm font-bold transition-all cursor-pointer px-1 pb-1",
                activeTab === "following"
                  ? "text-white border-b-2 border-white"
                  : "text-white/50 hover:text-white/70",
              )}
            >
              {t("reels.following")}
            </button>
            <button
              onClick={() => handleTabSwitch("forYou")}
              className={cn(
                "text-sm font-bold transition-all cursor-pointer px-1 pb-1",
                activeTab === "forYou"
                  ? "text-white border-b-2 border-white"
                  : "text-white/50 hover:text-white/70",
              )}
            >
              {t("reels.forYou")}
            </button>
          </div>
        )}
      </div>

      {/* ── Loading state ── */}
      {isLoading && reels.length === 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-white" />
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && reels.length === 0 && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-8">
          <Play size={48} className="text-white/30 mb-4" />
          <p className="text-white font-bold text-lg mb-1">Aucun reel</p>
          <p className="text-white/50 text-sm">
            {activeTab === "following"
              ? "Suivez des personnes pour voir leurs reels ici."
              : "Revenez plus tard pour découvrir de nouveaux contenus."}
          </p>
        </div>
      )}

      {/* ── Reels container with snap scroll ── */}
      {reels.length > 0 && (
        <div
          ref={containerRef}
          className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
          onScroll={(e) => {
            const el = e.currentTarget;
            const idx = Math.round(el.scrollTop / el.clientHeight);
            if (idx !== currentIndex) {
              debugReels("scroll:index-change", {
                tab: activeTab,
                previousIndex: currentIndex,
                nextIndex: idx,
                reelsLength: reels.length,
              });
              setTabValue(activeTab, { currentIndex: idx });
            }
          }}
        >
          {reels.map((reel, index) => (
            <ReelItem
              key={`${reel.id}-${index}`}
              reel={reel}
              isActive={index === currentIndex}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((m) => !m)}
              me={me!}
              updateReel={updateReel}
              removeReel={removeReel}
            />
          ))}
        </div>
      )}

      {/* ── Loading more indicator ── */}
      {isLoading && reels.length > 0 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/55 border border-white/15 backdrop-blur-sm text-white/90">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-[11px] font-medium">Chargement de nouveaux reels...</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REEL ITEM — Individual reel with video, actions, info
   ═══════════════════════════════════════════════════════════════ */
function ReelItem({
  reel,
  isActive,
  isMuted,
  onToggleMute,
  me,
  updateReel,
  removeReel,
}: {
  reel: Reel;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  me: User;
  updateReel: (id: number, fn: (r: Reel) => Reel) => void;
  removeReel: (id: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const viewCountedRef = useRef(false);
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef(0);
  const { t } = useTranslation();

  const actingCompanyId = getActingCompanyId();
  const isMyReel = actingCompanyId
    ? reel.company_id === actingCompanyId
    : reel.user_id === me.id && !reel.company_id;
  const isLiked = reel.is_like === 1;
  const videoUrl = addBaseURL(reel.content);
  const thumbnailUrl = addBaseURL(reel.thumbnail);
  const actorHref = reel.company?.id ? `/company/${reel.company.id}` : `/profile/${reel.user_id}`;
  const actorName = reel.company?.name ?? reel.user?.username ?? "unknown";
  const actorShareName = reel.company?.name ?? reel.user?.full_name ?? "Someone";
  const actorAvatar = reel.company?.logo ?? reel.user?.profile;

  // ── Save/Bookmark state ──
  const savedIds = (me.saved_reel_ids ?? "").split(",").filter(Boolean);
  const [isSaved, setIsSaved] = useState(savedIds.includes(String(reel.id)));

  const handleSave = useCallback(() => {
    const currentIds = (useAuthStore.getState().user?.saved_reel_ids ?? "").split(",").filter(Boolean);
    let newIds: string[];
    if (currentIds.includes(String(reel.id))) {
      newIds = currentIds.filter((id) => id !== String(reel.id));
      setIsSaved(false);
    } else {
      newIds = [...currentIds, String(reel.id)];
      setIsSaved(true);
    }
    const newIdsStr = newIds.join(",");
    useAuthStore.getState().setUser({ ...me, saved_reel_ids: newIdsStr });
    UserService.editProfile(me.id, { saved_reel_ids: newIdsStr }).catch(() => {});
  }, [reel.id, me]);

  // ── Video play/pause based on visibility ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stateTimer: ReturnType<typeof setTimeout> | undefined;
    if (isActive) {
      video.play().catch(() => {});
      stateTimer = setTimeout(() => setIsPlaying(true), 0);
      // View count after 3 seconds
      if (!viewCountedRef.current) {
        viewTimerRef.current = setTimeout(() => {
          ReelService.increaseReelViewCount(reel.id).catch(() => {});
          viewCountedRef.current = true;
        }, 3000);
      }
    } else {
      video.pause();
      video.currentTime = 0;
      stateTimer = setTimeout(() => setIsPlaying(false), 0);
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    }
    return () => {
      if (stateTimer) clearTimeout(stateTimer);
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    };
  }, [isActive, reel.id]);

  // ── Sync muted state ──
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  // ── Double tap to like ──
  const handleDoubleTapLike = useCallback(() => {
    if (isLiked) {
      setDoubleTapHeart(true);
      setTimeout(() => setDoubleTapHeart(false), 800);
      return;
    }
    setDoubleTapHeart(true);
    setTimeout(() => setDoubleTapHeart(false), 800);
    updateReel(reel.id, (r) => ({
      ...r,
      is_like: 1,
      likes_count: (r.likes_count ?? 0) + 1,
    }));
    ReelService.likeDislikeReel(me.id, reel.id, actingCompanyId ?? undefined).catch(() => {});
  }, [isLiked, reel.id, me.id, updateReel, actingCompanyId]);

  // ── Toggle play/pause on single tap ──
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap → like
      handleDoubleTapLike();
      return;
    }
    lastTapRef.current = now;
    setTimeout(() => {
      if (Date.now() - lastTapRef.current >= 300) {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
          video.play().catch(() => {});
          setIsPlaying(true);
        } else {
          video.pause();
          setIsPlaying(false);
        }
      }
    }, 300);
  }, [handleDoubleTapLike]);

  // ── Like/unlike ──
  const handleLike = useCallback(() => {
    const wasLiked = reel.is_like === 1;
    updateReel(reel.id, (r) => ({
      ...r,
      is_like: wasLiked ? 0 : 1,
      likes_count: wasLiked
        ? Math.max(0, (r.likes_count ?? 0) - 1)
        : (r.likes_count ?? 0) + 1,
    }));
    ReelService.likeDislikeReel(me.id, reel.id, actingCompanyId ?? undefined).catch(() => {
      // Rollback
      updateReel(reel.id, (r) => ({
        ...r,
        is_like: wasLiked ? 1 : 0,
        likes_count: wasLiked
          ? (r.likes_count ?? 0) + 1
          : Math.max(0, (r.likes_count ?? 0) - 1),
      }));
    });
  }, [reel.id, reel.is_like, me.id, updateReel, actingCompanyId]);

  // ── Share ──
  const handleShare = useCallback(async () => {
    setShowMenu(false);
    const url = `${window.location.origin}/reels?id=${reel.id}`;
    const text = `${actorShareName} sur ITGA`;
    if (navigator.share) {
      try { await navigator.share({ title: text, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
  }, [reel.id, actorShareName]);

  // ── Delete ──
  const handleDelete = useCallback(async () => {
    setShowMenu(false);
    if (!confirm("Supprimer ce reel ?")) return;
    try {
      const res = await ReelService.deleteReel(reel.id, me.id, actingCompanyId ?? undefined);
      if (res.status) removeReel(reel.id);
    } catch { /* silent */ }
  }, [reel.id, me.id, removeReel, actingCompanyId]);

  return (
    <div className="relative h-[100dvh] w-full snap-start snap-always flex items-center justify-center bg-black">
      {/* Thumbnail background (blur) while video loads */}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-30"
        />
      )}

      {/* Video */}
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnailUrl}
        className="absolute inset-0 w-full h-full object-contain"
        loop
        playsInline
        muted={isMuted}
        preload={isActive ? "auto" : "metadata"}
        onClick={handleTap}
      />

      {/* Double-tap heart animation */}
      {doubleTapHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <Heart
            size={80}
            className="text-white fill-white animate-ping"
            style={{ animationDuration: "0.6s", animationIterationCount: 1 }}
          />
        </div>
      )}

      {/* Pause indicator */}
      {!isPlaying && isActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Play size={28} className="text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Bottom gradient for text readability */}
      <div className="absolute bottom-0 left-0 right-0 h-60 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none z-10" />

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-16 z-20 p-4 pb-6">
        {/* User info */}
        <div className="flex items-center gap-2 mb-2">
          <Link href={actorHref}>
            <Avatar src={actorAvatar} alt={actorShareName} size={36} />
          </Link>
          <Link href={actorHref} className="text-white font-bold text-sm hover:underline">
            {actorName}
          </Link>
          {reel.company?.id && (
            <Link
              href={`/company/${reel.company.id}`}
              className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-cyan bg-cyan/15 border border-cyan/30"
            >
              Entreprise
            </Link>
          )}
          {reel.user?.is_verified >= 2 && <VerifyBadge size={14} />}
          {!reel.company_id && !isMyReel && reel.user?.followingStatus !== 2 && reel.user?.followingStatus !== 3 && (
            <FollowBtn userId={reel.user_id} meId={me.id} />
          )}
        </div>

        {/* Date & views */}
        <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
          <span>{formatTimeAgo(reel.created_at)}</span>
          <span className="w-1 h-1 rounded-full bg-white/40" />
          <span className="flex items-center gap-1">
            <Eye size={12} />
            {formatCount(reel.views_count ?? 0)} vues
          </span>
        </div>

        {/* Description with hashtags and mentions */}
        {reel.description && (
          <ReelDescription text={reel.description} />
        )}

        {/* Music */}
        {reel.music && (
          <Link
            href={`/reels?music=${reel.music.id}`}
            className="flex items-center gap-2 mt-2 group/music"
          >
            <Music2 size={12} className="text-white/70 animate-spin" style={{ animationDuration: "3s" }} />
            <span className="text-white/70 text-xs truncate max-w-[200px] group-hover/music:text-white group-hover/music:underline">
              {reel.music.artist} — {reel.music.title}
            </span>
          </Link>
        )}
      </div>

      {/* Right sidebar actions */}
      <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-4">
        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center gap-1 cursor-pointer active:scale-90 transition-transform duration-150 group">
          <div className={cn(
            "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200",
            isLiked ? "bg-red/20" : "bg-black/20 group-hover:bg-black/30"
          )} style={{ backdropFilter: 'blur(8px)' }}>
            <Heart
              size={24}
              className={cn(
                "transition-all duration-200",
                isLiked ? "text-red fill-red scale-110" : "text-white",
              )}
            />
          </div>
          <span className="text-white text-[11px] font-semibold drop-shadow">{formatCount(reel.likes_count ?? 0)}</span>
        </button>

        {/* Comments */}
        <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1 cursor-pointer active:scale-90 transition-transform duration-150 group">
          <div className="w-11 h-11 rounded-full bg-black/20 group-hover:bg-black/30 flex items-center justify-center transition-all duration-200" style={{ backdropFilter: 'blur(8px)' }}>
            <MessageCircle size={24} className="text-white" />
          </div>
          <span className="text-white text-[11px] font-semibold drop-shadow">{formatCount(reel.comments_count ?? 0)}</span>
        </button>

        {/* Save/Bookmark */}
        <button onClick={handleSave} className="flex flex-col items-center gap-1 cursor-pointer active:scale-90 transition-transform duration-150 group">
          <div className={cn(
            "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200",
            isSaved ? "bg-primary/20" : "bg-black/20 group-hover:bg-black/30"
          )} style={{ backdropFilter: 'blur(8px)' }}>
            {isSaved ? (
              <BookmarkCheck size={22} className="text-primary fill-primary transition-all" />
            ) : (
              <Bookmark size={22} className="text-white transition-all" />
            )}
          </div>
        </button>

        {/* Share */}
        <button onClick={handleShare} className="flex flex-col items-center gap-1 cursor-pointer active:scale-90 transition-transform duration-150 group">
          <div className="w-11 h-11 rounded-full bg-black/20 group-hover:bg-black/30 flex items-center justify-center transition-all duration-200" style={{ backdropFilter: 'blur(8px)' }}>
            <Share2 size={22} className="text-white" />
          </div>
        </button>

        {/* More menu */}
        <button onClick={() => setShowMenu((s) => !s)} className="cursor-pointer active:scale-90 transition-transform duration-150 group">
          <div className="w-11 h-11 rounded-full bg-black/20 group-hover:bg-black/30 flex items-center justify-center transition-all duration-200" style={{ backdropFilter: 'blur(8px)' }}>
            <MoreHorizontal size={22} className="text-white" />
          </div>
        </button>

        {/* Mute toggle */}
        <button onClick={onToggleMute} className="cursor-pointer active:scale-90 transition-transform duration-150 group">
          <div className="w-11 h-11 rounded-full bg-black/20 group-hover:bg-black/30 flex items-center justify-center transition-all duration-200" style={{ backdropFilter: 'blur(8px)' }}>
            {isMuted ? <VolumeX size={20} className="text-white/60" /> : <Volume2 size={20} className="text-white" />}
          </div>
        </button>
      </div>

      {/* ── More menu dropdown ── */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
          <div className="absolute right-3 bottom-52 z-40 w-48 bg-card rounded-xl shadow-2xl border border-border/30 py-1 animate-scaleIn origin-bottom-right ring-1 ring-black/5">
            <button onClick={handleShare} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-main hover:bg-bg-light/70 transition-colors cursor-pointer">
              <Share2 size={16} className="text-text-light" /> Partager
            </button>
            {isMyReel ? (
              <>
                <div className="h-px bg-border/30 mx-3 my-1" />
                <button onClick={handleDelete} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red hover:bg-red/5 transition-colors cursor-pointer">
                  <Trash2 size={16} /> Supprimer
                </button>
              </>
            ) : (
              <button onClick={() => { setShowMenu(false); setShowReport(true); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-main hover:bg-bg-light/70 transition-colors cursor-pointer">
                <Flag size={16} className="text-text-light" /> {t("reels.report")}
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Comments panel ── */}
      {showComments && (
        <ReelCommentsPanel
          reelId={reel.id}
          me={me}
          onClose={() => setShowComments(false)}
          updateReel={updateReel}
        />
      )}

      {/* ── Report modal ── */}
      {showReport && (
        <ReportReelModal reelId={reel.id} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}

/* ─── Follow Button (inline, transparent) ─── */
function FollowBtn({ userId, meId }: { userId: number; meId: number }) {
  const [followed, setFollowed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFollow = async () => {
    if (loading) return;
    setLoading(true);
    setFollowed(true);
    try {
      await UserService.followUser(meId, userId, getActingCompanyId() ?? undefined);
    } catch {
      setFollowed(false);
    }
    setLoading(false);
  };

  if (followed) return null;

  return (
    <button
      onClick={handleFollow}
      className="ml-1 px-3 py-1 text-xs font-semibold text-white border border-white/30 rounded-full bg-white/5 hover:bg-white/15 transition-colors cursor-pointer"
    >
      Suivre
    </button>
  );
}

/* ─── Reel Description with #hashtags and @mentions ─── */
function ReelDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 100;
  const displayText = !expanded && isLong ? text.slice(0, 100) + "..." : text;

  const parts = useMemo(() => {
    const regex = /(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g;
    const result: { text: string; type: "text" | "hashtag" | "mention" }[] = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(displayText)) !== null) {
      if (match.index > lastIndex) {
        result.push({ text: displayText.slice(lastIndex, match.index), type: "text" });
      }
      result.push({
        text: match[0],
        type: match[0].startsWith("#") ? "hashtag" : "mention",
      });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < displayText.length) {
      result.push({ text: displayText.slice(lastIndex), type: "text" });
    }
    return result;
  }, [displayText]);

  return (
    <p className="text-white/80 text-[13px] leading-relaxed">
      {parts.map((part, i) =>
        part.type === "text" ? (
          <span key={i}>{part.text}</span>
        ) : part.type === "hashtag" ? (
          <Link
            key={i}
            href={`/tag?tag=${encodeURIComponent(part.text.slice(1))}&tab=reels`}
            className="text-primary font-medium hover:underline"
          >
            {part.text}
          </Link>
        ) : (
          <MentionProfileLink
            key={i}
            username={part.text.replace(/^@/, "")}
            className="text-primary"
          >
            {part.text}
          </MentionProfileLink>
        ),
      )}
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-white/50 ml-1 text-xs cursor-pointer hover:text-white/70"
        >
          {expanded ? "moins" : "plus"}
        </button>
      )}
    </p>
  );
}

/* ─── Comment text with clickable #hashtags and @mentions (§6.3) ─── */
function CommentText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    if (!text) return [];
    const regex = /(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g;
    const result: { text: string; type: "text" | "hashtag" | "mention" }[] = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) result.push({ text: text.slice(lastIndex, match.index), type: "text" });
      result.push({ text: match[0], type: match[0].startsWith("#") ? "hashtag" : "mention" });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) result.push({ text: text.slice(lastIndex), type: "text" });
    return result;
  }, [text]);

  return (
    <p className={cn("leading-snug break-words", className)}>
      {parts.map((p, i) =>
        p.type === "text" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "hashtag" ? (
          <Link key={i} href={`/tag?tag=${encodeURIComponent(p.text.slice(1))}&tab=reels`} className="text-primary font-medium hover:underline">{p.text}</Link>
        ) : (
          <MentionProfileLink key={i} username={p.text.replace(/^@/, "")} className="text-primary">{p.text}</MentionProfileLink>
        ),
      )}
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REEL COMMENTS PANEL — §6
   ═══════════════════════════════════════════════════════════════ */
function ReelCommentsPanel({
  reelId,
  me,
  onClose,
  updateReel,
}: {
  reelId: number;
  me: User;
  onClose: () => void;
  updateReel: (id: number, fn: (r: Reel) => Reel) => void;
}) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ReelComment | null>(null);
  const [editingComment, setEditingComment] = useState<ReelComment | null>(null);
  const [editText, setEditText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const actingCompanyId = getActingCompanyId() ?? undefined;

  const fetchComments = useCallback(
    async (start: number, reset = false) => {
      try {
        const res = await ReelService.fetchReelComments(me.id, reelId, start, COMMENTS_PAGE_SIZE, actingCompanyId);
        if (res.status && res.data) {
          setComments((prev) => (reset ? res.data! : [...prev, ...res.data!]));
          setHasMore(res.data.length >= COMMENTS_PAGE_SIZE);
        }
      } catch { /* silent */ }
      setIsLoading(false);
    },
    [me.id, reelId, actingCompanyId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchComments(0, true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchComments]);

  // ── Send comment ──
  const handleSend = async () => {
    const text = newComment.trim();
    if (!text || isSending) return;
    setIsSending(true);
    try {
      const res = await ReelService.addReelComment(
        me.id,
        reelId,
        text,
        replyTo?.id,
        undefined,
        actingCompanyId,
      );
      if (res.status && res.data) {
        if (replyTo) {
          // Refresh to show reply in context
          fetchComments(0, true);
        } else {
          setComments((prev) => [res.data!, ...prev]);
        }
        updateReel(reelId, (r) => ({
          ...r,
          comments_count: (r.comments_count ?? 0) + 1,
        }));
      }
    } catch { /* silent */ }
    setNewComment("");
    setReplyTo(null);
    setIsSending(false);
  };

  // ── Like comment ──
  const handleLikeComment = useCallback(
    async (commentId: number) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                is_like: c.is_like === 1 ? 0 : 1,
                comment_like_count:
                  c.is_like === 1
                    ? Math.max(0, c.comment_like_count - 1)
                    : c.comment_like_count + 1,
              }
            : c,
        ),
      );
      try {
        await ReelService.likeDislikeReelComment(me.id, commentId, actingCompanyId);
      } catch { /* rollback would go here */ }
    },
    [me.id, actingCompanyId],
  );

  // ── Delete comment ──
  const handleDeleteComment = useCallback(
    async (commentId: number) => {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      updateReel(reelId, (r) => ({
        ...r,
        comments_count: Math.max(0, (r.comments_count ?? 0) - 1),
      }));
      try {
        await ReelService.deleteReelComment(me.id, commentId, actingCompanyId);
      } catch { /* silent */ }
    },
    [me.id, reelId, updateReel, actingCompanyId],
  );

  // ── Edit comment ──
  const handleEditComment = async () => {
    if (!editingComment || !editText.trim()) return;
    try {
      const res = await ReelService.editReelComment(me.id, editingComment.id, editText.trim(), actingCompanyId);
      if (res.status && res.data) {
        setComments((prev) =>
          prev.map((c) => (c.id === editingComment.id ? { ...c, description: editText.trim(), is_edited: 1 } : c)),
        );
      }
    } catch { /* silent */ }
    setEditingComment(null);
    setEditText("");
  };

  // ── Copy comment ──
  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card rounded-t-2xl shadow-2xl animate-slideUp flex flex-col max-h-[70vh]">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border/50" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/20 shrink-0">
          <h3 className="text-base font-bold text-text-main">Commentaires</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-bg-light text-text-light cursor-pointer transition-colors duration-200 active:scale-90">
            <X size={18} />
          </button>
        </div>

        {/* Comments list */}
        <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <MessageCircle size={32} className="text-text-light/30 mb-2" />
              <p className="text-sm text-text-light">{t("reels.beFirst")}</p>
            </div>
          ) : (
            <>
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  me={me}
                  onLike={handleLikeComment}
                  onReply={(c) => setReplyTo(c)}
                  onDelete={handleDeleteComment}
                  onEdit={(c) => {
                    setEditingComment(c);
                    setEditText(c.description);
                  }}
                  onCopy={handleCopy}
                />
              ))}
              {hasMore && (
                <button
                  onClick={() => fetchComments(comments.length)}
                  className="w-full py-2 text-xs text-primary font-semibold hover:underline cursor-pointer"
                >
                  Charger plus...
                </button>
              )}
            </>
          )}
        </div>

        {/* Edit mode */}
        {editingComment && (
          <div className="px-5 py-2 border-t border-border/20 bg-primary/[0.03] shrink-0">
            <div className="flex items-center gap-2">
              <Pencil size={14} className="text-primary" />
              <span className="text-xs text-primary font-medium">Modifier le commentaire</span>
              <button onClick={() => setEditingComment(null)} className="ml-auto text-text-light cursor-pointer hover:text-text-main transition-colors duration-200">
                <X size={14} />
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="flex-1 text-sm px-3 py-2 rounded-xl border border-border/30 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
                onKeyDown={(e) => e.key === "Enter" && handleEditComment()}
              />
              <button
                onClick={handleEditComment}
                className="px-3 py-2 bg-gradient-to-r from-primary to-cyan text-white text-sm font-semibold rounded-xl cursor-pointer hover:shadow-md hover:shadow-primary/20 transition-all duration-200 active:scale-95"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Reply indicator */}
        {replyTo && !editingComment && (
          <div className="px-5 py-2 border-t border-border/20 bg-primary/[0.03] shrink-0 flex items-center gap-2">
            <span className="text-xs text-text-light">
              {t("comment.replyingTo")} <span className="font-semibold text-primary">{replyTo.company?.name ?? replyTo.user?.full_name}</span>
            </span>
            <button onClick={() => setReplyTo(null)} className="ml-auto text-text-light hover:text-text-main cursor-pointer transition-colors duration-200">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Input */}
        {!editingComment && (
          <div className="px-4 py-3 border-t border-border/20 shrink-0 flex items-center gap-2.5">
            <Avatar src={me.profile} alt={me.full_name} size={32} />
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyTo ? `${t("comment.replyPlaceholder")} ${replyTo.company?.name ?? replyTo.user?.full_name}...` : t("comment.writePlaceholder")}
              className="flex-1 text-sm px-3.5 py-2 rounded-full bg-bg-light border border-border/20 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 placeholder:text-text-light/50 transition-all duration-200"
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={!newComment.trim() || isSending}
              className={cn(
                "p-2 rounded-full transition-all duration-200 cursor-pointer active:scale-90",
                newComment.trim() ? "text-primary hover:bg-primary/10" : "text-text-light/30",
              )}
            >
              {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Comment Item ─── */
function CommentItem({
  comment,
  me,
  onLike,
  onReply,
  onDelete,
  onEdit,
  onCopy,
}: {
  comment: ReelComment;
  me: User;
  onLike: (id: number) => void;
  onReply: (c: ReelComment) => void;
  onDelete: (id: number) => void;
  onEdit: (c: ReelComment) => void;
  onCopy: (text: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const actingCompanyId = getActingCompanyId();
  const isOwn = actingCompanyId
    ? comment.company_id === actingCompanyId
    : comment.user_id === me.id && !comment.company_id;
  const isModerator = me.is_moderator === 1;
  const isLiked = comment.is_like === 1;
  const actorHref = comment.company?.id ? `/company/${comment.company.id}` : `/profile/${comment.user_id}`;
  const actorName = comment.company?.name ?? comment.user?.full_name ?? "Utilisateur";
  const actorAvatar = comment.company?.logo ?? comment.user?.profile;

  return (
    <div className="flex gap-3 group">
      <Link href={actorHref} className="shrink-0">
        <Avatar src={actorAvatar} alt={actorName} size={34} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Link
            href={actorHref}
            className="text-[13px] font-bold text-text-main hover:underline truncate"
          >
            {actorName}
          </Link>
          {comment.company?.id && (
            <Link href={`/company/${comment.company.id}`} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-cyan bg-cyan/10 border border-cyan/25">
              Entreprise
            </Link>
          )}
          {comment.user?.is_verified >= 2 && <VerifyBadge size={13} />}
          <span className="text-[11px] text-text-light">{formatTimeAgo(comment.created_at)}</span>
          {comment.is_edited === 1 && (
            <span className="text-[10px] text-text-light/60 italic">modifié</span>
          )}
        </div>
        <CommentText text={comment.description} className="text-[13px] text-text-dark" />
        <div className="flex items-center gap-4 mt-1.5">
          <button onClick={() => onLike(comment.id)} className="flex items-center gap-1 cursor-pointer">
            <Heart
              size={14}
              className={cn(isLiked ? "text-red fill-red" : "text-text-light hover:text-red")}
            />
            {comment.comment_like_count > 0 && (
              <span className="text-[11px] text-text-light">{comment.comment_like_count}</span>
            )}
          </button>
          <button
            onClick={() => onReply(comment)}
            className="text-[11px] font-semibold text-text-light hover:text-primary cursor-pointer"
          >
            Répondre
          </button>
          <button
            onClick={() => setShowActions((s) => !s)}
            className="text-text-light/40 hover:text-text-light opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ml-auto"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>

        {/* Actions dropdown */}
        {showActions && (
          <div className="flex items-center gap-2 mt-1.5 text-[11px] animate-fadeIn">
            <button onClick={() => { onCopy(comment.description); setShowActions(false); }} className="text-text-light hover:text-text-main cursor-pointer flex items-center gap-1">
              <Copy size={12} /> Copier
            </button>
            {isOwn && (
              <>
                <button onClick={() => { onEdit(comment); setShowActions(false); }} className="text-primary hover:underline cursor-pointer flex items-center gap-1">
                  <Pencil size={12} /> Modifier
                </button>
                <button onClick={() => { onDelete(comment.id); setShowActions(false); }} className="text-red hover:underline cursor-pointer flex items-center gap-1">
                  <Trash2 size={12} /> Supprimer
                </button>
              </>
            )}
            {!isOwn && isModerator && (
              <button onClick={() => { onDelete(comment.id); setShowActions(false); }} className="text-red hover:underline cursor-pointer flex items-center gap-1">
                <Trash2 size={12} /> Supprimer
              </button>
            )}
          </div>
        )}

        {/* Reply count */}
        {(comment.reply_count ?? 0) > 0 && (
          <ReplyThread commentId={comment.id} me={me} onLike={onLike} onCopy={onCopy} />
        )}
      </div>
    </div>
  );
}

/* ─── Reply Thread ─── */
function ReplyThread({
  commentId,
  me,
  onLike,
  onCopy,
}: {
  commentId: number;
  me: User;
  onLike: (id: number) => void;
  onCopy: (text: string) => void;
}) {
  const [replies, setReplies] = useState<ReelComment[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const actingCompanyId = getActingCompanyId() ?? undefined;

  const fetchReplies = async () => {
    setIsLoading(true);
    try {
      const res = await ReelService.fetchReelCommentReplies(me.id, commentId, 0, 50, actingCompanyId);
      if (res.status && res.data) setReplies(res.data);
    } catch { /* silent */ }
    setIsLoading(false);
    setExpanded(true);
  };

  if (!expanded) {
    return (
      <button
        onClick={fetchReplies}
        className="text-[11px] text-primary font-semibold mt-2 cursor-pointer hover:underline flex items-center gap-1"
      >
        <ChevronDown size={12} />
        Voir les réponses
      </button>
    );
  }

  return (
    <div className="mt-3 ml-2 pl-3 border-l-2 border-border-light/60 space-y-3">
      {isLoading ? (
        <Loader2 size={14} className="animate-spin text-primary" />
      ) : (
        replies.map((reply) => {
          const actorHref = reply.company?.id ? `/company/${reply.company.id}` : `/profile/${reply.user_id}`;
          const actorName = reply.company?.name ?? reply.user?.full_name ?? "Utilisateur";
          const actorAvatar = reply.company?.logo ?? reply.user?.profile;

          return (
          <div key={reply.id} className="flex gap-2.5 group">
            <Link href={actorHref} className="shrink-0">
              <Avatar src={actorAvatar} alt={actorName} size={28} />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Link href={actorHref} className="text-xs font-bold text-text-main hover:underline">
                  {actorName}
                </Link>
                {reply.company?.id && (
                  <Link href={`/company/${reply.company.id}`} className="px-1 py-0.5 rounded-full text-[9px] font-semibold text-cyan bg-cyan/10 border border-cyan/25">
                    Entreprise
                  </Link>
                )}
                {reply.user?.is_verified >= 2 && <VerifyBadge size={12} />}
                <span className="text-[10px] text-text-light">{formatTimeAgo(reply.created_at)}</span>
                {reply.is_edited === 1 && <span className="text-[9px] text-text-light/60 italic">modifié</span>}
              </div>
              <CommentText text={reply.description} className="text-xs text-text-dark" />
              <div className="flex items-center gap-3 mt-1">
                <button onClick={() => onLike(reply.id)} className="flex items-center gap-1 cursor-pointer">
                  <Heart size={12} className={cn(reply.is_like === 1 ? "text-red fill-red" : "text-text-light hover:text-red")} />
                  {reply.comment_like_count > 0 && (
                    <span className="text-[10px] text-text-light">{reply.comment_like_count}</span>
                  )}
                </button>
                <button onClick={() => onCopy(reply.description)} className="text-text-light/40 hover:text-text-light text-[10px] cursor-pointer">
                  <Copy size={11} />
                </button>
              </div>
            </div>
          </div>
          );
        })
      )}
    </div>
  );
}

/* ─── Report Reel Modal ─── */
function ReportReelModal({ reelId, onClose }: { reelId: number; onClose: () => void }) {
  const reportReasons = useSettingsStore((state) => state.reportReasons);
  const availableReportReasons = getReportReasonsWithFallback(reportReasons);
  const [reason, setReason] = useState("");
  const [desc, setDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async () => {
    if (!reason) return;
    setIsSubmitting(true);
    try {
      await ReelService.reportReel(reelId, reason, desc);
      setSubmitted(true);
    } catch { /* silent */ }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slideUp overflow-hidden max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light shrink-0">
          <h3 className="text-lg font-bold text-text-main">{t("reels.reportTitle")}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-bg-light text-text-light cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 overscroll-contain">
          {submitted ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-green/10 flex items-center justify-center">
                <BadgeCheck size={24} className="text-green" />
              </div>
              <p className="text-sm font-semibold text-text-main">Signalement envoyé</p>
              <p className="text-xs text-text-light text-center">Merci pour votre signalement. Nous examinerons ce reel.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-text-light mb-4">Sélectionnez la raison du signalement :</p>
              <div className="space-y-2">
                {availableReportReasons.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer border",
                      reason === r
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border-light text-text-main hover:bg-bg-light",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                placeholder={t("reels.reportDetails")}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="mt-4 w-full h-20 px-3 py-2 rounded-xl border border-border-light text-sm text-text-main placeholder:text-text-light/50 focus:outline-none focus:border-primary resize-none"
              />
              <button
                onClick={handleSubmit}
                disabled={!reason || isSubmitting}
                className={cn(
                  "mt-4 w-full py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer",
                  reason && !isSubmitting
                    ? "bg-red text-white hover:bg-red/90"
                    : "bg-bg-light text-text-light cursor-not-allowed",
                )}
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin mx-auto" />
                ) : (
                  "Envoyer le signalement"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
