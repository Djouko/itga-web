"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Briefcase,
  MapPin,
  Building2,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  SlidersHorizontal,
  X,
  Clock,
  ChevronRight,
} from "lucide-react";
import { useAuthStore, useTranslation } from "@/lib/store";
import { JobService, type FetchJobsParams } from "@/lib/services/job-service";
import { addBaseURL, cn, formatTimeAgo } from "@/lib/utils";
import type { JobOffer, ContractType, LocationType, ExperienceLevel } from "@/lib/types";

const PAGE_SIZE = 15;

const CONTRACT_LABELS: Record<ContractType, string> = {
  stage: "Stage",
  alternance: "Alternance",
  cdi: "CDI",
  cdd: "CDD",
  freelance: "Freelance",
};

const LOCATION_LABELS: Record<LocationType, string> = {
  remote: "Remote",
  hybrid: "Hybride",
  onsite: "Sur site",
};

const CONTRACT_COLORS: Record<ContractType, string> = {
  stage: "bg-blue-100 text-blue-700",
  alternance: "bg-purple-100 text-purple-700",
  cdi: "bg-green-100 text-green-700",
  cdd: "bg-orange-100 text-orange-700",
  freelance: "bg-cyan-100 text-cyan-700",
};

export default function JobsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadingMore = useRef(false);

  // Filters
  const [keyword, setKeyword] = useState("");
  const [contractType, setContractType] = useState<ContractType | "">("");
  const [locationType, setLocationType] = useState<LocationType | "">("");
  const [domain, setDomain] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | "">("");
  const [sortBy, setSortBy] = useState<"date" | "relevance">("date");
  const [showFilters, setShowFilters] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadJobs = useCallback(
    async (start: number, reset = false) => {
      if (!user) return;
      const params: FetchJobsParams = {
        user_id: user.id,
        start,
        limit: PAGE_SIZE,
        sort_by: sortBy,
      };
      if (keyword.trim()) params.keyword = keyword.trim();
      if (contractType) params.contract_type = contractType;
      if (locationType) params.location_type = locationType;
      if (domain) params.domain = domain;
      if (experienceLevel) params.experience_level = experienceLevel;

      try {
        const res = await JobService.fetchJobs(params);
        if (res.status && Array.isArray(res.data)) {
          setLoadError(null);
          setJobs((prev) => (reset || start === 0 ? res.data! : [...prev, ...res.data!]));
          setHasMore(res.data!.length >= PAGE_SIZE);
        } else {
          if (start === 0) setLoadError(res.message || "Impossible de charger les offres.");
          if (start === 0) setJobs([]);
          setHasMore(false);
        }
      } catch (error) {
        if (start === 0) {
          const message = error instanceof Error ? error.message : "Impossible de contacter le serveur.";
          setLoadError(message);
        }
        if (start === 0) setJobs([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        loadingMore.current = false;
        setIsLoadingMore(false);
      }
    },
    [user, keyword, contractType, locationType, domain, experienceLevel, sortBy]
  );

  // Initial load + filter changes
  useEffect(() => {
    setLoading(true);
    setJobs([]);
    loadJobs(0, true);
  }, [loadJobs]);

  // Debounced search
  const handleSearch = (value: string) => {
    setKeyword(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setLoading(true);
      setJobs([]);
      loadJobs(0, true);
    }, 400);
  };

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore.current && !loading) {
          loadingMore.current = true;
          setIsLoadingMore(true);
          loadJobs(jobs.length);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, jobs.length, loadJobs, loading]);

  // Toggle save
  const handleToggleSave = async (job: JobOffer) => {
    if (!user) return;
    const wasSaved = job.is_saved === 1;
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, is_saved: wasSaved ? 0 : 1 } : j))
    );
    const res = await JobService.toggleSaveJob(user.id, job.id);
    if (!res.status) {
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, is_saved: wasSaved ? 1 : 0 } : j))
      );
    }
  };

  const clearFilters = () => {
    setContractType("");
    setLocationType("");
    setDomain("");
    setExperienceLevel("");
    setSortBy("date");
    setKeyword("");
    setLoadError(null);
  };

  const activeFilterCount =
    (contractType ? 1 : 0) +
    (locationType ? 1 : 0) +
    (domain ? 1 : 0) +
    (experienceLevel ? 1 : 0) +
    (sortBy !== "date" ? 1 : 0);

  return (
    <div className="min-h-screen bg-card">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Briefcase size={22} className="text-primary" />
            <h1 className="text-lg font-bold text-text-main">{t("jobs.title")}</h1>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => router.push("/jobs/saved")}
                className="p-2 rounded-xl hover:bg-bg-light transition-colors cursor-pointer"
              >
                <Bookmark size={18} className="text-text-light" />
              </button>
              <button
                onClick={() => router.push("/jobs/applications")}
                className="p-2 rounded-xl hover:bg-bg-light transition-colors cursor-pointer"
              >
                <Clock size={18} className="text-text-light" />
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light/60" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={t("jobs.searchPlaceholder")}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-light text-sm text-text-main placeholder:text-text-light/50 border border-border/20 focus:border-primary/40 focus:outline-none transition-colors"
            />
          </div>

          {/* Filter toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                showFilters || activeFilterCount > 0
                  ? "bg-primary/10 text-primary"
                  : "bg-bg-light text-text-light"
              )}
            >
              <SlidersHorizontal size={14} />
              {t("jobs.filters")}
              {activeFilterCount > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Quick filter chips */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {(["stage", "alternance", "cdi", "cdd", "freelance"] as ContractType[]).map((ct) => (
                <button
                  key={ct}
                  onClick={() => setContractType(contractType === ct ? "" : ct)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                    contractType === ct
                      ? CONTRACT_COLORS[ct]
                      : "bg-bg-light text-text-light hover:bg-bg-light/80"
                  )}
                >
                  {CONTRACT_LABELS[ct]}
                </button>
              ))}
            </div>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-border/20 space-y-3 animate-slideDown">
              <div className="flex gap-2 flex-wrap">
                <select
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value as LocationType | "")}
                  className="px-3 py-1.5 rounded-lg bg-bg-light text-xs text-text-main border border-border/20 focus:outline-none"
                >
                  <option value="">{t("jobs.allLocations")}</option>
                  <option value="remote">{LOCATION_LABELS.remote}</option>
                  <option value="hybrid">{LOCATION_LABELS.hybrid}</option>
                  <option value="onsite">{LOCATION_LABELS.onsite}</option>
                </select>

              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-bg-light text-xs text-text-main border border-border/20 focus:outline-none"
              >
                <option value="">Tous les domaines</option>
                <option value="data">Data</option>
                <option value="dev">Dev</option>
                <option value="engineering">Ingénierie</option>
                <option value="design">Design</option>
                <option value="marketing">Marketing</option>
                <option value="other">Autre</option>
              </select>

                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel | "")}
                  className="px-3 py-1.5 rounded-lg bg-bg-light text-xs text-text-main border border-border/20 focus:outline-none"
                >
                  <option value="">{t("jobs.allLevels")}</option>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid-level</option>
                  <option value="senior">Senior</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "date" | "relevance")}
                  className="px-3 py-1.5 rounded-lg bg-bg-light text-xs text-text-main border border-border/20 focus:outline-none"
                >
                  <option value="date">{t("jobs.sortDate")}</option>
                  <option value="relevance">{t("jobs.sortRelevance")}</option>
                </select>
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-red-500 hover:underline cursor-pointer"
                >
                  <X size={12} />
                  {t("jobs.clearFilters")}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="pb-8">
        {loadError && !loading && (
          <div className="mx-4 mt-4 rounded-xl border border-red/20 bg-red/5 p-3 text-xs text-red-600">
            {loadError}
          </div>
        )}
        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-36 bg-bg-light rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Briefcase size={36} className="text-text-light/30" />
            <p className="text-base font-semibold text-text-main">{t("jobs.noJobs")}</p>
            <p className="text-sm text-text-light text-center max-w-xs">{t("jobs.noJobsDesc")}</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onClick={() => router.push(`/jobs/${job.id}`)}
                onToggleSave={() => handleToggleSave(job)}
              />
            ))}
            <div ref={sentinelRef} className="h-4" />
            {isLoadingMore && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!hasMore && jobs.length > 0 && (
              <p className="text-center text-xs text-text-light py-4">{t("jobs.endOfList")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Job Card Component ─── */
function JobCard({
  job,
  onClick,
  onToggleSave,
}: {
  job: JobOffer;
  onClick: () => void;
  onToggleSave: () => void;
}) {
  const logo = addBaseURL(job.company?.logo);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-border/20 p-4 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex gap-3">
        {/* Company logo */}
        <div className="w-12 h-12 rounded-xl bg-bg-light flex items-center justify-center overflow-hidden shrink-0">
          {logo ? (
            <img src={logo} alt="" className="w-full h-full object-cover" />
          ) : (
            <Building2 size={20} className="text-text-light/40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title + save */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-text-main line-clamp-1 group-hover:text-primary transition-colors">
              {job.title}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave();
              }}
              className="shrink-0 p-1 rounded-lg hover:bg-bg-light transition-colors cursor-pointer"
            >
              {job.is_saved === 1 ? (
                <BookmarkCheck size={16} className="text-primary" />
              ) : (
                <Bookmark size={16} className="text-text-light/40" />
              )}
            </button>
          </div>

          {/* Company name */}
          <p className="text-xs text-text-light mt-0.5">{job.company?.name ?? "—"}</p>

          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span
              className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-semibold",
                CONTRACT_COLORS[job.contract_type] ?? "bg-gray-100 text-gray-600"
              )}
            >
              {CONTRACT_LABELS[job.contract_type] ?? job.contract_type}
            </span>

            {job.location_type && (
              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium">
                <MapPin size={9} />
                {LOCATION_LABELS[job.location_type] ?? job.location_type}
              </span>
            )}

            {job.location_city && (
              <span className="text-[10px] text-text-light">{job.location_city}</span>
            )}

            {job.is_match === 1 && (
              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold">
                <Sparkles size={9} />
                Match {job.match_score}%
              </span>
            )}
          </div>

          {/* Salary + time */}
          <div className="flex items-center justify-between mt-2">
            {job.salary_min != null && (
              <span className="text-[11px] font-semibold text-text-main">
                {job.salary_min.toLocaleString()}
                {job.salary_max != null && ` – ${job.salary_max.toLocaleString()}`}
                {job.salary_period ? ` €/${job.salary_period === "month" ? "mois" : "an"}` : " €"}
              </span>
            )}
            <span className="text-[10px] text-text-light ml-auto">{formatTimeAgo(job.created_at)}</span>
            <ChevronRight size={14} className="text-text-light/30 ml-1" />
          </div>
        </div>
      </div>
    </div>
  );
}
