"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, CheckCheck, MessageCircle, Users, Trash2, X,
  MailOpen, MailWarning, EllipsisVertical,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Tabs } from "@/components/ui/tabs";
import { useAuthStore, useTranslation } from "@/lib/store";
import { ChatService } from "@/lib/services/chat-service";
import type { ChatRoom } from "@/lib/types";
import { formatTimeAgo, addBaseURL } from "@/lib/utils";

// chatTabs is built dynamically using t() inside the component

export default function ChatsPage() {
  const router = useRouter();
  const { user: me } = useAuthStore();
  const { t } = useTranslation();

  const chatTabs = [
    { id: "discussions", label: t("chats.tabDiscussions") },
    { id: "requests", label: t("chats.tabRequests") },
    { id: "rooms", label: t("chats.tabRooms") },
  ];
  const [activeTab, setActiveTab] = useState("discussions");
  const [searchQuery, setSearchQuery] = useState("");
  const [userChats, setUserChats] = useState<ChatRoom[]>([]);
  const [roomChats, setRoomChats] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time chat lists
  useEffect(() => {
    if (!me) return;
    setLoading(true);
    let loaded = 0;
    const checkLoaded = () => { loaded++; if (loaded >= 2) setLoading(false); };

    const unsubUser = ChatService.subscribeToUserChats(me.id, (chats) => {
      setUserChats(chats);
      checkLoaded();
    });
    const unsubRoom = ChatService.subscribeToRoomChats(me.id, (chats) => {
      setRoomChats(chats);
      checkLoaded();
    });

    return () => { unsubUser(); unsubRoom(); };
  }, [me]);

  // Filter by search + tab
  const acceptedChats = userChats.filter((c) => c.type === 1);
  const requestChats = userChats.filter((c) => c.type === 0);

  const getFilteredList = (): ChatRoom[] => {
    let list: ChatRoom[] = [];
    if (activeTab === "discussions") list = acceptedChats;
    else if (activeTab === "requests") list = requestChats;
    else list = roomChats;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((c) => c.title?.toLowerCase().includes(q));
  };

  const filteredChats = getFilteredList();

  // Badge counts
  const requestCount = requestChats.length;
  const unreadRoomCount = roomChats.filter((c) => (c.newMsgCount ?? 0) > 0).length;

  const openChat = (chat: ChatRoom) => {
    if (!me) return;
    const convId = chat.conversationId ?? "";
    const params = new URLSearchParams({
      type: String(chat.type ?? 1),
      otherId: String(chat.userIdOrRoomId ?? 0),
      title: chat.title ?? "",
      img: chat.profileImage ?? "",
    });
    if (chat.profileType) params.set("profileType", chat.profileType);
    if (chat.companyId) params.set("companyId", String(chat.companyId));
    router.push(`/chats/${convId}?${params.toString()}`);
  };

  // Context menu
  const [menuChat, setMenuChat] = useState<ChatRoom | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuChat(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClear = async (chat: ChatRoom) => {
    if (!me) return;
    setMenuChat(null);
    if (chat.type === 2) {
      await ChatService.clearRoomChat(chat.conversationId ?? "", me.id);
    } else {
      await ChatService.clearUserChat(me.id, chat.userIdOrRoomId ?? 0);
    }
  };

  const handleDelete = async (chat: ChatRoom) => {
    if (!me || !confirm("Supprimer cette conversation ?")) return;
    setMenuChat(null);
    if (chat.type === 2) {
      await ChatService.deleteRoomChat(chat.conversationId ?? "", me.id);
    } else {
      await ChatService.deleteUserChat(me.id, chat.userIdOrRoomId ?? 0);
    }
  };

  const handleToggleMark = async (chat: ChatRoom) => {
    if (!me) return;
    setMenuChat(null);
    const count = chat.newMsgCount ?? 0;
    if (chat.type === 2) {
      await ChatService.toggleMarkRoomChat(chat.conversationId ?? "", me.id, count);
    } else {
      await ChatService.toggleMarkUserChat(me.id, chat.userIdOrRoomId ?? 0, count);
    }
  };

  if (!me) return null;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header Card */}
      <div className="card">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-lg font-bold text-text-main">{t("chats.title")}</h1>
        </div>
        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light" />
            <input
              type="text"
              placeholder={t("chats.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-bg-light border border-transparent text-sm focus:outline-none focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/10 transition-all duration-200"
            />
          </div>
        </div>
        {/* Tabs */}
        <div className="px-4 pb-3">
          <Tabs
            tabs={chatTabs.map((tab) => ({
              ...tab,
              label: tab.id === "requests" && requestCount > 0
                ? `${tab.label} (${requestCount})`
                : tab.id === "rooms" && unreadRoomCount > 0
                  ? `${tab.label} (${unreadRoomCount})`
                  : tab.label,
            }))}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="card divide-y divide-border/20 overflow-hidden">
        {loading ? (
          <ChatsSkeleton />
        ) : filteredChats.length === 0 ? (
          <EmptyChats tab={activeTab} />
        ) : (
          filteredChats.map((chat) => (
            <ChatRow
              key={`${chat.type}-${chat.conversationId}`}
              chat={chat}
              isMenuOpen={menuChat?.conversationId === chat.conversationId}
              onOpen={() => openChat(chat)}
              onMenuToggle={() => setMenuChat(menuChat?.conversationId === chat.conversationId ? null : chat)}
              onClear={() => handleClear(chat)}
              onDelete={() => handleDelete(chat)}
              onToggleMark={() => handleToggleMark(chat)}
              menuRef={menuChat?.conversationId === chat.conversationId ? menuRef : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CHAT ROW
   ═══════════════════════════════════════════════════ */
function ChatRow({
  chat, isMenuOpen, onOpen, onMenuToggle, onClear, onDelete, onToggleMark, menuRef,
}: {
  chat: ChatRoom;
  isMenuOpen: boolean;
  onOpen: () => void;
  onMenuToggle: () => void;
  onClear: () => void;
  onDelete: () => void;
  onToggleMark: () => void;
  menuRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const unread = (chat.newMsgCount ?? 0) > 0;
  const isRoom = chat.type === 2;
  const isRequest = chat.type === 0;
  const profileSrc = chat.profileImage ? addBaseURL(chat.profileImage) : null;

  return (
    <div className="relative group">
      <div
        onClick={onOpen}
        className="flex items-center gap-3 px-4 py-3 hover:bg-bg-light/50 transition-all duration-200 cursor-pointer active:scale-[0.99]"
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          {isRoom ? (
            <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-br from-primary/15 to-cyan/15 flex items-center justify-center overflow-hidden ring-2 ring-border/10">
              {profileSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileSrc} alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                <Users size={22} className="text-primary" />
              )}
            </div>
          ) : (
            <Avatar src={profileSrc} alt={chat.title ?? ""} size={50} />
          )}
          {isRequest && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange flex items-center justify-center">
              <MailWarning size={10} className="text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <h3 className={`text-sm truncate transition-colors duration-200 ${unread ? "font-bold text-navy" : "font-semibold text-text-main"}`}>
              {chat.title || "Conversation"}
            </h3>
            <span className={`text-xs shrink-0 ml-2 transition-colors duration-200 ${unread ? "text-primary font-semibold" : "text-text-light"}`}>
              {chat.time ? formatTimeAgo(chat.time.toISOString()) : ""}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <p className={`text-xs truncate pr-2 transition-colors duration-200 ${unread ? "text-text-main font-medium" : "text-text-light"}`}>
              {chat.lastMsg || "Aucun message"}
            </p>
            {unread ? (
              <span className="ml-auto w-5 h-5 rounded-full bg-gradient-to-br from-magenta to-magenta/80 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm shadow-magenta/20">
                {chat.newMsgCount! > 99 ? "99+" : chat.newMsgCount}
              </span>
            ) : chat.lastMsg ? (
              <CheckCheck size={14} className="ml-auto text-primary shrink-0" />
            ) : null}
          </div>
        </div>

        {/* Menu button */}
        <button
          onClick={(e) => { e.stopPropagation(); onMenuToggle(); }}
          className="w-8 h-8 rounded-full hover:bg-bg-light flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
        >
          <EllipsisVertical size={16} className="text-text-light" />
        </button>
      </div>

      {/* Context menu */}
      {isMenuOpen && (
        <div ref={menuRef} className="absolute right-4 top-12 z-50 bg-card rounded-xl shadow-xl border border-border/40 py-1 min-w-[180px] animate-fadeIn ring-1 ring-black/5">
          <button onClick={onToggleMark} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-main hover:bg-bg-light/70 transition-colors cursor-pointer">
            <MailOpen size={15} className="text-text-light" />
            {(chat.newMsgCount ?? 0) === 0 ? t("chats.markUnread") : t("chats.markRead")}
          </button>
          <button onClick={onClear} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-main hover:bg-bg-light/70 transition-colors cursor-pointer">
            <X size={15} className="text-text-light" />
            {t("chats.clearChat")}
          </button>
          <div className="h-px bg-border/30 mx-3 my-1" />
          <button onClick={onDelete} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red hover:bg-red/5 transition-colors cursor-pointer">
            <Trash2 size={15} />
            {t("chats.deleteChat")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SKELETON / EMPTY
   ═══════════════════════════════════════════════════ */
function ChatsSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="w-[50px] h-[50px] rounded-full bg-bg-light" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-bg-light rounded w-1/3" />
            <div className="h-3 bg-bg-light rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyChats({ tab }: { tab: string }) {
  const { t } = useTranslation();
  const icon = tab === "rooms" ? <Users size={40} className="text-primary/30" /> : <MessageCircle size={40} className="text-primary/30" />;
  const msg = tab === "requests"
    ? t("chats.emptyRequests")
    : tab === "rooms"
      ? t("chats.emptyRooms")
      : t("chats.emptyDiscussions");

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      {icon}
      <p className="text-sm text-text-light font-medium">{msg}</p>
      <p className="text-xs text-text-light/70">{t("chats.emptyDesc")}</p>
    </div>
  );
}
