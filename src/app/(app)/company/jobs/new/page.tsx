"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Save, Sparkles } from "lucide-react";
import { CompanyService } from "@/lib/services/company-service";
import { useTranslation } from "@/lib/store";
import { CompanyShell } from "@/components/company/company-shell";
import type { Company, ContractType, LocationType } from "@/lib/types";

function getCompanyFromStorage(): Company | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("itga-company");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function CreateJobPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form
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
  const [status, setStatus] = useState<"draft" | "published">("published");

  const inputClass =
    "w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20";

  const sectionClass =
    "rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5";

  useEffect(() => {
    const c = getCompanyFromStorage();
    if (!c) { router.replace("/company/auth"); return; }
    setCompany(c);
  }, [router]);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) {
      setSkills([...skills, s]);
    }
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSubmit = async () => {
    setError("");
    if (!title.trim()) { setError(t("company.errorTitleRequired")); return; }
    if (!description.trim()) { setError(t("company.errorDescRequired")); return; }
    if (!company) return;

    setLoading(true);
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

      const res = await CompanyService.createJob(company.id, data);
      if (res.status) {
        router.push("/company/dashboard");
      } else {
        setError(res.message || t("company.errorGeneric"));
      }
    } catch {
      setError(t("company.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

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
                Enregistrement...
              </>
            ) : (
              <>
                <Save size={14} /> {t("company.submitJob")}
              </>
            )}
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-cyan-200">
            <Sparkles size={12} /> JOB COMPOSER
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Nouvelle offre d&apos;emploi</h1>
          <p className="mt-1 text-sm text-white/55">
            Publiez une offre claire et attractive pour maximiser la qualite des candidatures.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className={sectionClass}>
            <Field label={t("company.jobTitle")}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("company.jobTitlePlaceholder")}
                className={inputClass}
              />
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
                <input type="text" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} placeholder="Paris, Lyon..." className={inputClass} />
              </Field>
              <Field label={t("company.domain")}>
                <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Data, Dev, IA..." className={inputClass} />
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
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("company.jobDescPlaceholder")}
                rows={5}
                className={`${inputClass} resize-none`}
              />
            </Field>

            <div className="mt-4">
              <Field label={t("company.jobMissions")}>
                <textarea
                  value={missions}
                  onChange={(e) => setMissions(e.target.value)}
                  placeholder={t("company.jobMissionsPlaceholder")}
                  rows={4}
                  className={`${inputClass} resize-none`}
                />
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
                  placeholder={t("company.addSkillPlaceholder")}
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
                      <button onClick={() => removeSkill(s)} className="cursor-pointer opacity-80 hover:opacity-100">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Field>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Field label={t("company.salaryMin")}>
                <input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="0" className={inputClass} />
              </Field>
              <Field label={t("company.salaryMax")}>
                <input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="0" className={inputClass} />
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
              <div className="flex gap-2">
                {(["published", "draft"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                      status === s
                        ? s === "published"
                          ? "border-emerald-300/45 bg-emerald-400/15 text-emerald-100"
                          : "border-white/25 bg-white/12 text-white"
                        : "border-white/10 bg-white/[0.04] text-white/60"
                    }`}
                  >
                    {s === "published" ? t("company.publish") : t("company.saveDraft")}
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
