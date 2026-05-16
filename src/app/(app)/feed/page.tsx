"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shuffle, PenSquare, Check, AlertCircle, RefreshCw, ImageIcon, VideoIcon, Loader2, Users, Lock, Globe, Building2, ShieldCheck } from "lucide-react";
import { UnderlineTabs } from "@/components/ui/tabs";
import { PostCard } from "@/components/post/post-card";
import { Avatar } from "@/components/ui/avatar";
import { StoriesBar } from "@/components/stories/stories-bar";
import { useAuthStore, useFeedStore, useSettingsStore, useTranslation, type TranslationKey } from "@/lib/store";
import { PostService } from "@/lib/services/post-service";
import { getActingCompanyId } from "@/lib/company-acting";
import { addBaseURL, formatCount } from "@/lib/utils";
import type { Interest, Post, Room, User } from "@/lib/types";

const PAGE_SIZE = 20; // Match mobile (Limits.pagination = 20)
const MAX_RANDOM_REFILL_ATTEMPTS = 4;

const feedTabs = (t: (k: TranslationKey) => string) => [
  { id: "forYou", label: t("feed.forYou") },
  { id: "following", label: t("feed.following") },
];

function dedupePostsById(items: Post[]) {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function debugFeed(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[ITGA][feed] ${message}`, payload ?? {});
}

function roomInterestTags(room: Room, interests: Interest[]) {
  const ids = (room.interest_ids ?? "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter(Boolean);
  return interests.filter((interest) => ids.includes(interest.id)).slice(0, 3);
}

function roomCreator(room: Room): User | undefined {
  return room.admin ?? room.user;
}

function SuggestedRoomsRail({
  rooms,
  interests,
  onOpenRoom,
}: {
  rooms: Room[];
  interests: Interest[];
  onOpenRoom: (roomId: number) => void;
}) {
  if (rooms.length === 0) return null;

  return (
    <section className="card p-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-bold text-text-main">Salons suggérés</h2>
          <p className="text-xs text-text-light">Créateurs vérifiés, intérêts compatibles.</p>
        </div>
        <Link href="/rooms" className="text-xs font-bold text-primary hover:text-primary-hover">
          Voir tout
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 snap-x">
        {rooms.map((room) => {
          const tags = roomInterestTags(room, interests);
          const creator = roomCreator(room);
          const isVerified = room.company?.is_verified === 1 || Number(creator?.is_verified ?? 0) >= 2;

          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onOpenRoom(room.id)}
              className="snap-start min-w-[252px] max-w-[280px] flex-1 text-left rounded-lg border border-border/70 bg-white hover:border-primary/40 hover:shadow-sm transition-all p-3 cursor-pointer"
            >
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-bg-light flex items-center justify-center">
                  {room.photo ? (
                    <img src={addBaseURL(room.photo)} alt={room.title} className="w-full h-full object-cover" />
                  ) : (
                    <Users size={22} className="text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-text-main truncate">{room.title}</h3>
                    {isVerified && <ShieldCheck size={14} className="text-primary shrink-0" aria-label="Compte vérifié" />}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-text-light">
                    {room.is_private === 1 ? <Lock size={12} /> : <Globe size={12} />}
                    <span>{formatCount(room.total_member)} membres</span>
                  </div>
                </div>
              </div>

              {room.company && (
                <div className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">
                  <Building2 size={12} />
                  <span className="truncate">{room.company.name}</span>
                </div>
              )}

              {tags.length > 0 && (
                <div className="mt-3 flex gap-1.5 flex-wrap">
                  {tags.map((tag) => (
                    <span key={tag.id} className="rounded-full bg-green/10 px-2 py-0.5 text-[11px] font-bold text-green">
                      {tag.title}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function FeedPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeTab, setActiveTab } = useFeedStore();
  const { interests } = useSettingsStore();
  const { t } = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [suggestedRooms, setSuggestedRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repostToast, setRepostToast] = useState(false);
  const isFetchingRef = useRef(false);
  const fetchGenRef = useRef(0);
  const postsRef = useRef<Post[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync with state (avoids stale closures)
  useEffect(() => { postsRef.current = posts; }, [posts]);

  // Fetch posts — mirrors mobile Flutter FeedScreenController.fetchFeeds()
  const fetchPosts = useCallback(
    async (isReset: boolean = false) => {
      if (!user) return;
      // Allow reset fetches to proceed even when another fetch is in-flight
      if (!isReset && isFetchingRef.current) return;

      const gen = ++fetchGenRef.current;
      isFetchingRef.current = true;
      if (isReset) {
        setIsLoading(true);
        setIsLoadingMore(false);
        setSuggestedRooms([]);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      const isFollowing = activeTab === "following";
      let workingPosts = isReset ? [] : postsRef.current;
      let nextPosts = workingPosts;
      let attempt = 0;
      let madeProgress = false;

      try {
        const actingCompanyId = getActingCompanyId() ?? undefined;
        debugFeed("fetch:start", {
          tab: activeTab,
          reset: isReset,
          currentCount: workingPosts.length,
          actingCompanyId,
        });

        while (attempt <= MAX_RANDOM_REFILL_ATTEMPTS) {
          const start = isFollowing ? workingPosts.length : (isReset && attempt === 0 ? 0 : workingPosts.length);
          const shouldSendSuggestedRoom = start === 0 && attempt === 0;
          const excludedPostIds = !isFollowing ? workingPosts.map((post) => post.id) : undefined;
          const res = await PostService.fetchPosts(user.id, start, PAGE_SIZE, isFollowing, shouldSendSuggestedRoom, excludedPostIds, actingCompanyId);

          // Stale response (tab switched while fetching) — discard
          if (gen !== fetchGenRef.current) return;

          if (!res.status || !res.data) {
            if (isReset) {
              setError(res.message || "Impossible de charger les publications.");
              setPosts([]);
              setSuggestedRooms([]);
            }
            break;
          }

          if (shouldSendSuggestedRoom) {
            setSuggestedRooms(Array.isArray(res.suggestedRooms) ? res.suggestedRooms : []);
          }

          const incoming = dedupePostsById(res.data);
          const existingIds = new Set(workingPosts.map((post) => post.id));
          const unseenPosts = incoming.filter((post) => !existingIds.has(post.id));

          debugFeed("fetch:batch", {
            tab: activeTab,
            reset: isReset,
            attempt,
            start,
            excludedCount: excludedPostIds?.length ?? 0,
            rawCount: res.data.length,
            dedupedCount: incoming.length,
            unseenCount: unseenPosts.length,
            currentCount: workingPosts.length,
          });

          if (isReset && attempt === 0) {
            nextPosts = incoming;
            madeProgress = incoming.length > 0;
            break;
          }

          if (unseenPosts.length > 0) {
            nextPosts = [...workingPosts, ...unseenPosts];
            workingPosts = nextPosts;
            madeProgress = true;
            break;
          }

          if (isFollowing || incoming.length === 0) {
            break;
          }

          attempt += 1;
        }

        // Mobile-like fallback for For You: allow refill even if all unique posts were already seen.
        if (!madeProgress && !isFollowing && !isReset) {
          try {
            const refillRes = await PostService.fetchPosts(
              user.id,
              workingPosts.length,
              PAGE_SIZE,
              false,
              false,
              undefined,
              actingCompanyId,
            );

            if (gen !== fetchGenRef.current) return;

            if (refillRes.status && Array.isArray(refillRes.data) && refillRes.data.length > 0) {
              nextPosts = [...workingPosts, ...refillRes.data];
              madeProgress = true;
              debugFeed("fetch:mobile-refill", {
                tab: activeTab,
                reset: isReset,
                appendedCount: refillRes.data.length,
                nextCount: nextPosts.length,
              });
            }
          } catch {
            // Keep current posts if fallback fails.
          }
        }

        if (madeProgress || isReset) {
          debugFeed("fetch:commit", {
            tab: activeTab,
            reset: isReset,
            nextCount: nextPosts.length,
            addedCount: Math.max(0, nextPosts.length - (isReset ? 0 : postsRef.current.length)),
          });
          setPosts(nextPosts);
        } else {
          debugFeed("fetch:no-progress", {
            tab: activeTab,
            reset: isReset,
            currentCount: workingPosts.length,
          });
        }
      } catch {
        if (gen !== fetchGenRef.current) return;
        setError("Erreur réseau");
      } finally {
        if (gen === fetchGenRef.current) {
          isFetchingRef.current = false;
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [user, activeTab]
  );

  const handleComment = useCallback(
    (postId: number) => {
      router.push(`/post/${postId}`);
    },
    [router]
  );

  const handleRepostSuccess = useCallback(() => {
    setRepostToast(true);
    setTimeout(() => setRepostToast(false), 2000);
  }, []);

  const handleDelete = useCallback((postId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const handleRandomProfile = useCallback(() => {
    if (posts.length === 0 || !user) return;
    const otherPosts = posts.filter((p) => p.user_id !== user.id);
    const pool = otherPosts.length > 0 ? otherPosts : posts;
    const random = pool[Math.floor(Math.random() * pool.length)];
    router.push(`/profile/${random.user_id}`);
  }, [posts, user, router]);

  const handleRefresh = useCallback(() => {
    fetchPosts(true);
  }, [fetchPosts]);

  // Initial load + tab switch
  useEffect(() => {
    fetchPosts(true);
  }, [fetchPosts]);

  // Infinite scroll — align with mobile ScrollController.addListener
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || isFetchingRef.current) return;

        debugFeed("scroll:trigger", {
          tab: activeTab,
          currentCount: postsRef.current.length,
        });
        fetchPosts(false);
      },
      { rootMargin: "200px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, fetchPosts]);

  // Auto-fill if content is shorter than viewport
  useEffect(() => {
    if (isLoading || isFetchingRef.current || posts.length === 0) return;

    const doc = document.documentElement;
    if (doc.scrollHeight <= window.innerHeight + 120) {
      debugFeed("autofill:trigger", {
        tab: activeTab,
        scrollHeight: doc.scrollHeight,
        viewport: window.innerHeight,
        currentCount: posts.length,
      });
      fetchPosts(false);
    }
  }, [activeTab, posts.length, isLoading, fetchPosts]);

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="card">
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          <Link href="/profile" className="shrink-0 ring-2 ring-primary/20 rounded-full hover:ring-primary/40 transition-all duration-300">
            <Avatar
              src={user?.profile}
              alt={user?.full_name ?? ""}
              size={38}
            />
          </Link>
          <Link
            href="/create"
            className="flex-1 h-9 flex items-center px-4 text-[13px] text-text-light rounded-full border border-border/60 hover:border-border hover:bg-bg-light/50 hover:text-text-dark transition-all duration-200 cursor-pointer"
          >
            {t("feed.startPost")}
          </Link>
        </div>
        <div className="flex items-center border-t border-border/30 mx-1">
          <Link href="/create" className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-text-dark hover:bg-bg-light/60 transition-all duration-200 rounded-bl-lg group">
            <ImageIcon size={15} className="text-cyan group-hover:scale-110 transition-transform duration-200" />
            <span>{t("feed.photo")}</span>
          </Link>
          <Link href="/create" className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-text-dark hover:bg-bg-light/60 transition-all duration-200 group">
            <VideoIcon size={15} className="text-green group-hover:scale-110 transition-transform duration-200" />
            <span>{t("feed.video")}</span>
          </Link>
          <Link href="/create" className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-text-dark hover:bg-bg-light/60 transition-all duration-200 rounded-br-lg group">
            <PenSquare size={13} className="text-magenta group-hover:scale-110 transition-transform duration-200" />
            <span>{t("feed.article")}</span>
          </Link>
        </div>
      </div>

      {/* Tab Selector + Sort */}
      <div className="card">
        <div className="flex items-center justify-between px-1">
          <UnderlineTabs
            tabs={feedTabs(t)}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as "forYou" | "following")}
          />
          <div className="flex items-center gap-0.5 mr-2">
            <button
              onClick={handleRefresh}
              disabled={isFetchingRef.current}
              className="p-2 rounded-full hover:bg-bg-light transition-all duration-200 text-text-light hover:text-primary cursor-pointer disabled:opacity-40 active:scale-90"
              title="Actualiser"
            >
              <RefreshCw size={16} className={isLoading && posts.length === 0 ? "animate-spin" : ""} />
            </button>
            <button
              onClick={handleRandomProfile}
              className="p-2 rounded-full hover:bg-bg-light transition-all duration-200 text-text-light hover:text-primary cursor-pointer active:scale-90"
              title="Profil aléatoire"
            >
              <Shuffle size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Stories Bar */}
      <StoriesBar />

      <SuggestedRoomsRail
        rooms={suggestedRooms}
        interests={interests}
        onOpenRoom={(roomId) => router.push(`/rooms?openRoom=${roomId}`)}
      />

      {/* Error state */}
      {error && (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-red/10 flex items-center justify-center mb-3">
              <AlertCircle size={24} className="text-red" />
            </div>
            <h3 className="text-sm font-bold text-text-main mb-1">{t("feed.loadError")}</h3>
            <p className="text-[13px] text-text-light max-w-xs mb-4">{error}</p>
            <button
              onClick={() => fetchPosts(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-full hover:bg-primary-hover transition-colors cursor-pointer"
            >
              <RefreshCw size={14} />
              {t("feed.retry")}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!error && posts.length === 0 && !isLoading && (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-bg-light flex items-center justify-center mb-4">
              <PenSquare size={28} className="text-text-light" />
            </div>
            <h3 className="text-base font-bold text-text-main mb-1">Aucune publication</h3>
            <p className="text-sm text-text-light max-w-xs">
              {activeTab === "following"
                ? "Suivez des personnes pour voir leurs publications ici."
                : "Soyez la première à partager quelque chose !"}
            </p>
          </div>
        </div>
      )}

      {/* Posts — each as a card with gap */}
      <div className="stagger-children">
        {posts.map((post, index) => (
          <div key={`${post.id}-${index}`} className="mb-2.5">
            <PostCard
              post={post}
              onComment={handleComment}
              onRepost={handleRepostSuccess}
              onDelete={handleDelete}
            />
          </div>
        ))}
      </div>

      <div ref={sentinelRef} className="h-px" aria-hidden="true" />

      {/* Loading indicator */}
      {(isLoadingMore || (isLoading && posts.length > 0)) && (
        <div className="card p-3">
          <div className="flex items-center justify-center gap-2 text-text-light">
            <Loader2 size={15} className="animate-spin text-primary" />
            <span className="text-xs font-medium">Chargement de nouveaux feeds...</span>
          </div>
        </div>
      )}

      {/* Initial loading skeletons */}
      {isLoading && posts.length === 0 && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full skeleton" />
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 w-32 rounded skeleton" />
                  <div className="h-2.5 w-20 rounded skeleton" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded skeleton" />
                <div className="h-3 w-4/5 rounded skeleton" />
                <div className="h-3 w-3/5 rounded skeleton" />
              </div>
              {i === 0 && <div className="h-48 w-full rounded-lg skeleton" />}
            </div>
          ))}
        </div>
      )}

      {/* Repost toast */}
      {repostToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-navy text-white px-5 py-3 rounded-xl shadow-2xl animate-slideUp border border-white/10">
          <div className="w-5 h-5 rounded-full bg-green/20 flex items-center justify-center">
            <Check size={12} className="text-green" />
          </div>
          <span className="text-sm font-medium">Repartagé avec succès</span>
        </div>
      )}
    </div>
  );
}
