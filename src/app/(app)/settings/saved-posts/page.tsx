"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { PostService } from "@/lib/services/post-service";
import { PostCard } from "@/components/post/post-card";
import { getActingCompanyId } from "@/lib/company-acting";
import type { Post } from "@/lib/types";

const PAGE_SIZE = 15;

export default function SavedPostsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const loadingMore = useRef(false);

  const loadPosts = useCallback(async (start: number) => {
    if (!user) return;
    try {
      const res = await PostService.fetchSavedPosts(user.id, start, PAGE_SIZE, getActingCompanyId() ?? undefined);
      if (res.status && Array.isArray(res.data)) {
        setPosts((prev) => start === 0 ? res.data! : [...prev, ...res.data!]);
        setHasMore(res.data!.length >= PAGE_SIZE);
      } else {
        if (start === 0) setPosts([]);
        setHasMore(false);
      }
    } catch {
      if (start === 0) setPosts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      loadingMore.current = false;
    }
  }, [user]);

  useEffect(() => {
    loadPosts(0);
  }, [loadPosts]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore.current) {
          loadingMore.current = true;
          loadPosts(posts.length);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, posts.length, loadPosts]);

  return (
    <div className="min-h-screen bg-card">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <h1 className="text-lg font-bold text-text-main">Saved Posts</h1>
        </div>
      </header>

      <div className="pb-8">
        {loading ? (
          <div className="space-y-4 p-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-bg-light rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Bookmark size={32} className="text-text-light/40" />
            <p className="text-base font-semibold text-text-main">Saved Items</p>
            <p className="text-sm text-text-light">No saved posts yet</p>
          </div>
        ) : (
          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            <div ref={sentinelRef} className="h-4" />
            {loadingMore.current && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!hasMore && posts.length > 0 && (
              <p className="text-center text-xs text-text-light py-4">Vous avez tout vu !</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
