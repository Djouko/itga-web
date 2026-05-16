import { apiCall, type ApiResponse } from "@/lib/api";
import type { User, Story } from "@/lib/types";

export const StoryService = {
  /** Fetch users (that I follow) who have active stories (last 24h) */
  async fetchStories(myUserId: number, companyId?: number): Promise<ApiResponse<User[]>> {
    return apiCall<User[]>({
      endpoint: "fetchStory",
      body: { my_user_id: myUserId, company_id: companyId },
    });
  },

  /** Mark a story as viewed */
  async viewStory(userId: number, storyId: number, companyId?: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "viewStory",
      body: { user_id: userId, story_id: storyId, company_id: companyId },
    });
  },

  /** Delete own story */
  async deleteStory(myUserId: number, storyId: number, companyId?: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "deleteStory",
      body: { my_user_id: myUserId, story_id: storyId, company_id: companyId },
    });
  },

  /** Create a new story (image or video upload) */
  async createStory(
    userId: number,
    file: File,
    type: number, // 0=image, 1=video
    duration?: number,
    companyId?: number,
  ): Promise<ApiResponse<Story>> {
    const formData = new FormData();
    formData.append("user_id", String(userId));
    formData.append("type", String(type));
    formData.append("content", file);
    if (companyId) {
      formData.append("company_id", String(companyId));
    }
    if (duration !== undefined) {
      formData.append("duration", String(duration));
    }
    return apiCall<Story>({
      endpoint: "createStory",
      formData,
    });
  },

  /** Fetch a single story by ID */
  async fetchStoryById(storyId: number): Promise<ApiResponse<Story>> {
    return apiCall<Story>({
      endpoint: "fetchStoryByID",
      body: { story_id: storyId },
    });
  },
};
