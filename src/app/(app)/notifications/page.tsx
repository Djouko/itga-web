"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Heart, MessageCircle, UserPlus, Repeat2, AtSign, Bell,
  Loader2, Megaphone, Building2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Tabs } from "@/components/ui/tabs";
import { useAuthStore, useUIStore, useTranslation, type TranslationKey } from "@/lib/store";
import { UserService } from "@/lib/services/user-service";
import { CommonService } from "@/lib/services/common-service";
import { companyModeEventName, getActingCompanyId } from "@/lib/company-acting";
import type { SavedNotification } from "@/lib/types";
import { addBaseURL, formatTimeAgo, cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const USER_NOTIFS_CACHE_KEY = "itga-user-notifs-cache";
const PLATFORM_NOTIFS_CACHE_KEY = "itga-platform-notifs-cache";

const notifTabs = (t: (k: TranslationKey) => string) => [
  { id: "user", label: t("notif.tabUser") },
  { id: "platform", label: t("notif.tabPlatform") },
];

/* Notification type constants (match backend Constants.php) */
const NOTIF_TYPE = {
  FOLLOW: 1,
  COMMENT_POST: 2,
  LIKE_POST: 3,
  ROOM_INVITE: 4,
  ROOM_INVITE_ACCEPTED: 5,
  ROOM_JOIN_REQUEST: 6,
  ROOM_JOIN_DIRECT: 7,
  ROOM_JOIN_ACCEPTED: 8,
  LIKE_REEL: 9,
  COMMENT_REEL: 10,
  MENTION_POST: 11,
  MENTION_COMMENT: 12,
  MENTION_REEL_COMMENT: 13,
  MENTION_REEL: 14,
  REPOST: 15,
  FOLLOW_ACCEPTED: -1,
  FOLLOW_REQUEST: -2,
  LIKE_COMMENT: -3,
};

function getNotifStyle(type: number): { icon: React.ReactNode; color: string; bg: string; text: string } {
  switch (type) {
    case NOTIF_TYPE.FOLLOW:
    case NOTIF_TYPE.FOLLOW_ACCEPTED:
    case NOTIF_TYPE.FOLLOW_REQUEST:
      return { icon: <UserPlus size={14} />, color: "text-primary", bg: "bg-primary/10", text: "a commencé à vous suivre" };
    case NOTIF_TYPE.LIKE_POST:
      return { icon: <Heart size={14} fill="currentColor" />, color: "text-magenta", bg: "bg-magenta/10", text: "a aimé votre publication" };
    case NOTIF_TYPE.LIKE_REEL:
      return { icon: <Heart size={14} fill="currentColor" />, color: "text-magenta", bg: "bg-magenta/10", text: "a aimé votre reel" };
    case NOTIF_TYPE.LIKE_COMMENT:
      return { icon: <Heart size={14} fill="currentColor" />, color: "text-magenta", bg: "bg-magenta/10", text: "a aimé votre commentaire" };
    case NOTIF_TYPE.COMMENT_POST:
      return { icon: <MessageCircle size={14} />, color: "text-navy", bg: "bg-navy/10", text: "a commenté votre publication" };
    case NOTIF_TYPE.COMMENT_REEL:
      return { icon: <MessageCircle size={14} />, color: "text-navy", bg: "bg-navy/10", text: "a commenté votre reel" };
    case NOTIF_TYPE.REPOST:
      return { icon: <Repeat2 size={14} />, color: "text-green", bg: "bg-green/10", text: "a repartagé votre publication" };
    case NOTIF_TYPE.ROOM_INVITE:
      return { icon: <UserPlus size={14} />, color: "text-cyan", bg: "bg-cyan/10", text: "vous a invité dans un salon" };
    case NOTIF_TYPE.MENTION_POST:
      return { icon: <AtSign size={14} />, color: "text-orange", bg: "bg-orange/10", text: "vous a mentionné dans un post" };
    case NOTIF_TYPE.MENTION_COMMENT:
    case NOTIF_TYPE.MENTION_REEL_COMMENT:
      return { icon: <AtSign size={14} />, color: "text-orange", bg: "bg-orange/10", text: "vous a mentionné dans un commentaire" };
    default:
      return { icon: <Bell size={14} />, color: "text-text-light", bg: "bg-bg-light", text: "notification" };
  }
}

function getNotifLink(notif: SavedNotification): string {
  if (notif.post_id) return `/post/${notif.post_id}`;
  if (notif.reel_id) return `/reels?id=${notif.reel_id}`;
  if (notif.company_id) return `/company/${notif.company_id}`;
  if (notif.user_id) return `/profile/${notif.user_id}`;
  return "#";
}

interface PlatformNotification {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

function safeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

export default function NotificationsPage() {
  const { user: me } = useAuthStore();
  const setNotifCount = useUIStore((s) => s.setNotifCount);
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("user");
  const [notifications, setNotifications] = useState<SavedNotification[]>([]);
  const [platformNotifs, setPlatformNotifs] = useState<PlatformNotification[]>([]);
  const [actingCompanyId, setActingCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<HTMLDivElement>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return "unsupported";
    }
    return Notification.permission;
  });

  const enableBrowserNotifications = useCallback(async () => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === "granted") {
        new Notification("ITGA", {
          body: "Les notifications navigateur sont maintenant activées.",
          icon: "/itga_logo.png",
        });
      }
    } catch {
      // no-op
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (!me) return;
    try {
      const res = await UserService.markNotificationsAsRead(me.id, actingCompanyId ?? undefined);
      if (res.status) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
        setNotifCount(0);
      }
    } catch {
      // no-op
    }
  }, [me, actingCompanyId, setNotifCount]);

  useEffect(() => {
    const syncMode = () => setActingCompanyId(getActingCompanyId());
    syncMode();
    window.addEventListener("storage", syncMode);
    window.addEventListener(companyModeEventName(), syncMode);
    return () => {
      window.removeEventListener("storage", syncMode);
      window.removeEventListener(companyModeEventName(), syncMode);
    };
  }, []);

  // Fetch user notifications
  const fetchNotifications = useCallback(async (start: number) => {
    if (!me) return;
    const isFirst = start === 0;
    if (isFirst) setLoading(true); else setLoadingMore(true);

    const cacheKey = `${USER_NOTIFS_CACHE_KEY}:${actingCompanyId ? `company:${actingCompanyId}` : `user:${me.id}`}`;
    const res = await UserService.fetchUserNotification(me.id, start, PAGE_SIZE, actingCompanyId ?? undefined);
    if (res.status) {
      const newNotifs = safeArray<SavedNotification>(res.data);
      setNotifications((prev) => {
        const merged = isFirst ? newNotifs : [...prev, ...newNotifs];
        // Sync unread count to UIStore (only on first page load)
        if (isFirst) {
          const unread = merged.filter((n) => n.is_read === 0).length;
          setNotifCount(unread);
        }
        if (typeof window !== "undefined") {
          localStorage.setItem(cacheKey, JSON.stringify(merged));
        }
        return merged;
      });
      setHasMore(newNotifs.length >= PAGE_SIZE);
    } else if (isFirst && typeof window !== "undefined") {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        try {
          const cached = safeArray<SavedNotification>(JSON.parse(raw));
          setNotifications(cached);
          setHasMore(false);
          const unread = cached.filter((n) => n.is_read === 0).length;
          setNotifCount(unread);
        } catch {
          // ignore cache parse errors
        }
      }
    }
    if (isFirst) setLoading(false); else setLoadingMore(false);
  }, [me, actingCompanyId, setNotifCount]);

  // Fetch platform notifications
  const fetchPlatformNotifications = useCallback(async () => {
    if (!me) return;
    const res = await CommonService.fetchPlatformNotifications(0, 20);
    if (res.status) {
      const parsed = safeArray<PlatformNotification>(res.data);
      setPlatformNotifs(parsed);
      if (typeof window !== "undefined") {
        localStorage.setItem(PLATFORM_NOTIFS_CACHE_KEY, JSON.stringify(parsed));
      }
    } else if (typeof window !== "undefined") {
      const raw = localStorage.getItem(PLATFORM_NOTIFS_CACHE_KEY);
      if (raw) {
        try {
          const cached = safeArray<PlatformNotification>(JSON.parse(raw));
          setPlatformNotifs(cached);
        } catch {
          // ignore cache parse errors
        }
      }
    }
  }, [me]);

  // Initial load
  useEffect(() => {
    if (!me?.id) return;
    const timer = window.setTimeout(() => {
      fetchNotifications(0);
      fetchPlatformNotifications();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [me?.id, actingCompanyId, fetchNotifications, fetchPlatformNotifications]);

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchNotifications(notifications.length);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, notifications.length, fetchNotifications]);

  if (!me) return null;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h1 className="text-lg font-bold text-text-main">{t("notif.title")}</h1>
          <div className="flex items-center gap-2">
            {notifPermission === "default" && (
              <button
                onClick={enableBrowserNotifications}
                className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors cursor-pointer"
              >
                Activer le push navigateur
              </button>
            )}
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors cursor-pointer"
            >
              {t("notif.markRead")}
            </button>
          </div>
        </div>
        <div className="px-4 pb-3">
          <Tabs tabs={notifTabs(t)} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {/* User Notifications */}
      {activeTab === "user" && (
        <div className="card overflow-hidden">
          {loading ? (
            <NotifSkeleton />
          ) : notifications.length === 0 ? (
            <EmptyNotif />
          ) : (
            <>
              {notifications.map((notif) => {
                const style = getNotifStyle(notif.type);
                const link = getNotifLink(notif);
                const actorName = notif.company?.name ?? notif.user?.full_name ?? t("notif.unknownUser");
                const actorProfile = notif.company?.logo ?? notif.user?.profile ?? null;
                const profileSrc = actorProfile ? addBaseURL(actorProfile) : null;

                return (
                  <Link
                    key={notif.id}
                    href={link}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3.5 hover:bg-bg-light/50 transition-all duration-200 border-b border-border/20 last:border-b-0 group",
                      notif.is_read === 0 && "bg-primary/[0.04]"
                    )}
                    >
                    <div className="relative shrink-0">
                      <Avatar src={profileSrc} alt={actorName} size={42} />
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${style.bg} ${style.color} flex items-center justify-center border-2 border-card`}>
                        {style.icon}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-main leading-snug">
                        <span className={cn("text-navy inline-flex items-center gap-1", notif.is_read === 0 ? "font-bold" : "font-semibold")}>
                          {actorName}
                          {notif.company && <Building2 size={12} className="text-primary shrink-0" />}
                        </span>{" "}
                        <span className={cn(notif.is_read === 0 ? "text-text-main font-medium" : "text-text-dark")}>{style.text}</span>
                      </p>
                      <span className={cn("text-xs mt-0.5 inline-block", notif.is_read === 0 ? "text-primary font-medium" : "text-text-light")}>
                        {formatTimeAgo(notif.created_at)}
                      </span>
                    </div>
                    {notif.is_read === 0 && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-2 animate-pulse" />
                    )}
                  </Link>
                );
              })}
              <div ref={observerRef} className="h-1" />
              {loadingMore && (
                <div className="flex justify-center py-3">
                  <Loader2 size={18} className="animate-spin text-primary" />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Platform Notifications */}
      {activeTab === "platform" && (
        <div className="card overflow-hidden">
          {platformNotifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Megaphone size={24} className="text-primary" />
              </div>
              <p className="text-sm text-text-light font-medium">Aucune annonce</p>
            </div>
          ) : (
            platformNotifs.map((pn) => (
              <div key={pn.id} className="px-4 py-3.5 border-b border-border/20 last:border-b-0 hover:bg-bg-light/50 transition-colors duration-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Megaphone size={12} className="text-primary" />
                  </span>
                  <span className="text-sm font-bold text-text-main">{pn.title}</span>
                </div>
                <p className="text-sm text-text-dark leading-relaxed">{pn.body}</p>
                <span className="text-xs text-text-light mt-1 inline-block">
                  {formatTimeAgo(pn.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NotifSkeleton() {
  return (
    <div className="divide-y divide-border/20">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3.5 animate-pulse">
          <div className="w-[42px] h-[42px] rounded-full bg-bg-light shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 bg-bg-light rounded w-3/4" />
            <div className="h-2.5 bg-bg-light rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyNotif() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
        <Bell size={24} className="text-primary" />
      </div>
      <p className="text-sm text-text-light font-medium">{t("notif.empty")}</p>
    </div>
  );
}
