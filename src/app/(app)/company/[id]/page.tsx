"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  ChevronRight,
  Clock,
  Globe,
  Leaf,
  MapPin,
  Settings,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar, VerifyBadge } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import { CompanyService } from "@/lib/services/company-service";
import { getActingCompanyId } from "@/lib/company-acting";
import { addBaseURL, cn, formatTimeAgo } from "@/lib/utils";
import type { Company, ContractType, JobOffer, LocationType, Post } from "@/lib/types";

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
  stage: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  alternance: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  cdi: "bg-green-500/10 text-green-500 border-green-500/20",
  cdd: "bg-orange/10 text-orange border-orange/20",
  freelance: "bg-cyan/10 text-cyan border-cyan/20",
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
  const loadingMore = useRef(false);

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

  const isOwner = Boolean(user?.id && company?.owner_user_id === user.id) || getActingCompanyId() === companyId;
  const isCertified = company?.is_verified === 1;

  const handleFollow = async () => {
    if (!user || followLoading || isOwner) return;
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
      <div className="card flex min-h-[360px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-text-light">Chargement du profil...</span>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="card flex min-h-[360px] flex-col items-center justify-center gap-4 text-center">
        <Building2 size={44} className="text-text-light/30" />
        <p className="font-semibold text-text-main">Entreprise introuvable.</p>
        <button onClick={() => router.back()} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white">
          Retour
        </button>
      </div>
    );
  }

  const logo = addBaseURL(company.logo);
  const location = [company.city, company.country].filter(Boolean).join(", ");

  return (
    <div className="animate-fadeIn space-y-4 pb-10">
      <header className="glass-header sticky top-0 z-20 -mx-3 border-b border-border/30 px-3 py-2 lg:-mx-4 lg:px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-light transition-colors hover:bg-bg-light hover:text-text-main"
            aria-label="Retour"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-black text-text-main">{company.name}</p>
              {isCertified && <VerifyBadge size={14} />}
            </div>
            <p className="truncate text-[11px] text-text-light">{company.sector ?? "Entreprise ITGA"}</p>
          </div>
          {isOwner ? (
            <Link
              href="/company/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"
            >
              <Settings size={13} />
              Gerer
            </Link>
          ) : (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                following
                  ? "border border-primary/25 bg-primary/10 text-primary"
                  : "bg-gradient-to-r from-primary to-cyan text-white shadow-sm shadow-primary/20",
                followLoading && "opacity-60"
              )}
            >
              {following ? <UserCheck size={13} /> : <UserPlus size={13} />}
              {following ? "Abonne" : "Suivre"}
            </button>
          )}
        </div>
      </header>

      <section className="card overflow-hidden">
        <div className="relative h-32 bg-gradient-to-br from-primary/25 via-cyan/15 to-magenta/10">
          <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,.5)_1px,transparent_0)] [background-size:24px_24px]" />
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-12 flex items-end justify-between gap-4">
            <div className="rounded-2xl bg-card p-1 shadow-sm ring-1 ring-border/40">
              <Avatar src={logo} alt={company.name} size={84} className="rounded-2xl" isVerified={isCertified} />
            </div>
            <div className="hidden gap-2 sm:flex">
              {company.website && (
                <a
                  href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 px-3 text-xs font-bold text-text-dark hover:border-primary/40 hover:text-primary"
                >
                  <Globe size={14} />
                  Site web
                </a>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-text-main">{company.name}</h1>
              {isCertified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">
                  <ShieldCheck size={13} />
                  Certifiee ITGA
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-bg-light px-2.5 py-1 text-[11px] font-bold text-text-light">
                  <Clock size={13} />
                  Certification non validee
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-text-light">{company.sector ?? "Entreprise tech"}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {location && <MetaPill icon={MapPin} label={location} />}
            {company.company_size && <MetaPill icon={Users} label={`${company.company_size} employes`} />}
            {company.website && <MetaPill icon={Globe} label="Site officiel" />}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <StatTile value={company.published_offers_count ?? 0} label="Offres actives" accent="text-primary" />
            <StatTile value={followersCount} label="Abonnes" accent="text-magenta" />
            <StatTile value={isCertified ? "OK" : "-"} label="Badge ITGA" accent={isCertified ? "text-green" : "text-text-light"} />
          </div>
        </div>
      </section>

      {company.description && (
        <section className="card p-5">
          <h2 className="text-sm font-black text-text-main">A propos</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-dark">{company.description}</p>
        </section>
      )}

      {company.rse_commitments && (
        <section className="card border-green/15 bg-green/5 p-5">
          <div className="mb-2 flex items-center gap-2">
            <Leaf size={16} className="text-green" />
            <h2 className="text-sm font-black text-green">Engagements</h2>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-text-dark">{company.rse_commitments}</p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-primary" />
            <h2 className="text-base font-black text-text-main">Offres d'emploi</h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">
              {company.published_offers_count ?? jobs.length}
            </span>
          </div>
          <Link href="/jobs" className="text-xs font-bold text-primary hover:underline">Tout voir</Link>
        </div>

        {jobs.length === 0 ? (
          <EmptyPanel icon={Briefcase} label="Aucune offre publiee pour le moment." />
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} onOpen={() => router.push(`/jobs/${job.id}`)} />
            ))}
            {hasMore && (
              <button
                onClick={() => load(jobs.length)}
                className="card w-full py-3 text-sm font-bold text-primary transition-colors hover:bg-bg-light/40"
              >
                Voir plus d'offres
              </button>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-magenta" />
          <h2 className="text-base font-black text-text-main">Activite de l'entreprise</h2>
        </div>
        {recentPosts.length === 0 ? (
          <EmptyPanel icon={Building2} label="Aucune publication entreprise pour le moment." />
        ) : (
          <div className="space-y-3">
            {recentPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => router.push(`/post/${post.id}`)}
                className="card-interactive w-full p-4 text-left"
              >
                <p className="line-clamp-2 text-sm font-bold text-text-main">{post.desc || "Publication entreprise"}</p>
                <p className="mt-1 text-[11px] text-text-light">{formatTimeAgo(post.created_at)}</p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetaPill({ icon: Icon, label }: { icon: typeof MapPin; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-bg-light/60 px-2.5 py-1 text-xs font-bold text-text-dark">
      <Icon size={12} />
      {label}
    </span>
  );
}

function StatTile({ value, label, accent }: { value: string | number; label: string; accent: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-bg-light/40 px-2 py-3 text-center">
      <p className={cn("text-lg font-black", accent)}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold text-text-light">{label}</p>
    </div>
  );
}

function EmptyPanel({ icon: Icon, label }: { icon: typeof Briefcase; label: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <Icon size={32} className="text-text-light/35" />
      <p className="text-sm text-text-light">{label}</p>
    </div>
  );
}

function JobCard({ job, onOpen }: { job: JobOffer; onOpen: () => void }) {
  const contractClass = CONTRACT_COLORS[job.contract_type] ?? CONTRACT_COLORS.freelance;

  return (
    <button onClick={onOpen} className="card-interactive w-full p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-text-main">{job.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-black", contractClass)}>
              {CONTRACT_LABELS[job.contract_type] ?? job.contract_type}
            </span>
            {job.location_type && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-bg-light px-2 py-0.5 text-[10px] font-bold text-text-dark">
                <MapPin size={9} />
                {LOCATION_LABELS[job.location_type] ?? job.location_type}
              </span>
            )}
            {job.location_city && <span className="text-[10px] text-text-light">{job.location_city}</span>}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-text-light">
            {job.deadline && (
              <span className="inline-flex items-center gap-1">
                <Clock size={10} />
                Jusqu'au {new Date(job.deadline).toLocaleDateString("fr-FR")}
              </span>
            )}
            <span>{formatTimeAgo(job.created_at)}</span>
          </div>
        </div>
        <ChevronRight size={16} className="mt-1 shrink-0 text-text-light/50" />
      </div>
    </button>
  );
}
