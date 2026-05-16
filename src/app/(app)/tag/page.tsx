"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Hash, Loader2, Play, Eye } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { PostCard } from "@/components/post/post-card";
import { useAuthStore } from "@/lib/store";
import { PostService } from "@/lib/services/post-service";
import { ReelService } from "@/lib/services/reel-service";
import type { Post, Reel } from "@/lib/types";
import { addBaseURL, formatCount } from "@/lib/utils";
import { getActingCompanyId } from "@/lib/company-acting";

const PAGE_SIZE = 20;

const tagTabs = [
  { id: "posts", label: "Publications" },
  { id: "reels", label: "Reels" },
];

function normalizeTag(rawTag: string): string {
  return String(rawTag ?? "").trim().replace(/^#+/, "");
}

export default function TagPage() {
  const searchParams = useSearchParams();
  const tag = normalizeTag(searchParams.get("tag") ?? "");
  const initialTab = searchParams.get("tab") === "reels" ? "reels" : "posts";

  const { user: me } = useAuthStore();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(
    async (start: number) => {
      if (!me || !tag) return;
      const isFirst = start === 0;
      if (isFirst) setLoading(true);
      else setLoadingMore(true);

      try {
        if (activeTab === "posts") {
          const res = await PostService.fetchPostsByHashtag(me.id, tag, start, PAGE_SIZE, getActingCompanyId() ?? undefined);
          if (res.status && res.data) {
            setPosts((prev) => (isFirst ? res.data! : [...prev, ...res.data!]));
            setHasMore(res.data.length >= PAGE_SIZE);
          }
        } else {
          const res = await ReelService.fetchReelsByHashtag(me.id, tag, start, PAGE_SIZE, getActingCompanyId() ?? undefined);
          if (res.status && res.data) {
            setReels((prev) => (isFirst ? res.data! : [...prev, ...res.data!]));
            setHasMore(res.data.length >= PAGE_SIZE);
          }
        }
      } catch (e) {
        console.error("Tag fetch error:", e);
      }
      if (isFirst) setLoading(false);
      else setLoadingMore(false);
    },
    [me, tag, activeTab]
  );

  // Reset on tab change
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPosts([]);
      setReels([]);
      setHasMore(true);
      fetchData(0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, fetchData]);

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current || !hasMore || loadingMore) return;
    const count = activeTab === "posts" ? posts.length : reels.length;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchData(count);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, fetchData, posts.length, reels.length, activeTab]);

  if (!me || !tag) return null;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="card">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <Link
            href="/search"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-bg-light transition-colors"
          >
            <ArrowLeft size={18} className="text-text-main" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Hash size={18} className="text-primary" />
            </div>
            <h1 className="text-lg font-bold text-navy">#{tag}</h1>
          </div>
        </div>
        <div className="px-4 pb-2">
          <Tabs tabs={tagTabs} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {/* Results */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border-light/50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="w-[42px] h-[42px] rounded-full bg-bg-light shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-bg-light rounded w-1/2" />
                  <div className="h-2.5 bg-bg-light rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Posts */}
            {activeTab === "posts" &&
              (posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <Hash size={28} className="text-text-light/40" />
                  <p className="text-sm text-text-light">Aucune publication avec #{tag}</p>
                </div>
              ) : (
                <div className="divide-y divide-border-light/50">
                  {posts.map((p) => (
                    <div key={p.id} className="px-4 py-3">
                      <PostCard post={p} />
                    </div>
                  ))}
                </div>
              ))}

            {/* Reels Grid */}
            {activeTab === "reels" &&
              (reels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <Play size={28} className="text-text-light/40" />
                  <p className="text-sm text-text-light">Aucun reel avec #{tag}</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-0.5">
                  {reels.map((r) => (
                    <Link
                      key={r.id}
                      href={`/reels?id=${r.id}`}
                      className="aspect-[9/16] bg-bg-dark relative overflow-hidden group"
                    >
                      {r.thumbnail ? (
                        <img
                          src={addBaseURL(r.thumbnail)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-cyan/20" />
                      )}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                        {r.description && (
                          <p className="text-[10px] text-white/80 line-clamp-1 flex-1 mr-1">
                            {r.description}
                          </p>
                        )}
                        <div className="flex items-center gap-0.5">
                          <Eye size={10} className="text-white/70" />
                          <span className="text-[9px] text-white/70">
                            {formatCount(r.views_count)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ))}

            <div ref={observerRef} className="h-1" />
            {loadingMore && (
              <div className="flex justify-center py-3">
                <Loader2 size={18} className="animate-spin text-primary" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
