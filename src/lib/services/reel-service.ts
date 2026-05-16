import { apiCall, type ApiResponse } from "../api";
import type { Reel, ReelComment, Music, MusicCategory } from "../types";
import { getActingCompanyId } from "@/lib/company-acting";

export const ReelService = {
  async fetchReelsOnExplore(
    myUserId: number,
    type: number,
    start: number,
    limit: number,
    excludedReelIds?: number[],
    companyId?: number
  ): Promise<ApiResponse<Reel[]>> {
    return apiCall<Reel[]>({
      endpoint: "fetchReelsOnExplore",
      body: {
        my_user_id: myUserId,
        type,
        start,
        limit,
        excluded_reel_ids: excludedReelIds && excludedReelIds.length > 0 ? excludedReelIds.join(",") : undefined,
        company_id: companyId,
      },
    });
  },

  async fetchReelsByUserId(
    myUserId: number,
    userId: number,
    start: number,
    limit: number,
    companyId?: number
  ): Promise<ApiResponse<Reel[]>> {
    return apiCall<Reel[]>({
      endpoint: "fetchReelsByUserId",
      body: { my_user_id: myUserId, user_id: userId, start, limit, company_id: companyId },
    });
  },

  async fetchReelById(
    myUserId: number,
    reelId: number,
    companyId?: number
  ): Promise<ApiResponse<Reel>> {
    return apiCall<Reel>({
      endpoint: "fetchReelById",
      body: { user_id: myUserId, reel_id: reelId, company_id: companyId },
    });
  },

  async uploadReel(formData: FormData): Promise<ApiResponse<Reel>> {
    return apiCall<Reel>({ endpoint: "uploadReel", formData });
  },

  async likeDislikeReel(userId: number, reelId: number, companyId?: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "likeDislikeReel",
      body: { user_id: userId, reel_id: reelId, company_id: companyId },
    });
  },

  async increaseReelViewCount(reelId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "increaseReelViewCount",
      body: { reel_id: reelId },
    });
  },

  async addReelComment(
    userId: number,
    reelId: number,
    comment: string,
    parentId?: number,
    mentionedUserIds?: string,
    companyId?: number
  ): Promise<ApiResponse<ReelComment>> {
    return apiCall<ReelComment>({
      endpoint: "addReelComment",
      body: {
        user_id: userId,
        reel_id: reelId,
        description: comment,
        parent_id: parentId,
        mentioned_user_ids: mentionedUserIds,
        company_id: companyId,
      },
    });
  },

  async fetchReelComments(
    myUserId: number,
    reelId: number,
    start: number,
    limit: number,
    companyId?: number
  ): Promise<ApiResponse<ReelComment[]>> {
    return apiCall<ReelComment[]>({
      endpoint: "fetchReelComments",
      body: { user_id: myUserId, reel_id: reelId, start, limit, company_id: companyId },
    });
  },

  async fetchReelCommentReplies(
    myUserId: number,
    commentId: number,
    start: number,
    limit: number,
    companyId?: number
  ): Promise<ApiResponse<ReelComment[]>> {
    return apiCall<ReelComment[]>({
      endpoint: "fetchReelCommentReplies",
      body: { user_id: myUserId, reel_comment_id: commentId, start, limit, company_id: companyId },
    });
  },

  async likeDislikeReelComment(userId: number, commentId: number, companyId?: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "likeDislikeReelComment",
      body: { user_id: userId, comment_id: commentId, company_id: companyId },
    });
  },

  async editReelComment(myUserId: number, commentId: number, description: string, companyId?: number): Promise<ApiResponse<ReelComment>> {
    return apiCall<ReelComment>({
      endpoint: "editReelComment",
      body: { my_user_id: myUserId, comment_id: commentId, description, company_id: companyId },
    });
  },

  async deleteReelComment(myUserId: number, commentId: number, companyId?: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "deleteReelComment",
      body: { my_user_id: myUserId, comment_id: commentId, company_id: companyId },
    });
  },

  async deleteReel(reelId: number, userId: number, companyId?: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "deleteReel",
      body: { reel_id: reelId, user_id: userId, company_id: companyId },
    });
  },

  async reportReel(reelId: number, reason: string, desc: string): Promise<ApiResponse> {
    const companyId = getActingCompanyId();
    const body: Record<string, unknown> = { reel_id: reelId, reason, desc };
    if (companyId) body.company_id = companyId;

    return apiCall({
      endpoint: "reportReel",
      body,
    });
  },

  async fetchSavedReels(myUserId: number, start: number, limit: number, companyId?: number): Promise<ApiResponse<Reel[]>> {
    return apiCall<Reel[]>({
      endpoint: "fetchSavedReels",
      body: { user_id: myUserId, start, limit, company_id: companyId },
    });
  },

  async fetchReelsByHashtag(
    myUserId: number,
    hashtag: string,
    start: number,
    limit: number,
    companyId?: number
  ): Promise<ApiResponse<Reel[]>> {
    return apiCall<Reel[]>({
      endpoint: "fetchReelsByHashtag",
      body: { user_id: myUserId, tag: hashtag, start, limit, company_id: companyId },
    });
  },

  async searchReelsByInterestId(
    userId: number,
    start: number,
    limit: number,
    keyword?: string,
    interestId?: number | null,
    companyId?: number,
  ): Promise<ApiResponse<Reel[]>> {
    return apiCall<Reel[]>({
      endpoint: "searchReelsByInterestId",
      body: {
        user_id: userId,
        interest_id: interestId ?? undefined,
        keyword: keyword ?? undefined,
        start,
        limit,
        company_id: companyId,
      },
    });
  },

  async fetchReelsByMusic(
    myUserId: number,
    musicId: number,
    start: number,
    limit: number,
    companyId?: number
  ): Promise<ApiResponse<Reel[]>> {
    return apiCall<Reel[]>({
      endpoint: "fetchReelsByMusic",
      body: { user_id: myUserId, music_id: musicId, start, limit, company_id: companyId },
    });
  },

  async fetchMusicWithSearch(
    start: number,
    limit: number,
    keyword?: string,
    categoryIds?: string
  ): Promise<ApiResponse<Music[]>> {
    return apiCall<Music[]>({
      endpoint: "fetchMusicWithSearch",
      body: { start, limit, keyword, category_ids: categoryIds },
    });
  },

  async fetchMusicCategories(): Promise<ApiResponse<MusicCategory[]>> {
    return apiCall<MusicCategory[]>({ endpoint: "fetchMusicCategories" });
  },
};
