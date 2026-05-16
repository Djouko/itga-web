"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  MessageSquare,
  ExternalLink,
  ChevronDown,
  User,
  Search,
  Filter,
  Briefcase,
  CalendarDays,
  Download,
} from "lucide-react";
import { CompanyService } from "@/lib/services/company-service";
import { addBaseURL, formatTimeAgo } from "@/lib/utils";
import { CompanyShell } from "@/components/company/company-shell";
import type { Company, JobOffer, JobApplication, ApplicationStatus } from "@/lib/types";

const PAGE_SIZE = 20;

const STATUS_CFG: Record<ApplicationStatus, { label: string; color: string; bg: string; dot: string; icon: typeof Clock }> = {
  received:  { label: "Reçue",       color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  dot: "#60a5fa", icon: Clock },
  in_review: { label: "En examen",   color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  dot: "#fbbf24", icon: Eye },
  interview: { label: "Entretien",   color: "#a78bfa", bg: "rgba(167,139,250,0.12)", dot: "#a78bfa", icon: MessageSquare },
  accepted:  { label: "Acceptée",    color: "#10b981", bg: "rgba(16,185,129,0.12)",  dot: "#10b981", icon: CheckCircle2 },
  rejected:  { label: "Refusée",     color: "#f43f5e", bg: "rgba(244,63,94,0.12)",   dot: "#f43f5e", icon: XCircle },
};

const STATUS_OPTS: ApplicationStatus[] = ["received", "in_review", "interview", "accepted", "rejected"];

function getCompanyFromStorage(): Company | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("itga-company");
    return raw ? (JSON.parse(raw) as Company) : null;
  } catch {
    return null;
  }
}

export default function CompanyApplicationsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = Number(params.jobId);

  const [company, setCompany] = useState<Company | null>(null);
  const [offer, setOffer] = useState<JobOffer | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | "all">("all");
  const [search, setSearch] = useState("");
  const loadingMore = useRef(false);

  useEffect(() => {
    const c = getCompanyFromStorage();
    if (!c) { router.replace("/company/auth"); return; }
    setCompany(c);
  }, [router]);

  const load = useCallback(async (start: number) => {
    if (!company || !jobId) return;
    try {
      const res = await CompanyService.fetchJobApplications(company.id, jobId, start, PAGE_SIZE);
      if (res.status && res.data) {
        setOffer(res.data.offer);
        const apps = res.data.applications;
        setApplications((prev) => start === 0 ? apps : [...prev, ...apps]);
        setHasMore(apps.length >= PAGE_SIZE);
      } else {
        if (start === 0) setApplications([]);
        setHasMore(false);
      }
    } catch {
      if (start === 0) setApplications([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      loadingMore.current = false;
    }
  }, [company, jobId]);

  useEffect(() => { if (company) load(0); }, [company, load]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore.current && !loading) {
        loadingMore.current = true;
        load(applications.length);
      }
    }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, applications.length, load, loading]);

  const handleStatusChange = async (app: JobApplication, newStatus: ApplicationStatus) => {
    if (!company) return;
    const prev = app.status;
    setApplications((a) => a.map((x) => x.id === app.id ? { ...x, status: newStatus } : x));
    const res = await CompanyService.updateApplicationStatus(company.id, app.id, newStatus);
    if (!res.status) setApplications((a) => a.map((x) => x.id === app.id ? { ...x, status: prev } : x));
  };

  const filtered = applications.filter((app) => {
    const matchStatus = filterStatus === "all" || app.status === filterStatus;
    const name = (app.user?.full_name ?? app.user?.username ?? "").toLowerCase();
    const matchSearch = !search.trim() || name.includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const countByStatus = (s: ApplicationStatus) => applications.filter((a) => a.status === s).length;

  return (
    <CompanyShell>
      <div className="p-4 sm:p-6 lg:p-8 pb-16 max-w-4xl mx-auto w-full">

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/company/dashboard")}
            className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <ArrowLeft size={16} className="text-white/70" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-white truncate">
              {offer?.title ?? "Candidatures"}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Briefcase size={11} style={{ color: "rgba(255,255,255,0.4)" }} />
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                {applications.length} candidature(s) reçue(s)
              </span>
            </div>
          </div>
        </div>

        {/* ── Pipeline status tabs ──────────────────────────────── */}
        <div
          className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide"
        >
          <button
            onClick={() => setFilterStatus("all")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-all shrink-0"
            style={filterStatus === "all"
              ? { background: "rgba(0,229,255,0.15)", color: "#00e5ff", border: "1px solid rgba(0,229,255,0.3)" }
              : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Filter size={11} />
            Tous ({applications.length})
          </button>
          {STATUS_OPTS.map((s) => {
            const cfg = STATUS_CFG[s];
            const count = countByStatus(s);
            if (count === 0 && filterStatus !== s) return null;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-all shrink-0"
                style={filterStatus === s
                  ? { background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }
                  : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        {/* ── Search ───────────────────────────────────────────── */}
        <div
          className="relative mb-4"
          style={{ display: applications.length > 5 ? "block" : "none" }}
        >
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un candidat..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-[13px] text-white outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}>
              <User size={24} style={{ color: "rgba(255,255,255,0.2)" }} />
            </div>
            <p className="text-[14px] font-semibold text-white">Aucune candidature</p>
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {filterStatus !== "all" ? "Essayez un autre filtre" : "Les candidatures apparaîtront ici"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((app) => {
              const cfg = STATUS_CFG[app.status];
              const StatusIcon = cfg.icon;
              const avatar = addBaseURL(app.user?.profile);

              return (
                <div
                  key={app.id}
                  className="rounded-2xl p-4 transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(0,229,255,0.15)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                >
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <div
                      className="w-11 h-11 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.1)" }}
                    >
                      {avatar ? (
                        <img src={avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={18} style={{ color: "rgba(255,255,255,0.3)" }} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <h3 className="text-[13px] font-bold text-white">
                            {app.user?.full_name || app.user?.username || `Candidat #${app.user_id}`}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <CalendarDays size={10} style={{ color: "rgba(255,255,255,0.35)" }} />
                            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                              {formatTimeAgo(app.created_at)}
                            </span>
                          </div>
                        </div>
                        {/* Status badge */}
                        <span
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold shrink-0"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          <StatusIcon size={10} />
                          {cfg.label}
                        </span>
                      </div>

                      {app.cover_letter && (
                        <p
                          className="text-[12px] line-clamp-2 mt-2 leading-relaxed"
                          style={{ color: "rgba(255,255,255,0.5)" }}
                        >
                          {app.cover_letter}
                        </p>
                      )}

                      {/* Actions row */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {app.user_id ? (
                          <Link
                            href={`/profile/${app.user_id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                            style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <User size={11} /> Profil
                          </Link>
                        ) : null}
                        {app.cv_file && (
                          <a
                            href={addBaseURL(app.cv_file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                            style={{ background: "rgba(0,229,255,0.1)", color: "#00e5ff", border: "1px solid rgba(0,229,255,0.2)", textDecoration: "none" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download size={11} /> CV
                            <ExternalLink size={9} />
                          </a>
                        )}

                        {/* Status change dropdown */}
                        <div className="relative ml-auto">
                          <select
                            value={app.status}
                            onChange={(e) => handleStatusChange(app, e.target.value as ApplicationStatus)}
                            className="appearance-none rounded-xl text-[11px] font-semibold pl-3 pr-7 py-1.5 cursor-pointer outline-none"
                            style={{
                              background: "rgba(255,255,255,0.08)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              color: "rgba(255,255,255,0.8)",
                            }}
                          >
                            {STATUS_OPTS.map((s) => (
                              <option key={s} value={s} style={{ background: "#0d1525", color: "#fff" }}>
                                {STATUS_CFG[s].label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.4)" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={sentinelRef} className="h-4" />
            {!hasMore && applications.length > 0 && (
              <p className="text-center text-[11px] py-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                — Fin de la liste —
              </p>
            )}
          </div>
        )}
      </div>
    </CompanyShell>
  );
}
