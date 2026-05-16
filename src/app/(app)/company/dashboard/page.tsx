"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Eye,
  FileText,
  Briefcase,
  BarChart3,
  ChevronRight,
  Edit,
  Trash2,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Building2,
} from "lucide-react";
import { CompanyService } from "@/lib/services/company-service";
import { useTranslation } from "@/lib/store";
import { addBaseURL, formatTimeAgo } from "@/lib/utils";
import { CompanyShell } from "@/components/company/company-shell";
import type { Company, CompanyDashboard, JobOffer } from "@/lib/types";

const COMPANY_NOTICE_KEY = "itga-company-notice";

const JOB_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Brouillon",  color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  published: { label: "Publiée",   color: "#10b981", bg: "rgba(16,185,129,0.12)"  },
  closed:    { label: "Fermée",    color: "#f43f5e", bg: "rgba(244,63,94,0.12)"   },
  rejected:  { label: "Rejetée",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
};

function getCompanyFromStorage(): Company | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("itga-company");
    return raw ? (JSON.parse(raw) as Company) : null;
  } catch {
    return null;
  }
}

export default function CompanyDashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [company, setCompany] = useState<Company | null>(null);
  const [dashboard, setDashboard] = useState<CompanyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyNotice, setCompanyNotice] = useState("");

  useEffect(() => {
    const c = getCompanyFromStorage();
    if (!c) { router.replace("/company/auth"); return; }
    setCompany(c);
    const notice = localStorage.getItem(COMPANY_NOTICE_KEY);
    if (notice) {
      setCompanyNotice(notice);
      localStorage.removeItem(COMPANY_NOTICE_KEY);
    }
  }, [router]);

  const loadDashboard = useCallback(async () => {
    if (!company) return;
    try {
      const res = await CompanyService.fetchDashboard(company.id);
      if (res.status && res.data) setDashboard(res.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => { if (company) loadDashboard(); }, [company, loadDashboard]);

  const handleDeleteJob = async (jobId: number) => {
    if (!company || !confirm(t("company.confirmDeleteJob"))) return;
    const res = await CompanyService.deleteJob(company.id, jobId);
    if (res.status) loadDashboard();
  };

  const logo = addBaseURL(company?.logo);
  const stats = dashboard?.stats;

  return (
    <CompanyShell>
      <div className="p-4 sm:p-6 lg:p-8 pb-16 max-w-5xl mx-auto w-full">

        {/* ── Banner / Hero ─────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-2xl mb-6"
          style={{
            background: "linear-gradient(135deg, rgba(0,229,255,0.12) 0%, rgba(167,139,250,0.1) 50%, rgba(255,107,172,0.08) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Grid texture */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: "linear-gradient(rgba(0,229,255,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,0.4) 1px,transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="relative z-10 p-5 sm:p-7 flex items-center gap-4 sm:gap-6">
            {/* Logo */}
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
              style={{ background: "rgba(0,229,255,0.1)", border: "2px solid rgba(0,229,255,0.2)" }}
            >
              {logo ? (
                <img src={logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={28} className="text-[#00e5ff]" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {company?.name ?? "—"}
                </h1>
                {company?.is_verified === 1 && (
                  <span
                    className="text-[9px] font-bold tracking-[0.12em] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(0,229,255,0.15)", color: "#00e5ff", border: "1px solid rgba(0,229,255,0.3)" }}
                  >
                    VÉRIFIÉ
                  </span>
                )}
              </div>
              <p className="text-[13px] mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
                {company?.sector ?? "Espace Entreprise"}{company?.city ? ` · ${company.city}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => router.push("/company/jobs/new")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white cursor-pointer transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg,#00c4d4,#7b2fff)", boxShadow: "0 4px 20px rgba(123,47,255,0.35)" }}
                >
                  <Plus size={14} /> Publier une offre
                </button>
                <button
                  onClick={() => router.push("/company/profile/edit")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold cursor-pointer transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  Modifier le profil
                </button>
              </div>
            </div>
          </div>
        </div>

        {companyNotice && (
          <div
            className="mb-6 flex items-start gap-3 rounded-2xl p-4"
            style={{
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.26)",
            }}
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#10b981]" />
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white">Mode entreprise pret</p>
              <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>
                {companyNotice}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
              ))}
            </div>
            <div className="h-48 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>
        ) : (
          <>
            {/* ── Stats Grid ──────────────────────────────────────── */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <StatCard
                  icon={Briefcase}
                  label="Offres totales"
                  value={stats.total_offers}
                  accent="#00e5ff"
                  trend={stats.published_offers > 0 ? `${stats.published_offers} publiées` : undefined}
                />
                <StatCard
                  icon={FileText}
                  label="Candidatures"
                  value={stats.total_applications}
                  accent="#a78bfa"
                />
                <StatCard
                  icon={Eye}
                  label="Vues totales"
                  value={stats.total_views}
                  accent="#ff6bac"
                />
                <StatCard
                  icon={BarChart3}
                  label="Publiées"
                  value={stats.published_offers}
                  accent="#10b981"
                  trend={stats.total_offers > 0
                    ? `${Math.round((stats.published_offers / stats.total_offers) * 100)}% du total`
                    : undefined}
                />
              </div>
            )}

            {/* ── Quick tips (empty state) ─────────────────────── */}
            {(!dashboard?.recent_offers || dashboard.recent_offers.length === 0) && (
              <div
                className="rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(0,229,255,0.1)" }}
                >
                  <Sparkles size={20} className="text-[#00e5ff]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[14px] font-bold text-white mb-1">Commencez à recruter</h3>
                  <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Publiez votre première offre d&apos;emploi et accédez à des milliers de candidates qualifiées dans la tech.
                  </p>
                </div>
                <button
                  onClick={() => router.push("/company/jobs/new")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white cursor-pointer whitespace-nowrap"
                  style={{ background: "rgba(0,229,255,0.15)", border: "1px solid rgba(0,229,255,0.3)", color: "#00e5ff" }}
                >
                  <Plus size={13} /> Créer une offre
                </button>
              </div>
            )}

            {/* ── Recent Offers ───────────────────────────────────── */}
            {dashboard?.recent_offers && dashboard.recent_offers.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] font-bold text-white">{t("company.recentOffers")}</h2>
                  <button
                    onClick={() => router.push("/company/jobs/new")}
                    className="flex items-center gap-1 text-[12px] font-semibold cursor-pointer transition-colors"
                    style={{ color: "#00e5ff" }}
                  >
                    <Plus size={13} /> Nouvelle offre
                  </button>
                </div>

                <div className="space-y-3">
                  {dashboard.recent_offers.map((offer: JobOffer) => {
                    const st = JOB_STATUS[offer.status] ?? JOB_STATUS.draft;
                    return (
                      <div
                        key={offer.id}
                        className="group rounded-2xl p-4 transition-all duration-200"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(0,229,255,0.2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: "rgba(0,229,255,0.08)" }}
                          >
                            <Briefcase size={16} className="text-[#00e5ff]" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-[14px] font-semibold text-white line-clamp-1 flex-1">
                                {offer.title}
                              </h3>
                              <span
                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0"
                                style={{ background: st.bg, color: st.color }}
                              >
                                {st.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                                <FileText size={11} />
                                {offer.applications_count ?? 0} candidature(s)
                              </span>
                              <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                                <Clock size={11} />
                                {formatTimeAgo(offer.created_at)}
                              </span>
                              {offer.contract_type && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>
                                  {offer.contract_type.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                          <button
                            onClick={() => router.push(`/company/applications/${offer.id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                            style={{ background: "rgba(0,229,255,0.1)", color: "#00e5ff", border: "1px solid rgba(0,229,255,0.2)" }}
                          >
                            <FileText size={12} /> Voir candidatures
                          </button>
                          <button
                            onClick={() => router.push(`/company/jobs/${offer.id}/edit`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
                          >
                            <Edit size={12} /> Modifier
                          </button>
                          <button
                            onClick={() => handleDeleteJob(offer.id)}
                            className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] cursor-pointer transition-all"
                            style={{ color: "rgba(244,63,94,0.6)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(244,63,94,0.08)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <Trash2 size={12} />
                          </button>
                          <button
                            onClick={() => router.push(`/company/applications/${offer.id}`)}
                            className="p-1.5 rounded-lg cursor-pointer"
                            style={{ color: "rgba(255,255,255,0.2)" }}
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Insights / Tips ─────────────────────────────────── */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TipCard
                icon={TrendingUp}
                title="Optimisez vos offres"
                desc="Les offres avec une description détaillée reçoivent 3× plus de candidatures."
                accent="#00e5ff"
              />
              <TipCard
                icon={CheckCircle2}
                title="Répondez rapidement"
                desc="Traitez les candidatures sous 48h pour améliorer votre marque employeur."
                accent="#a78bfa"
              />
            </div>
          </>
        )}
      </div>
    </CompanyShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  trend,
}: {
  icon: typeof Briefcase;
  label: string;
  value: number;
  accent: string;
  trend?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div
        className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10"
        style={{ background: accent, filter: "blur(20px)", transform: "translate(25%, -25%)" }}
      />
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
        style={{ background: `${accent}18` }}
      >
        <Icon size={16} style={{ color: accent }} />
      </div>
      <p className="text-2xl font-black text-white">{value.toLocaleString()}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</p>
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          <AlertCircle size={10} style={{ color: accent }} />
          <span className="text-[10px]" style={{ color: accent }}>{trend}</span>
        </div>
      )}
    </div>
  );
}

function TipCard({
  icon: Icon,
  title,
  desc,
  accent,
}: {
  icon: typeof TrendingUp;
  title: string;
  desc: string;
  accent: string;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl p-4"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}12` }}>
        <Icon size={15} style={{ color: accent }} />
      </div>
      <div>
        <p className="text-[12px] font-bold text-white mb-0.5">{title}</p>
        <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{desc}</p>
      </div>
    </div>
  );
}
