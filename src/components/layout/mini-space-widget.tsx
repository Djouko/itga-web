"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, PhoneOff, Maximize2 } from "lucide-react";
import { useSpaceCallStore } from "@/lib/store";
import { SpaceService } from "@/lib/services/space-service";

export function MiniSpaceWidget() {
  const router = useRouter();
  const { activeSpaceId, isMinimized, spaceTitle, participantCount, isMicOn, _refs } =
    useSpaceCallStore();

  const handleToggleMic = useCallback(() => {
    const track = _refs.localAudioTrack;
    if (!track || typeof track !== "object") return;
    const audio = track as { setEnabled: (v: boolean) => void };
    const newState = !isMicOn;
    audio.setEnabled(newState);
    useSpaceCallStore.getState().updateMeta({ isMicOn: newState });
  }, [_refs.localAudioTrack, isMicOn]);

  const handleLeave = useCallback(async () => {
    const store = useSpaceCallStore.getState();
    const { _refs: refs } = store;

    // Close Agora tracks & leave
    try {
      const closeable = (t: unknown) => {
        if (t && typeof t === "object" && "close" in t)
          (t as { close: () => void }).close();
      };
      closeable(refs.localAudioTrack);
      closeable(refs.localVideoTrack);
      if (refs.localScreenTrack && typeof refs.localScreenTrack === "object") {
        const st = refs.localScreenTrack as {
          video?: { close: () => void };
          audio?: { close: () => void };
        };
        st.video?.close();
        st.audio?.close();
      }
      if (
        refs.agoraClient &&
        typeof refs.agoraClient === "object" &&
        "leave" in refs.agoraClient
      ) {
        await (refs.agoraClient as { leave: () => Promise<void> }).leave();
      }
    } catch {
      /* best-effort cleanup */
    }

    // Leave in Firestore
    if (store.activeSpaceId && store.userId) {
      try {
        await SpaceService.leaveMinimizedCall(store.activeSpaceId, store.userId);
      } catch {
        console.warn("[MiniSpaceWidget] Failed to leave space in Firestore");
      }
    }

    store.clearCall();
  }, []);

  const handleExpand = useCallback(() => {
    if (activeSpaceId) router.push(`/spaces/${activeSpaceId}`);
  }, [activeSpaceId, router]);

  if (!activeSpaceId || !isMinimized) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slideUp">
      <div className="flex items-center gap-3 bg-navy border border-primary/20 rounded-2xl px-4 py-2.5 shadow-2xl shadow-navy-dark/60">
        {/* Pulse indicator */}
        <span className="w-2.5 h-2.5 rounded-full bg-cyan animate-pulse shrink-0" />

        {/* Info */}
        <div className="min-w-0 mr-1">
          <p className="text-[13px] font-semibold text-white truncate max-w-[160px]">
            {spaceTitle || "Espace"}
          </p>
          <p className="text-[11px] text-white/40">
            {participantCount} participant{participantCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Mic toggle */}
        <button
          onClick={handleToggleMic}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            isMicOn
              ? "bg-primary/20 hover:bg-primary/30 text-primary"
              : "bg-red/20 hover:bg-red/30 text-red"
          }`}
          title={isMicOn ? "Couper le micro" : "Activer le micro"}
        >
          {isMicOn ? (
            <Mic size={15} />
          ) : (
            <MicOff size={15} />
          )}
        </button>

        {/* Leave */}
        <button
          onClick={handleLeave}
          className="w-9 h-9 rounded-full bg-red/20 hover:bg-red/30 flex items-center justify-center transition-colors cursor-pointer"
          title="Quitter l'espace"
        >
          <PhoneOff size={15} className="text-red" />
        </button>

        {/* Expand */}
        <button
          onClick={handleExpand}
          className="w-9 h-9 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center transition-colors cursor-pointer"
          title="Ouvrir l'espace"
        >
          <Maximize2 size={15} className="text-primary" />
        </button>
      </div>
    </div>
  );
}
