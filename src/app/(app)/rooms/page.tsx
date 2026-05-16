"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Lock, Users, Globe, RefreshCw, Plus, ImagePlus, Pencil,
  LogOut, Trash2, Flag, Bell, BellOff, Check, X, Loader2, ShieldCheck, UserMinus,
  MessageSquare, Send, ArrowLeft as BackIcon, Paperclip, Building2,
} from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore, useSettingsStore } from "@/lib/store";
import { RoomService } from "@/lib/services/room-service";
import { ChatService, roomFirebaseId } from "@/lib/services/chat-service";
import type { Room, RoomUser, Interest, User, ChatMessage } from "@/lib/types";
import { companyModeEventName, getActingCompanyId } from "@/lib/company-acting";
import { buildActorIdentity } from "@/lib/actor-identity";
import { cn, addBaseURL, formatCount } from "@/lib/utils";
import { getReportReasonsWithFallback } from "@/lib/report-reasons";

const PAGE_SIZE = 20;

const roomTabs = [
  { id: "discover", label: "Découvrir" },
  { id: "myRooms", label: "Mes salons" },
  { id: "invitations", label: "Invitations" },
];

/* ═══════════════════════════════════════════════════
   MAIN ROOMS PAGE
   ═══════════════════════════════════════════════════ */
export default function RoomsPage() {
  const { user: me } = useAuthStore();
  const { interests, reportReasons } = useSettingsStore();
  const [activeTab, setActiveTab] = useState("discover");
  const [actingCompanyId, setActingCompanyId] = useState<number | null>(null);

  // Discover tab state
  const [discoverRooms, setDiscoverRooms] = useState<Room[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [selectedInterest, setSelectedInterest] = useState<number | null>(null);

  // My rooms tab state
  const [myRoomUsers, setMyRoomUsers] = useState<RoomUser[]>([]);
  const [myRoomsLoading, setMyRoomsLoading] = useState(false);

  // Invitations tab state
  const [invitations, setInvitations] = useState<RoomUser[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);

  // Detail sheet
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reportRoomId, setReportRoomId] = useState<number | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    const refreshActor = () => setActingCompanyId(getActingCompanyId());
    refreshActor();
    window.addEventListener("storage", refreshActor);
    window.addEventListener(companyModeEventName(), refreshActor);
    return () => {
      window.removeEventListener("storage", refreshActor);
      window.removeEventListener(companyModeEventName(), refreshActor);
    };
  }, []);

  /* ─── Fetch discover rooms ─── */
  const fetchDiscover = useCallback(async () => {
    if (!me) return;
    setDiscoverLoading(true);
    try {
      if (selectedInterest) {
        const res = await RoomService.fetchRoomsByInterest(me.id, selectedInterest, 0, PAGE_SIZE);
        if (res.status && res.data) setDiscoverRooms(res.data);
      } else {
        const res = await RoomService.fetchRandomRooms(me.id, PAGE_SIZE);
        if (res.status && res.data) setDiscoverRooms(res.data);
      }
    } catch { /* silent */ }
    setDiscoverLoading(false);
  }, [me, selectedInterest]);

  /* ─── Fetch my rooms ─── */
  const fetchMyRooms = useCallback(async () => {
    if (!me) return;
    setMyRoomsLoading(true);
    try {
      const res = await RoomService.fetchRoomsList(me.id);
      if (res.status && res.data) setMyRoomUsers(res.data);
    } catch { /* silent */ }
    setMyRoomsLoading(false);
  }, [me]);

  /* ─── Fetch invitations ─── */
  const fetchInvitations = useCallback(async () => {
    if (!me) return;
    setInvitationsLoading(true);
    try {
      const res = await RoomService.getInvitationList(me.id, 0, 50);
      if (res.status && res.data) setInvitations(res.data);
    } catch { /* silent */ }
    setInvitationsLoading(false);
  }, [me]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeTab === "discover") fetchDiscover();
      else if (activeTab === "myRooms") fetchMyRooms();
      else if (activeTab === "invitations") fetchInvitations();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, actingCompanyId, fetchDiscover, fetchMyRooms, fetchInvitations]);

  /* ─── Join / Request ─── */
  const handleJoinRoom = useCallback(async (room: Room) => {
    if (!me) return;
    try {
      const res = await RoomService.joinOrRequestRoom(room.id, me.id);
      if (res.status) {
        const msg = room.is_join_request_enable === 1 ? "Demande envoyée" : "Vous avez rejoint le salon";
        showToast(msg);
        // Update local state
        setDiscoverRooms((prev) =>
          prev.map((r) =>
            r.id === room.id
              ? { ...r, userRoomStatus: room.is_join_request_enable === 1 ? 1 : 2 }
              : r
          )
        );
      } else {
        showToast(res.message || "Erreur");
      }
    } catch { showToast("Erreur réseau"); }
  }, [me, showToast]);

  /* ─── Accept / Reject invitation ─── */
  const handleAcceptInvitation = useCallback(async (roomId: number) => {
    if (!me) return;
    try {
      const res = await RoomService.acceptInvitation(roomId, me.id);
      if (res.status) {
        setInvitations((prev) => prev.filter((inv) => inv.room_id !== roomId));
        showToast("Invitation acceptée");
      }
    } catch { /* silent */ }
  }, [me, showToast]);

  const handleRejectInvitation = useCallback(async (roomId: number) => {
    if (!me) return;
    try {
      const res = await RoomService.rejectInvitation(roomId, me.id);
      if (res.status) {
        setInvitations((prev) => prev.filter((inv) => inv.room_id !== roomId));
        showToast("Invitation refusée");
      }
    } catch { /* silent */ }
  }, [me, showToast]);

  /* ─── Open room detail ─── */
  const openRoomDetail = useCallback(async (roomId: number) => {
    if (!me) return;
    setDetailLoading(true);
    try {
      const res = await RoomService.fetchRoomDetail(roomId, me.id, 1);
      if (res.status && res.data) {
        setSelectedRoom(res.data);
      }
    } catch { /* silent */ }
    setDetailLoading(false);
  }, [me]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const roomId = Number(new URLSearchParams(window.location.search).get("openRoom"));
    if (!roomId || !me) return;
    openRoomDetail(roomId);
  }, [me, openRoomDetail]);

  /* ─── Leave room ─── */
  const handleLeaveRoom = useCallback(async (roomId: number) => {
    if (!me) return;
    if (!confirm("Quitter ce salon ?")) return;
    try {
      const res = await RoomService.leaveRoom(roomId, me.id);
      if (res.status) {
        showToast("Vous avez quitté le salon");
        setSelectedRoom(null);
        fetchMyRooms();
        fetchDiscover();
      }
    } catch { /* silent */ }
  }, [me, showToast, fetchMyRooms, fetchDiscover]);

  /* ─── Delete room ─── */
  const handleDeleteRoom = useCallback(async (roomId: number) => {
    if (!me) return;
    if (!confirm("Supprimer ce salon ? Cette action est irréversible.")) return;
    try {
      const res = await RoomService.deleteRoom(roomId, me.id);
      if (res.status) {
        showToast("Salon supprimé");
        setSelectedRoom(null);
        fetchMyRooms();
        fetchDiscover();
      }
    } catch { /* silent */ }
  }, [me, showToast, fetchMyRooms, fetchDiscover]);

  /* ─── Report room ─── */
  const handleReportRoom = useCallback((roomId: number) => {
    if (!me) return;
    setReportRoomId(roomId);
  }, [me]);

  /* ─── Mute/unmute ─── */
  const handleToggleMute = useCallback(async (roomId: number, currentMute: number) => {
    if (!me) return;
    const newMute = currentMute === 1 ? 0 : 1;
    try {
      const res = await RoomService.muteUnmuteRoom(roomId, me.id, newMute);
      if (res.status) {
        setSelectedRoom((prev) => prev ? { ...prev, is_mute: newMute } : null);
        showToast(newMute === 1 ? "Notifications désactivées" : "Notifications activées");
      }
    } catch { /* silent */ }
  }, [me, showToast]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header Card */}
      <div className="card">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h1 className="text-lg font-bold text-text-main">Salons</h1>
            {actingCompanyId && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                <Building2 size={12} />
                Mode entreprise actif
              </p>
            )}
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="p-2 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors cursor-pointer"
            title="Créer un salon"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="px-4 pb-3">
          <Tabs tabs={roomTabs} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {/* Interest Filter (only on discover) */}
      {activeTab === "discover" && interests.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setSelectedInterest(null)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0",
                selectedInterest === null ? "bg-navy text-white" : "bg-bg-light text-text-dark hover:bg-border",
              )}
            >
              Tous
            </button>
            {interests.map((interest) => (
              <button
                key={interest.id}
                onClick={() => setSelectedInterest(interest.id === selectedInterest ? null : interest.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0",
                  selectedInterest === interest.id ? "bg-navy text-white" : "bg-bg-light text-text-dark hover:bg-border",
                )}
              >
                {interest.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === "discover" && (
        <DiscoverTab
          rooms={discoverRooms}
          loading={discoverLoading}
          onJoin={handleJoinRoom}
          onOpenDetail={openRoomDetail}
          onRefresh={fetchDiscover}
          interests={interests}
        />
      )}
      {activeTab === "myRooms" && (
        <MyRoomsTab
          roomUsers={myRoomUsers}
          loading={myRoomsLoading}
          onOpenDetail={openRoomDetail}
          onRefresh={fetchMyRooms}
        />
      )}
      {activeTab === "invitations" && (
        <InvitationsTab
          invitations={invitations}
          loading={invitationsLoading}
          onAccept={handleAcceptInvitation}
          onReject={handleRejectInvitation}
          onRefresh={fetchInvitations}
          interests={interests}
        />
      )}

      {/* Room Detail Sheet */}
      {selectedRoom && (
        <RoomDetailSheet
          room={selectedRoom}
          loading={detailLoading}
          onClose={() => setSelectedRoom(null)}
          onLeave={handleLeaveRoom}
          onDelete={handleDeleteRoom}
          onReport={handleReportRoom}
          onToggleMute={handleToggleMute}
          onJoin={handleJoinRoom}
        />
      )}

      {/* Create Room Modal */}
      {createOpen && (
        <CreateRoomModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            fetchDiscover();
            fetchMyRooms();
          }}
        />
      )}

      {/* Report Room Modal */}
      {reportRoomId !== null && me && (
        <ReportRoomModal
          roomId={reportRoomId}
          myUserId={me.id}
          reportReasons={reportReasons}
          onClose={() => setReportRoomId(null)}
          onSubmitted={() => {
            setReportRoomId(null);
            showToast("Signalement envoyé");
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-navy text-white px-5 py-3 rounded-lg shadow-xl animate-fadeIn">
          <Check size={16} />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ROOM CARD — shared card component
   ═══════════════════════════════════════════════════ */
function RoomCard({
  room,
  onTap,
  actionSlot,
  interests,
}: {
  room: Room;
  onTap?: () => void;
  actionSlot?: React.ReactNode;
  interests?: Interest[];
}) {
  const roomInterests = (interests ?? []).filter((i) => {
    const ids = (room.interest_ids ?? "").split(",").map(Number);
    return ids.includes(i.id);
  });

  return (
    <div
      onClick={onTap}
      className="card p-4 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex gap-3">
        {/* Room photo */}
        <div className="w-[52px] h-[52px] rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-primary/20 to-cyan/20 flex items-center justify-center">
          {room.photo ? (
            <img src={addBaseURL(room.photo)} alt={room.title} className="w-full h-full object-cover" />
          ) : (
            <Users size={24} className="text-primary" />
          )}
        </div>

        {/* Room info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-bold text-navy truncate group-hover:text-primary transition-colors">
              {room.title}
            </h3>
            {room.is_private === 1 ? (
              <Lock size={12} className="text-text-light shrink-0" />
            ) : (
              <Globe size={12} className="text-text-light shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1 mb-1">
            <Users size={12} className="text-text-light" />
            <span className="text-xs text-text-light">
              {formatCount(room.total_member)} membres
            </span>
            {room.company && (
              <>
                <span className="text-xs text-text-light">•</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary min-w-0">
                  <Building2 size={12} />
                  <span className="truncate">{room.company.name}</span>
                </span>
              </>
            )}
          </div>
          {room.desc && (
            <p className="text-xs text-text-light line-clamp-2">{room.desc}</p>
          )}
        </div>

        {/* Action slot or status badge */}
        <div className="shrink-0 flex items-start">
          {actionSlot || <StatusBadge status={room.userRoomStatus ?? 0} />}
        </div>
      </div>

      {/* Interest tags */}
      {roomInterests.length > 0 && (
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {roomInterests.map((i) => (
            <span
              key={i.id}
              className="px-2.5 py-0.5 rounded-full bg-green/10 text-green text-[11px] font-bold uppercase tracking-wider"
            >
              {i.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   STATUS BADGE
   ═══════════════════════════════════════════════════ */
function StatusBadge({ status }: { status: number }) {
  let label: string;
  let color: string;

  switch (status) {
    case 2:
    case 3:
    case 5:
      label = "Membre";
      color = "text-green bg-green/10 border-green/30";
      break;
    case 4:
      label = "Invité";
      color = "text-cyan bg-cyan/10 border-cyan/30";
      break;
    case 1:
      label = "En attente";
      color = "text-orange bg-orange/10 border-orange/30";
      break;
    default:
      label = "Rejoindre";
      color = "text-primary bg-primary/10 border-primary/30";
      break;
  }

  return (
    <span className={cn("px-2.5 py-1 rounded-lg text-[11px] font-semibold border", color)}>
      {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════
   LOADING SKELETON
   ═══════════════════════════════════════════════════ */
function RoomsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="w-[52px] h-[52px] rounded-xl bg-bg-light" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-bg-light rounded w-3/4" />
              <div className="h-3 bg-bg-light rounded w-1/3" />
              <div className="h-3 bg-bg-light rounded w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════ */
function EmptyState({ icon, title, desc, onRefresh }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onRefresh?: () => void;
}) {
  return (
    <div className="card">
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-bg-light flex items-center justify-center mb-4">
          {icon}
        </div>
        <h3 className="text-base font-bold text-text-main mb-1">{title}</h3>
        <p className="text-sm text-text-light max-w-xs">{desc}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-full hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <RefreshCw size={14} />
            Actualiser
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DISCOVER TAB
   ═══════════════════════════════════════════════════ */
function DiscoverTab({
  rooms, loading, onJoin, onOpenDetail, onRefresh, interests,
}: {
  rooms: Room[];
  loading: boolean;
  onJoin: (room: Room) => void;
  onOpenDetail: (roomId: number) => void;
  onRefresh: () => void;
  interests: Interest[];
}) {
  if (loading) return <RoomsSkeleton />;
  if (rooms.length === 0) {
    return (
      <EmptyState
        icon={<Users size={28} className="text-text-light" />}
        title="Aucun salon trouvé"
        desc="Changez de filtre ou revenez plus tard pour découvrir de nouveaux salons."
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <div className="space-y-3">
      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          interests={interests}
          onTap={() => {
            const status = room.userRoomStatus ?? 0;
            if (status === 2 || status === 3 || status === 5) {
              onOpenDetail(room.id);
            } else if (status === 0) {
              onJoin(room);
            } else {
              onOpenDetail(room.id);
            }
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MY ROOMS TAB
   ═══════════════════════════════════════════════════ */
function MyRoomsTab({
  roomUsers, loading, onOpenDetail, onRefresh,
}: {
  roomUsers: RoomUser[];
  loading: boolean;
  onOpenDetail: (roomId: number) => void;
  onRefresh: () => void;
}) {
  if (loading) return <RoomsSkeleton />;
  if (roomUsers.length === 0) {
    return (
      <EmptyState
        icon={<Users size={28} className="text-text-light" />}
        title="Aucun salon"
        desc="Rejoignez des salons dans l'onglet Découvrir pour les voir ici."
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <div className="space-y-3">
      {roomUsers.map((ru) => {
        if (!ru.room) return null;
        const room: Room = { ...ru.room, userRoomStatus: ru.type };
        return (
          <RoomCard
            key={ru.id}
            room={room}
            onTap={() => onOpenDetail(room.id)}
          />
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   INVITATIONS TAB
   ═══════════════════════════════════════════════════ */
function InvitationsTab({
  invitations, loading, onAccept, onReject, onRefresh, interests,
}: {
  invitations: RoomUser[];
  loading: boolean;
  onAccept: (roomId: number) => void;
  onReject: (roomId: number) => void;
  onRefresh: () => void;
  interests: Interest[];
}) {
  if (loading) return <RoomsSkeleton />;
  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={<Users size={28} className="text-text-light" />}
        title="Aucune invitation"
        desc="Vous n'avez pas d'invitations en attente."
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <div className="space-y-3">
      {invitations.map((inv) => {
        if (!inv.room) return null;
        return (
          <RoomCard
            key={inv.id}
            room={inv.room}
            interests={interests}
            actionSlot={
              <div className="flex gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onAccept(inv.room_id); }}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
                >
                  Accepter
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onReject(inv.room_id); }}
                  className="px-3 py-1.5 rounded-lg bg-bg-light text-text-dark text-xs font-semibold hover:bg-border transition-colors cursor-pointer"
                >
                  Refuser
                </button>
              </div>
            }
          />
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   REPORT ROOM MODAL
   ═══════════════════════════════════════════════════ */
function ReportRoomModal({
  roomId,
  myUserId,
  reportReasons,
  onClose,
  onSubmitted,
}: {
  roomId: number;
  myUserId: number;
  reportReasons: string[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const availableReportReasons = getReportReasonsWithFallback(reportReasons);
  const [reason, setReason] = useState("");
  const [desc, setDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!reason || !desc.trim() || isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = await RoomService.reportRoom(roomId, myUserId, reason, desc.trim());
      if (response.status) {
        onSubmitted();
        return;
      }

      setErrorMessage(response.message || "Impossible d'envoyer le signalement.");
    } catch {
      setErrorMessage("Impossible d'envoyer le signalement.");
    }
    setIsSubmitting(false);
  }, [desc, isSubmitting, myUserId, onSubmitted, reason, roomId]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag size={18} className="text-red" />
            <h3 className="text-lg font-bold text-text-main">Signaler le salon</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-bg-light flex items-center justify-center transition-colors cursor-pointer">
            <X size={18} className="text-text-light" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-dark mb-1.5 block">Raison du signalement</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-bg-light/60 border border-border/50 rounded-xl outline-none focus:border-primary/40 text-text-main cursor-pointer"
            >
              <option value="">Sélectionner une raison...</option>
              {availableReportReasons.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-dark mb-1.5 block">Détails</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Décrivez le problème rencontré..."
              className="w-full min-h-[88px] text-sm text-text-main bg-bg-light/60 rounded-xl p-3.5 border border-border/50 outline-none focus:border-primary/40 resize-none placeholder:text-text-light/50"
            />
          </div>

          {errorMessage && (
            <div className="text-xs font-semibold text-red bg-red/10 border border-red/20 rounded-lg px-3 py-2">
              {errorMessage}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!reason || !desc.trim() || isSubmitting}
            className="w-full py-3 text-sm font-semibold text-white bg-red rounded-xl hover:bg-red/90 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? "Envoi..." : "Envoyer le signalement"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ROOM DETAIL SHEET
   ═══════════════════════════════════════════════════ */
function RoomDetailSheet({
  room, loading, onClose, onLeave, onDelete, onReport, onToggleMute, onJoin,
}: {
  room: Room;
  loading: boolean;
  onClose: () => void;
  onLeave: (roomId: number) => void;
  onDelete: (roomId: number) => void;
  onReport: (roomId: number) => void;
  onToggleMute: (roomId: number, currentMute: number) => void;
  onJoin: (room: Room) => void;
}) {
  const status = room.userRoomStatus ?? 0;
  const isMember = status === 2 || status === 3 || status === 5;
  const isCreator = status === 5;
  const isAdmin = status === 3 || status === 5;

  // Sub-panels
  const [panel, setPanel] = useState<"main" | "edit" | "invite" | "requests" | "members" | "chat">("main");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (panel !== "main") setPanel("main"); else onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, panel]);

  if (panel === "edit") {
    return <EditRoomPanel room={room} onBack={() => setPanel("main")} onClose={onClose} />;
  }
  if (panel === "invite") {
    return <InviteUsersPanel roomId={room.id} onBack={() => setPanel("main")} onClose={onClose} />;
  }
  if (panel === "requests") {
    return <ManageRequestsPanel roomId={room.id} onBack={() => setPanel("main")} onClose={onClose} />;
  }
  if (panel === "members") {
    return <ManageMembersPanel roomId={room.id} isAdmin={isAdmin} onBack={() => setPanel("main")} onClose={onClose} />;
  }
  if (panel === "chat") {
    return <RoomChatPanel room={room} onBack={() => setPanel("main")} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border/30">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-primary/20 to-cyan/20 flex items-center justify-center">
              {room.photo ? (
                <img src={addBaseURL(room.photo)} alt={room.title} className="w-full h-full object-cover" />
              ) : (
                <Users size={28} className="text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-navy truncate">{room.title}</h2>
                {room.is_private === 1 ? <Lock size={14} className="text-text-light shrink-0" /> : <Globe size={14} className="text-text-light shrink-0" />}
              </div>
              <p className="text-xs text-text-light mt-0.5">
                {formatCount(room.total_member)} membres
              </p>
              <StatusBadge status={status} />
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-bg-light flex items-center justify-center transition-colors cursor-pointer shrink-0 self-start">
              <X size={18} className="text-text-light" />
            </button>
          </div>
          {room.desc && (
            <p className="text-sm text-text-dark mt-3 leading-relaxed">{room.desc}</p>
          )}
          {loading && (
            <div className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-text-light">
              <Loader2 size={14} className="animate-spin text-primary" />
              Actualisation du salon...
            </div>
          )}
        </div>

        {/* Interests */}
        {room.interests && room.interests.length > 0 && (
          <div className="px-5 py-3 border-b border-border-light">
            <div className="flex gap-1.5 flex-wrap">
              {room.interests.map((i) => (
                <span key={i.id} className="px-2.5 py-0.5 rounded-full bg-green/10 text-green text-[11px] font-bold uppercase tracking-wider">
                  {i.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Admin info */}
        {(room.company || room.admin) && (
          <div className="px-5 py-3 border-b border-border-light">
            <p className="text-[11px] font-semibold text-text-light uppercase tracking-wider mb-2">Admin</p>
            {room.company ? (
              <Link href={`/company/${room.company.id}`} onClick={onClose} className="flex items-center gap-3 hover:bg-bg-light rounded-lg p-1.5 -m-1.5 transition-colors">
                <Avatar src={room.company.logo} alt={room.company.name ?? ""} size={36} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-main truncate inline-flex items-center gap-1">
                    <Building2 size={13} className="text-primary" />
                    {room.company.name}
                  </p>
                  <p className="text-xs text-text-light truncate">{room.company.sector ?? "Entreprise ITGA"}</p>
                </div>
              </Link>
            ) : room.admin ? (
              <Link href={`/profile/${room.admin.id}`} onClick={onClose} className="flex items-center gap-3 hover:bg-bg-light rounded-lg p-1.5 -m-1.5 transition-colors">
                <Avatar src={room.admin.profile} alt={room.admin.full_name ?? ""} size={36} />
                <div>
                  <p className="text-sm font-semibold text-text-main">{room.admin.full_name}</p>
                  <p className="text-xs text-text-light">@{room.admin.username}</p>
                </div>
              </Link>
            ) : null}
          </div>
        )}

        {/* Members preview */}
        {room.roomUsers && room.roomUsers.length > 0 && (
          <div className="px-5 py-3 border-b border-border-light">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-text-light uppercase tracking-wider">
                Membres ({room.roomUsers.length})
              </p>
              {isMember && (
                <button onClick={() => setPanel("members")} className="text-xs font-semibold text-primary cursor-pointer">
                  Voir tout
                </button>
              )}
            </div>
            <div className="flex -space-x-2">
              {room.roomUsers.slice(0, 8).map((member) => {
                const memberCompany = member.company;
                const memberUser = member.user;
                const href = memberCompany ? `/company/${memberCompany.id}` : `/profile/${member.user_id}`;
                const avatar = memberCompany?.logo ?? memberUser?.profile ?? null;
                const name = memberCompany?.name ?? memberUser?.full_name ?? "";
                return (
                  <Link key={`${member.company_id ?? "user"}-${member.user_id}`} href={href} onClick={onClose}>
                    <Avatar src={avatar} alt={name} size={32} />
                  </Link>
                );
              })}
              {room.roomUsers.length > 8 && (
                <div className="w-8 h-8 rounded-full bg-bg-light border-2 border-white flex items-center justify-center text-[10px] font-bold text-text-light">
                  +{room.roomUsers.length - 8}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admin Actions */}
        {isAdmin && (
          <div className="px-5 py-3 border-b border-border-light space-y-1.5">
            <p className="text-[11px] font-semibold text-text-light uppercase tracking-wider mb-1">Administration</p>
            <button onClick={() => setPanel("edit")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-bg-light transition-colors cursor-pointer text-left">
              <Pencil size={16} className="text-primary" />
              <span className="text-sm font-medium text-text-main">Modifier le salon</span>
            </button>
            <button onClick={() => setPanel("invite")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-bg-light transition-colors cursor-pointer text-left">
              <Plus size={16} className="text-primary" />
              <span className="text-sm font-medium text-text-main">Inviter des personnes</span>
            </button>
            <button onClick={() => setPanel("requests")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-bg-light transition-colors cursor-pointer text-left">
              <Users size={16} className="text-primary" />
              <span className="text-sm font-medium text-text-main">Demandes d&apos;adhésion</span>
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="p-5 space-y-2">
          {isMember && (
            <button
              onClick={() => setPanel("chat")}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <MessageSquare size={16} />
              Ouvrir le chat
            </button>
          )}
          {!isMember && status !== 1 && (
            <button
              onClick={() => onJoin(room)}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
            >
              {room.is_join_request_enable === 1 ? "Demander à rejoindre" : "Rejoindre"}
            </button>
          )}
          {status === 1 && (
            <div className="w-full py-2.5 rounded-xl bg-orange/10 text-orange text-sm font-semibold text-center">
              Demande en attente
            </div>
          )}
          {isMember && (
            <>
              <button
                onClick={() => onToggleMute(room.id, room.is_mute ?? 0)}
                className="w-full py-2.5 rounded-xl border border-border-light text-sm font-semibold text-text-dark hover:bg-bg-light transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {room.is_mute === 1 ? <Bell size={16} /> : <BellOff size={16} />}
                {room.is_mute === 1 ? "Activer les notifications" : "Désactiver les notifications"}
              </button>
              {!isCreator && (
                <button
                  onClick={() => onLeave(room.id)}
                  className="w-full py-2.5 rounded-xl border border-red/20 text-sm font-semibold text-red hover:bg-red/5 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogOut size={16} />
                  Quitter le salon
                </button>
              )}
              {isCreator && (
                <button
                  onClick={() => onDelete(room.id)}
                  className="w-full py-2.5 rounded-xl border border-red/20 text-sm font-semibold text-red hover:bg-red/5 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Supprimer le salon
                </button>
              )}
            </>
          )}
          <button
            onClick={() => onReport(room.id)}
            className="w-full py-2.5 rounded-xl border border-border-light text-sm font-semibold text-text-light hover:bg-bg-light transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Flag size={16} />
            Signaler
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ROOM CHAT PANEL
   ═══════════════════════════════════════════════════ */
function RoomChatPanel({ room, onBack, onClose }: { room: Room; onBack: () => void; onClose: () => void }) {
  const { user: me } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [, setActorRefreshToken] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const convId = roomFirebaseId(room.id);
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

  useEffect(() => {
    const unsub = ChatService.subscribeToMessages(convId, "", (msgs) => {
      setMessages(msgs);
    });
    return () => unsub();
  }, [convId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!me || !text.trim() || sending) return;
    const trimmed = text.trim();
    setText("");
    setSending(true);
    try {
      await ChatService.sendRoomMessage(
        me.id,
        me.full_name ?? "",
        {
          id: room.id,
          title: room.title,
          photo: room.photo ?? null,
          roomUserIds: Array.from(new Set((room.roomUsers ?? []).map((member) => member.user_id))),
        },
        null,
        trimmed,
        "TEXT",
        "",
        "",
        messages.length === 0,
        actor,
      );
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleUpload = async (file: File, msgType: "IMAGE" | "VIDEO" | "DOCUMENT", label = "") => {
    if (!me) return;
    setUploading(true);
    try {
      const url = await ChatService.uploadFile(file);
      if (!url) {
        setUploading(false);
        return;
      }
      await ChatService.sendRoomMessage(
        me.id,
        me.full_name ?? "",
        {
          id: room.id,
          title: room.title,
          photo: room.photo ?? null,
          roomUserIds: Array.from(new Set((room.roomUsers ?? []).map((member) => member.user_id))),
        },
        null,
        msgType === "DOCUMENT" ? (label || file.name) : "",
        msgType,
        url,
        "",
        messages.length === 0,
        actor,
      );
    } catch {
      // ignore upload failures
    }
    setUploading(false);
  };

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const isVideo = file.type.startsWith("video/");
    await handleUpload(file, isVideo ? "VIDEO" : "IMAGE");
  };

  const handleDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await handleUpload(file, "DOCUMENT", file.name);
  };

  // Format time
  const formatTime = (id: string) => {
    const ts = parseInt(id) / 1000;
    if (isNaN(ts)) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col animate-slideUp"
        style={{ height: "min(600px, 90vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-light shrink-0">
          <button onClick={onBack} className="w-8 h-8 rounded-full hover:bg-bg-light flex items-center justify-center transition-colors cursor-pointer">
            <BackIcon size={18} className="text-text-light" />
          </button>
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-cyan/20 flex items-center justify-center shrink-0">
            {room.photo ? (
              <img src={addBaseURL(room.photo)} alt="" className="w-full h-full object-cover" />
            ) : (
              <Users size={14} className="text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-main truncate">{room.title}</p>
            <p className="text-[11px] text-text-light">{formatCount(room.total_member)} membres</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-bg-light flex items-center justify-center transition-colors cursor-pointer">
            <X size={18} className="text-text-light" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-bg-light flex items-center justify-center">
                <MessageSquare size={20} className="text-text-light" />
              </div>
              <p className="text-sm font-semibold text-text-main">Démarrez la conversation</p>
              <p className="text-xs text-text-light">Soyez le premier à écrire dans ce salon !</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.senderId === me?.id;
            const senderName = msg.senderName || (() => {
              const member = room.roomUsers?.find((u) => u.user_id === msg.senderId);
              return member?.company?.name ?? member?.user?.full_name ?? "";
            })();
            const senderAvatar = msg.senderAvatar || (() => {
              const member = room.roomUsers?.find((u) => u.user_id === msg.senderId);
              return member?.company?.logo ?? member?.user?.profile ?? null;
            })();
            return (
              <div key={msg.id} className={cn("flex items-end gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                {!isMe && (
                  <Avatar
                    src={senderAvatar ? addBaseURL(senderAvatar) : null}
                    alt=""
                    size={28}
                  />
                )}
                <div className={cn("max-w-[72%] group", isMe ? "items-end" : "items-start", "flex flex-col gap-0.5")}>
                  {(msg.senderProfileType === "company" || !isMe) && senderName && (
                    <span className={cn("px-1 text-[10px] font-semibold", isMe ? "text-primary" : "text-text-light")}>
                      {msg.senderProfileType === "company" ? "Entreprise · " : ""}{senderName}
                    </span>
                  )}
                  {msg.msgType === "TEXT" && (
                    <div className={cn(
                      "px-3.5 py-2 rounded-2xl text-sm leading-relaxed",
                      isMe
                        ? "bg-primary text-white rounded-br-sm"
                        : "bg-bg-light text-text-main rounded-bl-sm",
                    )}>
                      {msg.msg}
                    </div>
                  )}
                  {msg.msgType === "IMAGE" && msg.content && (
                    <img src={addBaseURL(msg.content)} alt="Image" className="rounded-2xl max-w-full max-h-48 object-cover cursor-pointer" />
                  )}
                  {msg.msgType === "VIDEO" && msg.content && (
                    <video src={addBaseURL(msg.content)} controls className="rounded-2xl max-w-full max-h-48" />
                  )}
                  {msg.msgType === "DOCUMENT" && msg.content && (
                    <a
                      href={addBaseURL(msg.content)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium",
                        isMe ? "bg-white/20 text-white" : "bg-card text-primary border border-border/30"
                      )}
                    >
                      <Paperclip size={13} />
                      <span className="truncate max-w-[180px]">{msg.msg || "Document"}</span>
                    </a>
                  )}
                  <span className="text-[10px] text-text-light group-hover:opacity-100 opacity-60 transition-opacity px-1">
                    {formatTime(msg.id)}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 py-3 border-t border-border-light">
          {actor?.profileType === "company" && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-[11px] font-semibold text-primary">
              <Building2 size={13} />
              Envoi au nom de {actor.name}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => mediaRef.current?.click()}
              disabled={uploading}
              className="w-10 h-10 rounded-full hover:bg-bg-light text-text-light hover:text-primary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              title="Envoyer une image ou vidéo"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            </button>
            <input
              ref={mediaRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleMediaSelect}
            />
            <button
              onClick={() => docRef.current?.click()}
              disabled={uploading}
              className="w-10 h-10 rounded-full hover:bg-bg-light text-text-light hover:text-primary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              title="Envoyer un document"
            >
              <Paperclip size={16} />
            </button>
            <input
              ref={docRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.rtf,.odt"
              className="hidden"
              onChange={handleDocSelect}
            />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Écrire un message..."
              className="flex-1 px-4 py-2.5 rounded-full border border-border-light bg-bg-light text-sm focus:outline-none focus:border-primary transition-colors"
              maxLength={1000}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-40 shrink-0"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PANEL SHELL — shared overlay for sub-panels
   ═══════════════════════════════════════════════════ */
function PanelShell({ title, onBack, onClose, children }: {
  title: string;
  onBack: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30">
          <button onClick={onBack} className="w-8 h-8 rounded-full hover:bg-bg-light flex items-center justify-center transition-colors cursor-pointer">
            <X size={18} className="text-text-light" />
          </button>
          <h2 className="text-base font-bold text-text-main flex-1">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CREATE ROOM MODAL (§8.5)
   ═══════════════════════════════════════════════════ */
function CreateRoomModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user: me } = useAuthStore();
  const { interests } = useSettingsStore();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinRequest, setJoinRequest] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<number[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleInterest = (id: number) => {
    setSelectedInterests((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!me) return;
    if (!title.trim()) { setError("Le nom du salon est requis."); return; }
    if (selectedInterests.length === 0) { setError("Choisissez au moins un intérêt."); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await RoomService.createRoom(
        me.id, title.trim(), desc.trim(),
        selectedInterests.join(","),
        isPrivate ? 1 : 0, joinRequest ? 1 : 0,
        photo ?? undefined,
      );
      if (res.status) { onCreated(); }
      else { setError(res.message || "Erreur lors de la création."); }
    } catch { setError("Erreur réseau."); }
    setIsSubmitting(false);
  };

  useEffect(() => { return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }; }, [photoPreview]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <h2 className="text-base font-bold text-text-main">Créer un salon</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-bg-light flex items-center justify-center transition-colors cursor-pointer">
            <X size={18} className="text-text-light" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Photo */}
          <div className="flex items-center gap-4">
            <button onClick={() => fileRef.current?.click()} className="w-16 h-16 rounded-xl overflow-hidden bg-bg-light hover:bg-border flex items-center justify-center transition-colors cursor-pointer shrink-0">
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus size={24} className="text-text-light" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <p className="text-xs text-text-light">Photo du salon (optionnel)</p>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-text-dark block mb-1">Nom du salon *</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border/30 bg-card text-sm focus:outline-none focus:border-primary transition-colors"
              placeholder="Ex: Femmes dans la Tech"
            />
          </div>

          {/* Desc */}
          <div>
            <label className="text-xs font-semibold text-text-dark block mb-1">Description</label>
            <textarea
              value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border/30 bg-card text-sm focus:outline-none focus:border-primary transition-colors resize-none"
              placeholder="Décrivez votre salon..."
            />
          </div>

          {/* Interests */}
          <div>
            <label className="text-xs font-semibold text-text-dark block mb-2">Catégories d&apos;intérêt *</label>
            <div className="flex flex-wrap gap-2">
              {interests.map((i) => (
                <button
                  key={i.id} onClick={() => toggleInterest(i.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer",
                    selectedInterests.includes(i.id)
                      ? "bg-primary text-white"
                      : "bg-bg-light text-text-dark hover:bg-border",
                  )}
                >
                  {i.title}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy toggles */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-text-main">Salon privé</p>
              <p className="text-xs text-text-light">Seuls les invités peuvent rejoindre</p>
            </div>
            <button
              onClick={() => setIsPrivate((p) => !p)}
              className={cn("w-11 h-6 rounded-full transition-colors cursor-pointer relative", isPrivate ? "bg-primary" : "bg-border")}
            >
              <div className={cn("w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform", isPrivate ? "translate-x-5.5" : "translate-x-0.5")} />
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-text-main">Approbation requise</p>
              <p className="text-xs text-text-light">Les demandes doivent être approuvées</p>
            </div>
            <button
              onClick={() => setJoinRequest((p) => !p)}
              className={cn("w-11 h-6 rounded-full transition-colors cursor-pointer relative", joinRequest ? "bg-primary" : "bg-border")}
            >
              <div className={cn("w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform", joinRequest ? "translate-x-5.5" : "translate-x-0.5")} />
            </button>
          </div>

          {error && <p className="text-xs text-red font-medium">{error}</p>}

          <button
            onClick={handleSubmit} disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Création...</> : "Créer le salon"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   EDIT ROOM PANEL (§8.6)
   ═══════════════════════════════════════════════════ */
function EditRoomPanel({ room, onBack, onClose }: { room: Room; onBack: () => void; onClose: () => void }) {
  const { interests } = useSettingsStore();
  const [title, setTitle] = useState(room.title);
  const [desc, setDesc] = useState(room.desc ?? "");
  const [isPrivate, setIsPrivate] = useState(room.is_private === 1);
  const [joinRequest, setJoinRequest] = useState(room.is_join_request_enable === 1);
  const [selectedInterests, setSelectedInterests] = useState<number[]>(
    (room.interest_ids ?? "").split(",").map(Number).filter(Boolean)
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(room.photo ? addBaseURL(room.photo) : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleInterest = (id: number) => {
    setSelectedInterests((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!title.trim()) { setError("Le nom est requis."); return; }
    setSaving(true); setError(null);
    try {
      const res = await RoomService.editRoom(
        room.id,
        {
          title: title.trim(), desc: desc.trim(),
          interest_ids: selectedInterests.join(","),
          is_private: isPrivate ? 1 : 0,
          is_join_request_enable: joinRequest ? 1 : 0,
        },
        photo ?? undefined,
      );
      if (res.status) { setSuccess(true); setTimeout(onBack, 800); }
      else { setError(res.message || "Erreur."); }
    } catch { setError("Erreur réseau."); }
    setSaving(false);
  };

  return (
    <PanelShell title="Modifier le salon" onBack={onBack} onClose={onClose}>
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-4">
          <button onClick={() => fileRef.current?.click()} className="w-16 h-16 rounded-xl overflow-hidden bg-bg-light hover:bg-border flex items-center justify-center transition-colors cursor-pointer shrink-0">
            {photoPreview ? <img src={photoPreview} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={24} className="text-text-light" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); } }} />
          <p className="text-xs text-text-light">Changer la photo</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-text-dark block mb-1">Nom *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className="w-full px-3.5 py-2.5 rounded-xl border border-border/30 bg-card text-sm focus:outline-none focus:border-primary transition-colors" />
        </div>
        <div>
          <label className="text-xs font-semibold text-text-dark block mb-1">Description</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} rows={3} className="w-full px-3.5 py-2.5 rounded-xl border border-border/30 bg-card text-sm focus:outline-none focus:border-primary transition-colors resize-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-text-dark block mb-2">Catégories</label>
          <div className="flex flex-wrap gap-2">
            {interests.map((i) => (
              <button key={i.id} onClick={() => toggleInterest(i.id)} className={cn("px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer", selectedInterests.includes(i.id) ? "bg-primary text-white" : "bg-bg-light text-text-dark hover:bg-border")}>{i.title}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between py-2">
          <p className="text-sm font-medium text-text-main">Salon privé</p>
          <button onClick={() => setIsPrivate((p) => !p)} className={cn("w-11 h-6 rounded-full transition-colors cursor-pointer relative", isPrivate ? "bg-primary" : "bg-border")}>
            <div className={cn("w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform", isPrivate ? "translate-x-5.5" : "translate-x-0.5")} />
          </button>
        </div>
        <div className="flex items-center justify-between py-2">
          <p className="text-sm font-medium text-text-main">Approbation requise</p>
          <button onClick={() => setJoinRequest((p) => !p)} className={cn("w-11 h-6 rounded-full transition-colors cursor-pointer relative", joinRequest ? "bg-primary" : "bg-border")}>
            <div className={cn("w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform", joinRequest ? "translate-x-5.5" : "translate-x-0.5")} />
          </button>
        </div>
        {error && <p className="text-xs text-red font-medium">{error}</p>}
        {success && <p className="text-xs text-green font-medium">Modifications enregistrées !</p>}
        <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={16} className="animate-spin" /> Enregistrement...</> : "Enregistrer"}
        </button>
      </div>
    </PanelShell>
  );
}

/* ═══════════════════════════════════════════════════
   INVITE USERS PANEL (§8.7)
   ═══════════════════════════════════════════════════ */
function InviteUsersPanel({ roomId, onBack, onClose }: { roomId: number; onBack: () => void; onClose: () => void }) {
  const { user: me } = useAuthStore();
  const [keyword, setKeyword] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<number>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!me) return;
    setLoading(true);
    try {
      const res = await RoomService.searchUsersForInvitation(me.id, roomId, 0, 30, q);
      if (res.status && res.data) setUsers(res.data);
    } catch { /* silent */ }
    setLoading(false);
  }, [me, roomId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      search("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [search]);

  const handleSearch = (val: string) => {
    setKeyword(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleInvite = async (userId: number) => {
    if (!me) return;
    try {
      const res = await RoomService.inviteUser(roomId, userId);
      if (res.status) setInvitedIds((prev) => new Set(prev).add(userId));
    } catch { /* silent */ }
  };

  return (
    <PanelShell title="Inviter des personnes" onBack={onBack} onClose={onClose}>
      <div className="px-5 py-3">
        <input
          type="text" value={keyword} onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher un utilisateur..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-border-light bg-bg-light text-sm focus:outline-none focus:border-primary focus:bg-card transition-colors"
        />
      </div>
      <div className="px-5 pb-5 space-y-1 max-h-[50vh] overflow-y-auto">
        {loading && <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-primary" /></div>}
        {!loading && users.length === 0 && <p className="text-sm text-text-light text-center py-6">Aucun utilisateur trouvé</p>}
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 py-2">
            <Avatar src={u.profile} alt={u.full_name ?? ""} size={36} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-main truncate">{u.full_name}</p>
              <p className="text-xs text-text-light">@{u.username}</p>
            </div>
            {invitedIds.has(u.id) ? (
              <span className="px-3 py-1.5 rounded-lg bg-green/10 text-green text-xs font-semibold">Invité</span>
            ) : (
              <button onClick={() => handleInvite(u.id)} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer">
                Inviter
              </button>
            )}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

/* ═══════════════════════════════════════════════════
   MANAGE REQUESTS PANEL (§8.8)
   ═══════════════════════════════════════════════════ */
function ManageRequestsPanel({ roomId, onBack, onClose }: { roomId: number; onBack: () => void; onClose: () => void }) {
  const [requests, setRequests] = useState<RoomUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await RoomService.fetchRoomRequests(roomId, 0, 50);
        if (res.status && res.data) setRequests(res.data);
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [roomId]);

  const handleAccept = async (userId: number) => {
    try {
      const res = await RoomService.acceptRoomRequest(roomId, userId);
      if (res.status) setRequests((prev) => prev.filter((r) => r.user_id !== userId));
    } catch { /* silent */ }
  };

  const handleReject = async (userId: number) => {
    try {
      const res = await RoomService.rejectRoomRequest(roomId, userId);
      if (res.status) setRequests((prev) => prev.filter((r) => r.user_id !== userId));
    } catch { /* silent */ }
  };

  return (
    <PanelShell title="Demandes d'adhésion" onBack={onBack} onClose={onClose}>
      <div className="px-5 pb-5 space-y-1 max-h-[60vh] overflow-y-auto">
        {loading && <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-primary" /></div>}
        {!loading && requests.length === 0 && <p className="text-sm text-text-light text-center py-6">Aucune demande en attente</p>}
        {requests.map((ru) => {
          const actorCompany = ru.company;
          const name = actorCompany?.name ?? ru.user?.full_name ?? "";
          const subtitle = actorCompany ? (actorCompany.sector ?? "Entreprise ITGA") : `@${ru.user?.username ?? ""}`;
          return (
            <div key={ru.id} className="flex items-center gap-3 py-2.5">
              <Avatar src={actorCompany?.logo ?? ru.user?.profile ?? null} alt={name} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-main truncate inline-flex items-center gap-1">
                  {actorCompany && <Building2 size={13} className="text-primary" />}
                  {name}
                </p>
                <p className="text-xs text-text-light truncate">{subtitle}</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => handleAccept(ru.user_id)} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer">
                  Accepter
                </button>
                <button onClick={() => handleReject(ru.user_id)} className="px-3 py-1.5 rounded-lg bg-bg-light text-text-dark text-xs font-semibold hover:bg-border transition-colors cursor-pointer">
                  Refuser
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}

/* ═══════════════════════════════════════════════════
   MANAGE MEMBERS PANEL (§8.9 + §8.10)
   ═══════════════════════════════════════════════════ */
function ManageMembersPanel({ roomId, isAdmin, onBack, onClose }: { roomId: number; isAdmin: boolean; onBack: () => void; onClose: () => void }) {
  const { user: me } = useAuthStore();
  const [members, setMembers] = useState<RoomUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await RoomService.fetchRoomUsers(roomId, 0, 100);
        if (res.status && res.data) setMembers(res.data);
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [roomId]);

  const handleMakeAdmin = async (userId: number) => {
    try {
      const res = await RoomService.makeRoomAdmin(roomId, userId);
      if (res.status) setMembers((prev) => prev.map((m) => m.user_id === userId ? { ...m, type: 3 } : m));
    } catch { /* silent */ }
  };

  const handleRemoveAdmin = async (userId: number) => {
    try {
      const res = await RoomService.removeAdmin(roomId, userId);
      if (res.status) setMembers((prev) => prev.map((m) => m.user_id === userId ? { ...m, type: 2 } : m));
    } catch { /* silent */ }
  };

  const handleRemoveUser = async (userId: number) => {
    if (!confirm("Retirer ce membre du salon ?")) return;
    try {
      const res = await RoomService.removeUser(roomId, userId);
      if (res.status) setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch { /* silent */ }
  };

  const getTypeLabel = (type: number) => {
    if (type === 5) return "Créateur";
    if (type === 3) return "Co-admin";
    return "Membre";
  };

  return (
    <PanelShell title="Membres" onBack={onBack} onClose={onClose}>
      <div className="px-5 pb-5 space-y-1 max-h-[60vh] overflow-y-auto">
        {loading && <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-primary" /></div>}
        {members.map((m) => {
          const actorCompany = m.company;
          const isMe = m.user_id === me?.id;
          const isCreatorMember = m.type === 5;
          const href = actorCompany ? `/company/${actorCompany.id}` : `/profile/${m.user_id}`;
          const name = actorCompany?.name ?? m.user?.full_name ?? "";
          return (
            <div key={m.id} className="flex items-center gap-3 py-2.5">
              <Link href={href} onClick={onClose}>
                <Avatar src={actorCompany?.logo ?? m.user?.profile ?? null} alt={name} size={36} />
              </Link>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-main truncate inline-flex items-center gap-1">
                  {actorCompany && <Building2 size={13} className="text-primary" />}
                  {name}
                </p>
                <p className="text-xs text-text-light">
                  @{m.user?.username} · <span className={m.type >= 3 ? "text-primary font-semibold" : ""}>{getTypeLabel(m.type)}</span>
                </p>
              </div>
              {isAdmin && !isMe && !isCreatorMember && (
                <div className="flex gap-1">
                  {m.type === 2 ? (
                    <button onClick={() => handleMakeAdmin(m.user_id)} title="Nommer co-admin" className="w-8 h-8 rounded-lg hover:bg-primary/10 flex items-center justify-center transition-colors cursor-pointer">
                      <ShieldCheck size={16} className="text-primary" />
                    </button>
                  ) : m.type === 3 ? (
                    <button onClick={() => handleRemoveAdmin(m.user_id)} title="Retirer co-admin" className="w-8 h-8 rounded-lg hover:bg-orange/10 flex items-center justify-center transition-colors cursor-pointer">
                      <ShieldCheck size={16} className="text-orange" />
                    </button>
                  ) : null}
                  <button onClick={() => handleRemoveUser(m.user_id)} title="Retirer du salon" className="w-8 h-8 rounded-lg hover:bg-red/10 flex items-center justify-center transition-colors cursor-pointer">
                    <UserMinus size={16} className="text-red" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}
