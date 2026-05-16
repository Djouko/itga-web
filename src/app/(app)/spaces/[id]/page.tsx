"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Mic, MicOff, Volume2, VolumeX, Hand, Phone,
  Send, Loader2, Check, X, Video, VideoOff,
  ScreenShare, ScreenShareOff, Monitor, MoreVertical, UserMinus,
  MicOff as MicOffIcon, MessageSquare, Users,
  Smile, Minus,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore, useSpaceCallStore } from "@/lib/store";
import {
  SpaceService, getSpaceHostsWithAdmin, getSpaceListeners,
  getSpaceRequests, getActiveUsers, isSameSpaceActor,
} from "@/lib/services/space-service";
import type {
  AudioSpace, AudioSpaceUser, AudioSpaceMicStatus, AudioSpaceMessage,
} from "@/lib/types";
import { addBaseURL } from "@/lib/utils";
import { buildActorIdentity } from "@/lib/actor-identity";
import { companyModeEventName } from "@/lib/company-acting";
import type { Unsubscribe } from "firebase/firestore";

const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID ?? "";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "👏", "🔥", "🎉", "💯"];

const MAX_FLOATING_REACTIONS = 5;

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
  enableAudioVolumeIndicator?: (intervalMs?: number) => void;
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

export default function SpaceLivePage() {
  const params = useParams();
  const router = useRouter();
  const { user: me } = useAuthStore();
  const spaceId = params.id as string;

  // Core state
  const [space, setSpace] = useState<AudioSpace | null>(null);
  const [messages, setMessages] = useState<AudioSpaceMessage[]>([]);
  const [activeTab, setActiveTab] = useState("room");
  const [msgText, setMsgText] = useState("");
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [ended, setEnded] = useState(false);
  const [actorRefreshToken, setActorRefreshToken] = useState(0);

  // Audio/Video state
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [audioOutputMuted, setAudioOutputMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenSharingUid, setScreenSharingUid] = useState(0);
  const [remoteVideoUsers, setRemoteVideoUsers] = useState<Set<number>>(new Set());

  // UI state
  const [floatingReactions, setFloatingReactions] = useState<{ emoji: string; key: number; name: string; left: number }[]>([]);
  const [showEmojis, setShowEmojis] = useState(false);
  const [actionMenuUser, setActionMenuUser] = useState<number | null>(null);
  const [speakingUids, setSpeakingUids] = useState<Set<number>>(new Set());
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Refs
  const agoraClientRef = useRef<AgoraClient | null>(null);
  const agoraRTCRef = useRef<{ default: unknown } | null>(null);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  const localScreenTrackRef = useRef<{ video: LocalVideoTrack; audio?: LocalAudioTrack } | null>(null);
  const unsubsRef = useRef<Unsubscribe[]>([]);
  const reactionKeyRef = useRef(0);
  const lastReactionTsRef = useRef<Date | null>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const prevRoleRef = useRef<string | null>(null);
  const prevVideoModeRef = useRef<boolean | null>(null);
  const speakingClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isJoiningRef = useRef(false);
  const actor = useMemo(() => {
    void actorRefreshToken;
    return me ? buildActorIdentity(me) : null;
  }, [me, actorRefreshToken]);

  useEffect(() => {
    const syncActor = () => setActorRefreshToken((value) => value + 1);
    window.addEventListener("storage", syncActor);
    window.addEventListener(companyModeEventName(), syncActor);
    return () => {
      window.removeEventListener("storage", syncActor);
      window.removeEventListener(companyModeEventName(), syncActor);
    };
  }, []);

  // ═══════════ RESTORE FROM MINIMIZED CALL ═══════════
  useEffect(() => {
    const store = useSpaceCallStore.getState();
    if (store.activeSpaceId === spaceId && store.isMinimized && store._refs.agoraClient) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agoraClientRef.current = store._refs.agoraClient as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agoraRTCRef.current = store._refs.agoraRTC as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      localAudioTrackRef.current = store._refs.localAudioTrack as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      localVideoTrackRef.current = store._refs.localVideoTrack as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      localScreenTrackRef.current = store._refs.localScreenTrack as any;
      setJoined(true);
      setIsMicOn(store.isMicOn);
      if (localVideoTrackRef.current) setIsCameraOn(true);
      if (localScreenTrackRef.current) setIsScreenSharing(true);
      store.restore();
    }
  }, [spaceId]);

  // Derived state
  const actorCompanyId = actor?.companyId ?? null;
  const myUser = space?.users?.find((u) => (me ? isSameSpaceActor(u, me.id, actorCompanyId) : false));
  const isAdmin = myUser?.type === "ADMIN";
  const isHost = myUser?.type === "HOST" || isAdmin;
  const isRequested = myUser?.type === "REQUESTED";
  const isListener = myUser?.type === "LISTENER";
  const isVideoMode = space?.is_video_conference ?? false;
  const hosts = space ? getSpaceHostsWithAdmin(space) : [];
  const listeners = space ? getSpaceListeners(space) : [];
  const requests = space ? getSpaceRequests(space) : [];
  const activeUsers = space ? getActiveUsers(space) : [];



  // ═══════════ SUBSCRIBE TO SPACE + MESSAGES ═══════════
  useEffect(() => {
    if (!me || !spaceId) return;
    const unsubs: Unsubscribe[] = [];

    unsubs.push(
      SpaceService.subscribeToSpace(spaceId, (s) => {
        if (!s) {
          setEnded(true);
          return;
        }
        setSpace(s);
        setScreenSharingUid(s.screen_sharing_uid ?? 0);

        // If current screen sharer has left the space, clear the screen share flag
        const ssUid = s.screen_sharing_uid ?? 0;
        if (ssUid > 0) {
          const ssUser = s.users?.find((u) => u.id === ssUid);
          if (!ssUser) {
            // Screen sharer left — clear it in Firestore
            SpaceService.updateSpace(spaceId, { screen_sharing_uid: 0 }).catch(() => {});
            setScreenSharingUid(0);
          }
        }

        // Check if current user was kicked
        const meInSpace = s.users?.find((u) => isSameSpaceActor(u, me.id, actorCompanyId));
        if (meInSpace?.type === "KICKED_OUT") {
          // Clean up and leave
          localAudioTrackRef.current?.close();
          localVideoTrackRef.current?.close();
          if (localScreenTrackRef.current) {
            localScreenTrackRef.current.video.close();
            localScreenTrackRef.current.audio?.close();
          }
          agoraClientRef.current?.leave();
          useSpaceCallStore.getState().clearCall();
          setEnded(true);
          return;
        }

        // Sync store metadata for the mini widget
        if (useSpaceCallStore.getState().activeSpaceId === spaceId) {
          const active = getActiveUsers(s);
          useSpaceCallStore.getState().updateMeta({
            participantCount: active.length,
            spaceTitle: s.title ?? "",
          });
        }

        // Check for reactions from other users via parsed last_reaction
        const reaction = s.last_reaction;
        if (reaction && reaction.emoji && reaction.ts) {
          if (!isSameSpaceActor({ id: reaction.uid, company_id: reaction.company_id ?? null, type: "LISTENER", mic_status: "MUTED" }, me.id, actorCompanyId)) {
            if (!lastReactionTsRef.current || reaction.ts > lastReactionTsRef.current) {
              lastReactionTsRef.current = reaction.ts;
              // Find sender name from space users
              const sender = s.users?.find((u) => isSameSpaceActor(u, reaction.uid, reaction.company_id));
              const senderName = (reaction.name || sender?.display_name || sender?.fullName || "").split(" ")[0] ?? "";
              showFloatingReaction(reaction.emoji, senderName);
            }
          }
        }
      }),
    );

    unsubs.push(
      SpaceService.subscribeToSpaceMessages(spaceId, (msgs) => {
        setMessages(msgs);
        setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }),
    );

    unsubsRef.current = unsubs;
    return () => { unsubs.forEach((u) => u()); };
  }, [me, spaceId, actorCompanyId]);

  // ═══════════ RENDER REMOTE VIDEOS ═══════════
  useEffect(() => {
    if (!isVideoMode || !joined) return;
    const client = agoraClientRef.current;
    if (!client) return;

    client.remoteUsers.forEach((user: RemoteUser) => {
      if (user.hasVideo && user.videoTrack) {
        const el = document.getElementById(`remote-video-${user.uid}`);
        if (el && !el.querySelector("video")) {
          user.videoTrack.play(el);
        }
      }
    });
  }, [remoteVideoUsers, isVideoMode, joined, activeTab]);

  // ═══════════ AGORA JOIN ═══════════
  const handleJoinAgora = useCallback(async () => {
    if (!space || !me || joining) return;
    if (agoraClientRef.current) return; // Already connected (restored from minimize)
    if (isJoiningRef.current) return;
    isJoiningRef.current = true;
    setJoining(true);

    try {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      agoraRTCRef.current = { default: AgoraRTC };
      const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" }) as unknown as AgoraClient;
      agoraClientRef.current = client;

      const shouldBeBroadcaster = isHost || isAdmin;
      await client.setClientRole(shouldBeBroadcaster ? "host" : "audience");

      // Enable speaking volume detection (200ms for snappy visual response)
      client.enableAudioVolumeIndicator?.(200);
      client.on("volume-indicator", (volumes: unknown) => {
        const vols = volumes as { uid: number; level: number }[];
        const active = new Set<number>();
        vols.forEach(({ uid, level }) => {
          // uid === 0 = local user in some SDK versions; use me.id as fallback
          const resolvedUid = uid === 0 ? me.id : uid;
          if (level > 3) active.add(resolvedUid);
        });
        setSpeakingUids(active);
        // Auto-clear after 1.5s if no new indicator fires
        if (speakingClearTimerRef.current) clearTimeout(speakingClearTimerRef.current);
        speakingClearTimerRef.current = setTimeout(() => setSpeakingUids(new Set()), 1500);
      });

      // Remote user published
      client.on("user-published", async (remoteUser: unknown, mediaType: unknown) => {
        const ru = remoteUser as RemoteUser;
        const mt = mediaType as string;
        await client.subscribe(ru, mt);
        if (mt === "audio" && ru.audioTrack) {
          ru.audioTrack.play();
        }
        if (mt === "video") {
          setRemoteVideoUsers((prev) => new Set([...prev, ru.uid]));
        }
      });

      client.on("user-unpublished", async (remoteUser: unknown, mediaType: unknown) => {
        const ru = remoteUser as RemoteUser;
        const mt = mediaType as string;
        if (mt === "audio" && ru.audioTrack) {
          ru.audioTrack.stop();
        }
        if (mt === "video") {
          setRemoteVideoUsers((prev) => {
            const next = new Set(prev);
            next.delete(ru.uid);
            return next;
          });
        }
      });

      // Join channel
      await client.join(AGORA_APP_ID, spaceId, space.token ?? null, me.id);

      // Create and publish tracks if broadcaster
      if (shouldBeBroadcaster) {
        try {
          const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          localAudioTrackRef.current = localAudioTrack as unknown as LocalAudioTrack;

          const micOn = myUser?.mic_status === "ON";
          const tracksToPublish: unknown[] = [localAudioTrack];

          // If video mode, create camera track
          if (isVideoMode) {
            try {
              const localVideoTrack = await AgoraRTC.createCameraVideoTrack({
                encoderConfig: { width: 480, height: 640, frameRate: 15, bitrateMax: 600 },
              });
              localVideoTrackRef.current = localVideoTrack as unknown as LocalVideoTrack;
              tracksToPublish.push(localVideoTrack);
              setIsCameraOn(true);
              // play() triggered by useLayoutEffect after first render with isCameraOn=true
              await SpaceService.updateCameraStatus(spaceId, me.id, true, space, actorCompanyId);
            } catch (e) {
              console.warn("Camera init failed:", e);
            }
          }

          // Publish tracks first (Agora requires tracks to be enabled during publish)
          await client.publish(tracksToPublish);

          // THEN set mic state after publish
          if (!micOn) {
            localAudioTrackRef.current.setEnabled(false);
          }
          setIsMicOn(micOn);
        } catch (e) {
          console.error("Track creation error:", e);
        }
      }

      // Add user to space if not already present
      if (!space.users?.some((u) => isSameSpaceActor(u, me.id, actorCompanyId))) {
        const joinActor = actor ?? buildActorIdentity(me);
        const newUser: AudioSpaceUser = {
          id: me.id,
          userName: joinActor.username,
          fullName: joinActor.name,
          image: joinActor.avatar ?? "",
          deviceToken: me.device_token ?? undefined,
          deviceType: me.device_type ?? undefined,
          isVerified: me.is_verified >= 2,
          company_id: joinActor.companyId,
          profile_type: joinActor.profileType,
          display_name: joinActor.name,
          display_avatar: joinActor.avatar ?? "",
          type: "LISTENER",
          mic_status: "MUTED",
          is_camera_on: false,
        };
        await SpaceService.joinSpace(spaceId, newUser, space);
      }

      setJoined(true);
      prevRoleRef.current = shouldBeBroadcaster ? "host" : "listener";
      prevVideoModeRef.current = isVideoMode;

      // Save refs to global store for PiP / minimize
      useSpaceCallStore.getState().startCall(spaceId, space.title ?? "", me.id);
      useSpaceCallStore.getState().setRefs({
        agoraClient: client,
        agoraRTC: agoraRTCRef.current,
        localAudioTrack: localAudioTrackRef.current,
        localVideoTrack: localVideoTrackRef.current,
      });
    } catch (e) {
      console.error("Agora join error:", e);
      // Reset client ref on failure so a retry can occur
      agoraClientRef.current = null;
    }
    isJoiningRef.current = false;
    setJoining(false);
  }, [actor, actorCompanyId, isAdmin, isHost, isVideoMode, joining, me, myUser?.mic_status, space, spaceId]);

  // ═══════════ SYNC ROLE (WHEN USER IS PROMOTED/DEMOTED) ═══════════
  const syncAgoraRole = useCallback(async (nowHost: boolean) => {
    const client = agoraClientRef.current;
    if (!client || !me || !space || !joined) return;
    if (client.connectionState && client.connectionState !== "CONNECTED") return;

    try {
      if (nowHost) {
        await client.setClientRole("host");

        if (!localAudioTrackRef.current) {
          const AgoraRTC = agoraRTCRef.current?.default as { createMicrophoneAudioTrack: () => Promise<unknown> };
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          localAudioTrackRef.current = audioTrack as unknown as LocalAudioTrack;
          // Publish first (Agora requires enabled tracks), then disable
          await client.publish([audioTrack]);
          localAudioTrackRef.current.setEnabled(false);
          setIsMicOn(false);
        }

        if (isVideoMode && !localVideoTrackRef.current) {
          try {
            const AgoraRTC = agoraRTCRef.current?.default as { createCameraVideoTrack: (opts: unknown) => Promise<unknown> };
            const videoTrack = await AgoraRTC.createCameraVideoTrack({
              encoderConfig: { width: 480, height: 640, frameRate: 15, bitrateMax: 600 },
            });
            localVideoTrackRef.current = videoTrack as unknown as LocalVideoTrack;
            await client.publish([videoTrack]);
            setIsCameraOn(true);
            // play() triggered by useLayoutEffect after re-render with isCameraOn=true
          } catch { /* camera not available */ }
        }
      } else {
        if (localAudioTrackRef.current) {
          await client.unpublish([localAudioTrackRef.current as unknown]);
          localAudioTrackRef.current.close();
          localAudioTrackRef.current = null;
        }
        if (localVideoTrackRef.current) {
          await client.unpublish([localVideoTrackRef.current as unknown]);
          (localVideoTrackRef.current as unknown as { stop: () => void }).stop();
          localVideoTrackRef.current.close();
          localVideoTrackRef.current = null;
          setIsCameraOn(false);
        }
        await client.setClientRole("audience");
        setIsMicOn(false);
      }
    } catch (e) {
      console.error("Role sync error:", e);
    }
  }, [isVideoMode, joined, me, space]);

  // ═══════════ SYNC VIDEO MODE TOGGLE ═══════════
  const syncVideoMode = useCallback(async (videoEnabled: boolean) => {
    const client = agoraClientRef.current;
    if (!client || !me || !isHost || !joined) return;
    if (client.connectionState && client.connectionState !== "CONNECTED") return;

    try {
      if (videoEnabled && !localVideoTrackRef.current) {
        const AgoraRTC = agoraRTCRef.current?.default as { createCameraVideoTrack: (opts: unknown) => Promise<unknown> };
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: { width: 480, height: 640, frameRate: 15, bitrateMax: 600 },
        });
        localVideoTrackRef.current = videoTrack as unknown as LocalVideoTrack;
        await client.publish([videoTrack]);
        setIsCameraOn(true);
        // play() triggered by useLayoutEffect after re-render with isCameraOn=true
      } else if (!videoEnabled && localVideoTrackRef.current) {
        await client.unpublish([localVideoTrackRef.current as unknown]);
        await localVideoTrackRef.current.setEnabled(false);
        (localVideoTrackRef.current as unknown as { stop: () => void }).stop();
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
        setIsCameraOn(false);
      }
    } catch (e) {
      console.error("Video mode sync error:", e);
    }
  }, [isHost, joined, me]);

  // ═══════════ JOIN AGORA ON SPACE LOAD ═══════════
  // Guard with ref to prevent double-join (React StrictMode + rapid Firestore updates)
  useEffect(() => {
    if (!space || !me || joined || joining || ended) return;
    if (isJoiningRef.current) return;
    if (agoraClientRef.current) return;
    if (!AGORA_APP_ID) {
      console.error("Agora App ID not configured");
      return;
    }
    handleJoinAgora();
  }, [ended, handleJoinAgora, joined, joining, me, space]);

  // ═══════════ SYNC ROLE CHANGES (promotion/demotion) ═══════════
  useEffect(() => {
    if (!space || !me || !joined) return;
    const currentIsHost = isHost;
    const wasHost = prevRoleRef.current === "host";

    if (prevRoleRef.current !== null && currentIsHost !== wasHost) {
      syncAgoraRole(currentIsHost);
    }
    prevRoleRef.current = currentIsHost ? "host" : "listener";
  }, [isHost, joined, me, space, syncAgoraRole]);

  // ═══════════ SYNC VIDEO MODE CHANGES ═══════════
  useEffect(() => {
    if (!space || !me || !joined) return;
    const currentVideoMode = isVideoMode;

    if (prevVideoModeRef.current !== null && currentVideoMode !== prevVideoModeRef.current) {
      syncVideoMode(currentVideoMode);
    }
    prevVideoModeRef.current = currentVideoMode;
  }, [isVideoMode, joined, me, space, syncVideoMode]);

  // ═══════════ CLEANUP ═══════════
  useEffect(() => {
    return () => {
      // If minimized, skip cleanup — call persists in the global store
      const { isMinimized, activeSpaceId } = useSpaceCallStore.getState();
      if (isMinimized && activeSpaceId === spaceId) return;

      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.close();
      if (localScreenTrackRef.current) {
        localScreenTrackRef.current.video.close();
        localScreenTrackRef.current.audio?.close();
      }
      agoraClientRef.current?.leave();
      useSpaceCallStore.getState().clearCall();
    };
  }, [spaceId]);

  // ═══════════ ESCAPE KEY → MINIMIZE ═══════════
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Read latest state directly from refs + store to avoid stale closures
        const st = useSpaceCallStore.getState();
        if (!st.activeSpaceId || st.activeSpaceId !== spaceId) {
          st.startCall(spaceId, space?.title ?? "", me?.id ?? 0);
        }
        st.updateMeta({ isMicOn: localAudioTrackRef.current ? true : false });
        st.setRefs({
          agoraClient: agoraClientRef.current,
          agoraRTC: agoraRTCRef.current,
          localAudioTrack: localAudioTrackRef.current,
          localVideoTrack: localVideoTrackRef.current,
          localScreenTrack: localScreenTrackRef.current,
        });
        st.minimize();
        setTimeout(() => router.push("/feed"), 0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, router]);

  // ═══════════ MIC TOGGLE ═══════════
  const handleToggleMic = async () => {
    if (!space || !me || !isHost) return;
    const newMicOn = !isMicOn;
    setIsMicOn(newMicOn);
    localAudioTrackRef.current?.setEnabled(newMicOn);
    const newStatus: AudioSpaceMicStatus = newMicOn ? "ON" : "MUTED";
    await SpaceService.toggleMic(spaceId, me.id, newStatus, space, actorCompanyId);
  };

  // ═══════════ CAMERA TOGGLE ═══════════
  // Always destroy + recreate the video track on toggle — the only 100% reliable
  // pattern with Agora SDK v4. Avoids any internal renderer/DOM reference mismatch.
  const handleToggleCamera = async () => {
    if (!space || !me || !isHost || !isVideoMode) return;
    const client = agoraClientRef.current;
    if (!client) return;
    if (client.connectionState && client.connectionState !== "CONNECTED") return;

    if (isCameraOn && localVideoTrackRef.current) {
      // ── TURNING OFF: unpublish → destroy track ──
      try { await client.unpublish([localVideoTrackRef.current as unknown]); } catch { /* ignore */ }
      localVideoTrackRef.current.stop();  // detach renderer
      localVideoTrackRef.current.close(); // release camera hardware
      localVideoTrackRef.current = null;
      setIsCameraOn(false);
      await SpaceService.updateCameraStatus(spaceId, me.id, false, space, actorCompanyId);
    } else if (!isCameraOn) {
      // ── TURNING ON: create fresh track → publish → React re-renders with isCameraOn=true
      // useLayoutEffect fires after the DOM commit and calls play() on #local-video.
      try {
        const AgoraRTC = agoraRTCRef.current?.default as { createCameraVideoTrack: (opts: unknown) => Promise<unknown> };
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: { width: 640, height: 480, frameRate: 15, bitrateMax: 800 },
        });
        localVideoTrackRef.current = videoTrack as unknown as LocalVideoTrack;
        await client.publish([videoTrack]);
        setIsCameraOn(true);
        // useLayoutEffect handles play() after React inserts #local-video into DOM
      } catch (e) {
        console.error("Camera enable error:", e);
        return;
      }
      await SpaceService.updateCameraStatus(spaceId, me.id, true, space, actorCompanyId);
    }
  };

  // ═══════════ SCREEN SHARING ═══════════
  const handleToggleScreenShare = async () => {
    if (!space || !me || !isHost || !joined) return;
    const client = agoraClientRef.current;
    if (!client) return;
    if (client.connectionState && client.connectionState !== "CONNECTED") return;

    if (isScreenSharing) {
      if (localScreenTrackRef.current) {
        await client.unpublish([localScreenTrackRef.current.video as unknown]);
        localScreenTrackRef.current.video.close();
        localScreenTrackRef.current.audio?.close();
        localScreenTrackRef.current = null;
      }
      setIsScreenSharing(false);
      setScreenSharingUid(0);
      await SpaceService.updateSpace(spaceId, { screen_sharing_uid: 0 });

      // Re-publish camera track if it was on before screen share
      if (isCameraOn && localVideoTrackRef.current) {
        await client.publish([localVideoTrackRef.current as unknown]);
      }
    } else {
      if (screenSharingUid !== 0 && screenSharingUid !== me.id && !isAdmin) {
        return;
      }

      try {
        const AgoraRTC = agoraRTCRef.current?.default as {
          createScreenVideoTrack: (config: unknown, withAudio: string) => Promise<unknown[]>;
        };

        const tracks = await AgoraRTC.createScreenVideoTrack(
          { encoderConfig: { width: 1920, height: 1080, frameRate: 15, bitrateMax: 1500 } },
          "auto",
        );

        let screenVideoTrack: LocalVideoTrack;
        let screenAudioTrack: LocalAudioTrack | undefined;

        if (Array.isArray(tracks)) {
          screenVideoTrack = tracks[0] as unknown as LocalVideoTrack;
          screenAudioTrack = tracks[1] as unknown as LocalAudioTrack;
        } else {
          screenVideoTrack = tracks as unknown as LocalVideoTrack;
        }

        if (localVideoTrackRef.current) {
          await client.unpublish([localVideoTrackRef.current as unknown]);
        }

        const toPublish: unknown[] = [screenVideoTrack];
        if (screenAudioTrack) toPublish.push(screenAudioTrack);
        await client.publish(toPublish);

        localScreenTrackRef.current = { video: screenVideoTrack, audio: screenAudioTrack };
        setIsScreenSharing(true);
        setScreenSharingUid(me.id);
        await SpaceService.updateSpace(spaceId, { screen_sharing_uid: me.id });

        // When browser's "Stop sharing" button is clicked, clean up directly
        // using refs (always up-to-date) instead of the toggle function
        // (which would capture a stale isScreenSharing=false closure).
        (screenVideoTrack as unknown as { on: (evt: string, cb: () => void) => void }).on?.("track-ended", async () => {
          const c = agoraClientRef.current;
          const scr = localScreenTrackRef.current;
          if (scr && c) {
            try { await c.unpublish([scr.video as unknown]); } catch { /* already ended */ }
            try { scr.video.close(); } catch { /* no-op */ }
            try { scr.audio?.close(); } catch { /* no-op */ }
          }
          localScreenTrackRef.current = null;
          setIsScreenSharing(false);
          setScreenSharingUid(0);
          SpaceService.updateSpace(spaceId, { screen_sharing_uid: 0 }).catch(() => {});
          // Re-publish camera if it was on
          if (localVideoTrackRef.current && c) {
            try { await c.publish([localVideoTrackRef.current as unknown]); } catch { /* no-op */ }
          }
        });
      } catch (e) {
        // Handle user cancellation / permission denial gracefully
        const err = e as { code?: string; name?: string; message?: string };
        if (err.name === "NotAllowedError" || err.code === "PERMISSION_DENIED" || err.message?.includes("Permission denied")) {
          // User cancelled the screen share picker — do nothing, no error needed
        } else {
          console.error("Screen share error:", e);
        }
      }
    }
  };

  // ═══════════ VIDEO MODE TOGGLE (ADMIN ONLY) ═══════════
  const handleToggleVideoMode = async () => {
    if (!space || !isAdmin) return;
    await SpaceService.updateSpace(spaceId, { is_video_conference: !isVideoMode });
  };

  // ═══════════ AUDIO OUTPUT TOGGLE ═══════════
  const handleToggleAudioOutput = () => {
    const newMuted = !audioOutputMuted;
    setAudioOutputMuted(newMuted);
    const client = agoraClientRef.current;
    if (client) {
      client.remoteUsers?.forEach((u: RemoteUser) => {
        if (u.audioTrack) {
          if (newMuted) u.audioTrack.stop();
          else u.audioTrack.play();
        }
      });
    }
  };

  // ═══════════ RAISE HAND (toggle: listener → requested / requested → listener) ═══════════
  const handleRaiseHand = async () => {
    if (!space || !me) return;
    if (isRequested) {
      // Cancel the request (matching mobile toggle behavior)
      await SpaceService.cancelRequest(spaceId, me.id, space, actorCompanyId);
    } else if (isListener) {
      await SpaceService.requestToSpeak(spaceId, me.id, space, actorCompanyId);
    }
  };

  // ═══════════ HOST MANAGEMENT (ADMIN) ═══════════
  const handleAcceptRequest = async (userId: number) => {
    if (!space) return;
    await SpaceService.acceptSpeakRequest(spaceId, userId, space);
  };

  const handleRejectRequest = async (userId: number) => {
    if (!space) return;
    await SpaceService.rejectSpeakRequest(spaceId, userId, space);
  };

  const handleKickUser = async (userId: number) => {
    if (!space || !isAdmin) return;
    await SpaceService.changeUserType(spaceId, userId, "KICKED_OUT", "MUTED", space);
    setActionMenuUser(null);
  };

  const handleDemoteToListener = async (userId: number) => {
    if (!space || !isAdmin) return;
    await SpaceService.changeUserType(spaceId, userId, "LISTENER", "MUTED", space);
    setActionMenuUser(null);
  };

  const handleToggleUserMic = async (userId: number) => {
    if (!space || !isAdmin) return;
    const user = space.users?.find((u) => u.id === userId);
    if (!user) return;
    const newStatus: AudioSpaceMicStatus = user.mic_status === "ON" ? "MUTED" : "ON";
    await SpaceService.toggleMic(spaceId, userId, newStatus, space);
    setActionMenuUser(null);
  };

  const handlePromoteToHost = async (userId: number) => {
    if (!space || !isAdmin) return;
    await SpaceService.changeUserType(spaceId, userId, "HOST", "MUTED", space);
    setActionMenuUser(null);
  };

  // ═══════════ LEAVE / END ═══════════
  const handleLeave = async () => {
    if (!me || !space) return;
    // If we were screen sharing, clear it in Firestore
    if (isScreenSharing || screenSharingUid === me.id) {
      await SpaceService.updateSpace(spaceId, { screen_sharing_uid: 0 }).catch(() => {});
    }
    // If we had camera on, clear it
    if (isCameraOn) {
      await SpaceService.updateCameraStatus(spaceId, me.id, false, space, actorCompanyId).catch(() => {});
    }
    localAudioTrackRef.current?.close();
    localAudioTrackRef.current = null;
    localVideoTrackRef.current?.close();
    localVideoTrackRef.current = null;
    if (localScreenTrackRef.current) {
      localScreenTrackRef.current.video.close();
      localScreenTrackRef.current.audio?.close();
      localScreenTrackRef.current = null;
    }
    await agoraClientRef.current?.leave();
    agoraClientRef.current = null;
    useSpaceCallStore.getState().clearCall();
    await SpaceService.leaveSpace(spaceId, me.id, space, actorCompanyId);
    setShowLeaveModal(false);
    router.back();
  };

  const handleEndSpace = async () => {
    localAudioTrackRef.current?.close();
    localVideoTrackRef.current?.close();
    if (localScreenTrackRef.current) {
      localScreenTrackRef.current.video.close();
      localScreenTrackRef.current.audio?.close();
    }
    await agoraClientRef.current?.leave();
    useSpaceCallStore.getState().clearCall();
    await SpaceService.deleteSpace(spaceId);
    setShowLeaveModal(false);
    router.back();
  };

  const handleMinimize = () => {
    const store = useSpaceCallStore.getState();
    // Always re-save activeSpaceId + refs before minimizing (handles 2nd+ minimize)
    if (!store.activeSpaceId || store.activeSpaceId !== spaceId) {
      store.startCall(spaceId, space?.title ?? "", me?.id ?? 0);
    }
    store.updateMeta({ isMicOn });
    store.setRefs({
      agoraClient: agoraClientRef.current,
      agoraRTC: agoraRTCRef.current,
      localAudioTrack: localAudioTrackRef.current,
      localVideoTrack: localVideoTrackRef.current,
      localScreenTrack: localScreenTrackRef.current,
    });
    store.minimize();
    // Small delay so zustand state is visible to cleanup effect & widget
    setTimeout(() => router.push("/feed"), 0);
  };

  // ═══════════ REACTIONS ═══════════
  const handleReaction = async (emoji: string) => {
    if (!me) return;
    // Don't close emoji picker — allow multiple reactions like Google Meet
    const myName = (actor?.name || me.full_name || "").split(" ")[0] ?? "";
    showFloatingReaction(emoji, myName);
    await SpaceService.sendReaction(spaceId, me.id, emoji, actor);
  };

  const showFloatingReaction = (emoji: string, name: string) => {
    const key = reactionKeyRef.current++;
    const left = 10 + Math.random() * 60; // Random horizontal position (10-70%)
    setFloatingReactions((prev) => {
      const next = [...prev, { emoji, key, name, left }];
      return next.length > MAX_FLOATING_REACTIONS ? next.slice(-MAX_FLOATING_REACTIONS) : next;
    });
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.key !== key));
    }, 3000);
  };

  // ═══════════ MESSAGES ═══════════
  const handleSendMessage = async () => {
    if (!me || !msgText.trim()) return;
    const text = msgText.trim();
    setMsgText("");
    await SpaceService.sendMessage(spaceId, me.id, text, actor);
  };

  // ═══════════ PLAY SCREEN SHARE (local + remote) ═══════════
  // Handles both: (a) local user sees their own screen share, and
  // (b) remote users see the screen share without needing an extra click.
  // Uses a retry loop because Firestore (which creates the DOM container) and
  // Agora (which delivers the video track) update independently.
  useEffect(() => {
    if (screenSharingUid <= 0) return;
    const isLocalShare = isScreenSharing && screenSharingUid === me?.id;
    const isRemoteShare = !isLocalShare && remoteVideoUsers.has(screenSharingUid);
    if (!isLocalShare && !isRemoteShare) return;

    let cancelled = false;
    let tries = 0;
    const attempt = () => {
      if (cancelled) return;
      const el = document.getElementById(`remote-video-${screenSharingUid}`);
      if (!el) {
        // DOM not yet rendered by React — retry
        if (tries < 20) { tries++; setTimeout(attempt, 200); }
        return;
      }
      // Don't re-play if already has a video element
      if (el.querySelector("video")) return;

      if (isLocalShare && localScreenTrackRef.current) {
        localScreenTrackRef.current.video.play(el);
      } else if (isRemoteShare) {
        const client = agoraClientRef.current;
        const ru = client?.remoteUsers?.find((u: RemoteUser) => u.uid === screenSharingUid);
        if (ru?.videoTrack) {
          ru.videoTrack.play(el);
        } else if (tries < 20) {
          tries++; setTimeout(attempt, 300);
        }
      }
    };
    // Start after a frame to let React render the screen share container
    requestAnimationFrame(attempt);
    return () => { cancelled = true; };
  }, [screenSharingUid, isScreenSharing, remoteVideoUsers, me?.id]);

  // Toggle side panel (same icon closes it) — must be before early returns (Rules of Hooks)
  const togglePanel = useCallback((panel: string) => {
    setActiveTab((prev) => (prev === panel ? "room" : panel));
  }, []);

  const sidePanelOpen = activeTab === "messages" || activeTab === "members" || activeTab === "requests";

  if (!me) return null;

  if (ended) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-4">
        <div className="w-16 h-16 rounded-full bg-bg-light flex items-center justify-center">
          <Volume2 size={28} className="text-text-light" />
        </div>
        <h2 className="text-lg font-bold text-text-main">Espace terminé</h2>
        <p className="text-sm text-text-light">Cet espace a pris fin</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
        >
          Retour
        </button>
      </div>
    );
  }

  if (!space || joining) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-3">
        <Loader2 size={28} className="animate-spin text-primary" />
        <p className="text-sm text-text-light">{joining ? "Connexion à l'espace..." : "Chargement..."}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-br from-navy-dark via-[#162d4a] to-[#1B3A5C] overflow-hidden">

      {/* ─── Top bar ─── */}
      <div className="flex items-center gap-3 px-4 py-2.5 shrink-0 bg-gradient-to-r from-navy/80 to-navy-dark/80 border-b border-primary/10 backdrop-blur-sm">
        <button onClick={handleMinimize} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer" title="Réduire">
          <ArrowLeft size={16} className="text-white/70" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[13px] font-semibold text-white truncate">{space.title}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1.5 text-[11px] text-white/40">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
              {activeUsers.length} participant{activeUsers.length > 1 ? "s" : ""}
            </span>
            {isVideoMode && (
              <span className="px-1.5 py-[1px] bg-primary/20 border border-primary/30 rounded text-[9px] font-bold text-primary">VIDÉO</span>
            )}
            {screenSharingUid > 0 && (
              <span className="px-1.5 py-[1px] bg-cyan/20 border border-cyan/30 rounded text-[9px] font-bold text-cyan flex items-center gap-1">
                <Monitor size={8} /> Partage
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleMinimize}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            title="Réduire (continuer en arrière-plan)"
          >
            <Minus size={15} className="text-white/60" />
          </button>
        </div>
      </div>

      {/* ─── Main content area: Room + Side panel ─── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Room (always visible) */}
        <div className={`flex-1 overflow-y-auto px-4 py-4 transition-all duration-300 ${sidePanelOpen ? "mr-0" : ""}`}>
          <RoomView
            hosts={hosts}
            listeners={listeners}
            requests={requests}
            isAdmin={isAdmin}
            isVideoMode={isVideoMode}
            isCameraOn={isCameraOn}
            localVideoTrack={localVideoTrackRef.current}
            myId={me.id}
            remoteVideoUsers={remoteVideoUsers}
            screenSharingUid={screenSharingUid}
            speakingUids={speakingUids}
            onAcceptRequest={handleAcceptRequest}
            onRejectRequest={handleRejectRequest}
          />
        </div>

        {/* ─── Side panel (slides from right, like Google Meet) ─── */}
        <div className={`shrink-0 border-l border-primary/10 bg-navy-dark/95 backdrop-blur-md flex flex-col overflow-hidden transition-all duration-300 ${
          sidePanelOpen ? "w-[340px] opacity-100" : "w-0 opacity-0"
        }`}>
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10 shrink-0">
            <h3 className="text-[13px] font-semibold text-white">
              {activeTab === "messages" && `Messages (${messages.length})`}
              {activeTab === "members" && `Membres (${activeUsers.length})`}
              {activeTab === "requests" && `Demandes (${requests.length})`}
            </h3>
            <button
              onClick={() => setActiveTab("room")}
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={14} className="text-white/50" />
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {activeTab === "messages" && (
              <MessagesView
                messages={messages}
                spaceUsers={[...(space.users ?? []), ...(space.leaved_users ?? [])]}
                myId={me.id}
                myCompanyId={actorCompanyId}
                msgEndRef={msgEndRef}
              />
            )}
            {activeTab === "members" && (
              <MembersView
                hosts={hosts}
                listeners={listeners}
                requests={requests}
                isAdmin={isAdmin}
                myId={me.id}
                actionMenuUser={actionMenuUser}
                setActionMenuUser={setActionMenuUser}
                onAcceptRequest={handleAcceptRequest}
                onRejectRequest={handleRejectRequest}
                onKick={handleKickUser}
                onDemote={handleDemoteToListener}
                onToggleMic={handleToggleUserMic}
                onPromote={handlePromoteToHost}
              />
            )}
            {activeTab === "requests" && isAdmin && (
              <RequestsView
                requests={requests}
                onAcceptRequest={handleAcceptRequest}
                onRejectRequest={handleRejectRequest}
              />
            )}
          </div>

          {/* Message input inside side panel */}
          {activeTab === "messages" && (
            <div className="px-3 py-2.5 border-t border-primary/10 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                  placeholder="Votre message..."
                  className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] text-white text-[13px] placeholder-white/30 focus:outline-none focus:bg-white/10 border border-white/[0.06] focus:border-primary/40 transition-colors"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!msgText.trim()}
                  className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center cursor-pointer disabled:opacity-30 hover:bg-primary-hover transition-colors"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Floating reactions (over the room area) ─── */}
      <div className="absolute bottom-24 left-0 right-0 pointer-events-none z-40 overflow-hidden" style={{ height: 280 }}>
        {floatingReactions.map((r) => (
          <div
            key={r.key}
            className="absolute bottom-0 reaction-float flex flex-col items-center gap-0.5"
            style={{ left: `${r.left}%` }}
          >
            <span className="text-3xl drop-shadow-lg">{r.emoji}</span>
            {r.name && (
              <span className="text-[10px] text-white/60 font-medium bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-sm whitespace-nowrap">{r.name}</span>
            )}
          </div>
        ))}
      </div>

      {/* ─── Bottom Control Bar (always visible, Google Meet style) ─── */}
      <div className="px-4 py-3 shrink-0 bg-gradient-to-r from-navy-dark/90 to-navy/90 backdrop-blur-md border-t border-primary/10 relative z-30">
        {/* Emoji picker (above controls) */}
        {showEmojis && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-1.5 bg-navy/95 border border-primary/15 rounded-2xl px-3 py-2 shadow-2xl backdrop-blur-md animate-fadeIn">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-2xl transition-all hover:scale-110 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          {/* Leave / End call — opens confirmation modal */}
          <button
            onClick={() => setShowLeaveModal(true)}
            className="h-10 px-5 rounded-full bg-red/90 hover:bg-red text-white flex items-center justify-center gap-2 transition-colors cursor-pointer text-[13px] font-medium shadow-lg shadow-red/20"
            title="Quitter"
          >
            <Phone size={16} className="rotate-[135deg]" />
            <span className="hidden sm:inline">Quitter</span>
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Mic toggle / Raise hand */}
          {isHost ? (
            <button
              onClick={handleToggleMic}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isMicOn
                  ? "bg-primary/20 text-primary hover:bg-primary/30 ring-1 ring-primary/30"
                  : "bg-red/20 text-red hover:bg-red/30"
              }`}
              title={isMicOn ? "Couper le micro" : "Activer le micro"}
            >
              {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
          ) : isRequested ? (
            <button
              onClick={handleRaiseHand}
              className="w-10 h-10 rounded-full bg-orange/20 text-orange flex items-center justify-center transition-colors cursor-pointer hover:bg-orange/30 animate-pulse"
              title="Annuler la demande"
            >
              <Hand size={18} />
            </button>
          ) : (
            <button
              onClick={handleRaiseHand}
              className="w-10 h-10 rounded-full bg-white/[0.08] text-white flex items-center justify-center transition-colors cursor-pointer hover:bg-white/15"
              title="Lever la main"
            >
              <Hand size={18} />
            </button>
          )}

          {/* Camera toggle (hosts in video mode) */}
          {isHost && isVideoMode && (
            <button
              onClick={handleToggleCamera}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isCameraOn
                  ? "bg-primary/20 text-primary hover:bg-primary/30 ring-1 ring-primary/30"
                  : "bg-red/20 text-red hover:bg-red/30"
              }`}
              title={isCameraOn ? "Couper la caméra" : "Activer la caméra"}
            >
              {isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
          )}

          {/* Screen share (hosts, VIDEO MODE ONLY) */}
          {isHost && isVideoMode && (
            <button
              onClick={handleToggleScreenShare}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isScreenSharing
                  ? "bg-cyan/20 text-cyan hover:bg-cyan/30 ring-1 ring-cyan/30"
                  : "bg-white/[0.08] text-white hover:bg-white/15"
              }`}
              title={isScreenSharing ? "Arrêter le partage" : "Partager l'écran"}
            >
              {isScreenSharing ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}
            </button>
          )}

          {/* Audio output */}
          <button
            onClick={handleToggleAudioOutput}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              audioOutputMuted
                ? "bg-red/20 text-red hover:bg-red/30"
                : "bg-white/[0.08] text-white hover:bg-white/15"
            }`}
            title={audioOutputMuted ? "Réactiver le son" : "Couper le son"}
          >
            {audioOutputMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Video mode toggle (admin only) */}
          {isAdmin && (
            <button
              onClick={handleToggleVideoMode}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isVideoMode
                  ? "bg-primary/20 text-primary hover:bg-primary/30 ring-1 ring-primary/30"
                  : "bg-white/[0.08] text-white hover:bg-white/15"
              }`}
              title={isVideoMode ? "Passer en audio" : "Passer en vidéo"}
            >
              <Monitor size={18} />
            </button>
          )}

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Emoji reaction */}
          <button
            onClick={() => setShowEmojis(!showEmojis)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              showEmojis
                ? "bg-primary/20 text-primary"
                : "bg-white/[0.08] text-white hover:bg-white/15"
            }`}
            title="Réactions"
          >
            <Smile size={18} />
          </button>

          {/* Side panel toggles */}
          <button
            onClick={() => togglePanel("messages")}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer relative ${
              activeTab === "messages"
                ? "bg-primary/20 text-primary"
                : "bg-white/[0.08] text-white hover:bg-white/15"
            }`}
            title="Messages"
          >
            <MessageSquare size={18} />
            {messages.length > 0 && activeTab !== "messages" && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-magenta text-white text-[9px] font-bold flex items-center justify-center">
                {messages.length > 99 ? "99" : messages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => togglePanel("members")}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              activeTab === "members"
                ? "bg-primary/20 text-primary"
                : "bg-white/[0.08] text-white hover:bg-white/15"
            }`}
            title="Membres"
          >
            <Users size={18} />
          </button>

          {isAdmin && requests.length > 0 && (
            <button
              onClick={() => togglePanel("requests")}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer relative ${
                activeTab === "requests"
                  ? "bg-orange/20 text-orange"
                  : "bg-white/[0.08] text-white hover:bg-white/15"
              }`}
              title="Demandes"
            >
              <Hand size={18} />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-orange text-white text-[9px] font-bold flex items-center justify-center">
                {requests.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Custom Leave Confirmation Modal ─── */}
      {showLeaveModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gradient-to-b from-navy to-navy-dark border border-primary/15 rounded-2xl p-6 w-[340px] shadow-2xl shadow-black/40 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red/20 flex items-center justify-center">
                <Phone size={18} className="text-red rotate-[135deg]" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-white">Quitter l&apos;espace</h3>
                <p className="text-[12px] text-white/40 mt-0.5">Vous allez quitter la conférence</p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleLeave}
                className="w-full py-2.5 rounded-xl bg-red/90 hover:bg-red text-white text-[13px] font-semibold transition-colors cursor-pointer"
              >
                Quitter l&apos;espace
              </button>
              {isAdmin && (
                <button
                  onClick={handleEndSpace}
                  className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-red text-[13px] font-semibold transition-colors cursor-pointer border border-red/20"
                >
                  Terminer pour tous
                </button>
              )}
              <button
                onClick={() => setShowLeaveModal(false)}
                className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white/70 text-[13px] font-medium transition-colors cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for floating reactions (scoped) */}
      <style jsx>{`
        .reaction-float {
          animation: reactionFloatUp 3s ease-out forwards;
        }
        @keyframes reactionFloatUp {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          60%  { opacity: 1; transform: translateY(-200px) scale(1.2); }
          100% { opacity: 0; transform: translateY(-260px) scale(1.2); }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ROOM VIEW — Google Meet–style adaptive layout
   ═══════════════════════════════════════════════════ */
function RoomView({
  hosts, listeners, requests, isAdmin, isVideoMode, isCameraOn, localVideoTrack, myId,
  remoteVideoUsers, screenSharingUid, speakingUids, onAcceptRequest, onRejectRequest,
}: {
  hosts: AudioSpaceUser[];
  listeners: AudioSpaceUser[];
  requests: AudioSpaceUser[];
  isAdmin: boolean;
  isVideoMode: boolean;
  isCameraOn: boolean;
  localVideoTrack: LocalVideoTrack | null;
  myId: number;
  remoteVideoUsers: Set<number>;
  screenSharingUid: number;
  speakingUids: Set<number>;
  onAcceptRequest: (id: number) => void;
  onRejectRequest: (id: number) => void;
}) {
  const totalHosts = hosts.length;
  const hasScreenShare = screenSharingUid > 0;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* ── SCREEN SHARE: 16:9 ratio so shared screen fills exactly ── */}
      {hasScreenShare && (
        <div className="w-full rounded-2xl overflow-hidden border border-cyan/20 shadow-xl shadow-cyan/5 shrink-0 bg-[#0d2140]">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan/10 to-transparent border-b border-cyan/15 shrink-0">
            <Monitor size={12} className="text-cyan" />
            <span className="text-[11px] font-medium text-cyan">
              Partage d&apos;écran{screenSharingUid === myId ? " (vous)" : ""}
            </span>
          </div>
          {/* Video region — 16:9 aspect ratio, fills width, adapts to viewport */}
          <div
            id={`remote-video-${screenSharingUid}`}
            className="w-full video-contain"
            style={{ aspectRatio: "16 / 9", maxHeight: "70vh" }}
          />
        </div>
      )}

      {/* ── SPEAKERS AREA ── */}
      <div>
        {/* Section label */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-primary to-cyan" />
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-widest">Intervenants</h3>
          <span className="ml-auto text-[11px] text-white/30">{totalHosts}</span>
        </div>

        {isVideoMode ? (
          /* ── VIDEO MODE: Google Meet grid ── */
          <VideoGrid
            hosts={hosts}
            myId={myId}
            isCameraOn={isCameraOn}
            localVideoTrack={localVideoTrack}
            remoteVideoUsers={remoteVideoUsers}
            speakingUids={speakingUids}
            hasScreenShare={hasScreenShare}
          />
        ) : (
          /* ── AUDIO MODE: large centered circles like Google Meet ── */
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-wrap gap-10 justify-center items-center">
              {hosts.map((u) => (
                <AudioBubble
                  key={u.id}
                  user={u}
                  isSpeaking={speakingUids.has(u.id)}
                  totalCount={totalHosts}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── REQUESTS (admin only) ── */}
      {isAdmin && requests.length > 0 && (
        <div className="shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
            <h3 className="text-xs font-semibold text-amber-400/70 uppercase tracking-widest">Demandes de parole</h3>
            <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">{requests.length}</span>
          </div>
          <div className="space-y-2">
            {requests.map((u) => (
              <div key={u.id} className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.04]">
                <Avatar src={u.image ? addBaseURL(u.image) : null} alt={u.fullName ?? ""} size={32} />
                <span className="flex-1 text-[13px] text-white/80 truncate font-medium">{u.fullName}</span>
                <button onClick={() => onAcceptRequest(u.id)} className="w-7 h-7 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center cursor-pointer hover:bg-green-500/30 transition-colors">
                  <Check size={14} />
                </button>
                <button onClick={() => onRejectRequest(u.id)} className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center cursor-pointer hover:bg-red-500/30 transition-colors">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LISTENERS ── */}
      {listeners.length > 0 && (
        <div className="shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-white/20" />
            <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest">À l&apos;écoute</h3>
            <span className="ml-auto text-[11px] text-white/20">{listeners.length}</span>
          </div>
          <div className="flex flex-wrap gap-5 justify-center">
            {listeners.map((u) => (
              <div key={u.id} className="flex flex-col items-center gap-2 group">
                <div className="rounded-full p-[1.5px] bg-gradient-to-b from-white/20 to-transparent">
                  <Avatar src={u.image ? addBaseURL(u.image) : null} alt={u.fullName ?? ""} size={82} />
                </div>
                <span className="text-[11px] text-white/50 truncate max-w-[80px] text-center group-hover:text-white/70 transition-colors">{u.fullName?.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════ VIDEO GRID — Google Meet adaptive ═══════════ */
// ─── LocalVideoTile: plays the local camera track into a container div ───
// Uses a callback ref (fires synchronously during React commit) combined with
// a retry loop to handle Agora SDK timing quirks.  We NEVER call track.stop()
// in cleanup — the parent manages track lifecycle (close/unpublish).
function LocalVideoTile({ track }: { track: LocalVideoTrack }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playedRef = useRef(false);

  const playTrack = useCallback((el: HTMLDivElement | null) => {
    if (!el || !track) return;
    playedRef.current = false;
    let tries = 0;
    const attempt = () => {
      if (playedRef.current) return;
      try {
        // Clear any previous Agora-injected elements
        el.innerHTML = "";
        track.play(el);
        playedRef.current = true;
      } catch {
        if (tries < 12) {
          tries += 1;
          setTimeout(attempt, 150);
        }
      }
    };
    // Small delay to let the DOM settle after React commit
    requestAnimationFrame(() => attempt());
  }, [track]);

  // When the track reference changes, re-play into existing container
  useEffect(() => {
    if (containerRef.current && track) {
      playTrack(containerRef.current);
    }
  }, [track, playTrack]);

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (node) playTrack(node);
  }, [playTrack]);

  return (
    <div
      ref={setContainerRef}
      className="absolute inset-0 video-fill"
      style={{ width: "100%", height: "100%", minHeight: 1 }}
    />
  );
}

function VideoGrid({
  hosts, myId, isCameraOn, localVideoTrack, remoteVideoUsers, speakingUids, hasScreenShare,
}: {
  hosts: AudioSpaceUser[];
  myId: number;
  isCameraOn: boolean;
  localVideoTrack: LocalVideoTrack | null;
  remoteVideoUsers: Set<number>;
  speakingUids: Set<number>;
  hasScreenShare: boolean;
}) {
  const hasMeInHosts = hosts.some((u) => u.id === myId);
  const gridHosts = !hasMeInHosts && isCameraOn
    ? [{ id: myId, fullName: "Vous", image: "", type: "HOST", mic_status: "ON", is_camera_on: true } as AudioSpaceUser, ...hosts]
    : hosts;

  const count = gridHosts.length;

  // Grid layout
  const gridClass = hasScreenShare
    ? "flex flex-wrap gap-3 justify-center"
    : count <= 1
      ? "grid grid-cols-1 gap-4 max-w-2xl mx-auto"
      : count <= 2
        ? "grid grid-cols-2 gap-4"
        : count <= 4
          ? "grid grid-cols-2 gap-3"
          : count <= 6
            ? "grid grid-cols-3 gap-3"
            : "grid grid-cols-3 lg:grid-cols-4 gap-2";

  // Tile height: explicit (not min-height) so absolute inset-0 children always fill reliably
  const tileH: string | number = hasScreenShare
    ? 200
    : count <= 1 ? "65vh"
    : count <= 2 ? "50vh"
    : count <= 4 ? "40vh"
    : count <= 6 ? "34vh"
    : "28vh";

  return (
    <div className={`${gridClass} w-full`}>
      {gridHosts.map((u) => {
        const isMe = u.id === myId;
        const hasRemoteVideo = remoteVideoUsers.has(u.id);
        const showVideo = isMe ? isCameraOn : hasRemoteVideo;
        const isSpeaking = speakingUids.has(u.id);
        const avatarSize = hasScreenShare ? 52 : count <= 2 ? 96 : count <= 4 ? 72 : 56;

        return (
          <div
            key={u.id}
            style={{
              height: tileH,
              width: hasScreenShare ? 220 : undefined,
              // Background on the outer wrapper prevents transparent flash during
              // React reconciliation (when video div is removed and gradient div is inserted)
              background: "#1a3a60",
            }}
            className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
              isSpeaking
                ? "border-[3px] border-primary shadow-[0_0_24px_rgba(42,171,171,0.35)]"
                : "border border-white/[0.08]"
            }`}
          >
            {showVideo ? (
              /* Live video feed */
              isMe
                ? (localVideoTrack ? <LocalVideoTile track={localVideoTrack} /> : null)
                : <div id={`remote-video-${u.id}`} className="absolute inset-0 video-fill" />
            ) : (
              /* Camera off — bright, clearly-blue gradient (NOT dark/black) */
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{
                  background: "radial-gradient(ellipse at 40% 35%, #2a5991 0%, #1e4878 45%, #163d68 100%)",
                }}
              >
                {/* Speaking ring (gradient-border, overflow-safe) */}
                <div
                  className="relative"
                  style={{ width: avatarSize + 8, height: avatarSize + 8 }}
                >
                  <div
                    className={`absolute inset-0 rounded-full transition-opacity duration-200 ${
                      isSpeaking ? "speaks-ring" : "opacity-0"
                    }`}
                  />
                  <div className="absolute inset-1 rounded-full overflow-hidden bg-[#1e4878]">
                    <Avatar
                      src={u.image ? addBaseURL(u.image) : null}
                      alt={u.fullName ?? ""}
                      size={avatarSize}
                    />
                  </div>
                </div>
                <span className="text-[13px] text-white/80 font-semibold">{u.fullName?.split(" ")[0]}</span>
                <span className="text-[11px] text-white/40">Caméra désactivée</span>
              </div>
            )}

            {/* Name + mic + speaking wave overlay */}
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none">
              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  u.mic_status === "ON" ? "bg-primary/30" : "bg-red-500/20"
                }`}>
                  {u.mic_status === "ON"
                    ? <Mic size={10} className="text-primary" />
                    : <MicOff size={10} className="text-red-400" />}
                </div>
                <span className="text-[11px] text-white font-medium truncate flex-1">{u.fullName?.split(" ")[0]}</span>
                {u.type === "ADMIN" && (
                  <span className="px-1.5 py-[1px] bg-primary/20 border border-primary/30 rounded text-[8px] text-primary font-bold shrink-0">ADMIN</span>
                )}
                {/* Animated wave bars when speaking */}
                {isSpeaking && (
                  <div className="flex items-end gap-[2px] h-4 ml-1 shrink-0">
                    <div className="w-[3px] rounded-full bg-primary" style={{ animation: 'audioWave1 0.7s ease-in-out infinite', height: '35%' }} />
                    <div className="w-[3px] rounded-full bg-primary" style={{ animation: 'audioWave2 0.7s ease-in-out infinite 0.1s', height: '100%' }} />
                    <div className="w-[3px] rounded-full bg-cyan" style={{ animation: 'audioWave3 0.7s ease-in-out infinite 0.2s', height: '60%' }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════ AUDIO BUBBLE — Google Meet large circle ═══════════ */
function AudioBubble({ user, isSpeaking, totalCount }: { user: AudioSpaceUser; isSpeaking: boolean; totalCount: number }) {
  const micOn = user.mic_status === "ON";

  // Adaptive sizing: large when few people, shrinks as more join (like Google Meet)
  const size = totalCount <= 2 ? 120 : totalCount <= 4 ? 100 : totalCount <= 6 ? 80 : 68;
  // Ring adds 4px on each side = 8px total
  const ringSize = size + 8;

  return (
    <div className="flex flex-col items-center gap-3" style={{ width: ringSize + 36 }}>
      {/* Avatar + ring container */}
      <div className="relative" style={{ width: ringSize, height: ringSize }}>
        {/* Speaking ring: gradient bg visible in 4px gap between ring-div and avatar-div */}
        <div
          className={`absolute inset-0 rounded-full transition-opacity duration-200 ${
            isSpeaking ? "speaks-ring" : "opacity-0"
          }`}
        />
        {/* Avatar — inset-1 = 4px from ring edge (Tailwind 1 = 4px) */}
        <div className="absolute inset-1 rounded-full overflow-hidden bg-navy-dark">
          <Avatar
            src={user.image ? addBaseURL(user.image) : null}
            alt={user.fullName ?? ""}
            size={size}
          />
        </div>
        {/* Mic badge */}
        <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 border-[#162d4a] ${
          micOn ? "bg-primary" : "bg-navy"
        }`}>
          {micOn ? <Mic size={12} className="text-white" /> : <MicOff size={12} className="text-white/50" />}
        </div>
      </div>

      {/* Name + role + speaking waves */}
      <div className="flex flex-col items-center gap-1">
        <p
          className="text-[13px] text-white/80 truncate font-medium leading-tight text-center"
          style={{ maxWidth: ringSize + 20 }}
        >
          {user.fullName?.split(" ")[0]}
        </p>
        <p className={`text-[10px] font-medium ${user.type === "ADMIN" ? "text-primary" : "text-white/30"}`}>
          {user.type === "ADMIN" ? "Admin" : "Hôte"}
        </p>
        {/* Animated wave bars when speaking */}
        {isSpeaking && (
          <div className="flex items-end gap-[3px] h-3.5 mt-0.5">
            <div className="w-[3px] rounded-full bg-primary" style={{ animation: 'audioWave1 0.7s ease-in-out infinite', height: '35%' }} />
            <div className="w-[3px] rounded-full bg-cyan" style={{ animation: 'audioWave2 0.7s ease-in-out infinite 0.1s', height: '100%' }} />
            <div className="w-[3px] rounded-full bg-primary" style={{ animation: 'audioWave3 0.7s ease-in-out infinite 0.2s', height: '60%' }} />
            <div className="w-[3px] rounded-full bg-cyan" style={{ animation: 'audioWave1 0.7s ease-in-out infinite 0.15s', height: '45%' }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MESSAGES VIEW
   ═══════════════════════════════════════════════════ */
function MessagesView({
  messages, spaceUsers, myId, myCompanyId, msgEndRef,
}: {
  messages: AudioSpaceMessage[];
  spaceUsers: AudioSpaceUser[];
  myId: number;
  myCompanyId: number | null;
  msgEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const findUser = (userId: number, companyId?: number | null) =>
    spaceUsers.find((u) => isSameSpaceActor(u, userId, companyId));

  return (
    <div className="space-y-2.5">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <MessageSquare size={28} className="text-white/15" />
          <p className="text-[13px] text-white/30">Aucun message</p>
          <p className="text-[11px] text-white/20">Les messages du chat apparaîtront ici</p>
        </div>
      )}
      {messages.map((msg) => {
        const sender = findUser(msg.userId, msg.sender_company_id);
        const isMine = isSameSpaceActor(
          { id: msg.userId, company_id: msg.sender_company_id ?? null, type: "LISTENER", mic_status: "MUTED" },
          myId,
          myCompanyId,
        );
        const senderName = msg.sender_name || sender?.display_name || sender?.fullName || "Utilisateur";
        const senderAvatar = msg.sender_avatar || sender?.display_avatar || sender?.image || "";
        return (
          <div key={msg.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
            <Avatar src={senderAvatar ? addBaseURL(senderAvatar) : null} alt={senderName} size={28} />
            <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
              isMine
                ? "bg-primary/20 border border-primary/20 text-white"
                : "bg-white/[0.04] border border-white/[0.04] text-white/90"
            }`}>
              {!isMine && (
                <p className="text-[10px] text-primary/70 mb-0.5 font-medium">
                  {msg.sender_profile_type === "company" ? "Entreprise · " : ""}{senderName}
                </p>
              )}
              <p className="text-[13px] leading-relaxed">{msg.content}</p>
              <p className={`text-[9px] mt-0.5 ${isMine ? "text-white/30" : "text-white/20"}`}>
                {msg.time ? msg.time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={msgEndRef} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MEMBERS VIEW
   ═══════════════════════════════════════════════════ */
function MembersView({
  hosts, listeners, requests, isAdmin, myId, actionMenuUser, setActionMenuUser,
  onAcceptRequest, onRejectRequest, onKick, onDemote, onToggleMic, onPromote,
}: {
  hosts: AudioSpaceUser[];
  listeners: AudioSpaceUser[];
  requests: AudioSpaceUser[];
  isAdmin: boolean;
  myId: number;
  actionMenuUser: number | null;
  setActionMenuUser: (id: number | null) => void;
  onAcceptRequest: (id: number) => void;
  onRejectRequest: (id: number) => void;
  onKick: (id: number) => void;
  onDemote: (id: number) => void;
  onToggleMic: (id: number) => void;
  onPromote: (id: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Hosts */}
      <div>
        <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">
          Intervenants ({hosts.length})
        </h3>
        {hosts.map((u) => (
          <MemberRow
            key={`${u.id}-${u.company_id ?? "user"}`}
            user={u}
            roleLabel={u.type === "ADMIN" ? "Admin" : "Hôte"}
            roleColor="primary"
            isAdmin={isAdmin}
            isMe={u.id === myId}
            isUserAdmin={u.type === "ADMIN"}
            actionMenuOpen={actionMenuUser === u.id}
            onToggleMenu={() => setActionMenuUser(actionMenuUser === u.id ? null : u.id)}
            onKick={() => onKick(u.id)}
            onDemote={() => onDemote(u.id)}
            onToggleMic={() => onToggleMic(u.id)}
          />
        ))}
      </div>

      {/* Requests */}
      {isAdmin && requests.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-orange/80 uppercase tracking-wider mb-2">
            Demandes ({requests.length})
          </h3>
          {requests.map((u) => (
            <div key={`${u.id}-${u.company_id ?? "user"}`} className="flex items-center gap-3 py-2">
              <Avatar src={(u.display_avatar || u.image) ? addBaseURL(u.display_avatar || u.image || "") : null} alt={u.display_name || u.fullName || ""} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 truncate font-medium">{u.display_name || u.fullName}</p>
                <p className="text-[10px] text-white/40">@{u.userName}</p>
              </div>
              <button onClick={() => onAcceptRequest(u.id)} className="px-3 py-1 rounded-lg bg-green/80 text-white text-xs font-semibold cursor-pointer">Accepter</button>
              <button onClick={() => onRejectRequest(u.id)} className="px-3 py-1 rounded-lg bg-white/10 text-white/60 text-xs font-semibold cursor-pointer">Refuser</button>
            </div>
          ))}
        </div>
      )}

      {/* Listeners */}
      <div>
        <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">
          Auditeurs ({listeners.length})
        </h3>
        {listeners.map((u) => (
          <MemberRow
            key={`${u.id}-${u.company_id ?? "user"}`}
            user={u}
            roleLabel="Auditeur"
            roleColor="white/40"
            isAdmin={isAdmin}
            isMe={u.id === myId}
            isUserAdmin={false}
            actionMenuOpen={actionMenuUser === u.id}
            onToggleMenu={() => setActionMenuUser(actionMenuUser === u.id ? null : u.id)}
            onKick={() => onKick(u.id)}
            onPromote={() => onPromote(u.id)}
          />
        ))}
      </div>
    </div>
  );
}

function MemberRow({ user, roleLabel, roleColor, isAdmin, isMe, isUserAdmin, actionMenuOpen, onToggleMenu, onKick, onDemote, onToggleMic, onPromote }: {
  user: AudioSpaceUser;
  roleLabel: string;
  roleColor: string;
  isAdmin: boolean;
  isMe: boolean;
  isUserAdmin: boolean;
  actionMenuOpen: boolean;
  onToggleMenu: () => void;
  onKick?: () => void;
  onDemote?: () => void;
  onToggleMic?: () => void;
  onPromote?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 relative">
      <Avatar src={(user.display_avatar || user.image) ? addBaseURL(user.display_avatar || user.image || "") : null} alt={user.display_name || user.fullName || ""} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80 truncate font-medium">{user.display_name || user.fullName}</p>
        <p className="text-[10px] text-white/40">@{user.userName}</p>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold bg-${roleColor}/20 text-${roleColor}`}>
        {roleLabel}
      </span>
      {isAdmin && !isMe && !isUserAdmin && (
        <button onClick={onToggleMenu} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer">
          <MoreVertical size={14} className="text-white/50" />
        </button>
      )}

      {/* Action menu dropdown */}
      {actionMenuOpen && isAdmin && !isMe && !isUserAdmin && (
        <div className="absolute right-0 top-10 z-20 bg-bg-dark border border-white/10 rounded-xl shadow-lg py-1 min-w-[160px]">
          {onPromote && user.type === "LISTENER" && (
            <button onClick={onPromote} className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 cursor-pointer flex items-center gap-2">
              <Mic size={14} /> Promouvoir hôte
            </button>
          )}
          {onDemote && user.type === "HOST" && (
            <button onClick={onDemote} className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 cursor-pointer flex items-center gap-2">
              <UserMinus size={14} /> Rétrograder
            </button>
          )}
          {onToggleMic && (user.type === "HOST" || user.type === "ADMIN") && (
            <button onClick={onToggleMic} className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 cursor-pointer flex items-center gap-2">
              <MicOffIcon size={14} /> {user.mic_status === "ON" ? "Couper micro" : "Activer micro"}
            </button>
          )}
          {onKick && (
            <button onClick={onKick} className="w-full text-left px-4 py-2 text-sm text-red/80 hover:bg-white/10 cursor-pointer flex items-center gap-2">
              <X size={14} /> Expulser
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   REQUESTS VIEW — Admin-only 4th tab (matching mobile)
   ═══════════════════════════════════════════════════ */
function RequestsView({
  requests, onAcceptRequest, onRejectRequest,
}: {
  requests: AudioSpaceUser[];
  onAcceptRequest: (id: number) => void;
  onRejectRequest: (id: number) => void;
}) {
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Hand size={36} className="text-white/20" />
        <p className="text-sm text-white/40 font-medium">Aucune demande en attente</p>
        <p className="text-xs text-white/25">Les demandes de prise de parole apparaîtront ici</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-white/40 mb-3">
        {requests.length} demande{requests.length > 1 ? "s" : ""} de prise de parole
      </p>
      {requests.map((u) => (
        <div key={u.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/5 hover:border-orange/20 transition-colors">
          <Avatar src={u.image ? addBaseURL(u.image) : null} alt={u.fullName ?? ""} size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/90 truncate font-medium">{u.fullName}</p>
            <p className="text-[10px] text-white/40">@{u.userName}</p>
          </div>
          <button
            onClick={() => onAcceptRequest(u.id)}
            className="px-4 py-1.5 rounded-lg bg-green/80 text-white text-xs font-semibold cursor-pointer hover:bg-green transition-colors"
          >
            Accepter
          </button>
          <button
            onClick={() => onRejectRequest(u.id)}
            className="px-4 py-1.5 rounded-lg bg-white/10 text-white/60 text-xs font-semibold cursor-pointer hover:bg-white/20 transition-colors"
          >
            Refuser
          </button>
        </div>
      ))}
    </div>
  );
}
