export interface User {
  id: number;
  identity: string;
  full_name: string;
  username: string;
  email: string;
  bio: string | null;
  profile: string | null;
  background_image: string | null;
  interest_ids: string | null;
  block_user_ids: string | null;
  saved_post_ids: string | null;
  saved_reel_ids: string | null;
  saved_music_ids: string | null;
  followers: number;
  following: number;
  is_verified: number;
  is_block: number;
  is_push_notifications: number;
  is_invited_to_room: number;
  is_moderator: number;
  device_token: string | null;
  device_type: number | null;
  headline: string | null;
  about: string | null;
  experience: string | null;
  education: string | null;
  skills: string | null;
  location: string | null;
  website: string | null;
  pronouns: string | null;
  created_at: string;
  updated_at: string;
  // Dynamic fields from fetchProfile
  followingStatus?: number; // 0=none, 1=they follow me, 2=I follow them, 3=mutual
  stories?: Story[];
  company_stories?: Story[];
  interest?: Interest[];
  profile_type?: "user" | "company";
  owned_company?: Company | null;
}

export interface PostContent {
  id: number;
  post_id: number;
  content: string;
  content_type: number;
  thumbnail: string | null;
  audio_waves: string | null;
}

export interface Post {
  id: number;
  user_id: number;
  company_id?: number | null;
  desc: string | null;
  interest_ids: string | null;
  tags: string | null;
  likes_count: number;
  comments_count: number;
  repost_count: number;
  is_edited: number;
  original_post_id: number | null;
  is_restricted: number;
  content_type: number | null;
  link_preview_json: string | null;
  created_at: string;
  updated_at: string;
  user: User;
  company?: Company | null;
  content: PostContent[];
  original_post?: Post | null;
  is_like?: number;
}

export interface Comment {
  id: number;
  user_id: number;
  company_id?: number | null;
  post_id: number;
  comment: string;
  parent_id: number | null;
  comment_like_count: number;
  is_edited: number;
  created_at: string;
  updated_at: string;
  user: User;
  company?: Company | null;
  is_like?: number;
  replies_count?: number;
}

export interface Reel {
  id: number;
  user_id: number;
  company_id?: number | null;
  description: string | null;
  content: string;
  thumbnail: string;
  interest_ids: string | null;
  hashtags: string | null;
  music_id: number | null;
  likes_count: number;
  comments_count: number;
  views_count: number;
  created_at: string;
  updated_at: string;
  user: User;
  company?: Company | null;
  music?: Music | null;
  is_like?: number;
}

export interface ReelComment {
  id: number;
  user_id: number;
  company_id?: number | null;
  reel_id: number;
  description: string;
  parent_id: number | null;
  comment_like_count: number;
  reply_count: number;
  is_edited: number;
  created_at: string;
  updated_at: string;
  user: User;
  company?: Company | null;
  is_like?: number;
}

export interface Music {
  id: number;
  title: string;
  artist: string;
  audio: string;
  cover: string | null;
  category_id: number | null;
  duration: number;
}

export interface MusicCategory {
  id: number;
  name: string;
  musics_count: number;
}

export interface Room {
  id: number;
  title: string;
  desc: string | null;
  photo: string | null;
  admin_id: number;
  company_id?: number | null;
  interest_ids: string | null;
  is_private: number;
  is_join_request_enable: number;
  total_member: number;
  created_at: string;
  updated_at: string;
  // Dynamic fields from API
  userRoomStatus?: number; // 0=none, 1=requested, 2=member, 3=co-admin, 4=invited, 5=creator
  is_mute?: number;
  interests?: Interest[];
  admin?: User;
  user?: User;
  company?: Company | null;
  roomUsers?: RoomUser[];
}

export interface RoomUser {
  id: number;
  room_id: number;
  user_id: number;
  company_id?: number | null;
  type: number; // 1=requested, 2=member, 3=co-admin, 4=invited, 5=creator
  is_mute: number;
  invited_by: number | null;
  invited_by_company_id?: number | null;
  room?: Room;
  user?: User;
  company?: Company | null;
  invited_user?: User;
  invited_company?: Company | null;
}

export interface Story {
  id: number;
  user_id: number;
  company_id?: number | null;
  content: string;
  thumbnail: string | null;
  type: number; // 0=image, 1=video
  duration: number | null;
  view_by_user_ids: string | null;
  view_by_company_ids?: string | null;
  created_at: string;
  updated_at: string;
  user?: User;
  company?: Company | null;
}

export interface Interest {
  id: number;
  title: string;
  image: string | null;
}

export interface SettingCommon {
  id: number;
  title: string;
  created_at?: string;
  updated_at?: string;
}

export interface SavedNotification {
  id: number;
  my_user_id: number;
  user_id: number;
  company_id?: number | null;
  item_id?: number | null;
  post_id: number | null;
  comment_id?: number | null;
  room_id?: number | null;
  reel_id: number | null;
  reel_comment_id?: number | null;
  type: number;
  is_read: number;
  created_at: string;
  updated_at: string;
  user: User;
  company?: Company | null;
  post?: Post | null;
  reel?: Reel | null;
  room?: Room | null;
}

export interface Setting {
  id: number;
  app_name: string;
  privacy_policy: string | null;
  terms_of_use: string | null;
  support_email: string | null;
  min_android_version: number;
  min_ios_version: number;
  latest_android_version: number;
  latest_ios_version: number;
  interests?: Interest[];
  documentType?: SettingCommon[];
  reportReasons?: SettingCommon[];
  restrictedUsernames?: SettingCommon[];
}

/** Firestore: users/{uid}/userList/{otherUid} or chats/{conversationId} */
export interface ChatRoom {
  conversationId?: string;
  iAmBlocked?: boolean;
  iBlocked?: boolean;
  deletedId?: string;
  isDeleted?: boolean;
  isMute?: boolean;
  lastMsg?: string;
  newMsgCount?: number;
  title?: string;
  profileImage?: string;
  profileType?: ActorProfileType;
  companyId?: number | null;
  /** 0 = request chat, 1 = accepted user chat, 2 = room chat */
  type?: number;
  userIdOrRoomId?: number;
  time?: Date;
  /** Room chat only */
  usersIds?: number[];
  deleteChatIds?: Record<string, string>;
  unreadCounts?: Record<string, number>;
}

export type MessageType = "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "STORY_REPLY";
export type ActorProfileType = "user" | "company";

/** Firestore: chats/{conversationId}/messages/{id} */
export interface ChatMessage {
  id: string;
  msg?: string;
  msgType: MessageType;
  content?: string;
  thumbnail?: string;
  senderId: number;
  senderCompanyId?: number | null;
  senderProfileType?: ActorProfileType;
  senderName?: string;
  senderUsername?: string;
  senderAvatar?: string | null;
  storyId?: number;
  deletedIds?: string[];
}

/* ═══════════════════════════════════════════════════
   AUDIO SPACES (Firestore: audio_spaces/{id})
   ═══════════════════════════════════════════════════ */

export type AudioSpaceType = "PUBLIC" | "PRIVATE";

export type AudioSpaceUserType = "LISTENER" | "HOST" | "ADMIN" | "REQUESTED" | "KICKED_OUT" | "ADDED";

export type AudioSpaceMicStatus = "NOT_GRANTED" | "MUTED" | "ON";

export interface AudioSpaceUser {
  id: number;
  userName?: string;
  fullName?: string;
  image?: string;
  deviceToken?: string;
  deviceType?: number;
  isVerified?: boolean;
  company_id?: number | null;
  profile_type?: ActorProfileType;
  display_name?: string;
  display_avatar?: string | null;
  type: AudioSpaceUserType;
  mic_status: AudioSpaceMicStatus;
  is_camera_on?: boolean;
}

export interface AudioSpaceLastReaction {
  emoji: string;
  uid: number;
  ts?: Date;
  company_id?: number | null;
  profile_type?: ActorProfileType;
  name?: string;
}

export interface AudioSpace {
  id: string;
  title?: string;
  description?: string;
  topics?: string;
  token?: string;
  type?: AudioSpaceType;
  is_video_conference?: boolean;
  screen_sharing_uid?: number;
  created_at?: Date;
  users?: AudioSpaceUser[];
  leaved_users?: AudioSpaceUser[];
  last_reaction?: AudioSpaceLastReaction;
}

/** Firestore: audio_spaces/{id}/messages/{msgId} */
export interface AudioSpaceMessage {
  id: string;
  userId: number;
  content: string;
  time?: Date;
  user?: AudioSpaceUser;
  sender_company_id?: number | null;
  sender_profile_type?: ActorProfileType;
  sender_name?: string;
  sender_username?: string;
  sender_avatar?: string | null;
}

/* ═══════════════════════════════════════════════════
   JOB BOARD
   ═══════════════════════════════════════════════════ */

export interface Company {
  id: number;
  owner_user_id?: number | null;
  name: string;
  email: string;
  logo: string | null;
  description: string | null;
  sector: string | null;
  rse_commitments: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  company_size: number | null;
  is_verified: number;
  is_suspended: number;
  device_token: string | null;
  created_at: string;
  updated_at: string;
  // Dynamic
  published_offers_count?: number;
  job_offers_count?: number;
  followers_count?: number;
  is_following?: number;
}

export type ContractType = "stage" | "alternance" | "cdi" | "cdd" | "freelance";
export type LocationType = "remote" | "hybrid" | "onsite";
export type JobStatus = "draft" | "published" | "closed" | "rejected";
export type ExperienceLevel = "junior" | "mid" | "senior";
export type ApplicationStatus = "received" | "in_review" | "interview" | "accepted" | "rejected";

export interface JobOffer {
  id: number;
  company_id: number;
  title: string;
  contract_type: ContractType;
  location_type: LocationType;
  location_city: string | null;
  domain: string | null;
  description: string;
  missions: string | null;
  required_skills: string[] | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;
  experience_level: ExperienceLevel | null;
  deadline: string | null;
  status: JobStatus;
  is_featured: number;
  views_count: number;
  applications_count: number;
  created_at: string;
  updated_at: string;
  company?: Company;
  // Dynamic flags
  is_saved?: number;
  is_applied?: number;
  match_score?: number;
  is_match?: number;
  application_status?: ApplicationStatus | null;
}

export interface JobApplication {
  id: number;
  user_id: number;
  job_offer_id: number;
  cover_letter: string | null;
  cv_file: string | null;
  status: ApplicationStatus;
  company_note: string | null;
  created_at: string;
  updated_at: string;
  user?: User;
  job_offer?: JobOffer;
}

export interface CompanyDashboard {
  company: Company;
  stats: {
    total_offers: number;
    published_offers: number;
    draft_offers: number;
    total_applications: number;
    total_views: number;
  };
  recent_offers: JobOffer[];
}

export interface JobKPIs {
  total_companies: number;
  total_offers: number;
  published_offers: number;
  total_applications: number;
  accepted_applications: number;
  total_views: number;
  conversion_rate: number;
}
