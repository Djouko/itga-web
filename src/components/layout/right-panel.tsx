"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Briefcase, MapPin, Sparkles, TrendingUp, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import { PostService } from "@/lib/services/post-service";
import { UserService } from "@/lib/services/user-service";
import { JobService } from "@/lib/services/job-service";
import { getActingCompanyId } from "@/lib/company-acting";
import type { JobOffer, User } from "@/lib/types";
import { addBaseURL } from "@/lib/utils";

interface HashtagResult {
  tag: string;
  post_count: number;
}

const SUGGESTION_LIMIT = 3;
const RANDOM_FALLBACK_ATTEMPTS = 8;

function normalizeHashtag(raw: string): string {
  return String(raw ?? "").trim().replace(/^#+/, "");
}

export function RightPanel() {
  const { user: me } = useAuthStore();
  const [hashtags, setHashtags] = useState<HashtagResult[]>([]);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [jobSuggestions, setJobSuggestions] = useState<JobOffer[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    if (!me) return;
    // Fetch trending hashtags
    PostService.searchHashtag(me.id)
      .then((res) => {
        if (res.status && Array.isArray(res.data)) {
          setHashtags((res.data as HashtagResult[]).slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTrends(false));

    // Fetch suggested users (interest-ranked first, then random fallback)
    const fetchSuggestions = async () => {
      setLoadingSuggestions(true);
      const users: User[] = [];

      const pushUnique = (user?: User | null) => {
        if (!user || user.id === me.id) return;
        if (users.some((u) => u.id === user.id)) return;
        users.push(user);
      };

      try {
        const rankedRes = await UserService.searchProfile(me.id, "", 0);
        if (rankedRes.status && Array.isArray(rankedRes.data)) {
          rankedRes.data.forEach((user) => {
            if (users.length < SUGGESTION_LIMIT) {
              pushUnique(user);
            }
          });
        }
      } catch { /* skip */ }

      let attempts = 0;
      while (users.length < SUGGESTION_LIMIT && attempts < RANDOM_FALLBACK_ATTEMPTS) {
        attempts += 1;
        try {
          const res = await UserService.fetchRandomProfile(me.id);
          if (res.status && res.data) pushUnique(res.data);
        } catch { /* skip */ }
      }

      setSuggestions(users.slice(0, SUGGESTION_LIMIT));
      setLoadingSuggestions(false);
    };
    fetchSuggestions();

    JobService.fetchJobs({
      user_id: me.id,
      start: 0,
      limit: 3,
      sort_by: "relevance",
    })
      .then((res) => {
        if (res.status && Array.isArray(res.data)) {
          setJobSuggestions(res.data.slice(0, 3));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingJobs(false));
  }, [me]);

  const handleFollow = async (userId: number) => {
    if (!me) return;
    try {
      await UserService.followUser(me.id, userId, getActingCompanyId() ?? undefined);
      setSuggestions((prev) => prev.filter((u) => u.id !== userId));

      const refill = await UserService.fetchRandomProfile(me.id);
      if (refill.status && refill.data) {
        const candidate = refill.data;
        if (candidate.id !== me.id && candidate.id !== userId) {
          setSuggestions((prev) => {
            if (prev.some((u) => u.id === candidate.id)) return prev;
            return [...prev, candidate].slice(0, SUGGESTION_LIMIT);
          });
        }
      }
    } catch { /* skip */ }
  };

  return (
    <div
      className="sticky top-4 max-h-[calc(100vh-1rem)] overflow-y-auto scrollbar-hide pr-1 space-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-xl"
      tabIndex={0}
      aria-label="Panneau de tendances et suggestions"
    >
      {/* Trending Topics Card */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
          <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
            <TrendingUp size={11} className="text-primary" />
          </div>
          <h3 className="text-[12px] font-bold text-text-main">Tendances pour vous</h3>
        </div>
        <div>
          {loadingTrends ? (
            <div className="px-4 py-3 space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3.5 w-24 rounded skeleton" />
                  <div className="h-2.5 w-16 rounded skeleton" />
                </div>
              ))}
            </div>
          ) : hashtags.length === 0 ? (
            <p className="text-[12px] text-text-light text-center py-6">Aucune tendance pour le moment</p>
          ) : (
            hashtags.map((item, i) => (
              <Link
                key={item.tag}
                href={`/tag?tag=${encodeURIComponent(normalizeHashtag(item.tag))}`}
                className="flex items-center justify-between py-2 px-4 hover:bg-bg-light/50 transition-all duration-200 group"
              >
                <div>
                  <p className="text-[12px] font-semibold text-text-main group-hover:text-primary transition-colors duration-200">
                    #{item.tag}
                  </p>
                  <p className="text-[11px] text-text-light mt-0.5">{item.post_count.toLocaleString("fr-FR")} publications</p>
                </div>
                <span className="w-4 h-4 rounded-full bg-bg-light text-[9px] text-text-light font-bold flex items-center justify-center tabular-nums">{i + 1}</span>
              </Link>
            ))
          )}
        </div>
        <Link href="/search" className="block text-center py-2.5 text-[13px] font-semibold text-primary hover:bg-bg-light/40 transition-all duration-200 border-t border-border/20">
          Voir plus
        </Link>
      </div>

      {/* Suggested Users Card */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserPlus size={13} className="text-primary" />
          </div>
          <h3 className="text-sm font-bold text-text-main">Suggestions</h3>
        </div>
        <div>
          {loadingSuggestions ? (
            <div className="px-4 py-3 space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full skeleton" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-20 rounded skeleton" />
                    <div className="h-2.5 w-14 rounded skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-[12px] text-text-light text-center py-6">Aucune suggestion</p>
          ) : (
            suggestions.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 py-2 px-4 hover:bg-bg-light/50 transition-all duration-200 group"
              >
                <Link href={`/profile/${u.id}`} className="shrink-0">
                  <Avatar src={u.profile ? addBaseURL(u.profile) : null} alt={u.full_name ?? ""} size={40} />
                </Link>
                <Link href={`/profile/${u.id}`} className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text-main truncate leading-tight group-hover:text-primary transition-colors duration-200">
                    {u.full_name}
                  </p>
                  <p className="text-[11px] text-text-light truncate">@{u.username}</p>
                </Link>
                <button
                  onClick={() => handleFollow(u.id)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-primary border border-primary/60 rounded-full hover:bg-primary hover:text-white hover:border-primary transition-all duration-200 cursor-pointer shrink-0 active:scale-95"
                >
                  + Suivre
                </button>
              </div>
            ))
          )}
        </div>
        <Link href="/search" className="block text-center py-2.5 text-[13px] font-semibold text-primary hover:bg-bg-light/40 transition-all duration-200 border-t border-border/20">
          Voir plus
        </Link>
      </div>

      {/* Job Suggestions Card */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <div className="w-6 h-6 rounded-lg bg-cyan/10 flex items-center justify-center">
            <Briefcase size={13} className="text-cyan" />
          </div>
          <h3 className="text-sm font-bold text-text-main">Jobs recommandés</h3>
        </div>
        <div>
          {loadingJobs ? (
            <div className="px-4 py-3 space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3.5 w-32 rounded skeleton" />
                  <div className="h-2.5 w-24 rounded skeleton" />
                </div>
              ))}
            </div>
          ) : jobSuggestions.length === 0 ? (
            <p className="text-[12px] text-text-light text-center py-6">Aucune offre pour le moment</p>
          ) : (
            jobSuggestions.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block px-4 py-2.5 hover:bg-bg-light/50 transition-all duration-200 group"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                    {job.company?.logo ? (
                      <img src={addBaseURL(job.company.logo) ?? ""} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Briefcase size={15} className="text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-text-main group-hover:text-primary truncate">{job.title}</p>
                    <p className="text-[11px] text-text-light truncate">{job.company?.name ?? "Entreprise ITGA"}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-text-light">
                      {job.location_city && (
                        <span className="inline-flex min-w-0 items-center gap-0.5 truncate">
                          <MapPin size={10} />
                          <span className="truncate">{job.location_city}</span>
                        </span>
                      )}
                      {job.is_match === 1 && (
                        <span className="inline-flex items-center gap-0.5 text-magenta font-bold">
                          <Sparkles size={10} />
                          {job.match_score}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
        <Link href="/jobs" className="block text-center py-2.5 text-[13px] font-semibold text-primary hover:bg-bg-light/40 transition-all duration-200 border-t border-border/20">
          Voir les offres
        </Link>
      </div>

      {/* Footer */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-2.5">
          <Image src="/itga_logo.png" alt="ITGA" width={86} height={50} className="object-contain opacity-70 hover:opacity-90 transition-opacity duration-300" style={{ height: "auto" }} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-light">
          <Link href="/settings/terms" className="hover:text-primary transition-colors duration-200">Conditions</Link>
          <span className="text-border">·</span>
          <Link href="/settings/privacy" className="hover:text-primary transition-colors duration-200">Confidentialité</Link>
          <span className="text-border">·</span>
          <Link href="/settings/faq" className="hover:text-primary transition-colors duration-200">Aide</Link>
        </div>
        <p className="text-[10px] text-text-light/50 mt-2">© 2025 IT Girls Academy</p>
      </div>
    </div>
  );
}
