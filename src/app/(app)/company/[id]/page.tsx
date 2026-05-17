"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  Globe,
  Info,
  MapPin,
  Settings,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  cdi: "bg-green/10 text-green border-green/20",
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
      <div className="animate-fadeIn">
        <div className="h-[200px] skeleton" />
        <div className="px-4 pt-12">
          <div className="h-5 w-44 rounded skeleton" />
          <div className="mt-2 h-3 w-28 rounded skeleton" />
          <div className="mt-5 h-16 rounded-xl skeleton" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-4 text-center">
        <Building2 size={42} className="text-text-light/30" />
        <p className="text-sm font-semibold text-text-main">Entreprise introuvable.</p>
        <button onClick={() => router.back()} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white">
          Retour
        </button>
      </div>
    );
  }

  const logo = addBaseURL(company.logo);
  const location = [company.city, company.country].filter(Boolean).join(", ");
  const publishedOffers = company.published_offers_count ?? company.job_offers_count ?? jobs.length;

  return (
    <div className="min-h-screen bg-card animate-fadeIn">
      <div className="relative">
        <div className="relative h-[200px] sm:h-[240px] overflow-hidden bg-gradient-to-br from-primary via-navy to-magenta">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,.26)_1px,transparent_0)] [background-size:24px_24px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
          <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
              aria-label="Retour"
            >
              <ArrowLeft size={20} />
            </button>
            {isOwner && (
              <Link
                href="/company/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-2 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-black/50"
              >
                <Settings size={14} />
                Gerer
              </Link>
            )}
          </div>
        </div>

        <div className="absolute -bottom-[42px] left-4 z-10">
          <div className="rounded-2xl border-[3px] border-card bg-bg-light shadow-lg">
            <Avatar src={logo} alt={company.name} size={88} isVerified={isCertified} />
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 pt-[54px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="truncate text-xl font-black text-text-main">{company.name}</h1>
              {isCertified && <VerifyBadge size={18} />}
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                <Building2 size={11} />
                Entreprise
              </span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-magenta">@company-{company.id}</p>
            <p className="mt-1 text-sm text-text-light">{company.sector ?? "Entreprise ITGA"}</p>
          </div>

          {!isOwner && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={cn(
                "mt-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-all",
                following
                  ? "border border-primary/25 bg-primary/10 text-primary"
                  : "bg-gradient-to-r from-primary to-cyan text-white shadow-sm shadow-primary/20",
                followLoading && "opacity-60"
              )}
            >
              {following ? <UserCheck size={15} /> : <UserPlus size={15} />}
              {following ? "Abonne" : "Suivre"}
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {location && <MetaPill icon={MapPin} label={location} />}
          {company.company_size && <MetaPill icon={Users} label={`${company.company_size} employes`} />}
          {company.website && (
            <a
              href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary"
            >
              <Globe size={12} />
              Site web
            </a>
          )}
        </div>

        <div className="mt-4 flex items-center gap-0 border-y border-border/30 py-3">
          <StatButton value={publishedOffers} label="Offres" />
          <Divider />
          <StatButton value={followersCount} label="Abonnes" />
          <Divider />
          <StatButton value={isCertified ? "OK" : "-"} label="Badge ITGA" />
        </div>

        {company.description && (
          <section className="mt-3 rounded-xl border border-border/20 bg-bg-light/60 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-sm font-black text-text-main">
              <Info size={14} />
              A propos
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-text-dark">{company.description}</p>
          </section>
        )}

        {isCertified ? (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green/10 px-3 py-1.5 text-xs font-bold text-green">
            <ShieldCheck size={14} />
            Certification ITGA validee
          </div>
        ) : (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-bg-light px-3 py-1.5 text-xs font-bold text-text-light">
            <Clock size={14} />
            Certification ITGA en attente
          </div>
        )}

        <SectionTitle title="Offres d'emploi" count={publishedOffers} actionLabel="Tout voir" actionHref="/jobs" />
        {jobs.length === 0 ? (
          <EmptyPanel icon={Briefcase} label="Aucune offre publiee pour le moment." />
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} onOpen={() => router.push(`/jobs/${job.id}`)} />
            ))}
            {hasMore && (
              <button
                onClick={() => load(jobs.length)}
                className="w-full rounded-xl border border-border/40 py-3 text-sm font-bold text-primary transition-colors hover:bg-bg-light/50"
              >
                Voir plus d'offres
              </button>
            )}
          </div>
        )}

        <SectionTitle title="Activite de l'entreprise" count={recentPosts.length} />
        {recentPosts.length === 0 ? (
          <EmptyPanel icon={Building2} label="Aucune publication entreprise pour le moment." />
        ) : (
          <div className="space-y-2">
            {recentPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => router.push(`/post/${post.id}`)}
                className="w-full rounded-xl border border-border/40 bg-bg-light/40 p-3 text-left transition-colors hover:bg-bg-light"
              >
                <p className="line-clamp-2 text-sm font-bold text-text-main">{post.desc || "Publication entreprise"}</p>
                <p className="mt-1 text-[11px] text-text-light">{formatTimeAgo(post.created_at)}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-border/30" />;
}

function StatButton({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex-1 rounded-lg py-1.5 text-center">
      <span className="block text-lg font-black text-text-main">{value}</span>
      <span className="block text-[11px] font-medium text-text-light">{label}</span>
    </div>
  );
}

function MetaPill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-bg-light px-2.5 py-1 text-xs font-bold text-text-dark">
      <Icon size={12} />
      {label}
    </span>
  );
}

function SectionTitle({
  title,
  count,
  actionLabel,
  actionHref,
}: {
  title: string;
  count: number;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="mt-6 mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-black text-text-main">{title}</h2>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">{count}</span>
      </div>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="text-xs font-bold text-primary hover:underline">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function EmptyPanel({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="rounded-xl border border-border/30 bg-bg-light/40 px-4 py-8 text-center">
      <Icon size={28} className="mx-auto text-text-light/35" />
      <p className="mt-2 text-sm text-text-light">{label}</p>
    </div>
  );
}

function JobCard({ job, onOpen }: { job: JobOffer; onOpen: () => void }) {
  const contractClass = CONTRACT_COLORS[job.contract_type] ?? CONTRACT_COLORS.freelance;

  return (
    <button onClick={onOpen} className="w-full rounded-xl border border-border/40 bg-bg-light/40 p-3 text-left transition-colors hover:bg-bg-light">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-text-main">{job.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-black", contractClass)}>
              {CONTRACT_LABELS[job.contract_type] ?? job.contract_type}
            </span>
            {job.location_type && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-card px-2 py-0.5 text-[10px] font-bold text-text-dark">
                <MapPin size={9} />
                {LOCATION_LABELS[job.location_type] ?? job.location_type}
              </span>
            )}
            {job.location_city && <span className="text-[10px] text-text-light">{job.location_city}</span>}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-text-light">
            {job.deadline && (
              <span className="inline-flex items-center gap-1">
                <Calendar size={10} />
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
