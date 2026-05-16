"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Film, Eye } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { ReelService } from "@/lib/services/reel-service";
import { addBaseURL, formatCount } from "@/lib/utils";
import type { Reel } from "@/lib/types";
import { getActingCompanyId } from "@/lib/company-acting";

const PAGE_SIZE = 18;

export default function SavedReelsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const loadingMore = useRef(false);

  const loadReels = useCallback(async (start: number) => {
    if (!user) return;
    try {
      const res = await ReelService.fetchSavedReels(user.id, start, PAGE_SIZE, getActingCompanyId() ?? undefined);
      if (res.status && Array.isArray(res.data)) {
        setReels((prev) => start === 0 ? res.data! : [...prev, ...res.data!]);
        setHasMore(res.data!.length >= PAGE_SIZE);
      } else {
        if (start === 0) setReels([]);
        setHasMore(false);
      }
    } catch {
      if (start === 0) setReels([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      loadingMore.current = false;
    }
  }, [user]);

  useEffect(() => {
    loadReels(0);
  }, [loadReels]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore.current) {
          loadingMore.current = true;
          loadReels(reels.length);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, reels.length, loadReels]);

  return (
    <div className="min-h-screen bg-card">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <h1 className="text-lg font-bold text-text-main">Saved Reels</h1>
        </div>
      </header>

      <div className="pb-8">
        {loading ? (
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="aspect-[9/16] bg-bg-light animate-pulse" />
            ))}
          </div>
        ) : reels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Film size={32} className="text-text-light/40" />
            <p className="text-base font-semibold text-text-main">Saved Reels</p>
            <p className="text-sm text-text-light">No saved reels yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {reels.map((reel) => (
              <Link key={reel.id} href={`/reels?id=${reel.id}`} className="relative aspect-[9/16] bg-black group">
                <img
                  src={addBaseURL(reel.thumbnail || "")}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-1 left-1 flex items-center gap-1 text-white text-[10px] font-medium drop-shadow-lg">
                  <Eye size={12} />
                  <span>{formatCount(reel.views_count)}</span>
                </div>
              </Link>
            ))}
            <div ref={sentinelRef} className="col-span-3 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
