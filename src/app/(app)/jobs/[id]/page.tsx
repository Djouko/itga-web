"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Clock,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  Send,
  ExternalLink,
  Briefcase,
  CheckCircle2,
  Globe,
  Leaf,
  X,
  Upload,
} from "lucide-react";
import { useAuthStore, useTranslation } from "@/lib/store";
import { JobService } from "@/lib/services/job-service";
import {
  isCompanyActingMode,
  disableCompanyActingMode,
  companyModeEventName,
} from "@/lib/company-acting";
import { addBaseURL, cn, formatTimeAgo } from "@/lib/utils";
import type { JobOffer, ContractType, LocationType } from "@/lib/types";

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

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-500/10 text-blue-500 border border-blue-500/20",
  in_review: "bg-gold/10 text-gold border border-gold/20",
  interview: "bg-purple-500/10 text-purple-500 border border-purple-500/20",
  accepted: "bg-green/10 text-green border border-green/20",
  rejected: "bg-red/10 text-red border border-red/20",
};

const STATUS_LABELS: Record<string, string> = {
  received: "Reçue",
  in_review: "En cours d'examen",
  interview: "Entretien",
  accepted: "Acceptée",
  rejected: "Refusée",
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const jobId = Number(params.id);

  const [job, setJob] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [actingAsCompany, setActingAsCompany] = useState(false);

  useEffect(() => {
    setActingAsCompany(isCompanyActingMode());
    const handler = () => setActingAsCompany(isCompanyActingMode());
    window.addEventListener(companyModeEventName(), handler);
    return () => window.removeEventListener(companyModeEventName(), handler);
  }, []);

  const loadJob = useCallback(async () => {
    if (!user || !jobId) return;
    try {
      const res = await JobService.fetchJobDetail(user.id, jobId);
      if (res.status && res.data) setJob(res.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user, jobId]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const handleToggleSave = async () => {
    if (!user || !job) return;
    const wasSaved = job.is_saved === 1;
    setJob({ ...job, is_saved: wasSaved ? 0 : 1 });
    const res = await JobService.toggleSaveJob(user.id, job.id);
    if (!res.status) setJob((prev) => (prev ? { ...prev, is_saved: wasSaved ? 1 : 0 } : prev));
  };

  const handleApply = async () => {
    if (!user || !job) return;
    setApplying(true);
    try {
      const res = await JobService.applyToJob(user.id, job.id, coverLetter || undefined, cvFile ?? undefined);
      if (res.status) {
        setJob({ ...job, is_applied: 1, application_status: "received" });
        setShowApplyModal(false);
        setCoverLetter("");
        setCvFile(null);
      }
    } catch {
      /* ignore */
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-card">
        <div className="p-4 space-y-4">
          <div className="h-8 w-24 bg-bg-light rounded-lg animate-pulse" />
          <div className="h-6 w-3/4 bg-bg-light rounded-lg animate-pulse" />
          <div className="h-40 bg-bg-light rounded-2xl animate-pulse" />
          <div className="h-60 bg-bg-light rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-card flex flex-col items-center justify-center gap-3">
        <Briefcase size={36} className="text-text-light/30" />
        <p className="text-text-light">{t("jobs.notFound")}</p>
        <button onClick={() => router.back()} className="text-primary text-sm font-medium cursor-pointer">
          {t("common.goBack")}
        </button>
      </div>
    );
  }

  const logo = addBaseURL(job.company?.logo);
  const skills = job.required_skills ?? [];

  return (
    <div className="min-h-screen bg-card">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <h1 className="text-base font-bold text-text-main line-clamp-1 flex-1">{job.title}</h1>
          <button onClick={handleToggleSave} className="p-2 rounded-xl hover:bg-bg-light transition-colors cursor-pointer">
            {job.is_saved === 1 ? (
              <BookmarkCheck size={18} className="text-primary" />
            ) : (
              <Bookmark size={18} className="text-text-light" />
            )}
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4 pb-32">
        {/* Company card */}
        <div className="card p-4">
          <div className="flex gap-3 items-center">
            <div className="w-14 h-14 rounded-xl bg-bg-light flex items-center justify-center overflow-hidden shrink-0">
              {logo ? (
                <img src={logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={24} className="text-text-light/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-text-main">{job.title}</h2>
              <p className="text-sm text-text-light">{job.company?.name ?? "—"}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-semibold", CONTRACT_COLORS[job.contract_type] ?? "bg-bg-light text-text-dark border-border/40")}>
                  {CONTRACT_LABELS[job.contract_type] ?? job.contract_type}
                </span>
                {job.location_type && (
                  <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-bg-light text-text-dark text-[10px] font-medium">
                    <MapPin size={9} />
                    {LOCATION_LABELS[job.location_type] ?? job.location_type}
                  </span>
                )}
                {job.location_city && <span className="text-[10px] text-text-light">{job.location_city}</span>}
              </div>
            </div>
          </div>

          {/* Match badge */}
          {job.is_match === 1 && (
            <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/10">
              <Sparkles size={16} className="text-primary" />
              <div>
                <p className="text-xs font-semibold text-primary">Match {job.match_score}%</p>
                <p className="text-[10px] text-text-light">{t("jobs.matchDesc")}</p>
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-light">
            <span className="flex items-center gap-1"><Clock size={12} />{formatTimeAgo(job.created_at)}</span>
            {job.salary_min != null && (
              <span className="font-semibold text-text-main">
                {job.salary_min.toLocaleString()}{job.salary_max ? ` – ${job.salary_max.toLocaleString()}` : ""} €{job.salary_period === "month" ? "/mois" : job.salary_period === "year" ? "/an" : ""}
              </span>
            )}
            {job.experience_level && (
              <span className="capitalize">{job.experience_level}</span>
            )}
            {job.deadline && (
              <span>{t("jobs.deadline")}: {new Date(job.deadline).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {/* Application status */}
        {job.is_applied === 1 && job.application_status && (
          <div className={cn("rounded-xl p-3 flex items-center gap-2", STATUS_COLORS[job.application_status] ?? "bg-bg-light text-text-dark border border-border/40")}>
            <CheckCircle2 size={16} />
            <p className="text-xs font-semibold">{t("jobs.applicationStatus")}: {STATUS_LABELS[job.application_status] ?? job.application_status}</p>
          </div>
        )}

        {/* Description */}
        <section className="card p-4">
          <h3 className="text-sm font-bold text-text-main mb-2">{t("jobs.description")}</h3>
          <p className="text-sm text-text-light leading-relaxed whitespace-pre-line">{job.description}</p>
        </section>

        {/* Missions */}
        {job.missions && (
          <section className="card p-4">
            <h3 className="text-sm font-bold text-text-main mb-2">{t("jobs.missions")}</h3>
            <p className="text-sm text-text-light leading-relaxed whitespace-pre-line">{job.missions}</p>
          </section>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <section className="card p-4">
            <h3 className="text-sm font-bold text-text-main mb-2">{t("jobs.requiredSkills")}</h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, i) => (
                <span key={i} className="px-3 py-1 rounded-lg bg-bg-light text-xs font-medium text-text-main">
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Company info */}
        {job.company && (
          <section className="card p-4">
            <h3 className="text-sm font-bold text-text-main mb-3">{t("jobs.aboutCompany")}</h3>
            <button
              onClick={() => router.push(`/company/${job.company!.id}`)}
              className="flex gap-3 items-center mb-3 w-full text-left group cursor-pointer rounded-xl p-1.5 -m-1.5 transition-colors hover:bg-bg-light/50"
            >
              <div className="w-10 h-10 rounded-lg bg-bg-light flex items-center justify-center overflow-hidden shrink-0">
                {logo ? <img src={logo} alt="" className="w-full h-full object-cover" /> : <Building2 size={18} className="text-text-light/40" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-main group-hover:text-primary transition-colors">{job.company.name}</p>
                {job.company.sector && <p className="text-xs text-text-light">{job.company.sector}</p>}
              </div>
              <ExternalLink size={13} className="text-text-light/30 group-hover:text-primary/60 transition-colors shrink-0" />
            </button>
            {job.company.description && (
              <p className="text-xs text-text-light leading-relaxed mb-2">{job.company.description}</p>
            )}
            {job.company.rse_commitments && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-green/10 border border-green/20 mt-2">
                <Leaf size={14} className="text-green shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-semibold text-green mb-0.5">{t("jobs.rseCommitments")}</p>
                  <p className="text-xs text-text-dark leading-relaxed">{job.company.rse_commitments}</p>
                </div>
              </div>
            )}
            {job.company.website && (
              <a
                href={job.company.website.startsWith("http") ? job.company.website : `https://${job.company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
              >
                <Globe size={12} />
                {job.company.website}
                <ExternalLink size={10} />
              </a>
            )}
          </section>
        )}
      </div>

      {/* Sticky bottom bar */}
      {job.is_applied !== 1 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border/30 p-4 z-30">
          <div className="max-w-2xl mx-auto">
            {actingAsCompany ? (
              <div className="rounded-xl border border-cyan/20 bg-cyan/10 p-3">
                <div className="flex items-start gap-2">
                  <Building2 size={16} className="text-cyan shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs text-text-dark leading-relaxed">
                    <p className="font-semibold mb-1">Mode entreprise actif</p>
                    <p>La candidature serait enregistrée à votre nom personnel et non au nom de l’entreprise. Désactivez le mode entreprise pour postuler.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    disableCompanyActingMode();
                    setActingAsCompany(false);
                  }}
                    className="mt-2 w-full py-2 rounded-lg bg-cyan hover:bg-cyan/90 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Désactiver le mode entreprise
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowApplyModal(true)}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <Send size={16} />
                {t("jobs.applyNow")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Apply modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-5 animate-slideUp">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-text-main">{t("jobs.applyTo")} {job.title}</h3>
              <button onClick={() => setShowApplyModal(false)} className="p-1 cursor-pointer">
                <X size={18} className="text-text-light" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-main mb-1 block">{t("jobs.coverLetter")}</label>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder={t("jobs.coverLetterPlaceholder")}
                  rows={5}
                  className="w-full px-3 py-2 rounded-xl bg-bg-light text-sm text-text-main placeholder:text-text-light/50 border border-border/20 focus:border-primary/40 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-main mb-1 block">{t("jobs.cvUpload")}</label>
                <label className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border/30 hover:border-primary/30 transition-colors cursor-pointer">
                  <Upload size={16} className="text-text-light" />
                  <span className="text-xs text-text-light">
                    {cvFile ? cvFile.name : t("jobs.cvUploadPlaceholder")}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <button
                onClick={handleApply}
                disabled={applying}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {applying ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={16} />
                    {t("jobs.submitApplication")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
