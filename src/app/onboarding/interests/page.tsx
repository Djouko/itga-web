"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore, useSettingsStore } from "@/lib/store";
import { UserService } from "@/lib/services/user-service";
import type { Interest } from "@/lib/types";

const MAX_INTERESTS = 5;

export default function InterestsPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { interests: allInterests } = useSettingsStore();
  const [selected, setSelected] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.interest_ids) {
      const ids = user.interest_ids
        .split(",")
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
      setSelected(ids);
    }
  }, [user?.interest_ids]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, id];
    });
  };

  const handleContinue = async () => {
    if (!user || selected.length === 0) return;
    setError("");
    setIsLoading(true);
    try {
      const res = await UserService.editProfile(user.id, {
        interest_ids: selected.join(","),
      });
      if (res.status && res.data) {
        setUser(res.data);
      } else {
        setError(
          res.message ||
            "Impossible de sauvegarder vos intérêts. Veuillez réessayer."
        );
        setIsLoading(false);
        return;
      }
      router.replace("/onboarding/username");
    } catch {
      setError("Impossible de sauvegarder vos intérêts. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-card flex">
      {/* Left decorative panel (desktop) */}
      <div className="hidden lg:flex lg:w-[40%] bg-gradient-to-br from-[#1B3A5C] via-[#122840] to-[#0F172A] relative overflow-hidden items-center justify-center">
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-[rgba(42,171,171,0.1)] blur-[80px]" />
        <div className="absolute bottom-20 right-10 w-64 h-64 rounded-full bg-[rgba(233,30,140,0.06)] blur-[60px]" />
        <div className="relative z-10 px-12 xl:px-16 max-w-lg">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(42,171,171,0.2)] flex items-center justify-center mb-8">
            <Sparkles size={28} className="text-[#2AABAB]" />
          </div>
          <h2 className="text-3xl xl:text-4xl font-black text-white leading-tight mb-4">
            Qu&apos;est-ce qui<br />
            <span className="text-[#2AABAB]">vous passionne ?</span>
          </h2>
          <p className="text-[rgba(255,255,255,0.5)] leading-relaxed">
            Sélectionnez jusqu&apos;à {MAX_INTERESTS} sujets qui correspondent
            à vos centres d&apos;intérêt. Cela nous aide à personnaliser votre
            fil d&apos;actualité.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-[rgba(42,171,171,0.3)] border-2 border-[#122840]"
                />
              ))}
            </div>
            <span className="text-[rgba(255,255,255,0.4)] text-sm">
              Rejoignez des milliers de membres
            </span>
          </div>
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1 flex flex-col">
        {/* Progress */}
        <div className="px-6 sm:px-10 pt-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-[#2AABAB] uppercase tracking-wider">
              Étape 1 sur 2
            </span>
          </div>
          <div className="flex gap-1.5">
            <div className="h-1 flex-1 rounded-full bg-[#2AABAB]" />
            <div className="h-1 flex-1 rounded-full bg-[#E2E8F0]" />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col px-6 sm:px-10 py-8 max-w-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#1E293B] mb-1">
              Choisissez vos centres d&apos;intérêt
            </h1>
            <p className="text-sm text-[#94A3B8]">
              {selected.length} / {MAX_INTERESTS} sélectionné
              {selected.length > 1 ? "s" : ""}
            </p>
          </div>

          {/* Interests grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-wrap gap-2.5">
              {allInterests.map((interest: Interest) => {
                const isSelected = selected.includes(interest.id);
                const isDisabled =
                  !isSelected && selected.length >= MAX_INTERESTS;
                return (
                  <button
                    key={interest.id}
                    onClick={() => toggle(interest.id)}
                    disabled={isDisabled}
                    className={`
                      px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer
                      ${
                        isSelected
                          ? "bg-[#2AABAB] text-white shadow-md shadow-[rgba(42,171,171,0.2)] scale-[1.02]"
                          : "bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0] hover:text-[#1E293B]"
                      }
                      ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}
                    `}
                  >
                    {interest.title}
                  </button>
                );
              })}
              {allInterests.length === 0 && (
                <div className="w-full py-12 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3 animate-pulse">
                    <Sparkles size={18} className="text-[#94A3B8]" />
                  </div>
                  <p className="text-sm text-[#94A3B8]">
                    Chargement des intérêts...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle
                size={16}
                className="text-red-500 mt-0.5 shrink-0"
              />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Bottom action */}
          <div className="mt-6 flex items-center justify-end">
            <Button
              onClick={handleContinue}
              disabled={selected.length === 0}
              isLoading={isLoading}
              className="min-w-[160px] h-12"
            >
              Continuer
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
