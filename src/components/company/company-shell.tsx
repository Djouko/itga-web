"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Briefcase,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronRight,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { addBaseURL } from "@/lib/utils";
import type { Company } from "@/lib/types";
import { UserService } from "@/lib/services/user-service";
import { useAuthStore } from "@/lib/store";
import {
  canCompanyActAsUser,
  disableCompanyActingMode,
  enableCompanyActingMode,
  getCompanyFromStorage,
} from "@/lib/company-acting";

const NAV = [
  { href: "/company/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
  { href: "/company/jobs/new", icon: Briefcase, label: "Publier une offre" },
  { href: "/company/profile/edit", icon: Settings, label: "Profil entreprise" },
] as const;

type NavItem = (typeof NAV)[number];

interface SidebarContentProps {
  company: Company | null;
  logo: string;
  pathname: string;
  onNavigate: (href: string) => void;
  onCompanyAct: (href: string) => void;
  onLogout: () => void;
}

function SidebarContent({ company, logo, pathname, onNavigate, onCompanyAct, onLogout }: SidebarContentProps) {
  const canActAsCompany = canCompanyActAsUser(company);

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div
        className="px-5 pt-6 pb-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-1.5 mb-5">
          <Image
            src="/itga_logo.png"
            alt="ITGA"
            width={72}
            height={38}
            className="object-contain"
            style={{ height: "auto" }}
            priority
          />
          <span
            className="text-[8px] tracking-[0.15em] font-semibold px-1.5 py-0.5 rounded-full border"
            style={{
              color: "rgba(0,229,255,0.7)",
              borderColor: "rgba(0,229,255,0.25)",
              background: "rgba(0,229,255,0.06)",
            }}
          >
            COMPANY
          </span>
        </div>

        {/* Company card */}
        <div
          className="flex items-center gap-3 p-2.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: "rgba(0,229,255,0.1)" }}>
            {logo ? (
              <img src={logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <Building2 size={18} className="text-[#00e5ff]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-white truncate leading-tight">
              {company?.name ?? "Entreprise"}
            </p>
            <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
              {company?.sector ?? "Espace entreprise"}
            </p>
          </div>
          {company?.is_verified === 1 && (
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(0,229,255,0.2)" }}
              title="Compte vérifié"
            >
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2 2 4-4" stroke="#00e5ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item: NavItem) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <button
              key={item.href}
              onClick={() => onNavigate(item.href)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 text-left cursor-pointer",
                active
                  ? "text-white"
                  : "hover:text-white/80"
              )}
              style={
                active
                  ? {
                      background: "linear-gradient(135deg, rgba(0,229,255,0.12), rgba(167,139,250,0.08))",
                      border: "1px solid rgba(0,229,255,0.2)",
                      color: "#fff",
                    }
                  : { color: "rgba(255,255,255,0.45)" }
              }
            >
              <Icon
                size={16}
                strokeWidth={active ? 2.2 : 1.8}
                style={{ color: active ? "#00e5ff" : undefined }}
              />
              <span className="flex-1">{item.label}</span>
              {active && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#00e5ff", boxShadow: "0 0 6px #00e5ff" }}
                />
              )}
            </button>
          );
        })}

        <div className="pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "16px" }}>
          <p className="px-3 pb-2 text-[9px] tracking-[0.12em] font-semibold" style={{ color: "rgba(255,255,255,0.25)" }}>
            ACCÈS RAPIDE
          </p>
          <button
            onClick={() => company?.id && onNavigate(`/company/${company.id}`)}
            disabled={!company?.id}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: "rgba(0,196,212,0.7)", background: "rgba(0,196,212,0.06)", border: "1px solid rgba(0,196,212,0.12)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,196,212,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,196,212,0.06)")}
          >
            <Eye size={13} strokeWidth={1.8} style={{ color: "#00c4d4" }} />
            <span>Voir ma page publique</span>
            <ChevronRight size={11} className="ml-auto" style={{ color: "rgba(0,196,212,0.4)" }} />
          </button>
          <button
            onClick={() => {
              if (company?.id && canActAsCompany) {
                onCompanyAct("/feed");
              }
            }}
            disabled={!company?.id || !canActAsCompany}
            className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ color: "rgba(167,139,250,0.85)", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}
            title={canActAsCompany ? undefined : "Associez cette entreprise a un compte ITGA pour agir sur le feed."}
          >
            <span>Mode entreprise sur le feed</span>
            <ChevronRight size={11} className="ml-auto" style={{ color: "rgba(167,139,250,0.5)" }} />
          </button>
          <button
            onClick={() => {
              if (company?.id && canActAsCompany) {
                onCompanyAct(`/create?mode=company&companyId=${company.id}`);
              }
            }}
            disabled={!company?.id || !canActAsCompany}
            className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: "rgba(16,185,129,0.9)", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}
            title={canActAsCompany ? undefined : "Associez cette entreprise a un compte ITGA pour publier."}
          >
            <span>Publier en tant qu&apos;entreprise</span>
            <ChevronRight size={11} className="ml-auto" style={{ color: "rgba(16,185,129,0.5)" }} />
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer"
          style={{ color: "rgba(239,68,68,0.7)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <LogOut size={15} />
          Déconnexion
        </button>
      </div>
    </div>
  );
}

interface CompanyShellProps {
  children: React.ReactNode;
}

export function CompanyShell({ children }: CompanyShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [company, setCompany] = useState<Company | null>(() => getCompanyFromStorage());
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    if (!company) {
      router.replace("/company/auth");
    }
  }, [company, router]);

  useEffect(() => {
    const onStorage = () => {
      setCompany(getCompanyFromStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const handleLogout = () => {
    disableCompanyActingMode();
    localStorage.removeItem("itga-company");
    router.replace("/company/auth");
  };

  const navigate = (href: string) => {
    setSideOpen(false);
    router.push(href);
  };

  const activateCompanyExperience = async (href: string) => {
    if (!company?.id || !canCompanyActAsUser(company) || !company.owner_user_id) return;
    try {
      const ownerId = company.owner_user_id;
      const res = await UserService.fetchProfile(ownerId, ownerId);
      if (res.status && res.data) {
        setUser(res.data);
      } else {
        throw new Error(res.message || "owner-profile-missing");
      }
      enableCompanyActingMode(company.id);
      navigate(href);
    } catch {
      window.alert("Impossible de charger le profil ITGA associe a cette entreprise. Reconnectez-vous a l'espace entreprise.");
    }
  };

  const logo = addBaseURL(company?.logo);

  return (
    <div className="flex min-h-[100dvh]" style={{ background: "#030a14", color: "#fff" }}>
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-[230px] z-30"
        style={{ background: "#0b1220", borderRight: "1px solid rgba(255,255,255,0.07)" }}
      >
        <SidebarContent company={company} logo={logo} pathname={pathname} onNavigate={navigate} onCompanyAct={activateCompanyExperience} onLogout={handleLogout} />
      </aside>

      {/* Mobile: Backdrop */}
      {sideOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setSideOpen(false)}
        />
      )}

      {/* Mobile: Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-[230px] z-50 lg:hidden flex flex-col transition-transform duration-300",
          sideOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "#0b1220", borderRight: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button
          onClick={() => setSideOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors cursor-pointer"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          <X size={16} />
        </button>
        <SidebarContent company={company} logo={logo} pathname={pathname} onNavigate={navigate} onCompanyAct={activateCompanyExperience} onLogout={handleLogout} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:ml-[230px] min-h-[100dvh]">
        {/* Mobile topbar */}
        <header
          className="flex items-center gap-3 px-4 py-3 lg:hidden sticky top-0 z-20"
          style={{
            background: "rgba(11,18,32,0.95)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <button onClick={() => setSideOpen(true)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Menu size={18} />
          </button>
          <span className="text-[14px] font-bold text-white truncate">
            {company?.name ?? "Company Hub"}
          </span>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
