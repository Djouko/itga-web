import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  Unsubscribe,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiCall } from "@/lib/api";
import { API_URL, buildApiHeaders } from "@/lib/api-config";
import type {
  AudioSpace,
  AudioSpaceUser,
  AudioSpaceUserType,
  AudioSpaceMicStatus,
  AudioSpaceMessage,
  AudioSpaceLastReaction,
  ActorProfileType,
} from "@/lib/types";
import type { ActorIdentity } from "@/lib/actor-identity";

/* ═══════════════════════════════════════════════════
   CONSTANTS (matching Flutter FirebaseAudioConst)
   ═══════════════════════════════════════════════════ */
const FA = {
  audioSpaces: "audio_spaces",
  messages: "messages",
} as const;

/* ═══════════════════════════════════════════════════
   PARSERS
   ═══════════════════════════════════════════════════ */

function parseAudioSpaceUser(data: Record<string, unknown>): AudioSpaceUser {
  return {
    id: (data.id as number) ?? 0,
    userName: data.userName as string | undefined,
    fullName: data.fullName as string | undefined,
    image: data.image as string | undefined,
    deviceToken: data.deviceToken as string | undefined,
    deviceType: data.deviceType as number | undefined,
    isVerified: data.isVerified as boolean | undefined,
    company_id: asNumberOrNull(data.company_id) ?? asNumberOrNull(data.companyId) ?? null,
    profile_type: (data.profile_type as ActorProfileType | undefined) ?? (data.profileType as ActorProfileType | undefined) ?? "user",
    display_name: (data.display_name as string | undefined) ?? (data.displayName as string | undefined),
    display_avatar: (data.display_avatar as string | null | undefined) ?? (data.displayAvatar as string | null | undefined),
    type: (data.type as AudioSpaceUserType) || "LISTENER",
    mic_status: (data.mic_status as AudioSpaceMicStatus) || "MUTED",
    is_camera_on: data.is_camera_on as boolean | undefined,
  };
}

function asNumberOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseTimestamp(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "object" && val !== null && "seconds" in val) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  if (typeof val === "string") return new Date(val);
  return undefined;
}

function parseLastReaction(data: unknown): AudioSpaceLastReaction | undefined {
  if (!data || typeof data !== "object") return undefined;
  const raw = data as Record<string, unknown>;
  const emoji = raw.emoji as string | undefined;
  const uid = raw.uid as number | undefined;
  const ts = parseTimestamp(raw.ts);
  const companyId = asNumberOrNull(raw.company_id) ?? asNumberOrNull(raw.companyId) ?? null;
  const profileType = (raw.profile_type as ActorProfileType | undefined) ?? (raw.profileType as ActorProfileType | undefined);
  const name = raw.name as string | undefined;
  if (!emoji || uid === undefined) return undefined;
  return { emoji, uid, ts, company_id: companyId, profile_type: profileType, name };
}

function parseAudioSpace(data: Record<string, unknown>): AudioSpace {
  const usersRaw = data.users as Record<string, unknown>[] | undefined;
  const leavedRaw = data.leaved_users as Record<string, unknown>[] | undefined;

  return {
    id: data.id as string,
    title: data.title as string | undefined,
    description: data.description as string | undefined,
    topics: data.topics as string | undefined,
    token: data.token as string | undefined,
    type: (data.type as "PUBLIC" | "PRIVATE") || "PUBLIC",
    is_video_conference: data.is_video_conference === true,
    screen_sharing_uid: (data.screen_sharing_uid as number) ?? 0,
    created_at: parseTimestamp(data.created_at),
    users: usersRaw?.map((u) => parseAudioSpaceUser(u)) ?? [],
    leaved_users: leavedRaw?.map((u) => parseAudioSpaceUser(u)) ?? [],
    last_reaction: parseLastReaction(data.last_reaction),
  };
}

function parseMessage(data: Record<string, unknown>): AudioSpaceMessage {
  return {
    id: data.id as string,
    userId: (data.userId as number) ?? 0,
    content: (data.content as string) ?? "",
    time: parseTimestamp(data.time),
    sender_company_id: asNumberOrNull(data.sender_company_id) ?? asNumberOrNull(data.senderCompanyId) ?? null,
    sender_profile_type: (data.sender_profile_type as ActorProfileType | undefined) ?? (data.senderProfileType as ActorProfileType | undefined),
    sender_name: (data.sender_name as string | undefined) ?? (data.senderName as string | undefined),
    sender_username: (data.sender_username as string | undefined) ?? (data.senderUsername as string | undefined),
    sender_avatar: (data.sender_avatar as string | null | undefined) ?? (data.senderAvatar as string | null | undefined),
  };
}

function audioSpaceUserToJson(u: AudioSpaceUser): Record<string, unknown> {
  return {
    id: u.id,
    userName: u.userName ?? "",
    fullName: u.fullName ?? "",
    image: u.image ?? "",
    deviceToken: u.deviceToken ?? "",
    deviceType: u.deviceType ?? 0,
    isVerified: u.isVerified ?? false,
    company_id: u.company_id ?? null,
    profile_type: u.profile_type ?? "user",
    display_name: u.display_name ?? u.fullName ?? "",
    display_avatar: u.display_avatar ?? u.image ?? "",
    type: u.type,
    mic_status: u.mic_status,
    is_camera_on: u.is_camera_on ?? false,
  };
}

function audioSpaceToFirestore(space: AudioSpace): Record<string, unknown> {
  return {
    id: space.id,
    title: space.title ?? "",
    description: space.description ?? "",
    topics: space.topics ?? "",
    token: space.token ?? "",
    type: space.type ?? "PUBLIC",
    is_video_conference: space.is_video_conference ?? false,
    screen_sharing_uid: space.screen_sharing_uid ?? 0,
    created_at: space.created_at ? Timestamp.fromDate(space.created_at) : Timestamp.now(),
    users: (space.users ?? []).map(audioSpaceUserToJson),
    leaved_users: (space.leaved_users ?? []).map(audioSpaceUserToJson),
  };
}

/* ═══════════════════════════════════════════════════
   SPACE HELPERS
   ═══════════════════════════════════════════════════ */

export function getSpaceHosts(space: AudioSpace): AudioSpaceUser[] {
  return (space.users ?? []).filter((u) => u.type === "HOST");
}

export function getSpaceAdmins(space: AudioSpace): AudioSpaceUser[] {
  return (space.users ?? []).filter((u) => u.type === "ADMIN");
}

export function getSpaceHostsWithAdmin(space: AudioSpace): AudioSpaceUser[] {
  return (space.users ?? []).filter((u) => u.type === "HOST" || u.type === "ADMIN");
}

export function getSpaceListeners(space: AudioSpace): AudioSpaceUser[] {
  return (space.users ?? []).filter((u) => u.type === "LISTENER");
}

export function getSpaceRequests(space: AudioSpace): AudioSpaceUser[] {
  return (space.users ?? []).filter((u) => u.type === "REQUESTED");
}

export function getActiveUsers(space: AudioSpace): AudioSpaceUser[] {
  return (space.users ?? []).filter((u) => u.type !== "KICKED_OUT" && u.type !== "ADDED");
}

export function isSameSpaceActor(user: AudioSpaceUser, userId: number, companyId?: number | null): boolean {
  if (user.id !== userId) return false;
  const expectedCompanyId = companyId ?? null;
  const userCompanyId = user.company_id ?? null;
  return expectedCompanyId ? userCompanyId === expectedCompanyId : userCompanyId === null;
}

export function isUserInSpace(space: AudioSpace, userId: number, companyId?: number | null): boolean {
  const all = [...(space.users ?? []), ...(space.leaved_users ?? [])];
  return all.some((u) => isSameSpaceActor(u, userId, companyId));
}

/* ═══════════════════════════════════════════════════
   SPACE SERVICE
   ═══════════════════════════════════════════════════ */
export const SpaceService = {

  /** Subscribe to all active audio spaces */
  subscribeToSpaces(
    myUserId: number,
    onData: (spaces: AudioSpace[]) => void,
    companyId?: number | null,
  ): Unsubscribe {
    const ref = collection(db, FA.audioSpaces);
    return onSnapshot(ref, (snapshot) => {
      const spaces: AudioSpace[] = [];
      snapshot.docs.forEach((d) => {
        try {
          const space = parseAudioSpace(d.data());
          if (space.type === "PUBLIC" || isUserInSpace(space, myUserId, companyId)) {
            spaces.push(space);
          }
        } catch (err) { console.warn('[SpaceService] Skipping malformed space doc:', d.id, err); }
      });
      spaces.sort((a, b) => (b.created_at?.getTime() ?? 0) - (a.created_at?.getTime() ?? 0));
      onData(spaces);
    });
  },

  /** Subscribe to a single space document */
  subscribeToSpace(
    spaceId: string,
    onData: (space: AudioSpace | null) => void,
  ): Unsubscribe {
    const ref = doc(db, FA.audioSpaces, spaceId);
    return onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        onData(parseAudioSpace(snapshot.data()));
      } else {
        onData(null);
      }
    });
  },

  /** Subscribe to messages in a space */
  subscribeToSpaceMessages(
    spaceId: string,
    onData: (messages: AudioSpaceMessage[]) => void,
  ): Unsubscribe {
    const ref = collection(db, FA.audioSpaces, spaceId, FA.messages);
    const q = query(ref, orderBy("time", "asc"));
    return onSnapshot(q, (snapshot) => {
      const msgs: AudioSpaceMessage[] = [];
      snapshot.docs.forEach((d) => {
        try { msgs.push(parseMessage(d.data())); } catch (err) { console.warn('[SpaceService] Skipping malformed message:', d.id, err); }
      });
      onData(msgs);
    });
  },

  /** Generate Agora token via backend */
  async generateAgoraToken(channelName: string): Promise<string | null> {
    const res = await apiCall<unknown>({
      endpoint: "generateAgoraToken",
      body: { channelName },
    });
    // Backend returns { status, message, token } — token is at root level, not in data
    const raw = res as unknown as { status: boolean; token?: string };
    if (raw.status && raw.token) return raw.token;
    return null;
  },

  /** Send push notification to a user via FCM proxy (JSON body required by backend).
   *  Video calls (type '20'): Android stays data-only so the background handler
   *  can show CallKit. iOS receives an APNs alert fallback because PushKit/VoIP
   *  entitlement is not configured in the current iOS project. */
  async sendPushNotification(
    deviceToken: string,
    deviceType: number | undefined,
    title: string,
    body: string,
    extraData?: Record<string, string>,
  ): Promise<void> {
    if (!deviceToken) return;

    const isVideoCall = extraData?.type === "20";

    const dataPayload: Record<string, string> = {
      body,
      title,
      ...(extraData ?? {}),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageData: Record<string, any> = {
      token: deviceToken,
      data: dataPayload,
      android: { priority: "high" },
    };

    if (isVideoCall) {
      // Android data-only; iOS alert fallback so calls are visible without PushKit.
      messageData.apns = {
        payload: {
          aps: {
            "content-available": 1,
            alert: { title, body },
            badge: 1,
            sound: "default",
          },
        },
        headers: { "apns-push-type": "alert", "apns-priority": "10" },
      };
    } else {
      // Standard notification with system tray display
      messageData.notification = { body, title };
      messageData.android.notification = {
        sound: "default",
        channel_id: "high_importance_channel",
        default_vibrate_timings: true,
      };
      messageData.apns = {
        payload: { aps: { "content-available": 1, sound: "default", badge: 1 } },
        headers: { "apns-push-type": "alert" },
      };
    }

    try {
      const headers: Record<string, string> = buildApiHeaders({
        extraHeaders: { "Content-Type": "application/json" },
      });
      await fetch(`${API_URL}/pushNotificationToSingleUser`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: messageData }),
      });
    } catch (err) { console.warn('[SpaceService] Push notification failed (non-blocking):', err); }
  },

  /** Create a new audio space */
  async createSpace(space: AudioSpace): Promise<void> {
    const ref = doc(db, FA.audioSpaces, space.id);
    await setDoc(ref, audioSpaceToFirestore(space), { merge: true });
  },

  /** Update space document (partial update) */
  async updateSpace(spaceId: string, data: Record<string, unknown>): Promise<void> {
    const ref = doc(db, FA.audioSpaces, spaceId);
    await updateDoc(ref, data);
  },

  /** Update the users array in the space */
  async updateSpaceUsers(spaceId: string, users: AudioSpaceUser[], leavedUsers?: AudioSpaceUser[]): Promise<void> {
    const ref = doc(db, FA.audioSpaces, spaceId);
    const update: Record<string, unknown> = {
      users: users.map(audioSpaceUserToJson),
    };
    if (leavedUsers !== undefined) {
      update.leaved_users = leavedUsers.map(audioSpaceUserToJson);
    }
    await updateDoc(ref, update);
  },

  /** Join a space as listener */
  async joinSpace(spaceId: string, me: AudioSpaceUser, space: AudioSpace): Promise<void> {
    const users = [...(space.users ?? [])];
    const leavedUsers = [...(space.leaved_users ?? [])];

    // Remove from leaved if present
    const leavedIdx = leavedUsers.findIndex((u) => isSameSpaceActor(u, me.id, me.company_id));
    if (leavedIdx >= 0) leavedUsers.splice(leavedIdx, 1);

    // Add if not already present
    if (!users.some((u) => isSameSpaceActor(u, me.id, me.company_id))) {
      users.push(me);
    }

    await this.updateSpaceUsers(spaceId, users, leavedUsers);
  },

  /** Leave a space */
  async leaveSpace(spaceId: string, userId: number, space: AudioSpace, companyId?: number | null): Promise<void> {
    const users = [...(space.users ?? [])];
    const leavedUsers = [...(space.leaved_users ?? [])];
    const idx = users.findIndex((u) => isSameSpaceActor(u, userId, companyId));

    if (idx >= 0) {
      const [removed] = users.splice(idx, 1);
      removed.type = "LISTENER";
      removed.mic_status = "MUTED";
      removed.is_camera_on = false;
      leavedUsers.push(removed);
    }

    // If no admins left, delete the space
    const adminsLeft = users.filter((u) => u.type === "ADMIN");
    if (adminsLeft.length === 0) {
      await this.deleteSpace(spaceId);
    } else {
      await this.updateSpaceUsers(spaceId, users, leavedUsers);
    }
  },

  /** Leave a space from minimized mode (fetches fresh space data first) */
  async leaveMinimizedCall(spaceId: string, userId: number): Promise<void> {
    const ref = doc(db, FA.audioSpaces, spaceId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return;
    const space = parseAudioSpace(snapshot.data());
    await this.leaveSpace(spaceId, userId, space);
  },

  /** End/delete the space (admin only) */
  async deleteSpace(spaceId: string): Promise<void> {
    const ref = doc(db, FA.audioSpaces, spaceId);
    await deleteDoc(ref);
  },

  /** Change a user's type in the space (promote, demote, accept request, kick) */
  async changeUserType(
    spaceId: string,
    userId: number,
    newType: AudioSpaceUserType,
    newMicStatus: AudioSpaceMicStatus,
    space: AudioSpace,
    companyId?: number | null,
  ): Promise<void> {
    const users = [...(space.users ?? [])];
    const user = users.find((u) => isSameSpaceActor(u, userId, companyId));
    if (user) {
      user.type = newType;
      user.mic_status = newMicStatus;
    }
    await this.updateSpaceUsers(spaceId, users);
  },

  /** Update camera status for a user in the space */
  async updateCameraStatus(
    spaceId: string,
    userId: number,
    isCameraOn: boolean,
    space: AudioSpace,
    companyId?: number | null,
  ): Promise<void> {
    const users = [...(space.users ?? [])];
    const user = users.find((u) => isSameSpaceActor(u, userId, companyId));
    if (user) {
      user.is_camera_on = isCameraOn;
    }
    await this.updateSpaceUsers(spaceId, users);
  },

  /** Toggle mic status for a user */
  async toggleMic(
    spaceId: string,
    userId: number,
    newStatus: AudioSpaceMicStatus,
    space: AudioSpace,
    companyId?: number | null,
  ): Promise<void> {
    const users = [...(space.users ?? [])];
    const user = users.find((u) => isSameSpaceActor(u, userId, companyId));
    if (user) {
      user.mic_status = newStatus;
    }
    await this.updateSpaceUsers(spaceId, users);
  },

  /** Request to speak (listener → requested) */
  async requestToSpeak(spaceId: string, userId: number, space: AudioSpace, companyId?: number | null): Promise<void> {
    await this.changeUserType(spaceId, userId, "REQUESTED", "MUTED", space, companyId);
  },

  /** Accept speak request (requested → host) */
  async acceptSpeakRequest(spaceId: string, userId: number, space: AudioSpace, companyId?: number | null): Promise<void> {
    await this.changeUserType(spaceId, userId, "HOST", "MUTED", space, companyId);
  },

  /** Reject speak request (requested → listener) */
  async rejectSpeakRequest(spaceId: string, userId: number, space: AudioSpace, companyId?: number | null): Promise<void> {
    await this.changeUserType(spaceId, userId, "LISTENER", "MUTED", space, companyId);
  },

  /** Send emoji reaction via Firestore (for all users including listeners) — uses serverTimestamp() matching mobile */
  async sendReaction(spaceId: string, userId: number, emoji: string, actor?: ActorIdentity | null): Promise<void> {
    const ref = doc(db, FA.audioSpaces, spaceId);
    await updateDoc(ref, {
      last_reaction: {
        uid: userId,
        emoji,
        ts: serverTimestamp(),
        company_id: actor?.profileType === "company" ? actor.companyId : null,
        profile_type: actor?.profileType ?? "user",
        name: actor?.name ?? "",
      },
    });
  },

  /** Cancel raise hand request (requested → listener) — matching mobile toggle behavior */
  async cancelRequest(spaceId: string, userId: number, space: AudioSpace, companyId?: number | null): Promise<void> {
    await this.changeUserType(spaceId, userId, "LISTENER", "MUTED", space, companyId);
  },

  /** Send a text message in the space chat */
  async sendMessage(spaceId: string, userId: number, content: string, actor?: ActorIdentity | null): Promise<void> {
    const msgId = String(Date.now() * 1000);
    const ref = doc(db, FA.audioSpaces, spaceId, FA.messages, msgId);
    await setDoc(ref, {
      id: msgId,
      userId,
      content,
      time: new Date(),
      sender_company_id: actor?.profileType === "company" ? actor.companyId : null,
      sender_profile_type: actor?.profileType ?? "user",
      sender_name: actor?.name ?? "",
      sender_username: actor?.username ?? "",
      sender_avatar: actor?.avatar ?? "",
    });
  },
};
