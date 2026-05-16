"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Plus } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { RoomService } from "@/lib/services/room-service";
import { addBaseURL } from "@/lib/utils";
import type { Room } from "@/lib/types";

export default function MyRoomsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRooms = useCallback(async () => {
    if (!user) return;
    try {
      const res = await RoomService.fetchMyOwnRooms(user.id);
      if (res.status && Array.isArray(res.data)) {
        setRooms(res.data);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  return (
    <div className="min-h-screen bg-card">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <h1 className="text-lg font-bold text-text-main">Rooms You Own</h1>
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
                  <div className="w-24 h-2.5 bg-bg-light rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Users size={32} className="text-text-light/40" />
            <p className="text-base font-semibold text-text-main">Rooms You Own</p>
            <p className="text-sm text-text-light">You haven&apos;t created any rooms yet</p>
          </div>
        ) : (
          <div>
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="flex items-center gap-3 px-4 py-3 border-b border-border-light last:border-0 hover:bg-bg-light/50 transition-colors"
              >
                <div className="w-14 h-14 rounded-xl bg-bg-light overflow-hidden shrink-0">
                  {room.photo ? (
                    <img
                      src={addBaseURL(room.photo)}
                      alt={room.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users size={20} className="text-text-light" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-main truncate">{room.title}</p>
                  <p className="text-xs text-text-light">{room.total_member ?? 0} members</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Create New Room Button */}
        <div className="px-4 pt-4">
          <Link
            href="/rooms?create=true"
            className="flex items-center justify-center gap-2 w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-teal to-navy rounded-xl hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            Create New Room
          </Link>
        </div>
      </div>
    </div>
  );
}
