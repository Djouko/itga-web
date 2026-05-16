import { apiCall, type ApiResponse } from "../api";
import type { Post, Comment, Story, Room } from "../types";
import { CompanyService } from "./company-service";
import { getActingCompanyId } from "@/lib/company-acting";

type RawComment = Comment & {
  desc?: string | null;
  reply_count?: number;
  replies_count?: number;
  comment?: string | null;
};

function normalizeComment(raw: RawComment): Comment {
  return {
    ...raw,
    comment: String(raw.comment ?? raw.desc ?? ""),
    comment_like_count: Number(raw.comment_like_count ?? 0),
    replies_count: Number(raw.replies_count ?? raw.reply_count ?? 0),
  };
}

function normalizeCommentList(items: RawComment[]): Comment[] {
  return items.map(normalizeComment);
}

export const PostService = {
  async fetchPosts(
    myUserId: number,
    start: number,
    limit: number,
    isFollowing: boolean,
    shouldSendSuggestedRoom: boolean = false,
    excludedPostIds?: number[],
    companyId?: number
  ): Promise<ApiResponse<Post[]> & { suggestedRooms?: Room[] }> {
    return apiCall<Post[]>({
      endpoint: "fetchPosts",
      body: {
        my_user_id: myUserId,
        start,
        limit,
        is_following: isFollowing ? 1 : 0,
        should_send_suggested_room: shouldSendSuggestedRoom ? 1 : 0,
        fetch_post_type: isFollowing ? 2 : 0,
        excluded_post_ids: excludedPostIds && excludedPostIds.length > 0 ? excludedPostIds.join(",") : undefined,
        company_id: companyId,
      },
    }) as Promise<ApiResponse<Post[]> & { suggestedRooms?: Room[] }>;
  },

  async fetchPostByPostId(
    myUserId: number,
    postId: number,
    companyId?: number
  ): Promise<ApiResponse<Post>> {
    return apiCall<Post>({
      endpoint: "fetchPostByPostId",
      body: { my_user_id: myUserId, post_id: postId, company_id: companyId },
    });
  },

  async fetchPostByUser(
    myUserId: number,
    userId: number,
    start: number,
    limit: number,
    companyId?: number
  ): Promise<ApiResponse<Post[]>> {
    return apiCall<Post[]>({
      endpoint: "fetchPostByUser",
      body: { my_user_id: myUserId, user_id: userId, start, limit, company_id: companyId },
    });
  },

  async addPost(formData: FormData): Promise<ApiResponse<Post>> {
    return apiCall<Post>({ endpoint: "addPost", formData });
  },

  async addCompanyPost(formData: FormData): Promise<ApiResponse<Post>> {
    return CompanyService.createCompanyPost(formData);
  },

  async editPost(userId: number, postId: number, description: string, companyId?: number): Promise<ApiResponse<Post>> {
    return apiCall<Post>({
      endpoint: "editPost",
      body: { user_id: userId, post_id: postId, desc: description, company_id: companyId },
    });
  },

  async deleteMyPost(myUserId: number, postId: number, companyId?: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "deleteMyPost",
      body: { user_id: myUserId, post_id: postId, company_id: companyId },
    });
  },

  async likePost(userId: number, postId: number, companyId?: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "likePost",
      body: { user_id: userId, post_id: postId, company_id: companyId },
    });
  },

  async dislikePost(userId: number, postId: number, companyId?: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "dislikePost",
      body: { user_id: userId, post_id: postId, company_id: companyId },
    });
  },

  async repostPost(
    myUserId: number,
    postId: number,
    description?: string,
    companyId?: number
  ): Promise<ApiResponse> {
    return apiCall({
      endpoint: "repostPost",
      body: { user_id: myUserId, post_id: postId, desc: description, company_id: companyId },
    });
  },

  async fetchReposts(postId: number, start: number, limit: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "fetchReposts",
      body: { post_id: postId, start, limit },
    });
  },

  async addComment(
    userId: number,
    postId: number,
    comment: string,
    parentId?: number,
    mentionedUserIds?: string,
    companyId?: number
  ): Promise<ApiResponse<Comment>> {
    const res = await apiCall<RawComment>({
      endpoint: "addComment",
      body: {
        user_id: userId,
        post_id: postId,
        desc: comment,
        parent_id: parentId,
        mentioned_user_ids: mentionedUserIds,
        company_id: companyId,
      },
    });

    if (res.status && res.data) {
      return { ...res, data: normalizeComment(res.data) };
    }

    return res as ApiResponse<Comment>;
  },

  async fetchComments(
    myUserId: number,
    postId: number,
    start: number,
    limit: number,
    companyId?: number
  ): Promise<ApiResponse<Comment[]>> {
    const res = await apiCall<RawComment[]>({
      endpoint: "fetchComments",
      body: { my_user_id: myUserId, post_id: postId, start, limit, company_id: companyId },
    });

    if (res.status && Array.isArray(res.data)) {
      return { ...res, data: normalizeCommentList(res.data) };
    }

    return res as ApiResponse<Comment[]>;
  },

  async fetchReplies(
    myUserId: number,
    commentId: number,
    start: number,
    limit: number,
    companyId?: number
  ): Promise<ApiResponse<Comment[]>> {
    const res = await apiCall<RawComment[]>({
      endpoint: "fetchReplies",
      body: { my_user_id: myUserId, comment_id: commentId, start, limit, company_id: companyId },
    });

    if (res.status && Array.isArray(res.data)) {
      return { ...res, data: normalizeCommentList(res.data) };
    }

    return res as ApiResponse<Comment[]>;
  },

  async editComment(commentId: number, userId: number, comment: string, companyId?: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "editComment",
      body: { comment_id: commentId, user_id: userId, desc: comment, company_id: companyId },
    });
  },

  async deleteComment(commentId: number, userId: number, companyId?: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "deleteComment",
      body: { comment_id: commentId, user_id: userId, company_id: companyId },
    });
  },

  async likeDislikeComment(userId: number, commentId: number, companyId?: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "likeDislikeComment",
      body: { user_id: userId, comment_id: commentId, company_id: companyId },
    });
  },

  async reportPost(postId: number, reason: string, desc: string): Promise<ApiResponse> {
    const companyId = getActingCompanyId();
    const body: Record<string, unknown> = { post_id: postId, reason, desc };
    if (companyId) body.company_id = companyId;

    return apiCall({
      endpoint: "reportPost",
      body,
    });
  },

  async fetchSavedPosts(myUserId: number, start: number, limit: number, companyId?: number): Promise<ApiResponse<Post[]>> {
    return apiCall<Post[]>({
      endpoint: "fetchSavedPosts",
      body: { user_id: myUserId, start, limit, company_id: companyId },
    });
  },

  async fetchUsersWhoLikedPost(userId: number, postId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "fetchUsersWhoLikedPost",
      body: { user_id: userId, post_id: postId },
    });
  },

  async searchHashtag(
    userId: number,
    keyword?: string,
    start = 0,
    limit = 100,
  ): Promise<ApiResponse> {
    return apiCall({
      endpoint: "searchHashtag",
      body: { user_id: userId, keyword, start, limit },
    });
  },

  async searchPost(userId: number, keyword: string, start: number, limit: number, companyId?: number): Promise<ApiResponse<Post[]>> {
    return apiCall<Post[]>({
      endpoint: "searchPost",
      body: { user_id: userId, keyword, start, limit, company_id: companyId },
    });
  },

  async fetchPostsByHashtag(
    myUserId: number,
    hashtag: string,
    start: number,
    limit: number,
    companyId?: number
  ): Promise<ApiResponse<Post[]>> {
    return apiCall<Post[]>({
      endpoint: "fetchPostsByHashtag",
      // Keep the same payload shape as the mobile app/backend contract.
      body: { user_id: myUserId, tag: hashtag, start, limit, company_id: companyId },
    });
  },

  async searchPostByInterestId(
    userId: number,
    interestId: number,
    keyword: string,
    start: number,
    limit: number,
    companyId?: number,
  ): Promise<ApiResponse<Post[]>> {
    return apiCall<Post[]>({
      endpoint: "searchPostByInterestId",
      body: { user_id: userId, interest_id: interestId, keyword, start, limit, company_id: companyId },
    });
  },

  async createStory(formData: FormData): Promise<ApiResponse<Story>> {
    return apiCall<Story>({ endpoint: "createStory", formData });
  },

  async fetchStory(myUserId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "fetchStory",
      body: { my_user_id: myUserId },
    });
  },

  async viewStory(userId: number, storyId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "viewStory",
      body: { user_id: userId, story_id: storyId },
    });
  },

  async deleteStory(storyId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "deleteStory",
      body: { story_id: storyId },
    });
  },

  async uploadFile(formData: FormData): Promise<ApiResponse<string>> {
    return apiCall<string>({ endpoint: "uploadFile", formData });
  },
};
