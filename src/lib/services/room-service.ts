import { apiCall, type ApiResponse } from "@/lib/api";
import { getActingCompanyId } from "@/lib/company-acting";
import type { Room, RoomUser, User } from "@/lib/types";

function withActingCompany<T extends Record<string, unknown>>(body: T): T & { company_id?: number } {
  const companyId = getActingCompanyId();
  return companyId ? { ...body, company_id: companyId } : body;
}

function appendActingCompany(formData: FormData) {
  const companyId = getActingCompanyId();
  if (companyId) formData.append("company_id", String(companyId));
}

export const RoomService = {
  /** Create a new room */
  async createRoom(
    adminId: number,
    title: string,
    desc: string,
    interestIds: string,
    isPrivate: number,
    isJoinRequestEnable: number,
    photo?: File,
  ): Promise<ApiResponse<Room>> {
    const formData = new FormData();
    formData.append("admin_id", String(adminId));
    formData.append("title", title);
    formData.append("desc", desc);
    formData.append("interest_ids", interestIds);
    formData.append("is_private", String(isPrivate));
    formData.append("is_join_request_enable", String(isJoinRequestEnable));
    appendActingCompany(formData);
    if (photo) formData.append("photo", photo);
    return apiCall<Room>({ endpoint: "createRoom", formData });
  },

  /** Edit an existing room */
  async editRoom(
    roomId: number,
    fields: { title?: string; desc?: string; interest_ids?: string; is_private?: number; is_join_request_enable?: number },
    photo?: File,
  ): Promise<ApiResponse<Room>> {
    const formData = new FormData();
    formData.append("room_id", String(roomId));
    if (fields.title !== undefined) formData.append("title", fields.title);
    if (fields.desc !== undefined) formData.append("desc", fields.desc);
    if (fields.interest_ids !== undefined) formData.append("interest_ids", fields.interest_ids);
    if (fields.is_private !== undefined) formData.append("is_private", String(fields.is_private));
    if (fields.is_join_request_enable !== undefined) formData.append("is_join_request_enable", String(fields.is_join_request_enable));
    appendActingCompany(formData);
    if (photo) formData.append("photo", photo);
    return apiCall<Room>({ endpoint: "editRoom", formData });
  },

  /** Fetch random public rooms for discovery */
  async fetchRandomRooms(userId: number, limit: number): Promise<ApiResponse<Room[]>> {
    return apiCall<Room[]>({
      endpoint: "fetchRandomRooms",
      body: withActingCompany({ user_id: userId, limit }),
    });
  },

  /** Fetch rooms I'm a member of (type 2, 3, or 5) */
  async fetchRoomsList(userId: number): Promise<ApiResponse<RoomUser[]>> {
    return apiCall<RoomUser[]>({
      endpoint: "fetchRoomsList",
      body: withActingCompany({ user_id: userId }),
    });
  },

  /** Fetch my invitations (type 4) */
  async getInvitationList(userId: number, start: number, limit: number): Promise<ApiResponse<RoomUser[]>> {
    return apiCall<RoomUser[]>({
      endpoint: "getInvitationList",
      body: withActingCompany({ user_id: userId, start, limit }),
    });
  },

  /** Fetch suggested rooms based on interests */
  async fetchSuggestedRooms(myUserId: number): Promise<ApiResponse<Room[]>> {
    return apiCall<Room[]>({
      endpoint: "fetchSuggestedRooms",
      body: withActingCompany({ my_user_id: myUserId }),
    });
  },

  /** Fetch rooms by interest category */
  async fetchRoomsByInterest(userId: number, interestId: number, start: number, limit: number): Promise<ApiResponse<Room[]>> {
    return apiCall<Room[]>({
      endpoint: "fetchRoomsByInterest",
      body: withActingCompany({ user_id: userId, interest_id: interestId, start, limit }),
    });
  },

  /** Fetch room detail with optional members */
  async fetchRoomDetail(roomId: number, userId: number, shouldShowMember = 0): Promise<ApiResponse<Room>> {
    return apiCall<Room>({
      endpoint: "fetchRoomDetail",
      body: withActingCompany({ room_id: roomId, user_id: userId, should_show_member: shouldShowMember }),
    });
  },

  /** Join or request to join a room */
  async joinOrRequestRoom(roomId: number, userId: number): Promise<ApiResponse<RoomUser>> {
    return apiCall<RoomUser>({
      endpoint: "joinOrRequestRoom",
      body: withActingCompany({ room_id: roomId, user_id: userId }),
    });
  },

  /** Accept invitation */
  async acceptInvitation(roomId: number, userId: number): Promise<ApiResponse<RoomUser>> {
    return apiCall<RoomUser>({
      endpoint: "acceptInvitation",
      body: withActingCompany({ room_id: roomId, user_id: userId }),
    });
  },

  /** Reject invitation */
  async rejectInvitation(roomId: number, userId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "rejectInvitation",
      body: withActingCompany({ room_id: roomId, user_id: userId }),
    });
  },

  /** Leave a room */
  async leaveRoom(roomId: number, userId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "leaveThisRoom",
      body: withActingCompany({ room_id: roomId, user_id: userId }),
    });
  },

  /** Delete a room (creator only) */
  async deleteRoom(roomId: number, userId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "deleteRoom",
      body: withActingCompany({ room_id: roomId, user_id: userId }),
    });
  },

  /** Report a room */
  async reportRoom(roomId: number, userId: number, reason: string, desc: string): Promise<ApiResponse> {
    return apiCall({
      endpoint: "reportRoom",
      body: withActingCompany({ room_id: roomId, user_id: userId, reason, desc }),
    });
  },

  /** Mute/unmute room notifications */
  async muteUnmuteRoom(roomId: number, userId: number, isMute: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "muteUnmuteRoomNotification",
      body: withActingCompany({ room_id: roomId, user_id: userId, is_mute: isMute }),
    });
  },

  /** Fetch room members list */
  async fetchRoomUsers(roomId: number, start: number, limit: number): Promise<ApiResponse<RoomUser[]>> {
    return apiCall<RoomUser[]>({
      endpoint: "fetchRoomUsersList",
      body: withActingCompany({ room_id: roomId, start, limit }),
    });
  },

  /** Fetch room admins */
  async fetchRoomAdmins(roomId: number): Promise<ApiResponse<RoomUser[]>> {
    return apiCall<RoomUser[]>({
      endpoint: "fetchRoomAdmins",
      body: withActingCompany({ room_id: roomId }),
    });
  },

  /** Make a user co-admin */
  async makeRoomAdmin(roomId: number, userId: number): Promise<ApiResponse<RoomUser>> {
    return apiCall<RoomUser>({
      endpoint: "makeRoomAdmin",
      body: withActingCompany({ room_id: roomId, user_id: userId }),
    });
  },

  /** Remove co-admin status */
  async removeAdmin(roomId: number, userId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "removeAdminFromRoom",
      body: withActingCompany({ room_id: roomId, user_id: userId }),
    });
  },

  /** Remove user from room */
  async removeUser(roomId: number, userId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "removeUserFromRoom",
      body: withActingCompany({ room_id: roomId, user_id: userId }),
    });
  },

  /** Invite user to room */
  async inviteUser(roomId: number, userId: number): Promise<ApiResponse<RoomUser>> {
    return apiCall<RoomUser>({
      endpoint: "inviteUserToRoom",
      body: withActingCompany({ room_id: roomId, user_id: userId }),
    });
  },

  /** Search users to invite */
  async searchUsersForInvitation(
    myUserId: number,
    roomId: number,
    start: number,
    limit: number,
    keyword?: string,
  ): Promise<ApiResponse<User[]>> {
    return apiCall<User[]>({
      endpoint: "searchUserForInvitation",
      body: withActingCompany({ my_user_id: myUserId, room_id: roomId, start, limit, keyword: keyword ?? "" }),
    });
  },

  /** Fetch join requests for a room (admin) */
  async fetchRoomRequests(roomId: number, start: number, limit: number): Promise<ApiResponse<RoomUser[]>> {
    return apiCall<RoomUser[]>({
      endpoint: "fetchRoomRequestList",
      body: withActingCompany({ room_id: roomId, start, limit }),
    });
  },

  /** Accept join request */
  async acceptRoomRequest(roomId: number, userId: number): Promise<ApiResponse<RoomUser>> {
    return apiCall<RoomUser>({
      endpoint: "acceptRoomRequest",
      body: withActingCompany({ room_id: roomId, user_id: userId }),
    });
  },

  /** Reject join request */
  async rejectRoomRequest(roomId: number, userId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "rejectRoomRequest",
      body: withActingCompany({ room_id: roomId, user_id: userId }),
    });
  },

  /** Fetch rooms I own */
  async fetchMyOwnRooms(myUserId: number): Promise<ApiResponse<Room[]>> {
    return apiCall<Room[]>({
      endpoint: "fetchMyOwnRooms",
      body: withActingCompany({ my_user_id: myUserId }),
    });
  },
};
