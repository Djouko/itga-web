"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Newspaper,
  Users,
  Film,
  MessageCircle,
  User,
  Bell,
  Search,
  Settings,
  Plus,
  LogOut,
  Briefcase,
  Headphones,
  MoreHorizontal,
  Sun,
  Moon,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore, useUIStore, useThemeStore, useTranslation } from "@/lib/store";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { UserService } from "@/lib/services/user-service";
import { getWebDeviceToken } from "@/lib/device-token";
import { clearApiAuthToken } from "@/lib/api-auth-token";
import type { Company } from "@/lib/types";
import {
  canCompanyActAsUser,
  companyModeEventName,
  disableCompanyActingMode,
  enableCompanyActingMode,
  getActingCompanyId,
  getCompanyFromStorage,
} from "@/lib/company-acting";

const navItems = [
  { href: "/feed", labelKey: "nav.feed", icon: Newspaper },
  { href: "/rooms", labelKey: "nav.rooms", icon: Users },
  { href: "/reels", labelKey: "nav.reels", icon: Film },
  { href: "/chats", labelKey: "nav.messages", icon: MessageCircle },
  { href: "/spaces", labelKey: "nav.spaces", icon: Headphones },
  { href: "/jobs", labelKey: "nav.jobs", icon: Briefcase },
  { href: "/notifications", labelKey: "nav.notifications", icon: Bell },
  { href: "/search", labelKey: "nav.search", icon: Search },
  { href: "/profile", labelKey: "nav.profile", icon: User },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
] as const;

function extractUnreadCount(payload: unknown): number {
  if (typeof payload === "number") return Number.isFinite(payload) ? payload : 0;
  if (!payload || typeof payload !== "object") return 0;

  const data = payload as Record<string, unknown>;
  const candidates = [
    data.count,
    data.unread_count,
    (data.data as Record<string, unknown> | undefined)?.count,
    (data.data as Record<string, unknown> | undefined)?.unread_count,
  ];

  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, updateUser, setUser } = useAuthStore();
  const notifCount = useUIStore((s) => s.notifCount);
  const setNotifCount = useUIStore((s) => s.setNotifCount);
  const { mode: themeMode, setMode: setThemeMode } = useThemeStore();
  const { t } = useTranslation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [companySession, setCompanySession] = useState<Company | null>(null);
  const [actingCompanyId, setActingCompanyId] = useState<number | null>(null);
  const canActAsCompany = canCompanyActAsUser(companySession);

  const toggleTheme = () => {
    setThemeMode(themeMode === "dark" ? "light" : "dark");
  };

  useEffect(() => {
    if (!user) return;

    let mounted = true;
    const fetchCount = async () => {
      try {
        const res = await UserService.fetchUnreadNotificationCount(user.id, actingCompanyId ?? undefined);
        if (!mounted || !res.status) return;
        const previousCount = useUIStore.getState().notifCount;
        const count = extractUnreadCount(res.data);
        setNotifCount(count);

        if (
          typeof window !== "undefined" &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          count > previousCount
        ) {
          const delta = count - previousCount;
          const plural = delta > 1 ? "s" : "";
          const notif = new Notification("ITGA - Nouvelles notifications", {
            body: `Vous avez ${delta} nouvelle${plural} notification${plural}.`,
            icon: "/itga_logo.png",
          });
          notif.onclick = () => {
            window.focus();
            window.location.href = "/notifications";
          };
        }
      } catch {
        // keep previous badge count on transient network errors
      }
    };

    fetchCount();
    const timer = setInterval(fetchCount, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [user, actingCompanyId, setNotifCount]);

  useEffect(() => {
    const syncMode = () => {
      setCompanySession(getCompanyFromStorage());
      setActingCompanyId(getActingCompanyId());
    };
    syncMode();
    window.addEventListener("storage", syncMode);
    window.addEventListener(companyModeEventName(), syncMode);
    return () => {
      window.removeEventListener("storage", syncMode);
      window.removeEventListener(companyModeEventName(), syncMode);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = getWebDeviceToken();
    if (user.device_token === token) return;

    UserService.editProfile(user.id, { device_token: token, device_type: 2 })
      .then(() => {
        updateUser({ device_token: token, device_type: 2 });
      })
      .catch(() => {
        // keep app usable even if token sync fails
      });
  }, [user, updateUser]);

  const handleLogout = async () => {
    if (user) {
      try {
        await UserService.logOut(user.id);
      } catch {
        /* ignore */
      }
    }
    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }
    clearApiAuthToken();
    disableCompanyActingMode();
    setActingCompanyId(null);
    logout();
  };

  const activateCompanyFeedMode = async () => {
    if (!companySession?.id || !canActAsCompany || !companySession.owner_user_id) return;
    try {
      const ownerId = companySession.owner_user_id;
      const res = await UserService.fetchProfile(ownerId, ownerId);
      if (res.status && res.data) {
        setUser(res.data);
        enableCompanyActingMode(companySession.id);
        setActingCompanyId(companySession.id);
      } else {
        throw new Error(res.message || "owner-profile-missing");
      }
    } catch {
      window.alert("Impossible de charger le profil ITGA associe a cette entreprise.");
    }
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[var(--sidebar-width)] bg-card border-r border-border/20 flex flex-col z-40">
      {/* ITGA Logo */}
      <Link href="/feed" className="px-4 py-2.5 flex items-center gap-2 group">
        <img
          src="/itga_logo.png"
          alt="ITGA"
          className="h-11 w-auto object-contain group-hover:scale-[1.03] transition-transform duration-300"
        />
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1 space-y-0 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          const label = t(item.labelKey as Parameters<typeof t>[0]);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 group relative",
                isActive
                  ? "bg-primary/8 text-primary font-semibold"
                  : "text-text-dark/80 hover:bg-bg-light/60 hover:text-text-main"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-gradient-to-b from-primary to-cyan rounded-r-full" />
              )}
              <Icon
                size={17}
                strokeWidth={isActive ? 2.2 : 1.7}
                className={cn(
                  "shrink-0 transition-all duration-200",
                  isActive ? "text-primary" : "text-icon-light group-hover:text-text-dark group-hover:scale-105"
                )}
              />
              <span className="flex-1">{label}</span>
              {item.href === "/notifications" && notifCount > 0 && (
                <span
                  className="animate-number-pop inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-gradient-to-br from-magenta via-red to-orange px-1.5 text-[10px] font-black leading-none text-white shadow-[0_6px_16px_rgba(198,33,104,0.30),0_0_0_3px_rgba(198,33,104,0.12)] ring-1 ring-white/25"
                  aria-label={`${notifCount} notification${notifCount > 1 ? "s" : ""} non lue${notifCount > 1 ? "s" : ""}`}
                >
                  {notifCount > 99 ? "99+" : notifCount}
                </span>
              )}
              {item.href === "/chats" && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}

        {/* Create Button */}
        <div className="pt-3 px-1">
          <Link
            href="/create"
            className="flex items-center justify-center gap-2 w-full h-9 bg-gradient-to-r from-primary to-cyan text-white rounded-full font-semibold text-[13px] hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 active:scale-[0.98]"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>{t("nav.create")}</span>
          </Link>
          {companySession?.id && (
            <div className="mt-2 space-y-1.5">
              {actingCompanyId === companySession.id ? (
                <>
                  <button
                    onClick={() => {
                      disableCompanyActingMode();
                      setActingCompanyId(null);
                    }}
                    className="w-full h-8 px-3 rounded-lg text-left text-[12px] font-medium cursor-pointer"
                    style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}
                  >
                    Mode entreprise actif
                  </button>
                  <Link
                    href="/company/dashboard"
                    onClick={() => {
                      disableCompanyActingMode();
                      setActingCompanyId(null);
                    }}
                    className="flex items-center justify-between h-8 px-3 rounded-lg text-[12px] font-medium"
                    style={{ color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)" }}
                  >
                    Retour dashboard entreprise
                  </Link>
                </>
              ) : (
                <button
                  onClick={activateCompanyFeedMode}
                  disabled={!canActAsCompany}
                  className="w-full h-8 px-3 rounded-lg text-left text-[12px] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)" }}
                  title={canActAsCompany ? undefined : "Associez cette entreprise a un compte ITGA pour agir sur le feed."}
                >
                  {canActAsCompany ? "Activer mode entreprise (feed)" : "Compte ITGA requis pour le feed"}
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Theme Toggle */}
      <div className="px-3 pb-1 border-t border-border/20">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-[13px] font-medium text-text-dark/80 hover:bg-bg-light/60 hover:text-text-main transition-all duration-200 cursor-pointer mt-1 group"
          title={themeMode === "dark" ? t("nav.lightMode") : t("nav.darkMode")}
        >
          {themeMode === "dark" ? (
            <Sun size={20} strokeWidth={1.7} className="text-gold shrink-0 group-hover:rotate-45 transition-transform duration-300" />
          ) : (
            <Moon size={20} strokeWidth={1.7} className="text-icon-light shrink-0 group-hover:-rotate-12 transition-transform duration-300" />
          )}
          <span>{themeMode === "dark" ? t("nav.lightMode") : t("nav.darkMode")}</span>
        </button>
      </div>

      {/* User Profile Card */}
      {user && (
        <div className="px-2 py-2 border-t border-border/20 relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 w-full p-2 rounded-xl hover:bg-bg-light/60 transition-all duration-200 cursor-pointer group"
          >
            <Avatar
              src={user.profile}
              alt={user.full_name}
              size={32}
              isVerified={user.is_verified >= 2}
            />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[12px] font-semibold text-text-main truncate">
                {user.full_name}
              </p>
              <p className="text-[11px] text-text-light truncate">
                @{user.username}
              </p>
            </div>
            <MoreHorizontal size={14} className="text-text-light shrink-0" />
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute bottom-full left-3 right-3 mb-2 z-50 card-elevated py-1 rounded-xl animate-scaleIn">
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-main hover:bg-bg-light/60 transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <User size={16} className="text-icon-light" />
                  {t("nav.profile")}
                </Link>
                {actingCompanyId && companySession?.id === actingCompanyId && (
                  <Link
                    href={`/company/${companySession.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-main hover:bg-bg-light/60 transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Building2 size={16} className="text-cyan" />
                    Page entreprise
                  </Link>
                )}
                <Link
                  href="/settings"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-main hover:bg-bg-light/60 transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings size={16} className="text-icon-light" />
                  {t("nav.settings")}
                </Link>
                <div className="my-1 border-t border-border/30" />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red hover:bg-red/5 transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                  {t("settings.logout")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
