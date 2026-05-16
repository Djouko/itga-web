"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Globe,
  Users,
  Briefcase,
  Leaf,
  ExternalLink,
  CheckCircle2,
  Clock,
  ChevronRight,
  UserPlus,
  UserCheck,
  Settings,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { CompanyService } from "@/lib/services/company-service";
import { getActingCompanyId } from "@/lib/company-acting";
import { addBaseURL, formatTimeAgo, cn } from "@/lib/utils";
import type { Company, JobOffer, ContractType, LocationType, Post } from "@/lib/types";

const CONTRACT_LABELS: Record<ContractType, string> = {
  stage: "Stage", alternance: "Alternance", cdi: "CDI", cdd: "CDD", freelance: "Freelance",
};
const LOCATION_LABELS: Record<LocationType, string> = {
  remote: "Remote", hybrid: "Hybride", onsite: "Sur site",
};
const CONTRACT_COLORS: Record<ContractType, { text: string; bg: string; border: string }> = {
  cdi:        { text: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)" },
  cdd:        { text: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)" },
  stage:      { text: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.25)" },
  alternance: { text: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.25)" },
  freelance:  { text: "#00c4d4", bg: "rgba(0,196,212,0.1)",   border: "rgba(0,196,212,0.25)" },
};

export default function CompanyPublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const companyId = Number(params.id);

  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const loadingMore = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("itga-company");
      if (raw) {
        const ownCompany = JSON.parse(raw) as { id?: number };
        if (ownCompany?.id === companyId) setIsOwner(true);
      }
    } catch {
      /* ignore */
    }
  }, [companyId]);

  const load = useCallback(
    async (start: number, reset = false) => {
      if (!companyId || loadingMore.current) return;
      loadingMore.current = true;
      try {
        const res = await CompanyService.publicProfile(
          companyId,
          user?.id,
          start,
          10,
          getActingCompanyId() ?? undefined
        );
        if (res.status && res.data) {
          if (reset) {
            setCompany(res.data.company);
            setFollowing(res.data.company.is_following === 1);
            setFollowersCount(res.data.company.followers_count ?? 0);
            setJobs(res.data.jobs);
            setRecentPosts(res.data.recent_posts ?? []);
          } else {
            setJobs((prev) => [...prev, ...res.data!.jobs]);
          }
          setHasMore(res.data.jobs.length === 10);
        }
      } finally {
        setLoading(false);
        loadingMore.current = false;
      }
    },
    [companyId, user?.id]
  );

  useEffect(() => {
    load(0, true);
  }, [load]);

  const handleFollow = async () => {
    if (!user || followLoading) return;
    setFollowLoading(true);
    try {
      const res = following
        ? await CompanyService.unfollowCompany(user.id, companyId, getActingCompanyId() ?? undefined)
        : await CompanyService.followCompany(user.id, companyId, getActingCompanyId() ?? undefined);
      if (res.status && res.data) {
        setFollowing(res.data.is_following === 1);
        setFollowersCount(res.data.followers_count);
      }
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#030a14" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#00c4d4", borderTopColor: "transparent" }} />
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Chargement du profil…</span>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#030a14" }}>
        <Building2 size={48} style={{ color: "rgba(255,255,255,0.1)" }} />
        <p style={{ color: "rgba(255,255,255,0.4)" }}>Entreprise introuvable.</p>
        <button onClick={() => router.back()} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "rgba(0,196,212,0.1)", color: "#00c4d4", border: "1px solid rgba(0,196,212,0.2)" }}>
          Retour
        </button>
      </div>
    );
  }

  const logo = addBaseURL(company.logo);
  const initial = company.name?.[0]?.toUpperCase() ?? "E";

  return (
    <div className="min-h-screen pb-20" style={{ background: "#030a14" }}>

      {/* ─── Sticky Top Bar ─── */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
        style={{ background: "rgba(3,10,20,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <ArrowLeft size={16} style={{ color: "rgba(255,255,255,0.6)" }} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{company.name}</p>
          {company.sector && <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{company.sector}</p>}
        </div>
        {isOwner ? (
          <button
            onClick={() => router.push("/company/dashboard")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
            style={{ background: "rgba(0,196,212,0.12)", color: "#00c4d4", border: "1px solid rgba(0,196,212,0.3)" }}
          >
            <Settings size={13} />
            Gérer ma page
          </button>
        ) : user ? (
          <button
            onClick={handleFollow}
            disabled={followLoading}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer", followLoading && "opacity-60")}
            style={
              following
                ? { background: "rgba(0,196,212,0.12)", color: "#00c4d4", border: "1px solid rgba(0,196,212,0.3)" }
                : { background: "linear-gradient(135deg, #00c4d4, #7b2fff)", color: "#fff", border: "none" }
            }
          >
            {following ? <UserCheck size={13} /> : <UserPlus size={13} />}
            {following ? "Abonné" : "Suivre"}
          </button>
        ) : null}
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">

        {/* ─── Hero Card ─── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#0d1525", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {/* Banner */}
          <div className="h-24 relative" style={{ background: "linear-gradient(135deg, rgba(0,196,212,0.2), rgba(123,47,255,0.2), rgba(255,107,172,0.1))" }}>
            <div className="absolute inset-0" style={{ background: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
          </div>

          <div className="px-5 pb-5">
            {/* Logo + Verified */}
            <div className="flex items-end justify-between -mt-8 mb-4">
              <div
                className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-bold shadow-xl"
                style={{ background: logo ? "transparent" : "linear-gradient(135deg, rgba(0,196,212,0.3), rgba(123,47,255,0.2))", border: "3px solid #0d1525" }}
              >
                {logo ? (
                  <img src={logo} alt={company.name} className="w-full h-full object-cover" />
                ) : (
                  <span style={{ color: "#00c4d4" }}>{initial}</span>
                )}
              </div>

              {/* Mobile action button */}
              {isOwner ? (
                <button
                  onClick={() => router.push("/company/dashboard")}
                  className="sm:hidden flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  style={{ background: "rgba(0,196,212,0.1)", color: "#00c4d4", border: "1px solid rgba(0,196,212,0.25)" }}
                >
                  <Settings size={13} />
                  Gérer
                </button>
              ) : user ? (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={cn("sm:hidden flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer", followLoading && "opacity-60")}
                  style={
                    following
                      ? { background: "rgba(0,196,212,0.1)", color: "#00c4d4", border: "1px solid rgba(0,196,212,0.25)" }
                      : { background: "linear-gradient(135deg, #00c4d4, #7b2fff)", color: "#fff" }
                  }
                >
                  {following ? <UserCheck size={13} /> : <UserPlus size={13} />}
                  {following ? "Abonné" : "Suivre"}
                </button>
              ) : null}
            </div>

            {/* Name + Verified Badge */}
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">{company.name}</h1>
              {company.is_verified === 1 && (
                <span title="Compte vérifié"><CheckCircle2 size={16} style={{ color: "#00c4d4" }} /></span>
              )}
            </div>

            {company.sector && (
              <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>{company.sector}</p>
            )}

            {/* Meta pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {company.city && (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <MapPin size={10} /> {company.city}{company.country ? `, ${company.country}` : ""}
                </span>
              )}
              {company.company_size && (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Users size={10} /> {company.company_size} employés
                </span>
              )}
              {company.website && (
                <a
                  href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors"
                  style={{ background: "rgba(0,196,212,0.08)", color: "#00c4d4", border: "1px solid rgba(0,196,212,0.2)" }}
                >
                  <Globe size={10} /> Site web <ExternalLink size={8} />
                </a>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: company.published_offers_count ?? 0, label: "Offres actives", color: "#00c4d4" },
                { value: followersCount, label: "Abonnés", color: "#a78bfa" },
                { value: "", label: "ITGA Verified", color: "#10b981", icon: true },
              ].map((s, i) => (
                <div key={i} className="text-center py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {s.icon ? (
                    <CheckCircle2 size={20} style={{ color: s.color, margin: "0 auto 4px" }} />
                  ) : (
                    <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                  )}
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Description ─── */}
        {company.description && (
          <div className="rounded-2xl p-5 space-y-2" style={{ background: "#0d1525", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>À propos</h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", whiteSpace: "pre-line" }}>{company.description}</p>
          </div>
        )}

        {/* ─── RSE / Commitments ─── */}
        {company.rse_commitments && (
          <div className="rounded-2xl p-5" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Leaf size={14} style={{ color: "#10b981" }} />
              <h2 className="text-sm font-semibold" style={{ color: "#10b981" }}>Engagements RSE</h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", whiteSpace: "pre-line" }}>{company.rse_commitments}</p>
          </div>
        )}

        {/* ─── Job Offers ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-0.5 h-4 rounded-full" style={{ background: "#00c4d4" }} />
              <h2 className="text-base font-bold text-white">Offres d&apos;emploi</h2>
              {(company.published_offers_count ?? 0) > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(0,196,212,0.1)", color: "#00c4d4", border: "1px solid rgba(0,196,212,0.2)" }}>
                  {company.published_offers_count}
                </span>
              )}
            </div>
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: "#0d1525", border: "1px solid rgba(255,255,255,0.06)" }}>
              <Briefcase size={32} style={{ color: "rgba(255,255,255,0.1)", margin: "0 auto 10px" }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Aucune offre publiée pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} onOpen={() => router.push(`/jobs/${job.id}`)} />
              ))}
              {hasMore && (
                <button
                  onClick={() => load(jobs.length)}
                  className="w-full py-3 rounded-2xl text-sm font-medium transition-colors cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Voir plus d&apos;offres
                </button>
              )}
            </div>
          )}
        </div>

        {/* ─── Company Activity ─── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-0.5 h-4 rounded-full" style={{ background: "#a78bfa" }} />
            <h2 className="text-base font-bold text-white">Activité de l&apos;entreprise</h2>
          </div>
          {recentPosts.length === 0 ? (
            <div className="rounded-2xl p-6 text-center" style={{ background: "#0d1525", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                Aucune publication entreprise pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => router.push(`/post/${post.id}`)}
                  className="w-full text-left rounded-2xl p-4 transition-all cursor-pointer"
                  style={{ background: "#0d1525", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <p className="text-sm font-semibold text-white mb-1 line-clamp-2">{post.desc || "Publication entreprise"}</p>
                  <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {formatTimeAgo(post.created_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JobCard({ job, onOpen }: { job: JobOffer; onOpen: () => void }) {
  const ct = job.contract_type;
  const cfg = CONTRACT_COLORS[ct] ?? CONTRACT_COLORS.freelance;
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl p-4 transition-all cursor-pointer group"
      style={{ background: "#0d1525", border: "1px solid rgba(255,255,255,0.08)" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(0,196,212,0.25)"; e.currentTarget.style.background = "#101d30"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "#0d1525"; }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white mb-1 truncate">{job.title}</p>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
              {CONTRACT_LABELS[ct]}
            </span>
            {job.location_type && (
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                {LOCATION_LABELS[job.location_type]}
              </span>
            )}
            {job.location_city && (
              <span className="flex items-center gap-0.5 text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                <MapPin size={9} />{job.location_city}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {job.deadline && (
                <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <Clock size={9} />Jusqu&apos;au {new Date(job.deadline).toLocaleDateString("fr-FR")}
              </span>
            )}
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>{formatTimeAgo(job.created_at)}</span>
          </div>
        </div>
        <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0, marginTop: 2 }} />
      </div>
    </button>
  );
}
