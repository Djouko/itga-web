"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AtSign, Check, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore, useSettingsStore } from "@/lib/store";
import { UserService } from "@/lib/services/user-service";

const MAX_USERNAME = 30;

export default function UsernamePage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { restrictedUsernames } = useSettingsStore();
  const [username, setUsername] = useState(user?.username ?? "");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const validateAndCheck = useCallback(
    (value: string) => {
      setError("");
      setIsAvailable(null);

      if (!value) return;

      if (value.includes(" ")) {
        setError("Le nom d'utilisateur ne peut pas contenir d'espaces");
        return;
      }
      if (value.length > MAX_USERNAME) {
        setError(`Maximum ${MAX_USERNAME} caractères`);
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(value)) {
        setError("Lettres, chiffres et underscores uniquement");
        return;
      }
      if (restrictedUsernames.includes(value.toLowerCase())) {
        setError("Ce nom d'utilisateur n'est pas disponible");
        return;
      }
      if (user?.username && value === user.username) {
        setIsAvailable(true);
        return;
      }

      setIsChecking(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        try {
          const res = await UserService.checkUsername(value);
          if (res.status) {
            setIsAvailable(true);
          } else {
            setIsAvailable(false);
            setError(res.message || "Ce nom d'utilisateur est déjà pris");
          }
        } catch {
          setError("Impossible de vérifier le nom d'utilisateur");
        } finally {
          setIsChecking(false);
        }
      }, 500);
    },
    [restrictedUsernames, user?.username]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/\s/g, "");
    setUsername(val);
    validateAndCheck(val);
  };

  const handleContinue = async () => {
    if (!user || !username || !isAvailable) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await UserService.editProfile(user.id, { username });
      if (res.status && res.data) {
        setUser(res.data);
      } else {
        setError(
          res.message ||
            "Impossible de sauvegarder le nom d'utilisateur. Veuillez réessayer."
        );
        setIsLoading(false);
        return;
      }
      router.replace("/feed");
    } catch {
      setError(
        "Impossible de sauvegarder le nom d'utilisateur. Veuillez réessayer."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-card flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[40%] bg-gradient-to-br from-[#1B3A5C] via-[#122840] to-[#0F172A] relative overflow-hidden items-center justify-center">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[rgba(68,209,209,0.08)] blur-[80px]" />
        <div className="absolute bottom-16 left-8 w-64 h-64 rounded-full bg-[rgba(42,171,171,0.1)] blur-[60px]" />
        <div className="relative z-10 px-12 xl:px-16 max-w-lg">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(42,171,171,0.2)] flex items-center justify-center mb-8">
            <AtSign size={28} className="text-[#2AABAB]" />
          </div>
          <h2 className="text-3xl xl:text-4xl font-black text-white leading-tight mb-4">
            Choisissez votre<br />
            <span className="text-[#44D1D1]">identifiant unique</span>
          </h2>
          <p className="text-[rgba(255,255,255,0.5)] leading-relaxed">
            Votre nom d&apos;utilisateur permet aux autres de vous trouver et
            de vous mentionner sur ITGA. Choisissez quelque chose de mémorable.
          </p>
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1 flex flex-col">
        {/* Progress */}
        <div className="px-6 sm:px-10 pt-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-[#2AABAB] uppercase tracking-wider">
              Étape 2 sur 2
            </span>
          </div>
          <div className="flex gap-1.5">
            <div className="h-1 flex-1 rounded-full bg-[#2AABAB]" />
            <div className="h-1 flex-1 rounded-full bg-[#2AABAB]" />
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-8">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-bold text-[#1E293B] mb-1">
              Choisissez un nom d&apos;utilisateur
            </h1>
            <p className="text-sm text-[#94A3B8] mb-8">
              C&apos;est ainsi que les gens vous trouveront et vous
              mentionneront
            </p>

            {/* Username Input */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] font-medium text-lg">
                @
              </div>
              <input
                type="text"
                value={username}
                onChange={handleChange}
                maxLength={MAX_USERNAME}
                placeholder="nom_utilisateur"
                autoFocus
                className={`
                  w-full h-14 pl-10 pr-12 rounded-xl border-2 text-lg font-medium text-[#1E293B]
                  placeholder:text-[#CBD5E1] outline-none transition-all
                  ${
                    error
                      ? "border-red-300 focus:border-red-400"
                      : isAvailable
                        ? "border-green-300 focus:border-green-400"
                        : "border-[#E2E8F0] focus:border-[#2AABAB]"
                  }
                `}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {isChecking && (
                  <Loader2
                    size={20}
                    className="text-[#94A3B8] animate-spin"
                  />
                )}
                {!isChecking && isAvailable === true && (
                  <Check size={20} className="text-green-500" />
                )}
                {!isChecking && isAvailable === false && (
                  <X size={20} className="text-red-500" />
                )}
              </div>
            </div>

            {/* Status / error */}
            <div className="flex justify-between items-center mt-2 px-1">
              {error ? (
                <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                  <AlertCircle size={12} />
                  {error}
                </p>
              ) : isAvailable ? (
                <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <Check size={12} />
                  Disponible !
                </p>
              ) : (
                <p className="text-xs text-[#94A3B8]">
                  Lettres, chiffres et underscores
                </p>
              )}
              <span
                className={`text-xs font-medium ${username.length > MAX_USERNAME - 5 ? "text-[#FF8C42]" : "text-[#94A3B8]"}`}
              >
                {username.length}/{MAX_USERNAME}
              </span>
            </div>

            {/* Continue */}
            <Button
              onClick={handleContinue}
              disabled={!isAvailable || isChecking || !!error}
              isLoading={isLoading}
              className="w-full h-12 mt-8"
            >
              Terminer
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
