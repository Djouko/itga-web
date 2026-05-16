"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Building2,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  MessageSquare,
} from "lucide-react";
import { useAuthStore, useTranslation } from "@/lib/store";
import { JobService } from "@/lib/services/job-service";
import {
  isCompanyActingMode,
  companyModeEventName,
} from "@/lib/company-acting";
import { addBaseURL, cn, formatTimeAgo } from "@/lib/utils";
import type { JobApplication, ApplicationStatus } from "@/lib/types";

const PAGE_SIZE = 15;

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; icon: typeof Clock; color: string }> = {
  received: { label: "Reçue", icon: Clock, color: "bg-blue-100 text-blue-700" },
  in_review: { label: "En examen", icon: Eye, color: "bg-yellow-100 text-yellow-700" },
  interview: { label: "Entretien", icon: MessageSquare, color: "bg-purple-100 text-purple-700" },
  accepted: { label: "Acceptée", icon: CheckCircle2, color: "bg-green-100 text-green-700" },
  rejected: { label: "Refusée", icon: XCircle, color: "bg-red-100 text-red-700" },
};

export default function MyApplicationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [actingAsCompany, setActingAsCompany] = useState(false);
  const loadingMore = useRef(false);

  useEffect(() => {
    setActingAsCompany(isCompanyActingMode());
    const handler = () => setActingAsCompany(isCompanyActingMode());
    window.addEventListener(companyModeEventName(), handler);
    return () => window.removeEventListener(companyModeEventName(), handler);
  }, []);

  const load = useCallback(async (start: number) => {
    if (!user) return;
    try {
      const res = await JobService.fetchMyApplications(user.id, start, PAGE_SIZE);
      if (res.status && Array.isArray(res.data)) {
        setApplications((prev) => start === 0 ? res.data! : [...prev, ...res.data!]);
        setHasMore(res.data!.length >= PAGE_SIZE);
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
  }, [user]);

  useEffect(() => { load(0); }, [load]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore.current && !loading) {
          loadingMore.current = true;
          load(applications.length);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, applications.length, load, loading]);

  return (
    <div className="min-h-screen bg-card">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <h1 className="text-lg font-bold text-text-main">{t("jobs.myApplications")}</h1>
        </div>
      </header>

      <div className="pb-8">
        {actingAsCompany && (
          <div className="mx-4 mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
            <div className="flex items-start gap-2">
              <Building2 size={16} className="text-cyan-700 shrink-0 mt-0.5" />
              <p className="text-xs text-cyan-900 leading-relaxed">
                <span className="font-semibold">Mode entreprise actif.</span>{" "}
                Vous consultez vos candidatures personnelles. Les candidatures envoyées à votre nom n’incluent pas l’identité entreprise.
              </p>
            </div>
          </div>
        )}
        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 bg-bg-light rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText size={32} className="text-text-light/40" />
            <p className="text-base font-semibold text-text-main">{t("jobs.noApplications")}</p>
            <p className="text-sm text-text-light">{t("jobs.noApplicationsDesc")}</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {applications.map((app) => {
              const config = STATUS_CONFIG[app.status];
              const StatusIcon = config.icon;
              const logo = addBaseURL(app.job_offer?.company?.logo);

              return (
                <div
                  key={app.id}
                  onClick={() => router.push(`/jobs/${app.job_offer_id}`)}
                  className="bg-white rounded-2xl border border-border/20 p-4 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex gap-3">
                    <div className="w-11 h-11 rounded-xl bg-bg-light flex items-center justify-center overflow-hidden shrink-0">
                      {logo ? <img src={logo} alt="" className="w-full h-full object-cover" /> : <Building2 size={18} className="text-text-light/40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-text-main line-clamp-1">
                        {app.job_offer?.title ?? `Offre #${app.job_offer_id}`}
                      </h3>
                      <p className="text-xs text-text-light mt-0.5">
                        {app.job_offer?.company?.name ?? "—"}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold", config.color)}>
                          <StatusIcon size={10} />
                          {config.label}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-text-light">{formatTimeAgo(app.created_at)}</span>
                          <ChevronRight size={14} className="text-text-light/30" />
                        </div>
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
