import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  Timestamp,
  increment,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiCall } from "@/lib/api";
import type { ActorProfileType, ChatRoom, ChatMessage, MessageType } from "@/lib/types";
import type { ActorIdentity } from "@/lib/actor-identity";

/* ═══════════════════════════════════════════════════
   CONSTANTS (matching Flutter FirebaseConst)
   ═══════════════════════════════════════════════════ */
const FC = {
  users: "users",
  userList: "userList",
  chats: "chats",
  messages: "messages",
  isDeleted: "isDeleted",
  deletedId: "deletedId",
  newMsgCount: "newMsgCount",
  unreadCounts: "unreadCounts",
  deleteChatIds: "deleteChatIds",
  type: "type",
  id: "id",
  pagination: 20,
} as const;

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

function normalizeActor(
  actor: ActorIdentity | null | undefined,
  fallbackName: string,
  fallbackAvatar: string | null,
): Required<Pick<ChatMessage, "senderProfileType" | "senderName" | "senderUsername">> &
  Pick<ChatMessage, "senderCompanyId" | "senderAvatar"> {
  return {
    senderProfileType: actor?.profileType ?? "user",
    senderCompanyId: actor?.profileType === "company" ? actor.companyId : null,
    senderName: actor?.name || fallbackName,
    senderUsername: actor?.username || fallbackName,
    senderAvatar: actor?.avatar ?? fallbackAvatar,
  };
}

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

/** Generate conversationId for 1:1 chat — matches Flutter int_extension.dart */
export function toConversationId(myId: number, otherId: number): string {
  const arr = [myId, otherId].sort((a, b) => a - b);
  return arr.join("-");
}

/** Firebase user document ID = user.id as string — matches Flutter registration.dart */
export function userFirebaseId(userId: number): string {
  return String(userId);
}

/** Firebase room conversationId — matches Flutter room_model.dart */
export function roomFirebaseId(roomId: number): string {
  return `room_${roomId}`;
}

/** Parse Firestore doc → ChatRoom */
function parseChatRoom(data: Record<string, unknown>): ChatRoom {
  const time = data.time;
  let parsedTime: Date | undefined;
  if (time instanceof Timestamp) {
    parsedTime = time.toDate();
  } else if (time instanceof Date) {
    parsedTime = time;
  } else if (typeof time === "object" && time !== null && "seconds" in time) {
    parsedTime = new Date((time as { seconds: number }).seconds * 1000);
  }

  return {
    conversationId: data.conversationId as string | undefined,
    iAmBlocked: data.iAmBlocked as boolean | undefined,
    iBlocked: data.iBlocked as boolean | undefined,
    deletedId: data.deletedId as string | undefined,
    isDeleted: data.isDeleted as boolean | undefined,
    isMute: data.isMute as boolean | undefined,
    lastMsg: data.lastMsg as string | undefined,
    newMsgCount: data.newMsgCount as number | undefined,
    title: data.title as string | undefined,
    profileImage: data.profileImage as string | undefined,
    profileType: (data.profile_type as ActorProfileType | undefined) ?? (data.profileType as ActorProfileType | undefined),
    companyId: asNumberOrNull(data.company_id) ?? asNumberOrNull(data.companyId),
    type: data.type as number | undefined,
    userIdOrRoomId: data.userIdOrRoomId as number | undefined,
    time: parsedTime,
    usersIds: data.usersIds as number[] | undefined,
    deleteChatIds: data.deleteChatIds as Record<string, string> | undefined,
    unreadCounts: data.unreadCounts as Record<string, number> | undefined,
  };
}

/** Parse Firestore doc → ChatMessage */
function parseChatMessage(data: Record<string, unknown>): ChatMessage {
  const senderCompanyId =
    asNumberOrNull(data.sender_company_id) ?? asNumberOrNull(data.senderCompanyId);
  return {
    id: data.id as string,
    msg: data.msg as string | undefined,
    msgType: (data.msgType as MessageType) || "TEXT",
    content: data.content as string | undefined,
    thumbnail: data.thumbnail as string | undefined,
    senderId: data.senderId as number,
    senderCompanyId,
    senderProfileType: (data.sender_profile_type as ActorProfileType | undefined) ?? (data.senderProfileType as ActorProfileType | undefined),
    senderName: (data.sender_name as string | undefined) ?? (data.senderName as string | undefined),
    senderUsername: (data.sender_username as string | undefined) ?? (data.senderUsername as string | undefined),
    senderAvatar: (data.sender_avatar as string | null | undefined) ?? (data.senderAvatar as string | null | undefined),
    storyId: data.storyId as number | undefined,
    deletedIds: data.not_deleted_identities as string[] | undefined,
  };
}

/** Serialize ChatRoom → Firestore (only defined fields) */
function chatRoomToFirestore(room: ChatRoom): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (room.conversationId !== undefined) data.conversationId = room.conversationId;
  if (room.iAmBlocked !== undefined) data.iAmBlocked = room.iAmBlocked;
  if (room.iBlocked !== undefined) data.iBlocked = room.iBlocked;
  if (room.deletedId !== undefined) data.deletedId = room.deletedId;
  if (room.isDeleted !== undefined) data.isDeleted = room.isDeleted;
  if (room.isMute !== undefined) data.isMute = room.isMute;
  if (room.lastMsg !== undefined) data.lastMsg = room.lastMsg;
  if (room.newMsgCount !== undefined) data.newMsgCount = room.newMsgCount;
  if (room.title !== undefined) data.title = room.title;
  if (room.profileImage !== undefined) data.profileImage = room.profileImage;
  if (room.profileType !== undefined) data.profile_type = room.profileType;
  if (room.companyId !== undefined) data.company_id = room.companyId;
  if (room.type !== undefined) data.type = room.type;
  if (room.userIdOrRoomId !== undefined) data.userIdOrRoomId = room.userIdOrRoomId;
  if (room.time !== undefined) data.time = room.time;
  if (room.usersIds !== undefined) data.usersIds = room.usersIds;
  if (room.deleteChatIds !== undefined) data.deleteChatIds = room.deleteChatIds;
  if (room.unreadCounts !== undefined) data.unreadCounts = room.unreadCounts;
  return data;
}

/** Serialize ChatMessage → Firestore */
function chatMessageToFirestore(msg: ChatMessage): Record<string, unknown> {
  const data: Record<string, unknown> = {
    id: msg.id,
    msgType: msg.msgType,
    senderId: msg.senderId,
  };
  if (msg.msg !== undefined) data.msg = msg.msg;
  if (msg.content !== undefined) data.content = msg.content;
  if (msg.thumbnail !== undefined) data.thumbnail = msg.thumbnail;
  if (msg.senderCompanyId !== undefined) data.sender_company_id = msg.senderCompanyId;
  if (msg.senderProfileType !== undefined) data.sender_profile_type = msg.senderProfileType;
  if (msg.senderName !== undefined) data.sender_name = msg.senderName;
  if (msg.senderUsername !== undefined) data.sender_username = msg.senderUsername;
  if (msg.senderAvatar !== undefined) data.sender_avatar = msg.senderAvatar;
  if (msg.storyId !== undefined) data.storyId = msg.storyId;
  if (msg.deletedIds !== undefined) data.not_deleted_identities = msg.deletedIds;
  return data;
}

/* ═══════════════════════════════════════════════════
   CHAT SERVICE
   ═══════════════════════════════════════════════════ */
export const ChatService = {
  /* ─────────────── CONVERSATION LIST (1:1) ────────── */

  /** Subscribe to 1:1 chat list — mirrors ChatsScreenController.fetchChats */
  subscribeToUserChats(
    myUserId: number,
    onData: (chats: ChatRoom[]) => void,
  ): Unsubscribe {
    const ref = collection(db, FC.users, userFirebaseId(myUserId), FC.userList);
    const q = query(ref, where(FC.isDeleted, "==", false));
    return onSnapshot(q, (snapshot) => {
      const chats: ChatRoom[] = [];
      snapshot.docs.forEach((d) => {
        chats.push(parseChatRoom(d.data()));
      });
      chats.sort((a, b) => (b.time?.getTime() ?? 0) - (a.time?.getTime() ?? 0));
      onData(chats);
    });
  },

  /* ─────────────── CONVERSATION LIST (rooms) ──────── */

  /** Subscribe to room chat list — mirrors ChatsScreenController room listener */
  subscribeToRoomChats(
    myUserId: number,
    onData: (chats: ChatRoom[]) => void,
  ): Unsubscribe {
    const ref = collection(db, FC.chats);
    const q = query(ref, orderBy("time", "desc"), where("usersIds", "array-contains", myUserId));
    return onSnapshot(q, (snapshot) => {
      const chats: ChatRoom[] = [];
      snapshot.docs.forEach((d) => {
        const chat = parseChatRoom(d.data());
        chat.newMsgCount = (chat.unreadCounts?.[String(myUserId)] ?? 0);
        const deletedFlag = chat.deleteChatIds?.[String(myUserId)] ?? "";
        if (!deletedFlag.startsWith("d")) {
          chats.push(chat);
        }
      });
      onData(chats);
    });
  },

  /* ─────────────── MESSAGES ───────────────────────── */

  /** Subscribe to messages in a conversation — mirrors ChattingController.fetchMessages */
  subscribeToMessages(
    conversationId: string,
    deleteId: string,
    onData: (messages: ChatMessage[], lastDoc: QueryDocumentSnapshot | null) => void,
  ): Unsubscribe {
    const ref = collection(db, FC.chats, conversationId, FC.messages);
    const q = query(
      ref,
      where(FC.id, ">", deleteId),
      orderBy(FC.id, "desc"),
      limit(FC.pagination),
    );
    return onSnapshot(q, (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.docs.forEach((d) => {
        messages.push(parseChatMessage(d.data()));
      });
      const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
      onData(messages, lastDoc);
    });
  },

  /** Load older messages — mirrors ChattingController.loadOldData */
  async loadOlderMessages(
    conversationId: string,
    deleteId: string,
    afterDoc: QueryDocumentSnapshot,
  ): Promise<{ messages: ChatMessage[]; lastDoc: QueryDocumentSnapshot | null }> {
    const ref = collection(db, FC.chats, conversationId, FC.messages);
    const q = query(
      ref,
      where(FC.id, ">", deleteId),
      orderBy(FC.id, "desc"),
      startAfter(afterDoc),
      limit(FC.pagination),
    );
    const snapshot = await getDocs(q);
    const messages: ChatMessage[] = [];
    snapshot.docs.forEach((d) => {
      messages.push(parseChatMessage(d.data()));
    });
    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    return { messages, lastDoc };
  },

  /* ─────────────── SEND MESSAGE ───────────────────── */

  /** Send a message in a 1:1 chat — mirrors ChattingController.commonSend (user branch) */
  async sendUserMessage(
    myUserId: number,
    myName: string,
    myProfile: string | null,
    otherUserId: number,
    chatRoom: ChatRoom | null,
    myChatRoom: ChatRoom | null,
    msgText: string,
    type: MessageType,
    content: string = "",
    thumbnail: string = "",
    followingStatus: number = 0,
    isFirstMessage: boolean = false,
    actor?: ActorIdentity | null,
  ): Promise<void> {
    const convId = toConversationId(myUserId, otherUserId);
    const now = new Date();
    const msgId = String(now.getTime() * 1000);
    const senderActor = normalizeActor(actor, myName, myProfile);

    // Determine lastMsg display
    let lastMsg = msgText;
    if (!msgText && type === "DOCUMENT") lastMsg = "\u{1F4CE} Document";
    else if (!msgText && type === "IMAGE") lastMsg = "Image";
    else if (!msgText && type === "VIDEO") lastMsg = "Vidéo";

    // Update sender's chat room doc
    const senderDocRef = doc(db, FC.users, userFirebaseId(myUserId), FC.userList, String(otherUserId));
    const senderData: ChatRoom = {
      ...chatRoom,
      conversationId: convId,
      lastMsg,
      time: now,
      newMsgCount: 0,
      isDeleted: false,
    };
    if (isFirstMessage) {
      await setDoc(senderDocRef, chatRoomToFirestore(senderData));
    } else {
      await updateDoc(senderDocRef, chatRoomToFirestore(senderData));
    }

    // Update receiver's chat room doc
    const receiverDocRef = doc(db, FC.users, userFirebaseId(otherUserId), FC.userList, String(myUserId));
    const receiverChatType = (followingStatus === 1 || followingStatus === 3) ? 1 : 0;
    const receiverData: ChatRoom = {
      isMute: false,
      profileImage: senderActor.senderAvatar ?? "",
      profileType: senderActor.senderProfileType,
      companyId: senderActor.senderCompanyId ?? null,
      conversationId: convId,
      lastMsg,
      title: senderActor.senderName,
      time: now,
      type: (isFirstMessage || myChatRoom?.type == null) ? receiverChatType : myChatRoom?.type,
      userIdOrRoomId: myUserId,
      newMsgCount: 1,
      isDeleted: false,
    };
    if (isFirstMessage || myChatRoom?.type == null) {
      await setDoc(receiverDocRef, chatRoomToFirestore(receiverData));
    } else {
      const updateData = chatRoomToFirestore(receiverData);
      updateData[FC.newMsgCount] = increment(1);
      await updateDoc(receiverDocRef, updateData);
    }

    // Write the message document
    const msgRef = doc(db, FC.chats, convId, FC.messages, msgId);
    const msgData: ChatMessage = {
      id: msgId,
      msg: msgText,
      msgType: type,
      content: content || undefined,
      thumbnail: thumbnail || undefined,
      senderId: myUserId,
      ...senderActor,
    };
    await setDoc(msgRef, chatMessageToFirestore(msgData));
  },

  /** Send a message in a room chat — mirrors ChattingController.commonSend (room branch) */
  async sendRoomMessage(
    myUserId: number,
    myName: string,
    room: { id: number; title: string; photo: string | null; roomUserIds: number[] },
    chatRoom: ChatRoom | null,
    msgText: string,
    type: MessageType,
    content: string = "",
    thumbnail: string = "",
    isFirstMessage: boolean = false,
    actor?: ActorIdentity | null,
  ): Promise<void> {
    const convId = roomFirebaseId(room.id);
    const now = new Date();
    const msgId = String(now.getTime() * 1000);
    const senderActor = normalizeActor(actor, myName, null);

    let lastMsg = msgText;
    if (!msgText && type === "DOCUMENT") lastMsg = "\u{1F4CE} Document";
    else if (!msgText && type === "IMAGE") lastMsg = "Image";
    else if (!msgText && type === "VIDEO") lastMsg = "Vidéo";

    // Update room chat doc
    const roomDocRef = doc(db, FC.chats, convId);
    const unreadCounts: Record<string, number> = {};
    const deleteChatIds: Record<string, string> = {};
    room.roomUserIds.forEach((uid) => {
      unreadCounts[String(uid)] = (chatRoom?.unreadCounts?.[String(uid)] ?? 0) + 1;
      const existing = chatRoom?.deleteChatIds?.[String(uid)] ?? "";
      deleteChatIds[String(uid)] = existing.replace(/^d/, "");
    });

    const roomData: ChatRoom = {
      conversationId: convId,
      lastMsg,
      profileImage: room.photo ?? "",
      title: room.title,
      time: now,
      type: 2,
      usersIds: room.roomUserIds,
      userIdOrRoomId: room.id,
      unreadCounts,
      deleteChatIds,
    };

    if (isFirstMessage) {
      await setDoc(roomDocRef, chatRoomToFirestore(roomData));
    } else {
      await updateDoc(roomDocRef, chatRoomToFirestore(roomData));
    }

    // Write the message document
    const msgRef = doc(db, FC.chats, convId, FC.messages, msgId);
    const msgData: ChatMessage = {
      id: msgId,
      msg: msgText,
      msgType: type,
      content: content || undefined,
      thumbnail: thumbnail || undefined,
      senderId: myUserId,
      ...senderActor,
    };
    await setDoc(msgRef, chatMessageToFirestore(msgData));
  },

  /* ─────────────── CHAT ROOM METADATA ─────────────── */

  /** Subscribe to sender's chat room doc (1:1) */
  subscribeToChatRoom(
    myUserId: number,
    otherUserId: number,
    onData: (room: ChatRoom | null) => void,
  ): Unsubscribe {
    const ref = doc(db, FC.users, userFirebaseId(myUserId), FC.userList, String(otherUserId));
    return onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        onData(parseChatRoom(snapshot.data()));
      } else {
        onData(null);
      }
    });
  },

  /** Subscribe to receiver's view of chat (what they see about me) */
  subscribeToMyChatRoom(
    myUserId: number,
    otherUserId: number,
    onData: (room: ChatRoom | null) => void,
  ): Unsubscribe {
    const ref = doc(db, FC.users, userFirebaseId(otherUserId), FC.userList, String(myUserId));
    return onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        onData(parseChatRoom(snapshot.data()));
      } else {
        onData(null);
      }
    });
  },

  /** Subscribe to room chat doc */
  subscribeToRoomChatDoc(
    conversationId: string,
    onData: (room: ChatRoom | null) => void,
  ): Unsubscribe {
    const ref = doc(db, FC.chats, conversationId);
    return onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        onData(parseChatRoom(snapshot.data()));
      } else {
        onData(null);
      }
    });
  },

  /* ─────────────── MARK AS READ ───────────────────── */

  /** Mark 1:1 chat as read */
  async markUserChatAsRead(myUserId: number, otherUserId: number): Promise<void> {
    const ref = doc(db, FC.users, userFirebaseId(myUserId), FC.userList, String(otherUserId));
    try { await updateDoc(ref, { [FC.newMsgCount]: 0 }); } catch (err) { console.warn('[ChatService] markUserChatAsRead failed (doc may not exist):', err); }
  },

  /** Mark room chat as read */
  async markRoomChatAsRead(conversationId: string, myUserId: number): Promise<void> {
    const ref = doc(db, FC.chats, conversationId);
    try { await updateDoc(ref, { [`${FC.unreadCounts}.${myUserId}`]: 0 }); } catch (err) { console.warn('[ChatService] markRoomChatAsRead failed:', err); }
  },

  /* ─────────────── ACCEPT / REJECT REQUEST ────────── */

  /** Accept a chat request (type 0 → 1) */
  async acceptChatRequest(myUserId: number, otherUserId: number): Promise<void> {
    const ref = doc(db, FC.users, userFirebaseId(myUserId), FC.userList, String(otherUserId));
    await updateDoc(ref, { [FC.type]: 1 });
  },

  /** Reject a chat request (mark deleted) */
  async rejectChatRequest(myUserId: number, otherUserId: number): Promise<void> {
    const ref = doc(db, FC.users, userFirebaseId(myUserId), FC.userList, String(otherUserId));
    const date = String(Date.now() * 1000);
    await updateDoc(ref, { [FC.deletedId]: date, [FC.isDeleted]: true });
  },

  /* ─────────────── DELETE / CLEAR CHAT ────────────── */

  /** Clear chat (keep in list, but hide old messages) */
  async clearUserChat(myUserId: number, otherUserId: number): Promise<void> {
    const date = String(Date.now() * 1000);
    const ref = doc(db, FC.users, userFirebaseId(myUserId), FC.userList, String(otherUserId));
    await updateDoc(ref, { [FC.deletedId]: date, lastMsg: "" });
  },

  /** Delete chat (remove from list) */
  async deleteUserChat(myUserId: number, otherUserId: number): Promise<void> {
    const date = String(Date.now() * 1000);
    const ref = doc(db, FC.users, userFirebaseId(myUserId), FC.userList, String(otherUserId));
    await updateDoc(ref, { [FC.deletedId]: date, [FC.isDeleted]: true });
  },

  /** Clear room chat */
  async clearRoomChat(conversationId: string, myUserId: number): Promise<void> {
    const date = String(Date.now() * 1000);
    const ref = doc(db, FC.chats, conversationId);
    await updateDoc(ref, { [`${FC.deleteChatIds}.${myUserId}`]: date });
  },

  /** Delete room chat (prefix "d" to hide from list) */
  async deleteRoomChat(conversationId: string, myUserId: number): Promise<void> {
    const date = `d${Date.now() * 1000}`;
    const ref = doc(db, FC.chats, conversationId);
    await updateDoc(ref, { [`${FC.deleteChatIds}.${myUserId}`]: date });
  },

  /* ─────────────── MARK TOGGLE (unread badge) ─────── */

  /** Toggle unread badge for user chat */
  async toggleMarkUserChat(myUserId: number, otherUserId: number, currentCount: number): Promise<void> {
    const ref = doc(db, FC.users, userFirebaseId(myUserId), FC.userList, String(otherUserId));
    await updateDoc(ref, { [FC.newMsgCount]: currentCount === 0 ? -1 : 0 });
  },

  /** Toggle unread badge for room chat */
  async toggleMarkRoomChat(conversationId: string, myUserId: number, currentCount: number): Promise<void> {
    const ref = doc(db, FC.chats, conversationId);
    await updateDoc(ref, { [`${FC.unreadCounts}.${myUserId}`]: currentCount === 0 ? -1 : 0 });
  },

  /* ─────────────── BLOCK (Firestore flags) ────────── */

  /** Block user — update Firestore flags on both sides */
  async blockUserInChat(myUserId: number, otherUserId: number): Promise<void> {
    const myRef = doc(db, FC.users, userFirebaseId(myUserId), FC.userList, String(otherUserId));
    const otherRef = doc(db, FC.users, userFirebaseId(otherUserId), FC.userList, String(myUserId));
    try { await updateDoc(myRef, { iBlocked: true }); } catch (err) { console.warn('[ChatService] blockUser (my side) failed:', err); }
    try { await updateDoc(otherRef, { iAmBlocked: true }); } catch (err) { console.warn('[ChatService] blockUser (other side) failed:', err); }
  },

  /** Unblock user — update Firestore flags on both sides */
  async unblockUserInChat(myUserId: number, otherUserId: number): Promise<void> {
    const myRef = doc(db, FC.users, userFirebaseId(myUserId), FC.userList, String(otherUserId));
    const otherRef = doc(db, FC.users, userFirebaseId(otherUserId), FC.userList, String(myUserId));
    try { await updateDoc(myRef, { iBlocked: false }); } catch (err) { console.warn('[ChatService] unblockUser (my side) failed:', err); }
    try { await updateDoc(otherRef, { iAmBlocked: false }); } catch (err) { console.warn('[ChatService] unblockUser (other side) failed:', err); }
  },

  /* ─────────────── EDIT / DELETE MESSAGE ───────────── */

  /** Edit a message's text */
  async editMessage(conversationId: string, messageId: string, newMsg: string): Promise<void> {
    const ref = doc(db, FC.chats, conversationId, FC.messages, messageId);
    await updateDoc(ref, { msg: newMsg });
  },

  /** Delete a message (remove the doc) — mirrors Flutter approach */
  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    const { deleteDoc } = await import("firebase/firestore");
    const ref = doc(db, FC.chats, conversationId, FC.messages, messageId);
    await deleteDoc(ref);
  },

  /* ─────────────── FILE UPLOAD via Backend ────────── */

  /** Upload a file (image/video/document) via Laravel backend and get URL */
  async uploadFile(file: File): Promise<string | null> {
    const formData = new FormData();
    // Backend/mobile expects the multipart key to be "uploadFile".
    formData.append("uploadFile", file);
    const res = await apiCall<string>({ endpoint: "uploadFile", formData });
    if (res.status && res.data) return res.data;
    return null;
  },
};
