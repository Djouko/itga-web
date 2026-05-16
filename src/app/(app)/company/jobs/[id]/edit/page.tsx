"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Save, Sparkles } from "lucide-react";
import { CompanyService } from "@/lib/services/company-service";
import { useTranslation } from "@/lib/store";
import { CompanyShell } from "@/components/company/company-shell";
import type { Company, JobOffer, ContractType, LocationType } from "@/lib/types";

function getCompanyFromStorage(): Company | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("itga-company");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function EditJobPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const jobId = Number(params.id);

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [contractType, setContractType] = useState<ContractType>("cdi");
  const [locationType, setLocationType] = useState<LocationType>("onsite");
  const [locationCity, setLocationCity] = useState("");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [missions, setMissions] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [salaryPeriod, setSalaryPeriod] = useState("month");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<string>("published");

  const inputClass =
    "w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20";

  const sectionClass =
    "rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5";

  useEffect(() => {
    const c = getCompanyFromStorage();
    if (!c) { router.replace("/company/auth"); return; }
    setCompany(c);
  }, [router]);

  const loadJob = useCallback(async () => {
    if (!company || !jobId) return;
    try {
      const res = await CompanyService.fetchCompanyJobs(company.id, 0, 100);
      if (res.status && Array.isArray(res.data)) {
        const job = res.data.find((j: JobOffer) => j.id === jobId);
        if (job) {
          setTitle(job.title);
          setContractType(job.contract_type);
          setLocationType(job.location_type);
          setLocationCity(job.location_city ?? "");
          setDomain(job.domain ?? "");
          setDescription(job.description);
          setMissions(job.missions ?? "");
          setSkills(job.required_skills ?? []);
          setSalaryMin(job.salary_min != null ? String(job.salary_min) : "");
          setSalaryMax(job.salary_max != null ? String(job.salary_max) : "");
          setSalaryPeriod(job.salary_period ?? "month");
          setExperienceLevel(job.experience_level ?? "");
          setDeadline(job.deadline ? job.deadline.split("T")[0] : "");
          setStatus(job.status);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [company, jobId]);

  useEffect(() => {
    if (company) loadJob();
  }, [company, loadJob]);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills([...skills, s]);
    setSkillInput("");
  };

  const handleSave = async () => {
    setError("");
    if (!title.trim()) { setError(t("company.errorTitleRequired")); return; }
    if (!company) return;

    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        title: title.trim(),
        contract_type: contractType,
        location_type: locationType,
        description: description.trim(),
        status,
      };
      if (locationCity.trim()) data.location_city = locationCity.trim();
      if (domain.trim()) data.domain = domain.trim();
      if (missions.trim()) data.missions = missions.trim();
      if (skills.length > 0) data.required_skills = skills;
      if (salaryMin) data.salary_min = Number(salaryMin);
      if (salaryMax) data.salary_max = Number(salaryMax);
      if (salaryPeriod) data.salary_period = salaryPeriod;
      if (experienceLevel) data.experience_level = experienceLevel;
      if (deadline) data.deadline = deadline;

      const res = await CompanyService.editJob(company.id, jobId, data);
      if (res.status) {
        router.push("/company/dashboard");
      } else {
        setError(res.message || t("company.errorGeneric"));
      }
    } catch {
      setError(t("company.errorGeneric"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <CompanyShell>
        <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6 lg:p-8">
          <div className="h-8 w-44 animate-pulse rounded-lg bg-white/10" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/8" />
          ))}
        </div>
      </CompanyShell>
    );
  }

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
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00c4d4] via-[#7b2fff] to-[#c0356b] px-4 py-2 text-sm font-bold text-white shadow-[0_8px_24px_rgba(123,47,255,0.35)] transition-all hover:brightness-110 disabled:opacity-60"
          >
            {saving ? (
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
            <Sparkles size={12} /> JOB EDITOR
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Modifier l&apos;offre</h1>
          <p className="mt-1 text-sm text-white/55">
            Ajustez les details de votre offre sans perdre l&apos;historique des candidatures.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className={sectionClass}>
            <Field label={t("company.jobTitle")}>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </Field>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label={t("company.contractType")}>
                <select value={contractType} onChange={(e) => setContractType(e.target.value as ContractType)} className={inputClass}>
                  <option value="cdi">CDI</option>
                  <option value="cdd">CDD</option>
                  <option value="stage">Stage</option>
                  <option value="alternance">Alternance</option>
                  <option value="freelance">Freelance</option>
                </select>
              </Field>
              <Field label={t("company.locationType")}>
                <select value={locationType} onChange={(e) => setLocationType(e.target.value as LocationType)} className={inputClass}>
                  <option value="onsite">Sur site</option>
                  <option value="hybrid">Hybride</option>
                  <option value="remote">Remote</option>
                </select>
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label={t("company.locationCity")}>
                <input type="text" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} className={inputClass} />
              </Field>
              <Field label={t("company.domain")}>
                <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} className={inputClass} />
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label={t("company.experienceLevel")}>
                <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid-level</option>
                  <option value="senior">Senior</option>
                </select>
              </Field>
              <Field label={t("company.deadline")}>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
              </Field>
            </div>
          </section>

          <section className={sectionClass}>
            <Field label={t("company.jobDescription")}>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={`${inputClass} resize-none`} />
            </Field>

            <div className="mt-4">
              <Field label={t("company.jobMissions")}>
                <textarea value={missions} onChange={(e) => setMissions(e.target.value)} rows={4} className={`${inputClass} resize-none`} />
              </Field>
            </div>
          </section>

          <section className={sectionClass}>
            <Field label={t("company.requiredSkills")}>
              <div className="mb-2 flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  className={`${inputClass} flex-1`}
                />
                <button
                  onClick={addSkill}
                  className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 text-cyan-200 transition-colors hover:bg-cyan-400/20"
                >
                  <Plus size={14} />
                </button>
              </div>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span key={s} className="flex items-center gap-1 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-100">
                      {s}
                      <button onClick={() => setSkills(skills.filter((x) => x !== s))} className="cursor-pointer opacity-80 hover:opacity-100">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Field>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Field label={t("company.salaryMin")}>
                <input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} className={inputClass} />
              </Field>
              <Field label={t("company.salaryMax")}>
                <input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} className={inputClass} />
              </Field>
              <Field label={t("company.salaryPeriod")}>
                <select value={salaryPeriod} onChange={(e) => setSalaryPeriod(e.target.value)} className={inputClass}>
                  <option value="month">Par mois</option>
                  <option value="year">Par an</option>
                </select>
              </Field>
            </div>
          </section>

          <section className={sectionClass}>
            <Field label={t("company.publishStatus")}>
              <div className="grid grid-cols-3 gap-2">
                {(["published", "draft", "closed"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                      status === s
                        ? s === "published"
                          ? "border-emerald-300/45 bg-emerald-400/15 text-emerald-100"
                          : s === "closed"
                            ? "border-rose-300/45 bg-rose-500/15 text-rose-100"
                            : "border-white/25 bg-white/12 text-white"
                        : "border-white/10 bg-white/[0.04] text-white/60"
                    }`}
                  >
                    {s === "published" ? t("company.publish") : s === "closed" ? t("company.close") : t("company.saveDraft")}
                  </button>
                ))}
              </div>
            </Field>

            {error && (
              <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
                {error}
              </p>
            )}
          </section>
        </div>
      </div>
    </CompanyShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-white/70">{label}</label>
      {children}
    </div>
  );
}
