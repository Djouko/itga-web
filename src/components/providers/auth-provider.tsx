"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  useAuthStore,
  useSettingsStore,
  getOnboardingStep,
} from "@/lib/store";
import { CommonService } from "@/lib/services/common-service";
import { UserService } from "@/lib/services/user-service";
import {
  canCompanyActAsUser,
  disableCompanyActingMode,
  isCompanyActingMode,
  getOwnerUserId,
  getCompanyFromStorage,
} from "@/lib/company-acting";
import { normalizeReportReasons } from "@/lib/report-reasons";

const PUBLIC_PATHS = ["/auth"];
const ONBOARDING_PATHS = ["/onboarding/interests", "/onboarding/username"];
const STEP_ROUTES: Record<string, string> = {
  interests: "/onboarding/interests",
  username: "/onboarding/username",
};

// Company "admin" paths — require a company session (localStorage itga-company)
const COMPANY_ADMIN_PREFIXES = [
  "/company/auth",
  "/company/dashboard",
  "/company/jobs",
  "/company/applications",
  "/company/profile",
];

function isPublic(path: string) {
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}
function isOnboarding(path: string) {
  return ONBOARDING_PATHS.some((p) => path.startsWith(p));
}
function isCompanyAdminPath(path: string) {
  return COMPANY_ADMIN_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}
/** /company/123 , /company/123/anything — but NOT /company/dashboard etc. */
function isCompanyPublicProfile(path: string) {
  return /^\/company\/\d+(\/|$)/.test(path);
}
function hasCompanySession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem("itga-company");
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isHydrated, setUser } = useAuthStore();
  const {
    isLoaded,
    setSettings,
    setInterests,
    setReportReasons,
    setRestrictedUsernames,
    setLoaded,
  } = useSettingsStore();
  const [isReady, setIsReady] = useState(false);
  const initDone = useRef(false);

  /* ── 1. Load global settings (once) ── */
  useEffect(() => {
    if (isLoaded) return;
    CommonService.fetchGlobalSettings()
      .then((res) => {
        if (res.status && res.data) {
          setSettings(res.data);
          if (res.data.interests) setInterests(res.data.interests);
          setReportReasons(normalizeReportReasons(res.data.reportReasons));
          if (res.data.restrictedUsernames) {
            setRestrictedUsernames(
              res.data.restrictedUsernames.map(
                (r) => r.title?.toLowerCase() ?? ""
              )
            );
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoaded());
  }, [isLoaded, setSettings, setInterests, setReportReasons, setRestrictedUsernames, setLoaded]);

  /* ── 2. Wait for hydration, refresh user profile (or owner if company acting), THEN set ready ── */
  useEffect(() => {
    if (!isHydrated || initDone.current) return;
    initDone.current = true;

    const finish = () => setIsReady(true);

    const actingAsCompany = isCompanyActingMode();
    const company = getCompanyFromStorage();
    const ownerUserId = getOwnerUserId();

    if (actingAsCompany) {
      if (company && canCompanyActAsUser(company) && ownerUserId) {
        UserService.fetchProfile(ownerUserId, ownerUserId)
          .then((res) => {
            if (res.status && res.data) {
              setUser(res.data);
            } else {
              disableCompanyActingMode();
            }
          })
          .catch(() => {
            disableCompanyActingMode();
          })
          .finally(finish);
      } else {
        disableCompanyActingMode();
        finish();
      }
    } else if (isAuthenticated && user?.id) {
      // Normal user session — refresh profile
      UserService.fetchProfile(user.id, user.id)
        .then((res) => {
          if (res.status && res.data) {
            setUser(res.data);
          }
        })
        .catch(() => {})
        .finally(finish);
    } else {
      finish();
    }
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 3. Route guard — runs after ready and on every pathname / user change ── */
  useEffect(() => {
    if (!isReady) return;

    const pub = isPublic(pathname);
    const onb = isOnboarding(pathname);
    const companyAdmin = isCompanyAdminPath(pathname);
    const companyPublic = isCompanyPublicProfile(pathname);
    const companySession = hasCompanySession();

    /* ── Company admin zone (dashboard, jobs, applications, profile, auth) ── */
    if (companyAdmin) {
      // Company login page: if already in company session, go to dashboard
      if (pathname === "/company/auth" || pathname.startsWith("/company/auth/")) {
        if (companySession) router.replace("/company/dashboard");
        return;
      }
      // Other company admin pages need company session
      if (!companySession) {
        router.replace("/company/auth");
      }
      return;
    }

    /* ── Public company profile (/company/123, /company/123/...) ── */
    if (companyPublic) {
      // Accessible to either an ITGA user OR a company owner viewing own page
      if (!isAuthenticated && !companySession) {
        router.replace("/auth");
      }
      return;
    }

    /* ── Pure public path (/auth) ── */
    if (pub) {
      if (isAuthenticated && user && getOnboardingStep(user) === "complete") {
        router.replace("/feed");
      }
      return;
    }

    /* ── Everything else: requires ITGA user session ── */
    if (!isAuthenticated) {
      // Exception: company in acting mode can access user-facing pages
      // (interactions will work if owner_user_id was resolved above)
      if (isCompanyActingMode() && hasCompanySession()) return;
      if (companySession) {
        router.replace("/company/dashboard");
        return;
      }
      router.replace("/auth");
      return;
    }

    if (user) {
      const step = getOnboardingStep(user);
      if (step !== "complete") {
        const target = STEP_ROUTES[step];
        if (pathname !== target) router.replace(target);
        return;
      }
      if (onb) {
        router.replace("/feed");
        return;
      }
    }
  }, [isReady, isAuthenticated, user, pathname, router]);

  /* ── Splash / Loading screen ── */
  if (!isReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-card">
        <div className="flex flex-col items-center gap-6 animate-[fadeIn_0.5s_ease-out]">
          <Image
            src="/itga_logo.png"
            alt="ITGA"
            width={140}
            height={84}
            className="object-contain animate-pulse"
            style={{ height: "auto" }}
            priority
          />
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2AABAB] animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#2AABAB] animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#2AABAB] animate-bounce" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
