"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Mic, MicOff, Video, VideoOff, Phone, ScreenShare, ScreenShareOff,
  ArrowLeft, Loader2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import { cn, addBaseURL } from "@/lib/utils";
import { SpaceService } from "@/lib/services/space-service";
import { UserService } from "@/lib/services/user-service";
import { buildActorIdentity } from "@/lib/actor-identity";

const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID ?? "9bfaecd4e3b34b91a3953ed07f5133b2";
const UNANSWERED_TIMEOUT_MS = 60_000;

/* ═══════════ Agora types ═══════════ */
type AgoraClient = {
  setClientRole: (role: string) => Promise<void>;
  join: (appId: string, channel: string, token: string | null, uid: number) => Promise<void>;
  leave: () => Promise<void>;
  publish: (tracks: unknown[]) => Promise<void>;
  unpublish: (tracks?: unknown[]) => Promise<void>;
  subscribe: (user: RemoteUser, mediaType: string) => Promise<void>;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  remoteUsers: RemoteUser[];
  connectionState?: string;
};

type RemoteUser = {
  uid: number;
  audioTrack?: { play: () => void; stop: () => void };
  videoTrack?: { play: (el: HTMLElement) => void; stop: () => void };
  hasAudio: boolean;
  hasVideo: boolean;
};

type LocalAudioTrack = {
  setEnabled: (enabled: boolean) => void;
  close: () => void;
};

type LocalVideoTrack = {
  play: (el: HTMLElement) => void;
  stop: () => void;
  close: () => void;
  setEnabled: (enabled: boolean) => Promise<void>;
};

/* ═══════════ UUID helper (matches mobile Uuid().v1()) ═══════════ */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ═══════════ MAIN PAGE ═══════════ */
export default function VideoCallPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: me } = useAuthStore();
  const actor = me ? buildActorIdentity(me) : null;

  // Outgoing call params (from chat page)
  const otherId = Number(searchParams.get("otherId") ?? 0);
  const otherName = searchParams.get("title") ?? "Utilisateur";
  const otherImg = searchParams.get("img") ?? "";

  // Remote actor identity (shared by outgoing and incoming flows).
  // - Outgoing: chat page sets `profileType` and `companyId` when peer is a company.
  // - Incoming: incoming-call-overlay propagates `caller_profile_type` / `caller_company_id`
  //   from the FCM payload (web caller + mobile caller both send these fields).
  const otherProfileType = searchParams.get("profileType") === "company" ? "company" : "user";
  const otherCompanyId = Number(searchParams.get("companyId") ?? 0);
  const otherIsCompany = otherProfileType === "company" && otherCompanyId > 0;

  // Incoming call params (from push notification handler)
  const incomingChannel = searchParams.get("channel") ?? "";
  const incomingToken = searchParams.get("token") ?? "";
  const isIncoming = !!incomingChannel && !!incomingToken;

  // State
  const [status, setStatus] = useState<"connecting" | "connected" | "ended">("connecting");
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [remoteHasAudio, setRemoteHasAudio] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const agoraClientRef = useRef<AgoraClient | null>(null);
  const agoraRTCRef = useRef<{ default: unknown } | null>(null);
  const localAudioRef = useRef<LocalAudioTrack | null>(null);
  const localVideoRef = useRef<LocalVideoTrack | null>(null);
  const localScreenRef = useRef<{ video: LocalVideoTrack; audio?: LocalAudioTrack } | null>(null);
  const localVideoElRef = useRef<HTMLDivElement>(null);
  const remoteVideoElRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinedRef = useRef(false);
  const unansweredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Format duration ─── */
  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  /* ─── Cleanup existing connection ─── */
  const cleanupConnection = useCallback(async () => {
    try {
      localAudioRef.current?.close();
      localVideoRef.current?.close();
      if (localScreenRef.current) {
        localScreenRef.current.video.close();
        localScreenRef.current.audio?.close();
        localScreenRef.current = null;
      }
      if (agoraClientRef.current) {
        await agoraClientRef.current.leave();
        agoraClientRef.current = null;
      }
    } catch { /* ignore cleanup errors */ }
    localAudioRef.current = null;
    localVideoRef.current = null;
    joinedRef.current = false;
    if (unansweredTimerRef.current) {
      clearTimeout(unansweredTimerRef.current);
      unansweredTimerRef.current = null;
    }
  }, []);

  /* ─── Join call ─── */
  const joinCall = useCallback(async () => {
    if (!me) {
      setError("Informations d'appel manquantes.");
      return;
    }
    // Prevent double-join
    if (joinedRef.current) return;
    joinedRef.current = true;

    try {
      // Clean up any previous session first
      await cleanupConnection();
      joinedRef.current = true; // re-set after cleanup resets it

      let channelName: string;
      let token: string;

      if (isIncoming) {
        // ── Incoming call: use channel+token from URL params ──
        channelName = incomingChannel;
        token = incomingToken;
      } else {
        // ── Outgoing call: generate UUID channel + token (matches mobile) ──
        if (!otherId) {
          setError("Informations d'appel manquantes.");
          joinedRef.current = false;
          return;
        }
        channelName = generateUUID();
        const generatedToken = await SpaceService.generateAgoraToken(channelName);
        if (!generatedToken) {
          setError("Impossible de générer le token d'appel. Vérifiez la connexion.");
          joinedRef.current = false;
          return;
        }
        token = generatedToken;

        // Send push notification to callee (same format as mobile Flutter)
        try {
          const profileRes = await UserService.fetchProfile(me.id, otherId);
          const otherUser = profileRes.data;
          if (otherUser?.device_token) {
            await SpaceService.sendPushNotification(
              otherUser.device_token,
              otherUser.device_type ?? undefined,
              actor?.name ?? me.full_name ?? "Someone",
              "Incoming video call...",
              {
                type: "20",
                channel_id: channelName,
                agora_token: token,
                caller_id: String(me.id),
                caller_name: actor?.name ?? me.full_name ?? "Someone",
                caller_image: actor?.avatar ? addBaseURL(actor.avatar) ?? "" : "",
                caller_profile_type: actor?.profileType ?? "user",
                caller_company_id: actor?.companyId ? String(actor.companyId) : "",
              },
            );
            console.info("[VideoCall] Push notification sent to callee");
          } else {
            console.warn("[VideoCall] Callee has no device token — they may not receive the call");
          }
        } catch (err) {
          console.warn("[VideoCall] Failed to notify callee (non-blocking):", err);
        }
      }

      // Dynamic import Agora SDK
      const AgoraRTC = await import("agora-rtc-sdk-ng");
      agoraRTCRef.current = AgoraRTC;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rtc = (AgoraRTC as any).default ?? AgoraRTC;

      const client = rtc.createClient({ mode: "rtc", codec: "vp8" }) as AgoraClient;
      agoraClientRef.current = client;

      // Remote user events
      client.on("user-published", async (...args: unknown[]) => {
        const user = args[0] as RemoteUser;
        const mediaType = args[1] as string;
        await client.subscribe(user, mediaType);
        if (mediaType === "video" && user.videoTrack && remoteVideoElRef.current) {
          user.videoTrack.play(remoteVideoElRef.current);
          setRemoteHasVideo(true);
        }
        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.play();
          setRemoteHasAudio(true);
        }
        setStatus("connected");
      });

      client.on("user-unpublished", (...args: unknown[]) => {
        const mediaType = args[1] as string;
        if (mediaType === "video") setRemoteHasVideo(false);
        if (mediaType === "audio") setRemoteHasAudio(false);
      });

      client.on("user-joined", () => {
        setStatus("connected");
        // Cancel unanswered timeout since someone joined
        if (unansweredTimerRef.current) {
          clearTimeout(unansweredTimerRef.current);
          unansweredTimerRef.current = null;
        }
      });

      client.on("user-left", () => {
        setRemoteHasVideo(false);
        setRemoteHasAudio(false);
        setStatus("ended");
      });

      // Join channel — UID 0 = auto-assign (avoids UID_CONFLICT)
      await client.join(AGORA_APP_ID, channelName, token, 0);

      // Create and publish local tracks
      const [audioTrack, videoTrack] = await Promise.all([
        rtc.createMicrophoneAudioTrack(),
        rtc.createCameraVideoTrack(),
      ]);
      localAudioRef.current = audioTrack as LocalAudioTrack;
      localVideoRef.current = videoTrack as LocalVideoTrack;

      if (localVideoElRef.current) {
        (videoTrack as LocalVideoTrack).play(localVideoElRef.current);
      }

      await client.publish([audioTrack, videoTrack]);

      // Start call timer
      timerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);

      // Start unanswered timeout for outgoing calls (60s, like WhatsApp).
      // Cleared by user-joined handler — if it fires, nobody answered.
      if (!isIncoming) {
        unansweredTimerRef.current = setTimeout(() => {
          console.info("[VideoCall] Unanswered timeout — ending call");
          setStatus("ended");
        }, UNANSWERED_TIMEOUT_MS);
      }
    } catch (err) {
      console.error("[VideoCall] Join error:", err);
      joinedRef.current = false;
      setError("Impossible de démarrer l'appel. Vérifiez votre caméra et micro.");
    }
  }, [
    me,
    otherId,
    isIncoming,
    incomingChannel,
    incomingToken,
    cleanupConnection,
    actor?.avatar,
    actor?.companyId,
    actor?.name,
    actor?.profileType,
  ]);

  /* ─── Leave call ─── */
  const leaveCall = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (unansweredTimerRef.current) clearTimeout(unansweredTimerRef.current);

    try {
      localAudioRef.current?.close();
      localVideoRef.current?.close();
      if (localScreenRef.current) {
        localScreenRef.current.video.close();
        localScreenRef.current.audio?.close();
      }
      await agoraClientRef.current?.leave();
    } catch { /* silent */ }

    setStatus("ended");
  }, []);

  /* ─── Toggle mic ─── */
  const toggleMic = useCallback(() => {
    if (localAudioRef.current) {
      const next = !isMicOn;
      localAudioRef.current.setEnabled(next);
      setIsMicOn(next);
    }
  }, [isMicOn]);

  /* ─── Toggle camera ─── */
  const toggleCamera = useCallback(async () => {
    if (!localVideoRef.current || !agoraClientRef.current) return;
    const next = !isCameraOn;
    await localVideoRef.current.setEnabled(next);
    setIsCameraOn(next);
  }, [isCameraOn]);

  /* ─── Toggle screen share ─── */
  const toggleScreenShare = useCallback(async () => {
    if (!agoraClientRef.current || !agoraRTCRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rtc = (agoraRTCRef.current as any).default ?? agoraRTCRef.current;

    if (isScreenSharing) {
      if (localScreenRef.current) {
        await agoraClientRef.current.unpublish([localScreenRef.current.video as unknown]);
        localScreenRef.current.video.close();
        localScreenRef.current.audio?.close();
        localScreenRef.current = null;
      }
      // Re-publish camera
      if (localVideoRef.current) {
        await agoraClientRef.current.publish([localVideoRef.current as unknown]);
        if (localVideoElRef.current) localVideoRef.current.play(localVideoElRef.current);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenTrack = await rtc.createScreenVideoTrack({ encoderConfig: "1080p_1" }, "auto");
        const videoTrack = Array.isArray(screenTrack) ? screenTrack[0] : screenTrack;
        const audioTrack = Array.isArray(screenTrack) ? screenTrack[1] : undefined;
        localScreenRef.current = { video: videoTrack as LocalVideoTrack, audio: audioTrack as LocalAudioTrack | undefined };

        // Unpublish camera, publish screen
        if (localVideoRef.current) {
          await agoraClientRef.current.unpublish([localVideoRef.current as unknown]);
        }
        const tracks: unknown[] = [videoTrack];
        if (audioTrack) tracks.push(audioTrack);
        await agoraClientRef.current.publish(tracks);

        if (localVideoElRef.current) (videoTrack as LocalVideoTrack).play(localVideoElRef.current);
        setIsScreenSharing(true);

        // Listen for screen share stop
        (videoTrack as LocalVideoTrack & { on?: (evt: string, cb: () => void) => void }).on?.("track-ended", () => {
          toggleScreenShare();
        });
      } catch {
        // User cancelled screen share dialog
      }
    }
  }, [isScreenSharing]);

  /* ─── Init ─── */
  useEffect(() => {
    joinCall();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupConnection();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── End screen redirect ─── */
  const handleBack = () => {
    if (status !== "ended") {
      leaveCall();
    }
    router.back();
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] z-50 flex flex-col">
      {/* ─── Top bar ─── */}
      <div className="flex items-center justify-between px-4 h-14 bg-black/30 backdrop-blur-sm">
        <button onClick={handleBack} className="p-2 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-white text-sm font-semibold">{otherName}</span>
            {otherIsCompany && (
              <span
                className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-cyan-300"
                style={{ background: "rgba(0,229,255,0.14)", border: "1px solid rgba(0,229,255,0.3)" }}
              >
                Entreprise
              </span>
            )}
          </div>
          <span className="text-white/60 text-xs">
            {status === "connecting" && "Connexion en cours..."}
            {status === "connected" && formatDuration(callDuration)}
            {status === "ended" && "Appel terminé"}
          </span>
        </div>
        <div className="w-10" />
      </div>

      {/* ─── Video area ─── */}
      <div className="flex-1 relative overflow-hidden">
        {/* Remote video (full screen) */}
        <div
          ref={remoteVideoElRef}
          className="absolute inset-0 bg-[#0a0a0f]"
        >
          {!remoteHasVideo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <Avatar src={otherImg} alt={otherName} size={120} />
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-white/70 text-lg font-medium">{otherName}</span>
                {otherIsCompany && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-cyan-300"
                    style={{ background: "rgba(0,229,255,0.14)", border: "1px solid rgba(0,229,255,0.3)" }}
                  >
                    Entreprise ITGA
                  </span>
                )}
              </div>
              {status === "connecting" && (
                <div className="flex items-center gap-2 text-white/50 text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  <span>En attente de réponse...</span>
                </div>
              )}
              {!remoteHasAudio && status === "connected" && (
                <span className="text-white/40 text-xs flex items-center gap-1">
                  <MicOff size={12} /> Micro désactivé
                </span>
              )}
            </div>
          )}
        </div>

        {/* Local video (PiP) */}
        <div
          ref={localVideoElRef}
          className={cn(
            "absolute bottom-4 right-4 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 z-10 transition-all",
            isCameraOn || isScreenSharing ? "w-40 h-56 bg-black" : "w-32 h-32 bg-[#1a1a2e]"
          )}
        >
          {!isCameraOn && !isScreenSharing && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Avatar src={me?.profile} alt={me?.full_name ?? ""} size={60} />
            </div>
          )}
        </div>

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-sm text-center">
              <p className="text-white text-sm mb-4">{error}</p>
              <button
                onClick={handleBack}
                className="px-6 py-2.5 bg-white text-black rounded-full text-sm font-semibold hover:bg-white/90 transition-colors cursor-pointer"
              >
                Retour
              </button>
            </div>
          </div>
        )}

        {/* Ended overlay */}
        {status === "ended" && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-sm text-center">
              <Avatar src={otherImg} alt={otherName} size={80} />
              <div className="flex flex-col items-center gap-1.5 mt-4">
                <p className="text-white text-lg font-semibold">{otherName}</p>
                {otherIsCompany && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-cyan-300"
                    style={{ background: "rgba(0,229,255,0.14)", border: "1px solid rgba(0,229,255,0.3)" }}
                  >
                    Entreprise ITGA
                  </span>
                )}
              </div>
              <p className="text-white/60 text-sm mt-1">Appel terminé · {formatDuration(callDuration)}</p>
              <button
                onClick={handleBack}
                className="mt-6 px-6 py-2.5 bg-white text-black rounded-full text-sm font-semibold hover:bg-white/90 transition-colors cursor-pointer"
              >
                Retour à la conversation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Controls bar ─── */}
      {status !== "ended" && (
        <div className="flex items-center justify-center gap-4 py-6 bg-gradient-to-t from-black/60 to-transparent">
          <ControlButton
            active={isMicOn}
            onClick={toggleMic}
            icon={isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
            label={isMicOn ? "Micro" : "Muet"}
          />
          <ControlButton
            active={isCameraOn}
            onClick={toggleCamera}
            icon={isCameraOn ? <Video size={22} /> : <VideoOff size={22} />}
            label={isCameraOn ? "Caméra" : "Off"}
          />
          <ControlButton
            active={isScreenSharing}
            onClick={toggleScreenShare}
            icon={isScreenSharing ? <ScreenShareOff size={22} /> : <ScreenShare size={22} />}
            label="Écran"
          />
          <button
            onClick={leaveCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors cursor-pointer shadow-lg shadow-red-500/30"
          >
            <Phone size={24} className="rotate-[135deg]" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Control Button ─── */
function ControlButton({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 cursor-pointer transition-all",
      )}
    >
      <div className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center transition-all",
        active
          ? "bg-white/20 text-white hover:bg-white/30"
          : "bg-white/10 text-white/50 hover:bg-white/20"
      )}>
        {icon}
      </div>
      <span className="text-[10px] text-white/60 font-medium">{label}</span>
    </button>
  );
}
