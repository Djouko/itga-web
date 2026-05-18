"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Briefcase,
  Film,
  Headphones,
  MessageCircle,
  MoreHorizontal,
  Newspaper,
  Plus,
  Search,
  Settings,
  User,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation, useUIStore } from "@/lib/store";
import type { TranslationKey } from "@/lib/i18n";

type MobileNavItem = {
  href: string;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  badge?: number;
};

const primaryItems: MobileNavItem[] = [
  { href: "/feed", labelKey: "nav.feed", icon: Newspaper },
  { href: "/rooms", labelKey: "nav.rooms", icon: Users },
  { href: "/chats", labelKey: "nav.messages", icon: MessageCircle },
];

const secondaryItemsBase: Omit<MobileNavItem, "badge">[] = [
  { href: "/reels", labelKey: "nav.reels", icon: Film },
  { href: "/spaces", labelKey: "nav.spaces", icon: Headphones },
  { href: "/jobs", labelKey: "nav.jobs", icon: Briefcase },
  { href: "/notifications", labelKey: "nav.notifications", icon: Bell },
  { href: "/search", labelKey: "nav.search", icon: Search },
  { href: "/profile", labelKey: "nav.profile", icon: User },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const notifCount = useUIStore((s) => s.notifCount);
  const [moreOpen, setMoreOpen] = useState(false);

  const secondaryItems = useMemo<MobileNavItem[]>(
    () =>
      secondaryItemsBase.map((item) => ({
        ...item,
        badge: item.href === "/notifications" ? notifCount : undefined,
      })),
    [notifCount]
  );

  const isMoreActive = secondaryItems.some((item) => isActivePath(pathname, item.href));

  useEffect(() => {
    if (!moreOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-black/[0.35] backdrop-blur-[2px]" onClick={() => setMoreOpen(false)} />
      )}

      <div
        className={cn(
          "fixed left-3 right-3 z-50 rounded-[22px] border border-white/10 bg-[#0d1117]/95 p-3 shadow-[0_22px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl transition-all duration-200 lg:hidden",
          moreOpen
            ? "bottom-[calc(78px+env(safe-area-inset-bottom,0px))] translate-y-0 opacity-100"
            : "pointer-events-none bottom-[calc(72px+env(safe-area-inset-bottom,0px))] translate-y-3 opacity-0"
        )}
        role="dialog"
        aria-label={t("nav.more")}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/[0.55]">{t("nav.more")}</p>
            <p className="text-sm font-bold text-white">ITGA</p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/70 transition-colors active:scale-95"
            onClick={() => setMoreOpen(false)}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {secondaryItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "relative flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border text-center transition-all active:scale-[0.98]",
                  active
                    ? "border-primary/[0.55] bg-primary/[0.22] text-white shadow-[0_10px_24px_rgba(42,171,171,0.18)]"
                    : "border-white/[0.14] bg-white/[0.075] text-white/[0.9]"
                )}
              >
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", active ? "bg-primary text-white" : "bg-white/[0.1] text-white/[0.88]")}>
                  <Icon size={17} strokeWidth={active ? 2.3 : 1.8} className={active ? "text-white" : "text-white/[0.88]"} />
                </span>
                <span className="max-w-full px-1 text-[11px] font-bold leading-tight text-white">{t(item.labelKey)}</span>
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-magenta px-1 text-[10px] font-black text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom lg:hidden"
        style={{
          background: "rgba(13,17,23,0.94)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
        }}
        aria-label="Navigation mobile"
      >
        <div className="grid grid-cols-5 items-end border-t border-white/[0.06] px-2 pb-1 pt-2">
          {primaryItems.slice(0, 2).map((item) => (
            <MobileNavLink key={item.href} item={item} pathname={pathname} label={t(item.labelKey)} />
          ))}

          <Link href="/create" className="flex flex-col items-center -mt-5" aria-label={t("nav.create")} onClick={() => setMoreOpen(false)}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-cyan text-white shadow-lg shadow-primary/25 transition-all duration-200 active:scale-90">
              <Plus size={26} strokeWidth={2.5} />
            </div>
            <span className="sr-only">{t("nav.create")}</span>
          </Link>

          <MobileNavLink item={primaryItems[2]} pathname={pathname} label={t(primaryItems[2].labelKey)} />

          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className="relative flex min-w-0 flex-col items-center gap-1 py-1 text-[10px] transition-all active:scale-[0.98]"
            aria-expanded={moreOpen}
            aria-label={t("nav.more")}
          >
            <span className={cn("h-1 w-1 rounded-full", isMoreActive || moreOpen ? "bg-primary" : "bg-transparent")} />
            <MoreHorizontal size={22} strokeWidth={isMoreActive || moreOpen ? 2.1 : 1.55} className={cn(isMoreActive || moreOpen ? "text-white" : "text-text-light/[0.65]")} />
            <span className={cn("max-w-full truncate px-0.5", isMoreActive || moreOpen ? "font-semibold text-white" : "font-normal text-text-light/[0.65]")}>{t("nav.more")}</span>
            {notifCount > 0 && (
              <span className="absolute right-1 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-magenta px-1 text-[10px] font-black text-white">
                {notifCount > 99 ? "99+" : notifCount}
              </span>
            )}
          </button>
        </div>
      </nav>
    </>
  );
}

function MobileNavLink({ item, pathname, label }: { item: MobileNavItem; pathname: string; label: string }) {
  const Icon = item.icon;
  const active = isActivePath(pathname, item.href);

  return (
    <Link href={item.href} className="flex min-w-0 flex-col items-center gap-1 py-1" aria-label={label}>
      <span className={cn("h-1 w-1 rounded-full transition-colors duration-200", active ? "bg-primary" : "bg-transparent")} />
      <Icon
        size={22}
        strokeWidth={active ? 2.1 : 1.55}
        className={cn("transition-all duration-200", active ? "scale-105 text-white" : "text-text-light/[0.65]")}
      />
      <span className={cn("max-w-full truncate px-0.5 text-[10px] transition-colors duration-200", active ? "font-semibold text-white" : "font-normal text-text-light/[0.65]")}>
        {label}
      </span>
    </Link>
  );
}
