"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Globe, FileText, Leaf, Save, Sparkles, UploadCloud } from "lucide-react";
import { CompanyService } from "@/lib/services/company-service";
import { useTranslation } from "@/lib/store";
import { addBaseURL } from "@/lib/utils";
import { CompanyShell } from "@/components/company/company-shell";
import type { Company } from "@/lib/types";

function getCompanyFromStorage(): Company | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("itga-company");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function CompanyProfileEditPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [description, setDescription] = useState("");
  const [rseCommitments, setRseCommitments] = useState("");
  const [website, setWebsite] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = getCompanyFromStorage();
    if (!c) { router.replace("/company/auth"); return; }
    setCompany(c);
    setName(c.name ?? "");
    setSector(c.sector ?? "");
    setDescription(c.description ?? "");
    setRseCommitments(c.rse_commitments ?? "");
    setWebsite(c.website ?? "");
  }, [router]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  };

  const handleSubmit = async () => {
    if (!company) return;
    if (!name.trim()) { setError(t("company.errorNameRequired")); return; }

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const data: Record<string, unknown> = {
        name: name.trim(),
        sector: sector.trim(),
        description: description.trim(),
        rse_commitments: rseCommitments.trim(),
        website: website.trim(),
      };

      const res = await CompanyService.editProfile(company.id, data, logoFile ?? undefined);

      if (res.status && res.data) {
        const updated = res.data as Company;
        localStorage.setItem("itga-company", JSON.stringify(updated));
        setCompany(updated);
        setSuccess(true);
        setTimeout(() => {
          router.push("/company/dashboard");
        }, 1200);
      } else {
        setError(res.message ?? t("company.errorGeneric"));
      }
    } catch {
      setError(t("company.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  const logo = logoPreview ?? addBaseURL(company?.logo);

  const inputClass =
    "w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20";

  const sectionClass =
    "rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5";

  return (
    <CompanyShell>
      <div className="mx-auto w-full max-w-5xl p-4 pb-16 sm:p-6 lg:p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/75 transition-all hover:text-white"
          >
            <ArrowLeft size={14} /> Retour
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00c4d4] via-[#7b2fff] to-[#c0356b] px-4 py-2 text-sm font-bold text-white shadow-[0_8px_24px_rgba(123,47,255,0.35)] transition-all hover:brightness-110 disabled:opacity-60"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save size={14} /> {t("company.saveChanges")}
              </>
            )}
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-cyan-200">
            <Sparkles size={12} /> COMPANY PROFILE
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">{t("company.editProfileTitle")}</h1>
          <p className="mt-1 text-sm text-white/55">
            Renforcez votre image de marque pour attirer des profils plus qualifies.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className={sectionClass}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />

            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Identite</p>
            <div className="mb-4 flex items-center gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03]"
              >
                {logo ? (
                  <img src={logo} alt="Company logo" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Building2 size={24} className="text-white/30" />
                  </div>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                  <UploadCloud size={16} className="text-white" />
                </span>
              </button>
              <div>
                <p className="text-sm font-semibold text-white">Logo entreprise</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 text-xs font-semibold text-cyan-200 transition-colors hover:text-cyan-100"
                >
                  Changer le logo
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-white/70">
                  {t("company.nameField")} <span className="text-rose-300">*</span>
                </label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("company.nameField")}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-white/70">{t("company.sectorField")}</label>
                <input
                  type="text"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder="ex: Tech, Finance, Sante..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-white/70">{t("company.website")}</label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://votre-site.com"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Positionnement</p>

            <div className="mb-4">
              <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-white/70">
                <FileText size={12} /> {t("company.descriptionLabel")}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Decrivez votre entreprise, sa mission, ses valeurs..."
                className={`${inputClass} resize-none`}
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-white/70">
                <Leaf size={12} className="text-emerald-300" /> {t("company.rseLabel")}
              </label>
              <textarea
                value={rseCommitments}
                onChange={(e) => setRseCommitments(e.target.value)}
                rows={5}
                placeholder="Engagements RSE, inclusion, environnement, impact social..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100">
                Profil mis a jour avec succes.
              </div>
            )}
          </section>
        </div>
      </div>
    </CompanyShell>
  );
}
