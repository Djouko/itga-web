"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  Building2,
  MapPin,
  BookmarkCheck,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useAuthStore, useTranslation } from "@/lib/store";
import { JobService } from "@/lib/services/job-service";
import { addBaseURL, cn, formatTimeAgo } from "@/lib/utils";
import type { JobOffer, ContractType, LocationType } from "@/lib/types";

const PAGE_SIZE = 15;

const CONTRACT_LABELS: Record<ContractType, string> = {
  stage: "Stage", alternance: "Alternance", cdi: "CDI", cdd: "CDD", freelance: "Freelance",
};
const LOCATION_LABELS: Record<LocationType, string> = {
  remote: "Remote", hybrid: "Hybride", onsite: "Sur site",
};
const CONTRACT_COLORS: Record<ContractType, string> = {
  stage: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  alternance: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  cdi: "bg-green/10 text-green border-green/20",
  cdd: "bg-orange/10 text-orange border-orange/20",
  freelance: "bg-cyan/10 text-cyan border-cyan/20",
};

export default function SavedJobsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const loadingMore = useRef(false);

  const loadJobs = useCallback(async (start: number) => {
    if (!user) return;
    try {
      const res = await JobService.fetchSavedJobs(user.id, start, PAGE_SIZE);
      if (res.status && Array.isArray(res.data)) {
        setJobs((prev) => start === 0 ? res.data! : [...prev, ...res.data!]);
        setHasMore(res.data!.length >= PAGE_SIZE);
      } else {
        if (start === 0) setJobs([]);
        setHasMore(false);
      }
    } catch {
      if (start === 0) setJobs([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      loadingMore.current = false;
    }
  }, [user]);

  useEffect(() => { loadJobs(0); }, [loadJobs]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore.current && !loading) {
          loadingMore.current = true;
          loadJobs(jobs.length);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, jobs.length, loadJobs, loading]);

  const handleUnsave = async (job: JobOffer) => {
    if (!user) return;
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    const res = await JobService.toggleSaveJob(user.id, job.id);
    if (!res.status) {
      setJobs((prev) => [...prev, job]);
    }
  };

  return (
    <div className="min-h-screen bg-card">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <h1 className="text-lg font-bold text-text-main">{t("jobs.savedJobs")}</h1>
        </div>
      </header>

      <div className="pb-8">
        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-bg-light rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Bookmark size={32} className="text-text-light/40" />
            <p className="text-base font-semibold text-text-main">{t("jobs.noSavedJobs")}</p>
            <p className="text-sm text-text-light">{t("jobs.noSavedJobsDesc")}</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {jobs.map((job) => {
              const logo = addBaseURL(job.company?.logo);
              return (
                <div
                  key={job.id}
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  className="card-interactive p-4"
                >
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-xl bg-bg-light flex items-center justify-center overflow-hidden shrink-0">
                      {logo ? <img src={logo} alt="" className="w-full h-full object-cover" /> : <Building2 size={20} className="text-text-light/40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-text-main line-clamp-1">{job.title}</h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUnsave(job); }}
                          className="shrink-0 p-1 rounded-lg hover:bg-bg-light cursor-pointer"
                        >
                          <BookmarkCheck size={16} className="text-primary" />
                        </button>
                      </div>
                      <p className="text-xs text-text-light mt-0.5">{job.company?.name ?? "—"}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-semibold", CONTRACT_COLORS[job.contract_type] ?? "bg-bg-light text-text-dark border-border/40")}>
                          {CONTRACT_LABELS[job.contract_type] ?? job.contract_type}
                        </span>
                        {job.location_type && (
                          <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-bg-light text-text-dark text-[10px] font-medium">
                            <MapPin size={9} />{LOCATION_LABELS[job.location_type]}
                          </span>
                        )}
                        {job.is_match === 1 && (
                          <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold">
                            <Sparkles size={9} />Match {job.match_score}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-text-light">{formatTimeAgo(job.created_at)}</span>
                        <ChevronRight size={14} className="text-text-light/30" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={sentinelRef} className="h-4" />
            {loadingMore.current && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
