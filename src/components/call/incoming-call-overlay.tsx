"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import { setupPushNotifications } from "@/lib/push-notifications";

interface IncomingCall {
  channelId: string;
  agoraToken: string;
  callerId: string;
  callerName: string;
  callerImage: string;
  callerProfileType: "user" | "company";
  callerCompanyId: string;
}

export function IncomingCallOverlay() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for FCM messages with type=20 (video call)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    setupPushNotifications({
      onMessage: (payload: unknown) => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (payload as any)?.data ?? (payload as any);
        const type = data?.type;
        if (type !== "20") return;

        const profileType = data.caller_profile_type === "company" ? "company" : "user";
        const call: IncomingCall = {
          channelId: data.channel_id ?? "",
          agoraToken: data.agora_token ?? "",
          callerId: data.caller_id ?? "",
          callerName: data.caller_name ?? "Someone",
          callerImage: data.caller_image ?? "",
          callerProfileType: profileType,
          callerCompanyId: data.caller_company_id ?? "",
        };

        if (!call.channelId || !call.agoraToken) return;

        setIncomingCall(call);

        // Auto-dismiss after 45 seconds (matches mobile CallKit timeout)
        timeoutRef.current = setTimeout(() => {
          setIncomingCall(null);
        }, 45_000);
      },
    }).then((result) => {
      if (cancelled) {
        result.unsubscribe?.();
      } else {
        unsubscribe = result.unsubscribe;
      }
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user]);

  const handleAccept = useCallback(() => {
    if (!incomingCall) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const params = new URLSearchParams({
      channel: incomingCall.channelId,
      token: incomingCall.agoraToken,
      otherId: incomingCall.callerId,
      title: incomingCall.callerName,
      img: incomingCall.callerImage,
    });
    if (incomingCall.callerProfileType === "company") {
      params.set("profileType", "company");
      if (incomingCall.callerCompanyId) {
        params.set("companyId", incomingCall.callerCompanyId);
      }
    }

    setIncomingCall(null);
    router.push(`/spaces/call?${params.toString()}`);
  }, [incomingCall, router]);

  const handleDecline = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIncomingCall(null);
  }, []);

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-8 pointer-events-none">
      <div className="pointer-events-auto w-[380px] max-w-[90vw] bg-[#1c1c2e]/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/10 animate-slideDown">
        {/* Caller info */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3">
            <Avatar src={incomingCall.callerImage} alt={incomingCall.callerName} size={80} />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center ring-2 ring-[#1c1c2e]">
              <Phone size={12} className="text-white" />
            </div>
          </div>
          <h3 className="text-white text-lg font-bold">{incomingCall.callerName}</h3>
          {incomingCall.callerProfileType === "company" && (
            <span
              className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-cyan-300"
              style={{ background: "rgba(0,229,255,0.14)", border: "1px solid rgba(0,229,255,0.3)" }}
            >
              Entreprise ITGA
            </span>
          )}
          <p className="text-white/50 text-sm flex items-center gap-1.5 mt-1">
            <Loader2 size={12} className="animate-spin" />
            Incoming video call...
          </p>
        </div>

        {/* Accept / Decline buttons */}
        <div className="flex items-center justify-center gap-8">
          <button
            onClick={handleDecline}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-all group-active:scale-90">
              <PhoneOff size={24} className="text-red-400" />
            </div>
            <span className="text-white/50 text-[11px] font-medium">Decline</span>
          </button>
          <button
            onClick={handleAccept}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-full bg-green-500/20 hover:bg-green-500/30 flex items-center justify-center transition-all animate-pulse group-active:scale-90">
              <Phone size={24} className="text-green-400" />
            </div>
            <span className="text-white/50 text-[11px] font-medium">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}
