import { apiCall, type ApiResponse } from "../api";
import type { JobOffer, JobApplication, ContractType, LocationType, ExperienceLevel } from "../types";

export interface FetchJobsParams {
  user_id: number;
  start: number;
  limit: number;
  keyword?: string;
  contract_type?: ContractType;
  location_type?: LocationType;
  domain?: string;
  experience_level?: ExperienceLevel;
  sort_by?: "date" | "relevance";
}

export const JobService = {
  async fetchJobs(params: FetchJobsParams): Promise<ApiResponse<JobOffer[]>> {
    const body: Record<string, unknown> = {
      user_id: params.user_id,
      start: params.start,
      limit: params.limit,
    };
    if (params.keyword) body.keyword = params.keyword;
    if (params.contract_type) body.contract_type = params.contract_type;
    if (params.location_type) body.location_type = params.location_type;
    if (params.domain) body.domain = params.domain;
    if (params.experience_level) body.experience_level = params.experience_level;
    if (params.sort_by) body.sort_by = params.sort_by;
    return apiCall<JobOffer[]>({ endpoint: "Job/fetchJobs", body });
  },

  async fetchJobDetail(userId: number, jobOfferId: number): Promise<ApiResponse<JobOffer>> {
    return apiCall<JobOffer>({
      endpoint: "Job/fetchJobDetail",
      body: { user_id: userId, job_offer_id: jobOfferId },
    });
  },

  async toggleSaveJob(userId: number, jobOfferId: number): Promise<ApiResponse<{ is_saved: number }>> {
    return apiCall<{ is_saved: number }>({
      endpoint: "Job/toggleSaveJob",
      body: { user_id: userId, job_offer_id: jobOfferId },
    });
  },

  async fetchSavedJobs(userId: number, start: number, limit: number): Promise<ApiResponse<JobOffer[]>> {
    return apiCall<JobOffer[]>({
      endpoint: "Job/fetchSavedJobs",
      body: { user_id: userId, start, limit },
    });
  },

  async applyToJob(
    userId: number,
    jobOfferId: number,
    coverLetter?: string,
    cvFile?: File
  ): Promise<ApiResponse<JobApplication>> {
    if (cvFile) {
      const formData = new FormData();
      formData.append("user_id", String(userId));
      formData.append("job_offer_id", String(jobOfferId));
      if (coverLetter) formData.append("cover_letter", coverLetter);
      formData.append("cv_file", cvFile);
      return apiCall<JobApplication>({ endpoint: "Application/applyToJob", formData });
    }
    return apiCall<JobApplication>({
      endpoint: "Application/applyToJob",
      body: { user_id: userId, job_offer_id: jobOfferId, cover_letter: coverLetter ?? "" },
    });
  },

  async fetchMyApplications(userId: number, start: number, limit: number): Promise<ApiResponse<JobApplication[]>> {
    return apiCall<JobApplication[]>({
      endpoint: "Application/fetchMyApplications",
      body: { user_id: userId, start, limit },
    });
  },
};
