import { apiCall, type ApiResponse } from "../api";
import type { Interest, Setting, SettingCommon } from "../types";

interface FetchSettingResponse {
  interests: Interest[];
  reportReasons: SettingCommon[];
  restrictedUsernames: SettingCommon[];
}

export interface FAQ {
  id: number;
  faqs_type_id: number;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
}

export interface FAQType {
  id: number;
  title: string;
  is_deleted: number;
  faqs: FAQ[];
  created_at: string;
  updated_at: string;
}

export const CommonService = {
  async fetchGlobalSettings(): Promise<
    ApiResponse<FetchSettingResponse & Setting>
  > {
    return apiCall<FetchSettingResponse & Setting>({
      endpoint: "fetchSetting",
    });
  },

  async fetchFAQs(): Promise<ApiResponse<FAQType[]>> {
    return apiCall<FAQType[]>({ endpoint: "fetchFAQs" });
  },

  async fetchPlatformNotifications(
    start: number,
    limit: number
  ): Promise<ApiResponse<{ id: number; title: string; description: string; created_at: string }[]>> {
    return apiCall({ endpoint: "fetchPlatformNotification", body: { start, limit } });
  },
};
