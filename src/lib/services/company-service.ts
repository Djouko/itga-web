import { apiCall, type ApiResponse } from "../api";
import { getCompanyFromStorage } from "../company-acting";
import type {
  Company,
  CompanyDashboard,
  JobOffer,
  JobApplication,
  ApplicationStatus,
  JobKPIs,
} from "../types";

function getStoredCompanyOwnerUserId(companyId: number): number | null {
  const company = getCompanyFromStorage();
  if (!company || company.id !== companyId) return null;
  const ownerId = company.owner_user_id;
  return typeof ownerId === "number" && ownerId > 0 ? ownerId : null;
}

function withCompanyOwner(companyId: number, body: Record<string, unknown>): Record<string, unknown> {
  const ownerUserId = getStoredCompanyOwnerUserId(companyId);
  return ownerUserId ? { ...body, user_id: ownerUserId } : body;
}

function appendCompanyOwner(formData: FormData, companyId: number) {
  const ownerUserId = getStoredCompanyOwnerUserId(companyId);
  if (ownerUserId) {
    formData.append("user_id", String(ownerUserId));
  }
}

export const CompanyService = {
  // ─── Auth ───
  async register(
    name: string,
    email: string,
    password: string,
    sector?: string,
    userId?: number,
    deviceToken?: string
  ): Promise<ApiResponse<Company>> {
    const body: Record<string, unknown> = { name, email, password, sector };
    if (userId) body.user_id = userId;
    if (deviceToken) {
      body.device_token = deviceToken;
      body.device_type = 2;
    }
    return apiCall<Company>({
      endpoint: "Company/register",
      body,
    });
  },

  async login(email: string, password: string, userId?: number, deviceToken?: string): Promise<ApiResponse<Company>> {
    const body: Record<string, unknown> = { email, password };
    if (userId) body.user_id = userId;
    if (deviceToken) {
      body.device_token = deviceToken;
      body.device_type = 2;
    }
    return apiCall<Company>({
      endpoint: "Company/login",
      body,
    });
  },

  async verifyEmail(email: string, code: string, userId?: number, deviceToken?: string): Promise<ApiResponse<Company>> {
    const body: Record<string, unknown> = { email, code };
    if (userId) body.user_id = userId;
    if (deviceToken) {
      body.device_token = deviceToken;
      body.device_type = 2;
    }
    return apiCall<Company>({
      endpoint: "Company/verifyEmail",
      body,
    });
  },

  async resendVerification(email: string): Promise<ApiResponse> {
    return apiCall({
      endpoint: "Company/resendVerification",
      body: { email },
    });
  },

  // ─── Profile ───
  async editProfile(
    companyId: number,
    data: Record<string, unknown>,
    logo?: File
  ): Promise<ApiResponse<Company>> {
    if (logo) {
      const formData = new FormData();
      formData.append("company_id", String(companyId));
      appendCompanyOwner(formData, companyId);
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== null) formData.append(key, String(val));
      });
      formData.append("logo", logo);
      return apiCall<Company>({ endpoint: "Company/editProfile", formData });
    }
    return apiCall<Company>({
      endpoint: "Company/editProfile",
      body: withCompanyOwner(companyId, { company_id: companyId, ...data }),
    });
  },

  async fetchProfile(companyId: number): Promise<ApiResponse<Company>> {
    return apiCall<Company>({
      endpoint: "Company/fetchProfile",
      body: withCompanyOwner(companyId, { company_id: companyId }),
    });
  },

  async fetchDashboard(companyId: number): Promise<ApiResponse<CompanyDashboard>> {
    return apiCall<CompanyDashboard>({
      endpoint: "Company/fetchDashboard",
      body: withCompanyOwner(companyId, { company_id: companyId }),
    });
  },

  // ─── Job management ───
  async createJob(
    companyId: number,
    data: Record<string, unknown>
  ): Promise<ApiResponse<JobOffer>> {
    const body: Record<string, unknown> = withCompanyOwner(companyId, { company_id: companyId, ...data });
    if (body.required_skills && Array.isArray(body.required_skills)) {
      body.required_skills = JSON.stringify(body.required_skills);
    }
    return apiCall<JobOffer>({ endpoint: "Job/createJob", body });
  },

  async editJob(
    companyId: number,
    jobOfferId: number,
    data: Record<string, unknown>
  ): Promise<ApiResponse<JobOffer>> {
    const body: Record<string, unknown> = withCompanyOwner(companyId, {
      company_id: companyId,
      job_offer_id: jobOfferId,
      ...data,
    });
    if (body.required_skills && Array.isArray(body.required_skills)) {
      body.required_skills = JSON.stringify(body.required_skills);
    }
    return apiCall<JobOffer>({ endpoint: "Job/editJob", body });
  },

  async deleteJob(companyId: number, jobOfferId: number): Promise<ApiResponse> {
    return apiCall({
      endpoint: "Job/deleteJob",
      body: withCompanyOwner(companyId, { company_id: companyId, job_offer_id: jobOfferId }),
    });
  },

  async fetchCompanyJobs(
    companyId: number,
    start: number,
    limit: number
  ): Promise<ApiResponse<JobOffer[]>> {
    return apiCall<JobOffer[]>({
      endpoint: "Job/fetchCompanyJobs",
      body: withCompanyOwner(companyId, { company_id: companyId, start, limit }),
    });
  },

  // ─── Applications management ───
  async fetchJobApplications(
    companyId: number,
    jobOfferId: number,
    start: number,
    limit: number
  ): Promise<ApiResponse<{ offer: JobOffer; applications: JobApplication[] }>> {
    return apiCall<{ offer: JobOffer; applications: JobApplication[] }>({
      endpoint: "Application/fetchJobApplications",
      body: withCompanyOwner(companyId, { company_id: companyId, job_offer_id: jobOfferId, start, limit }),
    });
  },

  async updateApplicationStatus(
    companyId: number,
    applicationId: number,
    status: ApplicationStatus,
    companyNote?: string
  ): Promise<ApiResponse<JobApplication>> {
    const body: Record<string, unknown> = withCompanyOwner(companyId, {
      company_id: companyId,
      application_id: applicationId,
      status,
    });
    if (companyNote) body.company_note = companyNote;
    return apiCall<JobApplication>({ endpoint: "Application/updateApplicationStatus", body });
  },

  // ─── Public / Social ───
  async publicProfile(
    companyId: number,
    userId?: number,
    start = 0,
    limit = 10,
    followerCompanyId?: number
  ): Promise<ApiResponse<{ company: Company; jobs: import("../types").JobOffer[]; recent_posts: import("../types").Post[] }>> {
    const body: Record<string, unknown> = { company_id: companyId, start, limit };
    if (userId) body.user_id = userId;
    if (followerCompanyId) body.follower_company_id = followerCompanyId;
    return apiCall<{ company: Company; jobs: import("../types").JobOffer[]; recent_posts: import("../types").Post[] }>({
      endpoint: "Company/publicProfile",
      body,
    });
  },

  async createCompanyPost(formData: FormData): Promise<ApiResponse<import("../types").Post>> {
    return apiCall<import("../types").Post>({ endpoint: "Company/createPost", formData });
  },

  async followCompany(
    userId: number,
    companyId: number,
    followerCompanyId?: number
  ): Promise<ApiResponse<{ followers_count: number; is_following: number }>> {
    const body: Record<string, unknown> = { user_id: userId, company_id: companyId };
    if (followerCompanyId) body.follower_company_id = followerCompanyId;
    return apiCall<{ followers_count: number; is_following: number }>({
      endpoint: "Company/followCompany",
      body,
    });
  },

  async unfollowCompany(
    userId: number,
    companyId: number,
    followerCompanyId?: number
  ): Promise<ApiResponse<{ followers_count: number; is_following: number }>> {
    const body: Record<string, unknown> = { user_id: userId, company_id: companyId };
    if (followerCompanyId) body.follower_company_id = followerCompanyId;
    return apiCall<{ followers_count: number; is_following: number }>({
      endpoint: "Company/unfollowCompany",
      body,
    });
  },

  async fetchFollowedCompanies(
    userId: number,
    start = 0,
    limit = 20,
    followerCompanyId?: number
  ): Promise<ApiResponse<Company[]>> {
    const body: Record<string, unknown> = { user_id: userId, start, limit };
    if (followerCompanyId) body.follower_company_id = followerCompanyId;
    return apiCall<Company[]>({
      endpoint: "Company/fetchFollowedCompanies",
      body,
    });
  },

  // ─── Admin ───
  async fetchAllJobsAdmin(
    start: number,
    limit: number,
    statusFilter?: string
  ): Promise<ApiResponse<JobOffer[]>> {
    const body: Record<string, unknown> = { start, limit };
    if (statusFilter) body.status_filter = statusFilter;
    return apiCall<JobOffer[]>({ endpoint: "AdminJob/fetchAllJobs", body });
  },

  async moderateJob(
    jobOfferId: number,
    action: "approve" | "reject"
  ): Promise<ApiResponse<JobOffer>> {
    return apiCall<JobOffer>({
      endpoint: "AdminJob/moderateJob",
      body: { job_offer_id: jobOfferId, action },
    });
  },

  async fetchCompaniesAdmin(start: number, limit: number): Promise<ApiResponse<Company[]>> {
    return apiCall<Company[]>({ endpoint: "AdminJob/fetchCompanies", body: { start, limit } });
  },

  async toggleSuspendCompany(companyId: number): Promise<ApiResponse<Company>> {
    return apiCall<Company>({ endpoint: "AdminJob/toggleSuspendCompany", body: { company_id: companyId } });
  },

  async fetchJobKPIs(): Promise<ApiResponse<JobKPIs>> {
    return apiCall<JobKPIs>({ endpoint: "AdminJob/fetchJobKPIs" });
  },
};
