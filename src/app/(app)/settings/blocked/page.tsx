"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldOff } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { UserService } from "@/lib/services/user-service";
import { Avatar } from "@/components/ui/avatar";
import type { User } from "@/lib/types";

export default function BlockListPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<number | null>(null);

  const loadBlockedUsers = useCallback(async () => {
    if (!user) return;
    try {
      const res = await UserService.fetchBlockedUserList(user.id);
      if (res.status && Array.isArray(res.data)) {
        setBlockedUsers(res.data);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBlockedUsers();
  }, [loadBlockedUsers]);

  const handleUnblock = async (targetUser: User) => {
    if (!user || unblocking !== null) return;
    setUnblocking(targetUser.id);
    try {
      const res = await UserService.unblockUser(user.id, targetUser.id);
      if (res.status) {
        setBlockedUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      }
    } catch { /* ignore */ } finally {
      setUnblocking(null);
    }
  };

  return (
    <div className="min-h-screen bg-card">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <h1 className="text-lg font-bold text-text-main">Block List</h1>
        </div>
      </header>

      <div className="pb-8">
        {loading ? (
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-12 h-12 rounded-full bg-bg-light animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-3 bg-bg-light rounded animate-pulse" />
                  <div className="w-20 h-2.5 bg-bg-light rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : blockedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <ShieldOff size={32} className="text-text-light/40" />
            <p className="text-base font-semibold text-text-main">Block List</p>
            <p className="text-sm text-text-light">No blocked users</p>
          </div>
        ) : (
          <div>
            {blockedUsers.map((blockedUser) => (
              <div key={blockedUser.id} className="flex items-center gap-3 px-4 py-3 border-b border-border-light last:border-0">
                <Avatar
                  src={blockedUser.profile}
                  alt={blockedUser.full_name}
                  size={48}
                  isVerified={blockedUser.is_verified >= 2}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-main truncate">{blockedUser.full_name}</p>
                  <p className="text-xs text-text-light truncate">@{blockedUser.username}</p>
                </div>
                <button
                  onClick={() => handleUnblock(blockedUser)}
                  disabled={unblocking === blockedUser.id}
                  className="px-4 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {unblocking === blockedUser.id ? "..." : "UNBLOCK"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
