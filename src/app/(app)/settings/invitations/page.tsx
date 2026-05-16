"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Check, X } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { RoomService } from "@/lib/services/room-service";
import { addBaseURL } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";

interface Invitation {
  id: number;
  room_id: number;
  user_id: number;
  invited_by: number;
  status: number;
  room?: {
    id: number;
    title: string;
    photo: string | null;
    member_count: number;
  };
  invited_by_user?: {
    id: number;
    full_name: string;
    username: string;
  };
}

const PAGE_SIZE = 15;

export default function InvitationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<Invitation | null>(null);
  const loadingMore = useRef(false);

  const loadInvitations = useCallback(async (start: number) => {
    if (!user) return;
    try {
      const res = await RoomService.getInvitationList(user.id, start, PAGE_SIZE);
      if (res.status && Array.isArray(res.data)) {
        setInvitations((prev) => start === 0 ? res.data! as unknown as Invitation[] : [...prev, ...(res.data! as unknown as Invitation[])]);
        setHasMore((res.data! as unknown as Invitation[]).length >= PAGE_SIZE);
      } else {
        if (start === 0) setInvitations([]);
        setHasMore(false);
      }
    } catch {
      if (start === 0) setInvitations([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      loadingMore.current = false;
    }
  }, [user]);

  useEffect(() => {
    loadInvitations(0);
  }, [loadInvitations]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore.current) {
          loadingMore.current = true;
          loadInvitations(invitations.length);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, invitations.length, loadInvitations]);

  const handleAccept = async (invitation: Invitation) => {
    if (!user || processing !== null) return;
    setProcessing(invitation.id);
    try {
      const res = await RoomService.acceptInvitation(invitation.room_id, user.id);
      if (res.status) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitation.id));
      }
    } catch { /* ignore */ } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (invitation: Invitation) => {
    if (!user || processing !== null) return;
    setProcessing(invitation.id);
    try {
      const res = await RoomService.rejectInvitation(invitation.room_id, user.id);
      if (res.status) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitation.id));
      }
    } catch { /* ignore */ } finally {
      setProcessing(null);
      setShowRejectModal(null);
    }
  };

  return (
    <div className="min-h-screen bg-card">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <h1 className="text-lg font-bold text-text-main">Room Invitations</h1>
        </div>
      </header>

      <div className="pb-8">
        {loading ? (
          <div className="space-y-0">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-14 h-14 rounded-xl bg-bg-light animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="w-40 h-3 bg-bg-light rounded animate-pulse" />
                  <div className="w-28 h-2.5 bg-bg-light rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Mail size={32} className="text-text-light/40" />
            <p className="text-base font-semibold text-text-main">Room Invitations</p>
            <p className="text-sm text-text-light">No pending invitations</p>
          </div>
        ) : (
          <div>
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3 border-b border-border-light last:border-0">
                <div className="w-14 h-14 rounded-xl bg-bg-light overflow-hidden shrink-0">
                  {inv.room?.photo ? (
                    <img
                      src={addBaseURL(inv.room.photo)}
                      alt={inv.room?.title ?? ""}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-light">
                      <Mail size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-main truncate">{inv.room?.title ?? "Room"}</p>
                  <p className="text-xs text-text-light">{inv.room?.member_count ?? 0} members</p>
                  {inv.invited_by_user && (
                    <Link
                      href={`/profile/${inv.invited_by_user.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Invited by @{inv.invited_by_user.username}
                    </Link>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleAccept(inv)}
                    disabled={processing === inv.id}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => setShowRejectModal(inv)}
                    disabled={processing === inv.id}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
            <div ref={sentinelRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Reject Confirmation Modal */}
      <Modal
        isOpen={showRejectModal !== null}
        onClose={() => setShowRejectModal(null)}
        title="Reject Invitation"
        size="sm"
      >
        <div className="px-6 pb-6">
          <p className="text-sm text-text-light mb-6">
            Are you sure you want to reject this invitation to &quot;{showRejectModal?.room?.title}&quot;?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowRejectModal(null)}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-border-light hover:bg-bg-light transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => showRejectModal && handleReject(showRejectModal)}
              disabled={processing !== null}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Reject
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
