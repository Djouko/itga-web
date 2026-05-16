"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Send, Image as ImageIcon, Paperclip, Loader2,
  MoreVertical, Copy, Pencil, Trash2, Check, X, ShieldBan, Video,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import { ChatService } from "@/lib/services/chat-service";
import type { ChatRoom, ChatMessage, MessageType } from "@/lib/types";
import { buildActorIdentity } from "@/lib/actor-identity";
import { companyModeEventName } from "@/lib/company-acting";
import { addBaseURL } from "@/lib/utils";
import { QueryDocumentSnapshot, Unsubscribe } from "firebase/firestore";

export default function ConversationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user: me } = useAuthStore();

  const conversationId = params.conversationId as string;
  const chatType = Number(searchParams.get("type") ?? 1);
  const otherIdParam = Number(searchParams.get("otherId") ?? 0);
  const titleParam = searchParams.get("title") ?? "";
  const imgParam = searchParams.get("img") ?? "";
  const peerProfileType = searchParams.get("profileType") ?? "";
  const peerCompanyId = Number(searchParams.get("companyId") ?? 0);

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
  const [myChatRoom, setMyChatRoom] = useState<ChatRoom | null>(null);
  const [deleteId, setDeleteId] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [menuMsg, setMenuMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [, setActorRefreshToken] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const isFirstLoadRef = useRef(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const unsubsRef = useRef<Unsubscribe[]>([]);

  const isRoom = chatType === 2;
  const isRequest = chatRoom?.type === 0;
  const isBlocked = chatRoom?.iAmBlocked === true;
  const iBlockedThem = chatRoom?.iBlocked === true;
  const actor = me ? buildActorIdentity(me) : null;

  useEffect(() => {
    const syncActor = () => setActorRefreshToken((value) => value + 1);
    window.addEventListener("storage", syncActor);
    window.addEventListener(companyModeEventName(), syncActor);
    return () => {
      window.removeEventListener("storage", syncActor);
      window.removeEventListener(companyModeEventName(), syncActor);
    };
  }, []);

  // Subscribe to chat room metadata + messages
  useEffect(() => {
    if (!me || !conversationId) return;

    const unsubs: Unsubscribe[] = [];

    if (isRoom) {
      // Room chat: listen to chats/{conversationId}
      unsubs.push(
        ChatService.subscribeToRoomChatDoc(conversationId, (room) => {
          if (room) {
            setChatRoom(room);
            const did = (room.deleteChatIds?.[String(me.id)] ?? "").replace(/^d/, "");
            setDeleteId(did);
          }
        }),
      );
    } else {
      // 1:1 chat: listen to my chat room doc
      unsubs.push(
        ChatService.subscribeToChatRoom(me.id, otherIdParam, (room) => {
          if (room) {
            setChatRoom(room);
            setDeleteId(room.deletedId ?? "");
          }
        }),
      );
      // Listen to receiver's view of me
      unsubs.push(
        ChatService.subscribeToMyChatRoom(me.id, otherIdParam, (room) => {
          setMyChatRoom(room);
        }),
      );
    }

    unsubsRef.current = unsubs;
    return () => { unsubs.forEach((u) => u()); };
  }, [me, conversationId, isRoom, otherIdParam]);

  // Subscribe to messages once deleteId is resolved
  useEffect(() => {
    if (!conversationId || deleteId === undefined) return;

    const unsub = ChatService.subscribeToMessages(
      conversationId,
      deleteId,
      (msgs, lastDoc) => {
        setMessages(msgs);
        lastDocRef.current = lastDoc;
        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }), 50);
        }
      },
    );

    return () => unsub();
  }, [conversationId, deleteId]);

  // Mark as read on mount and when messages change
  useEffect(() => {
    if (!me || !conversationId) return;
    if (isRoom) {
      ChatService.markRoomChatAsRead(conversationId, me.id);
    } else {
      ChatService.markUserChatAsRead(me.id, otherIdParam);
    }
  }, [me, conversationId, isRoom, otherIdParam, messages.length]);

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuMsg(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Load older messages
  const loadOlder = useCallback(async () => {
    if (!lastDocRef.current || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const { messages: older, lastDoc } = await ChatService.loadOlderMessages(
        conversationId, deleteId, lastDocRef.current,
      );
      if (older.length > 0) {
        setMessages((prev) => [...prev, ...older]);
        lastDocRef.current = lastDoc;
      }
    } catch { /* silent */ }
    setLoadingOlder(false);
  }, [conversationId, deleteId, loadingOlder]);

  // Scroll handler for loading older messages
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // Messages are displayed in reverse, so "top" = oldest
    if (el.scrollTop < 100) {
      loadOlder();
    }
  }, [loadOlder]);

  // Send text message
  const handleSend = async () => {
    if (!me || !text.trim() || sending) return;
    const msg = text.trim();
    setText("");
    setSending(true);

    try {
      const isFirst = messages.length === 0;
      if (isRoom) {
        await ChatService.sendRoomMessage(
          me.id, me.full_name, {
            id: otherIdParam,
            title: titleParam,
            photo: imgParam || null,
            roomUserIds: chatRoom?.usersIds ?? [],
          },
          chatRoom, msg, "TEXT", "", "", isFirst,
          actor,
        );
      } else {
        await ChatService.sendUserMessage(
          me.id, me.full_name, me.profile,
          otherIdParam, chatRoom, myChatRoom,
          msg, "TEXT", "", "", 0, isFirst,
          actor,
        );
      }
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      console.error("Send error:", e);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  // Send media (image/video)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !me) return;
    e.target.value = "";

    const isVideo = file.type.startsWith("video/");
    const msgType: MessageType = isVideo ? "VIDEO" : "IMAGE";

    setUploading(true);
    try {
      const url = await ChatService.uploadFile(file);
      if (!url) { setUploading(false); return; }

      const isFirst = messages.length === 0;
      if (isRoom) {
        await ChatService.sendRoomMessage(
          me.id, me.full_name, {
            id: otherIdParam,
            title: titleParam,
            photo: imgParam || null,
            roomUserIds: chatRoom?.usersIds ?? [],
          },
          chatRoom, "", msgType, url, "", isFirst,
          actor,
        );
      } else {
        await ChatService.sendUserMessage(
          me.id, me.full_name, me.profile,
          otherIdParam, chatRoom, myChatRoom,
          "", msgType, url, "", 0, isFirst,
          actor,
        );
      }
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      console.error("Upload error:", e);
    }
    setUploading(false);
  };

  // Send document file
  const handleDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !me) return;
    e.target.value = "";

    setUploading(true);
    try {
      const url = await ChatService.uploadFile(file);
      if (!url) {
        setUploading(false);
        return;
      }

      const isFirst = messages.length === 0;
      if (isRoom) {
        await ChatService.sendRoomMessage(
          me.id,
          me.full_name,
          {
            id: otherIdParam,
            title: titleParam,
            photo: imgParam || null,
            roomUserIds: chatRoom?.usersIds ?? [],
          },
          chatRoom,
          file.name,
          "DOCUMENT",
          url,
          "",
          isFirst,
          actor,
        );
      } else {
        await ChatService.sendUserMessage(
          me.id,
          me.full_name,
          me.profile,
          otherIdParam,
          chatRoom,
          myChatRoom,
          file.name,
          "DOCUMENT",
          url,
          "",
          0,
          isFirst,
          actor,
        );
      }
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      console.error("Document upload error:", e);
    }
    setUploading(false);
  };

  // Edit message
  const handleEditSave = async () => {
    if (!editingMsg || !editText.trim()) return;
    await ChatService.editMessage(conversationId, editingMsg.id, editText.trim());
    setEditingMsg(null);
    setEditText("");
  };

  // Delete message
  const handleDelete = async (msgId: string) => {
    if (!confirm("Supprimer ce message ?")) return;
    setMenuMsg(null);
    await ChatService.deleteMessage(conversationId, msgId);
  };

  // Copy message
  const handleCopy = (msg: ChatMessage) => {
    navigator.clipboard.writeText(msg.msg ?? "");
    setMenuMsg(null);
  };

  // Accept / reject request
  const handleAcceptRequest = async () => {
    if (!me) return;
    await ChatService.acceptChatRequest(me.id, otherIdParam);
  };

  const handleRejectRequest = async () => {
    if (!me) return;
    await ChatService.rejectChatRequest(me.id, otherIdParam);
    router.back();
  };

  // Keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!me) return null;

  const profileSrc = imgParam ? addBaseURL(imgParam) : null;
  const peerHref =
    !isRoom && (chatRoom?.profileType === "company" || peerProfileType === "company") && (chatRoom?.companyId || peerCompanyId)
      ? `/company/${chatRoom?.companyId || peerCompanyId}`
      : `/profile/${otherIdParam}`;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-card rounded-2xl overflow-hidden shadow-sm border border-border/30">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-card shrink-0">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-full hover:bg-bg-light flex items-center justify-center transition-colors cursor-pointer">
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        {isRoom ? (
          <Link href="/rooms" className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-cyan/20 flex items-center justify-center overflow-hidden shrink-0">
            {profileSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profileSrc} alt="" className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-primary font-bold text-sm">{(titleParam || "S")[0]}</span>
            )}
          </Link>
        ) : (
          <Link href={peerHref}>
            <Avatar src={profileSrc} alt={titleParam} size={40} />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <Link href={isRoom ? "/rooms" : peerHref}>
            <h2 className="text-sm font-bold text-text-main truncate hover:text-primary transition-colors">{titleParam || "Conversation"}</h2>
          </Link>
          {isRoom && (
            <p className="text-[11px] text-text-light">{chatRoom?.usersIds?.length ?? 0} membres</p>
          )}
        </div>
        {/* Video call button (1:1 chats only) */}
        {!isRoom && !isBlocked && !isRequest && (
          <button
            onClick={() => {
              const params = new URLSearchParams({
                otherId: String(otherIdParam),
                title: titleParam,
                img: imgParam,
              });
              const peerIsCompany =
                chatRoom?.profileType === "company" || peerProfileType === "company";
              const peerCompany = chatRoom?.companyId ?? peerCompanyId;
              if (peerIsCompany && peerCompany) {
                params.set("profileType", "company");
                params.set("companyId", String(peerCompany));
              }
              router.push(`/spaces/call?${params.toString()}`);
            }}
            className="w-9 h-9 rounded-full hover:bg-bg-light flex items-center justify-center transition-colors cursor-pointer text-text-light hover:text-primary shrink-0"
            title="Appel vidéo"
          >
            <Video size={18} />
          </button>
        )}
      </div>

      {/* ─── Messages ─── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-bg-light/30"
      >
        {loadingOlder && (
          <div className="flex justify-center py-2">
            <Loader2 size={18} className="animate-spin text-primary" />
          </div>
        )}

        {/* Messages rendered oldest → newest (data is desc, reverse it) */}
        {[...messages].reverse().map((msg) => {
          const isMine = msg.senderId === me.id;
          const isEditing = editingMsg?.id === msg.id;
          const senderLabel = msg.senderName && (isRoom || msg.senderProfileType === "company") ? msg.senderName : "";

          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} group relative`}>
              <div className={`relative max-w-[75%] ${isMine ? "order-1" : ""}`}>
                {/* Bubble */}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 ${
                    isMine
                      ? "bg-navy text-white rounded-br-md"
                      : "bg-bg-light text-text-main border border-border/30 rounded-bl-md"
                  }`}
                >
                  {senderLabel && (
                    <p className={`text-[10px] font-semibold mb-1 ${isMine ? "text-white/60" : "text-primary"}`}>
                      {msg.senderProfileType === "company" ? "Entreprise" : "Membre"} · {senderLabel}
                    </p>
                  )}

                  {/* Media content */}
                  {(msg.msgType === "IMAGE" || msg.msgType === "VIDEO") && msg.content && (
                    <div className="mb-1.5 rounded-xl overflow-hidden">
                      {msg.msgType === "VIDEO" ? (
                        <video
                          src={addBaseURL(msg.content)}
                          controls
                          className="max-w-full max-h-[300px] rounded-xl"
                          preload="metadata"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={addBaseURL(msg.content)}
                          alt=""
                          className="max-w-full max-h-[300px] rounded-xl object-cover cursor-pointer"
                          onClick={() => window.open(addBaseURL(msg.content!), "_blank")}
                        />
                      )}
                    </div>
                  )}

                  {/* Document — card style like mobile app */}
                  {msg.msgType === "DOCUMENT" && msg.content && (() => {
                    const fileName = msg.msg || "Document";
                    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
                    const extColor = ext === "pdf" ? "bg-red/20 text-red" : ext === "doc" || ext === "docx" ? "bg-blue-500/20 text-blue-500" : ext === "xls" || ext === "xlsx" ? "bg-green/20 text-green" : "bg-primary/20 text-primary";
                    return (
                      <a
                        href={addBaseURL(msg.content)}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className={`flex items-center gap-3 p-3 mb-1.5 rounded-xl border transition-colors ${
                          isMine
                            ? "bg-white/10 border-white/15 hover:bg-white/15"
                            : "bg-bg-light/80 border-border-light/50 hover:bg-bg-light"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${extColor}`}>
                          <Paperclip size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isMine ? "text-white" : "text-text-main"}`}>{fileName}</p>
                          <p className={`text-[10px] mt-0.5 ${isMine ? "text-white/50" : "text-text-light"}`}>
                            {ext.toUpperCase() || "FICHIER"} · Appuyez pour télécharger
                          </p>
                        </div>
                      </a>
                    );
                  })()}

                  {/* Text */}
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); if (e.key === "Escape") { setEditingMsg(null); setEditText(""); } }}
                        className="flex-1 bg-white/20 rounded-lg px-2 py-1 text-sm outline-none"
                        autoFocus
                      />
                      <button onClick={handleEditSave} className="cursor-pointer"><Check size={16} /></button>
                      <button onClick={() => { setEditingMsg(null); setEditText(""); }} className="cursor-pointer"><X size={16} /></button>
                    </div>
                  ) : (
                    msg.msg && msg.msgType !== "DOCUMENT" && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.msg}</p>
                    )
                  )}

                  {/* Time */}
                  <p className={`text-[10px] mt-1 ${isMine ? "text-white/50" : "text-text-light"}`}>
                    {formatMsgTime(msg.id)}
                  </p>
                </div>

                {/* Context menu trigger */}
                {isMine && !isEditing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuMsg(menuMsg === msg.id ? null : msg.id); }}
                    className="absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-bg-light flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <MoreVertical size={14} className="text-text-light" />
                  </button>
                )}

                {/* Context menu */}
                {menuMsg === msg.id && (
                  <div ref={menuRef} className={`absolute ${isMine ? "-left-40" : "left-0"} top-0 z-50 bg-card rounded-xl shadow-lg border border-border py-1 min-w-[140px] animate-fadeIn`}>
                    {msg.msgType === "TEXT" && isMine && (
                      <button
                        onClick={() => { setEditingMsg(msg); setEditText(msg.msg ?? ""); setMenuMsg(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-main hover:bg-bg-light transition-colors cursor-pointer"
                      >
                        <Pencil size={13} /> Modifier
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(msg)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-main hover:bg-bg-light transition-colors cursor-pointer"
                    >
                      <Copy size={13} /> Copier
                    </button>
                    {isMine && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red hover:bg-red/5 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} /> Supprimer
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Blocked indicator ─── */}
      {isBlocked && (
        <div className="px-4 py-3 bg-bg-light border-t border-border-light text-center">
          <div className="flex items-center justify-center gap-2 text-text-light text-sm">
            <ShieldBan size={16} />
            <span>Vous ne pouvez pas envoyer de messages à cette personne</span>
          </div>
        </div>
      )}

      {/* ─── Request actions ─── */}
      {isRequest && !isBlocked && (
        <div className="px-4 py-3 border-t border-border/30 bg-card shrink-0">
          <p className="text-xs text-text-light text-center mb-2">Cette personne souhaite vous envoyer un message</p>
          <div className="flex gap-2">
            <button
              onClick={handleRejectRequest}
              className="flex-1 py-2.5 rounded-xl border border-border-light text-sm font-semibold text-text-dark hover:bg-bg-light transition-colors cursor-pointer"
            >
              Refuser
            </button>
            <button
              onClick={handleAcceptRequest}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
            >
              Accepter
            </button>
          </div>
        </div>
      )}

      {/* ─── Input bar ─── */}
      {!isBlocked && !isRequest && (
        <div className="px-4 py-3 border-t border-border/30 bg-card shrink-0">
          {actor?.profileType === "company" && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-[11px] font-semibold text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Envoi au nom de {actor.name}
            </div>
          )}
          <div className="flex items-end gap-2">
            {/* Media buttons */}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-9 h-9 rounded-full hover:bg-bg-light flex items-center justify-center transition-colors cursor-pointer text-text-light hover:text-primary shrink-0 disabled:opacity-50"
              title="Envoyer une image ou vidéo"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => docRef.current?.click()}
              disabled={uploading}
              className="w-9 h-9 rounded-full hover:bg-bg-light flex items-center justify-center transition-colors cursor-pointer text-text-light hover:text-primary shrink-0 disabled:opacity-50"
              title="Envoyer un document"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={docRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.rtf,.odt"
              className="hidden"
              onChange={handleDocSelect}
            />

            {/* Text input */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Écrivez un message..."
                className="w-full px-4 py-2.5 rounded-full bg-bg-light text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary/30 transition-all"
                disabled={iBlockedThem}
              />
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="w-9 h-9 rounded-full bg-gradient-to-r from-primary to-cyan text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 shrink-0 hover:shadow-md"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   HELPER — Format message timestamp from microsecond ID
   ═══════════════════════════════════════════════════ */
function formatMsgTime(id: string): string {
  try {
    const microseconds = parseInt(id, 10);
    if (isNaN(microseconds)) return "";
    const date = new Date(microseconds / 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    if (isToday) return time;
    if (isYesterday) return `Hier ${time}`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + ` ${time}`;
  } catch {
    return "";
  }
}
