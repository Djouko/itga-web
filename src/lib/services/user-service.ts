import { apiCall, type ApiResponse } from "../api";
import type { User, Interest, SavedNotification } from "../types";
import { getActingCompanyId } from "@/lib/company-acting";

export const UserService = {
  async addUser(
    identity: string,
    fullName: string | null,
    loginType: number,
    deviceToken: string
  ): Promise<ApiResponse<User>> {
    return apiCall<User>({
      endpoint: "addUser",
      body: {
        identity,
        full_name: fullName,
        login_type: loginType,
        device_type: 2,
        device_token: deviceToken,
      },
    });
  },

  async editProfile(
    userId: number,
    data: Record<string, unknown>,
    profileImage?: File,
    bgImage?: File
  ): Promise<ApiResponse<User>> {
    if (profileImage || bgImage) {
      const formData = new FormData();
      formData.append("user_id", String(userId));
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== null) formData.append(key, String(val));
      });
      if (profileImage) formData.append("profile", profileImage);
      if (bgImage) formData.append("background_image", bgImage);
      return apiCall<User>({ endpoint: "editProfile", formData });
    }
    return apiCall<User>({
      endpoint: "editProfile",
      body: { user_id: userId, ...data },
    });
  },

  async fetchProfile(myUserId: number, userId: number, companyId?: number): Promise<ApiResponse<User>> {
    const body: Record<string, unknown> = { my_user_id: myUserId, user_id: userId };
    if (companyId) body.company_id = companyId;
    return apiCall<User>({
      endpoint: "fetchProfile",
      body,
    });
  },

  async followUser(myUserId: number, userId: number, companyId?: number): Promise<ApiResponse> {
    const body: Record<string, unknown> = { my_user_id: myUserId, user_id: userId };
    if (companyId) body.company_id = companyId;
    return apiCall({
      endpoint: "followUser",
      body,
    });
  },

  async unfollowUser(myUserId: number, userId: number, companyId?: number): Promise<ApiResponse> {
    const body: Record<string, unknown> = { my_user_id: myUserId, user_id: userId };
    if (companyId) body.company_id = companyId;
    return apiCall({
      endpoint: "unfollowUser",
      body,
    });
  },

  async fetchFollowersList(userId: number, keyword?: string, start?: number, limit?: number): Promise<ApiResponse<User[]>> {
    return apiCall<User[]>({
      endpoint: "fetchFollowersList",
      body: { user_id: userId, keyword, start, limit },
    });
  },

  async fetchFollowingList(myUserId: number, start: number, limit: number, companyId?: number): Promise<ApiResponse<User[]>> {
    const body: Record<string, unknown> = { my_user_id: myUserId, start, limit };
    if (companyId) body.company_id = companyId;
    return apiCall<User[]>({
      endpoint: "fetchFollowingList",
      body,
    });
  },

  async searchProfile(myUserId: number, keyword: string, start: number): Promise<ApiResponse<User[]>> {
    return apiCall<User[]>({
      endpoint: "searchProfile",
      body: { my_user_id: myUserId, keyword, start, limit: 20 },
    });
  },

  async checkUsername(username: string): Promise<ApiResponse> {
    return apiCall({
      endpoint: "checkUsername",
      body: { username },
    });
  },

  async fetchRandomProfile(myUserId: number): Promise<ApiResponse<User>> {
    return apiCall<User>({
      endpoint: "fetchRandomProfile",
      body: { my_user_id: myUserId },
    });
  },

  async fetchInterests(): Promise<ApiResponse<Interest[]>> {
    return apiCall<Interest[]>({ endpoint: "fetchInterests" });
  },

  async fetchUserNotification(myUserId: number, start: number, limit: number, companyId?: number): Promise<ApiResponse<SavedNotification[]>> {
    const body: Record<string, unknown> = { my_user_id: myUserId, start, limit };
    if (companyId) body.company_id = companyId;
    return apiCall<SavedNotification[]>({
      endpoint: "fetchUserNotification",
      body,
    });
  },

  async fetchUnreadNotificationCount(myUserId: number, companyId?: number): Promise<ApiResponse<{ count: number }>> {
    const body: Record<string, unknown> = { my_user_id: myUserId };
    if (companyId) body.company_id = companyId;
    return apiCall({
      endpoint: "fetchUnreadNotificationCount",
      body,
    });
  },

  async markNotificationsAsRead(myUserId: number, companyId?: number): Promise<ApiResponse> {
    const body: Record<string, unknown> = { my_user_id: myUserId };
    if (companyId) body.company_id = companyId;
    return apiCall({
      endpoint: "markNotificationsAsRead",
      body,
    });
  },

  async reportUser(userId: number, reason: string, desc: string): Promise<ApiResponse> {
    const companyId = getActingCompanyId();
    const body: Record<string, unknown> = { user_id: userId, reason, desc };
    if (companyId) body.company_id = companyId;

    return apiCall({
      endpoint: "reportUser",
      body,
    });
  },

  async blockUser(myUserId: number, userId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "UserBlockedByUser",
      body: { my_user_id: myUserId, user_id: userId },
    });
  },

  async blockUserByModerator(moderatorUserId: number, targetUserId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "userBlockByModerator",
      body: { user_id: moderatorUserId, to_user_id: targetUserId },
    });
  },

  async unblockUser(myUserId: number, userId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "UserUnblockedByUser",
      body: { my_user_id: myUserId, user_id: userId },
    });
  },

  async fetchBlockedUserList(myUserId: number): Promise<ApiResponse<User[]>> {
    return apiCall<User[]>({
      endpoint: "fetchBlockedUserList",
      body: { my_user_id: myUserId },
    });
  },

  async deleteUser(userId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "deleteUser",
      body: { user_id: userId },
    });
  },

  async logOut(userId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "logOut",
      body: { user_id: userId },
    });
  },

  };
