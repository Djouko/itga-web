"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search as SearchIcon, Hash, Loader2, Eye, Building2,
} from "lucide-react";
import { Avatar, VerifyBadge } from "@/components/ui/avatar";
import { Tabs } from "@/components/ui/tabs";
import { useAuthStore, useSettingsStore, useTranslation, type TranslationKey } from "@/lib/store";
import { UserService } from "@/lib/services/user-service";
import { PostService } from "@/lib/services/post-service";
import { ReelService } from "@/lib/services/reel-service";
import { InputSanitizer } from "@/lib/input-sanitizer";
import type { User, Post, Reel } from "@/lib/types";
import { addBaseURL, formatCount } from "@/lib/utils";
import { PostCard } from "@/components/post/post-card";
import { getActingCompanyId } from "@/lib/company-acting";

const PAGE_SIZE = 20;

const searchTabs = (t: (k: TranslationKey) => string) => [
  { id: "people", label: t("search.people") },
  { id: "posts", label: t("search.posts") },
  { id: "reels", label: t("search.tabReels") },
  { id: "hashtags", label: t("search.tabTags") },
];

interface HashtagResult {
  tag: string;
  post_count: number;
}

export default function SearchPage() {
  const router = useRouter();
  const { user: me } = useAuthStore();
  const { interests: allInterests } = useSettingsStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("people");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedInterest, setSelectedInterest] = useState<number | null>(null);

  // Results
  const [people, setPeople] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);

  // Hashtags: filtered server-side
  const [hashtags, setHashtags] = useState<HashtagResult[]>([]);
  const [hashtagsLoading, setHashtagsLoading] = useState(false);

  // Loading / pagination
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sanitize & debounce query (500ms like mobile)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const sanitized = InputSanitizer.sanitizeSearch(query);
      setDebouncedQuery(sanitized);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Fetch hashtags with server-side filtering when hashtags tab is active.
  useEffect(() => {
    if (!me || activeTab !== "hashtags") return;

    let isAlive = true;
    Promise.resolve().then(() => {
      if (isAlive) {
        setHashtagsLoading(true);
      }
    });

    PostService.searchHashtag(me.id, debouncedQuery, 0, 100)
      .then((res) => {
        if (!isAlive) return;

        if (res.status && res.data) {
          const raw = res.data as unknown as HashtagResult[];
          setHashtags(Array.isArray(raw) ? raw : []);
        } else {
          setHashtags([]);
        }
      })
      .catch(() => {
        if (isAlive) {
          setHashtags([]);
        }
      })
      .finally(() => {
        if (isAlive) {
          setHashtagsLoading(false);
        }
      });

    return () => {
      isAlive = false;
    };
  }, [me, activeTab, debouncedQuery]);

  // Reset results when tab or query changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPeople([]);
      setPosts([]);
      setReels([]);
      setHasMore(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, debouncedQuery]);

  // Reset interest when tab changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedInterest(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab]);

  // Main search — mirrors mobile SearchScreenController._performSearch
  const doSearch = useCallback(async (start: number) => {
    if (!me) return;
    const isFirst = start === 0;
    if (isFirst) setLoading(true); else setLoadingMore(true);

    try {
      if (activeTab === "people") {
        const res = await UserService.searchProfile(me.id, debouncedQuery, start);
        if (res.status && res.data) {
          setPeople((prev) => isFirst ? res.data! : [...prev, ...res.data!]);
          setHasMore(res.data.length >= PAGE_SIZE);
        } else {
          if (isFirst) setPeople([]);
          setHasMore(false);
        }
      } else if (activeTab === "posts") {
        const companyId = getActingCompanyId() ?? undefined;
        if (selectedInterest) {
          const res = await PostService.searchPostByInterestId(me.id, selectedInterest, debouncedQuery, start, PAGE_SIZE, companyId);
          if (res.status && res.data) {
            setPosts((prev) => isFirst ? res.data! : [...prev, ...res.data!]);
            setHasMore(res.data.length >= PAGE_SIZE);
          } else {
            if (isFirst) setPosts([]);
            setHasMore(false);
          }
        } else {
          const res = await PostService.searchPost(me.id, debouncedQuery, start, PAGE_SIZE, companyId);
          if (res.status && res.data) {
            setPosts((prev) => isFirst ? res.data! : [...prev, ...res.data!]);
            setHasMore(res.data.length >= PAGE_SIZE);
          } else {
            if (isFirst) setPosts([]);
            setHasMore(false);
          }
        }
      } else if (activeTab === "reels") {
        // Mobile uses searchReelsByInterestId for ALL reel searching (keyword + optional interestId)
        const res = await ReelService.searchReelsByInterestId(
          me.id, start, PAGE_SIZE, debouncedQuery || undefined, selectedInterest, getActingCompanyId() ?? undefined
        );
        if (res.status && res.data) {
          setReels((prev) => isFirst ? res.data! : [...prev, ...res.data!]);
          setHasMore(res.data.length >= PAGE_SIZE);
        } else {
          if (isFirst) setReels([]);
          setHasMore(false);
        }
      }
      // Hashtags are queried in a separate tab-specific effect.
    } catch (e) {
      console.error("Search error:", e);
    }
    if (isFirst) setLoading(false); else setLoadingMore(false);
  }, [me, activeTab, debouncedQuery, selectedInterest]);

  // Trigger search on mount and when query/interest changes
  useEffect(() => {
    if (activeTab === "hashtags") return;
    const timer = window.setTimeout(() => {
      doSearch(0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [debouncedQuery, selectedInterest, activeTab, doSearch]);

  // Interest filter change
  const handleInterestFilter = (id: number) => {
    setSelectedInterest((prev) => (prev === id ? null : id));
    setPosts([]);
    setReels([]);
    setHasMore(true);
  };

  // Navigate to tag page (like mobile TagScreen)
  const handleHashtagClick = (tag: string) => {
    router.push(`/tag?tag=${encodeURIComponent(tag.replace("#", ""))}`);
  };

  // Infinite scroll
  useEffect(() => {
    if (activeTab === "hashtags") return;
    if (!observerRef.current || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          const nextStart = activeTab === "people"
            ? people.length
            : activeTab === "posts"
              ? posts.length
              : reels.length;

          doSearch(nextStart);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, people.length, posts.length, reels.length, activeTab, doSearch]);

  if (!me) return null;

  const showInterestChips = activeTab === "posts" || activeTab === "reels";

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="card">
        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search.placeholder")}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-bg-light text-sm border border-transparent focus:outline-none focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/10 transition-all duration-200"
              autoFocus
              maxLength={200}
            />
          </div>
        </div>
        <div className="px-4 pb-2">
          <Tabs tabs={searchTabs(t)} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
        {/* Interest filter chips */}
        {showInterestChips && allInterests.length > 0 && (
          <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {allInterests.map((i) => (
              <button
                key={i.id}
                onClick={() => handleInterestFilter(i.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  selectedInterest === i.id
                    ? "bg-primary text-white shadow-sm shadow-primary/20"
                    : "bg-bg-light text-text-light hover:bg-primary/10 hover:text-primary"
                }`}
              >
                {i.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="card overflow-hidden">
        {loading && activeTab !== "hashtags" ? (
          <SearchSkeleton />
        ) : activeTab === "hashtags" ? (
          /* Hashtags — filtered server-side */
          hashtagsLoading ? (
            <SearchSkeleton />
          ) : hashtags.length === 0 ? (
            <NoResults />
          ) : (
            hashtags.map((h) => (
              <div
                key={h.tag}
                onClick={() => handleHashtagClick(h.tag)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-bg-light/50 transition-all duration-200 border-b border-border/20 last:border-b-0 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors duration-200">
                  <Hash size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-main group-hover:text-primary transition-colors duration-200">#{h.tag}</p>
                  <p className="text-xs text-text-light">
                    {h.post_count ?? 0} publication{(h.post_count ?? 0) > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            ))
          )
        ) : (
          <>
            {/* People */}
            {activeTab === "people" && (
              people.length === 0 && !loading ? <NoResults /> : (
                people.map((u) => {
                  const company = u.profile_type === "company" ? u.owned_company : null;
                  const href = company?.id ? `/company/${company.id}` : `/profile/${u.id}`;
                  const name = company?.name ?? u.full_name ?? "Profil";
                  const avatar = company?.logo ?? u.profile;
                  const subtitle = company?.sector ?? `@${u.username}`;

                  return (
                    <Link
                      key={`${company ? "company" : "user"}-${company?.id ?? u.id}`}
                      href={href}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-bg-light/50 transition-all duration-200 border-b border-border/20 last:border-b-0 group"
                    >
                      <Avatar src={avatar ? addBaseURL(avatar) : null} alt={name} size={42} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-text-main truncate group-hover:text-primary transition-colors duration-200">{name}</span>
                          {u.is_verified >= 2 && <VerifyBadge size={14} />}
                          {company && <Building2 size={13} className="text-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-text-light truncate">{subtitle}</p>
                      </div>
                    </Link>
                  );
                })
              )
            )}

            {/* Posts */}
            {activeTab === "posts" && (
              posts.length === 0 && !loading ? <NoResults /> : (
                <div className="divide-y divide-border/20">
                  {posts.map((p) => (
                    <div key={p.id} className="px-4 py-3">
                      <PostCard post={p} />
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Reels */}
            {activeTab === "reels" && (
              reels.length === 0 && !loading ? <NoResults /> : (
                <div className="grid grid-cols-3 gap-0.5">
                  {reels.map((r) => (
                    <Link
                      key={r.id}
                      href={`/reels?id=${r.id}`}
                      className="aspect-[9/16] bg-bg-dark relative overflow-hidden group"
                    >
                      {r.thumbnail ? (
                        <img src={addBaseURL(r.thumbnail)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-cyan/20" />
                      )}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                        {r.description && (
                          <p className="text-[10px] text-white/80 line-clamp-1 flex-1 mr-1">{r.description}</p>
                        )}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Eye size={10} className="text-white/70" />
                          <span className="text-[9px] text-white/70">{formatCount(r.views_count)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            )}

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

function SearchSkeleton() {
  return (
    <div className="divide-y divide-border-light/50">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div className="w-[42px] h-[42px] rounded-full bg-bg-light shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-bg-light rounded w-1/2" />
            <div className="h-2.5 bg-bg-light rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NoResults() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <SearchIcon size={28} className="text-text-light/40" />
      <p className="text-sm text-text-light">{t("search.noResults")}</p>
    </div>
  );
}
