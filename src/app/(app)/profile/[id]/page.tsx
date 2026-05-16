"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Settings,
  MoreHorizontal,
  Pencil,
  Share2,
  MessageCircle,
  UserPlus,
  UserMinus,
  MapPin,
  LinkIcon,
  BadgeCheck,
  Briefcase,
  GraduationCap,
  Sparkles,
  User as UserIcon,
  Grid3X3,
  Play,
  Info,
  Flag,
  ShieldBan,
  ShieldCheck,
  X,
  Loader2,
  Heart,
  Flame,
  Star,
  Award,
  Calendar,
  Building2,
} from "lucide-react";
import { Avatar, VerifyBadge } from "@/components/ui/avatar";
import { PostCard } from "@/components/post/post-card";
import { useAuthStore, useSettingsStore, useTranslation } from "@/lib/store";
import { UserService } from "@/lib/services/user-service";
import { PostService } from "@/lib/services/post-service";
import { ReelService } from "@/lib/services/reel-service";
import { cn, formatCount, addBaseURL } from "@/lib/utils";
import { toConversationId } from "@/lib/services/chat-service";
import { getActingCompanyId } from "@/lib/company-acting";
import { getReportReasonsWithFallback } from "@/lib/report-reasons";
import type { Post, Reel, User, Company } from "@/lib/types";

const POSTS_PAGE_SIZE = 15;
const REELS_PAGE_SIZE = 18;

/* ═══════════════════════════════════════════════════════════════════
   PROFILE PAGE — identique au mobile ProfileScreen
   ═══════════════════════════════════════════════════════════════════ */

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: me } = useAuthStore();
  const { t } = useTranslation();
  const profileId = Number(params.id);

  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Posts tab
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);

  // Reels tab
  const [reels, setReels] = useState<Reel[]>([]);
  const [isLoadingReels, setIsLoadingReels] = useState(false);
  const [hasMoreReels, setHasMoreReels] = useState(true);

  // Follow state
  const [followingStatus, setFollowingStatus] = useState<number>(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Modals
  const [showMenu, setShowMenu] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Block state — local for immediate UI update after block/unblock
  const [isBlocked, setIsBlocked] = useState(false);

  const isMyProfile = me?.id === profileId;
  const isFollowing = followingStatus === 2 || followingStatus === 3;

  // ── Fetch Profile ──
  const fetchProfile = useCallback(async () => {
    if (!me) return;
    setIsLoading(true);
    try {
      const res = await UserService.fetchProfile(me.id, profileId, getActingCompanyId() ?? undefined);
      if (res.status && res.data) {
        setProfile(res.data);
        setFollowingStatus(res.data.followingStatus ?? 0);
        setFollowersCount(res.data.followers ?? 0);
        setFollowingCount(res.data.following ?? 0);
        // Derive blocked state from me.block_user_ids (refreshed from fetchProfile of self)
        const blockedIds = (me.block_user_ids ?? "").split(",").map(Number);
        setIsBlocked(blockedIds.includes(profileId));
      }
    } catch { /* silent */ }
    setIsLoading(false);
  }, [me, profileId]);

  // ── Fetch Posts ──
  const fetchPosts = useCallback(async (start: number, reset = false) => {
    if (!me) return;
    setIsLoadingPosts(true);
    try {
      const res = await PostService.fetchPostByUser(me.id, profileId, start, POSTS_PAGE_SIZE, getActingCompanyId() ?? undefined);
      if (res.status && res.data) {
        setPosts((prev) => reset ? res.data! : [...prev, ...res.data!]);
        setHasMorePosts(res.data.length >= POSTS_PAGE_SIZE);
      }
    } catch { /* silent */ }
    setIsLoadingPosts(false);
  }, [me, profileId]);

  // ── Fetch Reels ──
  const fetchReels = useCallback(async (start: number, reset = false) => {
    if (!me) return;
    setIsLoadingReels(true);
    try {
      const res = await ReelService.fetchReelsByUserId(me.id, profileId, start, REELS_PAGE_SIZE, getActingCompanyId() ?? undefined);
      if (res.status && res.data) {
        setReels((prev) => reset ? res.data! : [...prev, ...res.data!]);
        setHasMoreReels(res.data.length >= REELS_PAGE_SIZE);
      }
    } catch { /* silent */ }
    setIsLoadingReels(false);
  }, [me, profileId]);

  // Initial data load — profile first, then posts/reels if not blocked
  const initialLoadDone = useRef(false);
  useEffect(() => {
    initialLoadDone.current = false;
    const timer = window.setTimeout(() => {
      fetchProfile();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchProfile]);

  useEffect(() => {
    // Only fetch posts/reels once after profile first loads (not on block/unblock state changes)
    if (!isLoading && profile && !initialLoadDone.current) {
      initialLoadDone.current = true;
      if (!isBlocked) {
        const timer = window.setTimeout(() => {
          fetchPosts(0, true);
          fetchReels(0, true);
        }, 0);
        return () => window.clearTimeout(timer);
      }
    }
  }, [isLoading, profile, isBlocked, fetchPosts, fetchReels]);

  // ── Follow / Unfollow ──
  const handleFollow = useCallback(async () => {
    if (!me || isFollowLoading) return;
    setIsFollowLoading(true);
    const wasFollowing = isFollowing;

    // Optimistic
    if (wasFollowing) {
      setFollowingStatus((s) => (s === 3 ? 1 : 0));
      setFollowersCount((c) => Math.max(0, c - 1));
    } else {
      setFollowingStatus((s) => (s === 1 ? 3 : 2));
      setFollowersCount((c) => c + 1);
    }

    try {
      const res = wasFollowing
        ? await UserService.unfollowUser(me.id, profileId, getActingCompanyId() ?? undefined)
        : await UserService.followUser(me.id, profileId, getActingCompanyId() ?? undefined);
      if (!res.status) {
        // Rollback
        if (wasFollowing) {
          setFollowingStatus((s) => (s === 1 ? 3 : 2));
          setFollowersCount((c) => c + 1);
        } else {
          setFollowingStatus((s) => (s === 3 ? 1 : 0));
          setFollowersCount((c) => Math.max(0, c - 1));
        }
      }
    } catch {
      // Rollback
      if (wasFollowing) {
        setFollowingStatus((s) => (s === 1 ? 3 : 2));
        setFollowersCount((c) => c + 1);
      } else {
        setFollowingStatus((s) => (s === 3 ? 1 : 0));
        setFollowersCount((c) => Math.max(0, c - 1));
      }
    }
    setIsFollowLoading(false);
  }, [me, profileId, isFollowing, isFollowLoading]);

  // ── Block / Unblock — identique au mobile blockUnblock() ──
  const handleBlockToggle = useCallback(async () => {
    if (!me) return;
    setShowMenu(false);
    try {
      if (isBlocked) {
        // Unblock → re-fetch content
        await UserService.unblockUser(me.id, profileId);
        setIsBlocked(false);
        fetchProfile();
        fetchPosts(0, true);
        fetchReels(0, true);
      } else {
        // Block → backend auto-unfollows in both directions, clears follow records
        await UserService.blockUser(me.id, profileId);
        setIsBlocked(true);
        setFollowingStatus(0);
        setPosts([]);
        setReels([]);
        setHasMorePosts(false);
        setHasMoreReels(false);
      }
    } catch { /* silent */ }
  }, [me, profileId, isBlocked, fetchProfile, fetchPosts, fetchReels]);

  // ── Block Globally (moderator only) ──
  const handleBlockGlobally = useCallback(async () => {
    if (!me || me.is_moderator !== 1) return;
    setShowMenu(false);
    try {
      await UserService.blockUserByModerator(me.id, profileId);
      setIsBlocked(true);
      setFollowingStatus(0);
      setPosts([]);
      setReels([]);
      setHasMorePosts(false);
      setHasMoreReels(false);
    } catch { /* silent */ }
  }, [me, profileId]);

  // ── Share Profile ──
  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/profile/${profileId}`;
    if (navigator.share) {
      navigator.share({ title: profile?.full_name ?? "Profil", url });
    } else {
      navigator.clipboard.writeText(url);
    }
    setShowMenu(false);
  }, [profileId, profile]);

  // ── Delete post handler ──
  const handleDeletePost = useCallback((postId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  // ── Load more posts ──
  const handleLoadMorePosts = useCallback(() => {
    if (!isLoadingPosts && hasMorePosts) {
      fetchPosts(posts.length);
    }
  }, [isLoadingPosts, hasMorePosts, posts.length, fetchPosts]);

  // ── Load more reels ──
  const handleLoadMoreReels = useCallback(() => {
    if (!isLoadingReels && hasMoreReels) {
      fetchReels(reels.length);
    }
  }, [isLoadingReels, hasMoreReels, reels.length, fetchReels]);

  // ── Scroll sentinel for infinite load ──
  const postsEndRef = useRef<HTMLDivElement>(null);
  const reelsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab !== 0 || !postsEndRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) handleLoadMorePosts(); },
      { threshold: 0.1 }
    );
    observer.observe(postsEndRef.current);
    return () => observer.disconnect();
  }, [activeTab, handleLoadMorePosts]);

  useEffect(() => {
    if (activeTab !== 1 || !reelsEndRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) handleLoadMoreReels(); },
      { threshold: 0.1 }
    );
    observer.observe(reelsEndRef.current);
    return () => observer.disconnect();
  }, [activeTab, handleLoadMoreReels]);

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="animate-fadeIn">
        {/* Cover skeleton */}
        <div className="h-[200px] skeleton rounded-none" />
        <div className="px-4 -mt-12">
          <div className="w-[88px] h-[88px] rounded-2xl skeleton border-[3px] border-card" />
          <div className="mt-3 space-y-2">
            <div className="h-5 w-40 rounded skeleton" />
            <div className="h-3 w-24 rounded skeleton" />
          </div>
          <div className="flex gap-6 mt-4">
            <div className="h-3 w-16 rounded skeleton" />
            <div className="h-3 w-20 rounded skeleton" />
            <div className="h-3 w-16 rounded skeleton" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded skeleton" />
            <div className="h-3 w-3/4 rounded skeleton" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-text-light text-sm">{t("profile.notFound")}</p>
        <button onClick={() => router.back()} className="text-primary text-sm font-semibold hover:underline cursor-pointer">
          {t("profile.back")}
        </button>
      </div>
    );
  }

  const coverUrl = addBaseURL(profile.background_image);
  const avatarUrl = addBaseURL(profile.profile);
  const ownedCompany = profile.owned_company ?? null;
  const companyLogoUrl = addBaseURL(ownedCompany?.logo);
  const displayAvatarUrl = companyLogoUrl || avatarUrl;
  const profileStories = [...(profile.stories ?? []), ...(profile.company_stories ?? [])];
  const hasHeadline = !!profile.headline?.trim();
  const hasLocation = !!profile.location?.trim();
  const hasWebsite = !!profile.website?.trim();
  const hasBio = !!profile.bio?.trim();
  const interestsList = profile.interest ?? [];

  return (
    <div className="min-h-screen bg-card animate-fadeIn">
      {/* ── Cover Image + Navigation ── */}
      <div className="relative">
        <div
          className="relative h-[200px] sm:h-[240px] bg-gradient-to-br from-navy to-primary/80 overflow-hidden cursor-pointer"
          onClick={() => coverUrl && setLightboxUrl(coverUrl)}
        >
          {coverUrl && (
            <img
              src={coverUrl}
              alt="Couverture"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
          {ownedCompany && (
            <div className="absolute bottom-4 right-4 hidden sm:flex items-center gap-2 rounded-full bg-black/35 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15">
              <Building2 size={14} />
              Entreprise ITGA
            </div>
          )}

          {/* Nav buttons */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 z-10">
            <button
              onClick={(e) => { e.stopPropagation(); router.back(); }}
              className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
            {isMyProfile ? (
              <Link
                href="/settings"
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
              >
                <Settings size={20} />
              </Link>
            ) : (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                  className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors cursor-pointer"
                >
                  <MoreHorizontal size={20} />
                </button>
                {showMenu && (
                  <ProfileMenu
                    isBlocked={isBlocked}
                    isModerator={me?.is_moderator === 1}
                    onShare={handleShare}
                    onReport={() => { setShowMenu(false); setShowReportModal(true); }}
                    onBlock={handleBlockToggle}
                    onBlockGlobally={handleBlockGlobally}
                    onClose={() => setShowMenu(false)}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Avatar — positioned outside overflow-hidden cover so it's never clipped */}
        <div className="absolute -bottom-[42px] left-4 z-10">
            <button
              onClick={() => setLightboxUrl(displayAvatarUrl || "/default-avatar.png")}
              className={cn(
                "w-[88px] h-[88px] rounded-2xl border-[3px] shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 block",
                profileStories.length > 0
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-card"
              )}
            >
            <img
              src={displayAvatarUrl || "/default-avatar.png"}
              alt={ownedCompany?.name ?? profile.full_name}
              className="w-full h-full object-cover bg-bg-light"
            />
          </button>
        </div>
      </div>

      {/* ── Profile Details ── */}
      <div className="pt-[52px] px-4 pb-2">
        {/* Name + Badge */}
        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
          <h1 className="text-xl font-bold text-text-main truncate">{profile.full_name}</h1>
          {profile.is_verified >= 2 && <VerifyBadge size={18} />}
          {ownedCompany && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
              <Building2 size={11} />
              Entreprise
            </span>
          )}
        </div>

        {/* Username */}
        <p className="text-sm font-medium text-magenta">@{profile.username}</p>

        {/* Headline */}
        {hasHeadline && (
          <p className="text-sm text-text-light mt-1 leading-snug">{profile.headline}</p>
        )}

        {/* Location + Website chips */}
        {(hasLocation || hasWebsite) && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {hasLocation && (
              <span className="flex items-center gap-1 text-xs text-text-light bg-bg-light px-2.5 py-1 rounded-full">
                <MapPin size={12} />
                {profile.location}
              </span>
            )}
            {hasWebsite && (
              <a
                href={profile.website!.startsWith("http") ? profile.website! : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary bg-primary/5 px-2.5 py-1 rounded-full hover:bg-primary/10 transition-colors"
              >
                <LinkIcon size={12} />
                {profile.website}
              </a>
            )}
          </div>
        )}

        {/* Stats Row — Posts | Followers | Following */}
        {ownedCompany && (
          <CompanyIdentityPanel
            company={ownedCompany}
            isMyProfile={isMyProfile}
            dashboardLabel={t("company.dashboard")}
          />
        )}

        <div className="flex items-center gap-0 mt-4 py-3 border-y border-border/30">
          <button
            onClick={() => setActiveTab(0)}
            className="flex-1 text-center cursor-pointer hover:bg-bg-light/50 rounded-lg py-1.5 transition-all duration-200 group"
          >
            <span className="block text-lg font-bold text-text-main group-hover:text-primary transition-colors">{posts.length}</span>
            <span className="block text-[11px] text-text-light font-medium">Posts</span>
          </button>
          <div className="w-px h-8 bg-border/30" />
          <button
            onClick={() => setShowFollowers(true)}
            className="flex-1 text-center cursor-pointer hover:bg-bg-light/50 rounded-lg py-1.5 transition-all duration-200 group"
          >
            <span className="block text-lg font-bold text-text-main group-hover:text-primary transition-colors">{formatCount(followersCount)}</span>
            <span className="block text-[11px] text-text-light font-medium">Followers</span>
          </button>
          <div className="w-px h-8 bg-border/30" />
          <button
            onClick={() => setShowFollowing(true)}
            className="flex-1 text-center cursor-pointer hover:bg-bg-light/50 rounded-lg py-1.5 transition-all duration-200 group"
          >
            <span className="block text-lg font-bold text-text-main group-hover:text-primary transition-colors">{formatCount(followingCount)}</span>
            <span className="block text-[11px] text-text-light font-medium">Following</span>
          </button>
        </div>

        {/* Bio — with clickable URLs like mobile DetectableText */}
        {hasBio && (
          <div className="mt-3 p-3 bg-bg-light/60 rounded-xl border border-border/20">
            <BioText text={profile.bio!} />
          </div>
        )}

        {/* Interest Tags */}
        {interestsList.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {interestsList.map((interest) => (
              <span
                key={interest.id}
                className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/15"
              >
                {interest.title}
              </span>
            ))}
          </div>
        )}

        {/* Achievement Badges — Test 13.7 */}
        <AchievementBadges user={profile} postCount={posts.length} reelCount={reels.length} />

        {/* Action Buttons — Test 13.5, 14.1, 14.2 */}
        {!isBlocked && (
          <div className="flex gap-2 mt-4">
            {isMyProfile ? (
              <>
                <Link
                  href="/settings"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-primary to-cyan text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 active:scale-[0.98]"
                >
                  <Pencil size={15} />
                  {t("profile.editProfile")}
                </Link>
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border/40 text-text-main text-sm font-semibold hover:bg-bg-light transition-all duration-200 cursor-pointer active:scale-[0.98]"
                >
                  <Share2 size={15} />
                  {t("profile.share")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href={`/chats/${me ? toConversationId(me.id, profileId) : ""}?type=1&otherId=${profileId}&title=${encodeURIComponent(profile?.full_name ?? "")}&img=${encodeURIComponent(profile?.profile ?? "")}`}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border/40 text-text-main text-sm font-semibold hover:bg-bg-light transition-all duration-200 active:scale-[0.98]"
                >
                  <MessageCircle size={15} />
                  {t("profile.message")}
                </Link>
                <button
                  onClick={handleFollow}
                  disabled={isFollowLoading}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer active:scale-[0.98]",
                    isFollowing
                      ? "border border-border/40 text-text-main hover:bg-bg-light"
                      : "bg-gradient-to-r from-primary to-cyan text-white hover:shadow-lg hover:shadow-primary/20"
                  )}
                >
                  {isFollowing ? <UserMinus size={15} /> : <UserPlus size={15} />}
                  {isFollowing ? t("profile.unfollow") : t("profile.follow")}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Tabs: Posts / Reels / About ── */}
      <div className="sticky top-0 z-10 glass-header border-b border-border/20 mt-2">
        <div className="flex mx-4">
          {[
            { label: "POSTS", icon: <Grid3X3 size={16} /> },
            { label: "REELS", icon: <Play size={16} /> },
            { label: "ABOUT", icon: <Info size={16} /> },
          ].map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer relative",
                activeTab === i
                  ? "text-primary"
                  : "text-text-light hover:text-text-dark hover:bg-bg-light/40"
              )}
            >
              {tab.icon}
              {tab.label}
              {activeTab === i && (
                <span
                  className="absolute bottom-0 left-1/4 right-1/4 h-[2.5px] rounded-full"
                  style={{ background: "linear-gradient(90deg, #2AABAB, #5DCCC6)" }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="min-h-[300px]">
        {isBlocked ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 px-4">
            <div className="w-14 h-14 rounded-full bg-red/10 flex items-center justify-center">
              <ShieldBan size={28} className="text-red" />
            </div>
            <p className="text-sm font-semibold text-text-main">{t("profile.blockedLabel")}</p>
            <p className="text-xs text-text-light text-center max-w-xs">
              {t("profile.blockedDesc")}
            </p>
          </div>
        ) : (
          <>
            {/* Posts Tab */}
            {activeTab === 0 && (
              <div className="animate-fadeIn">
                {posts.length === 0 && !isLoadingPosts ? (
                  <EmptyState icon={<Grid3X3 size={32} />} text={t("profile.noPost")} />
                ) : (
                  <>
                    {posts.map((post) => (
                      <PostCard key={post.id} post={post} onDelete={handleDeletePost} />
                    ))}
                    {isLoadingPosts && <LoadingSpinner />}
                    {!hasMorePosts && posts.length > 0 && (
                      <p className="text-center text-xs text-text-light py-6">{t("profile.seenAll")}</p>
                    )}
                    <div ref={postsEndRef} className="h-4" />
                  </>
                )}
              </div>
            )}

            {/* Reels Tab */}
            {activeTab === 1 && (
              <div className="animate-fadeIn p-2">
                {reels.length === 0 && !isLoadingReels ? (
                  <EmptyState icon={<Play size={32} />} text={t("profile.noReel")} />
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-1">
                      {reels.map((reel) => (
                        <ReelThumbnail key={reel.id} reel={reel} />
                      ))}
                    </div>
                    {isLoadingReels && <LoadingSpinner />}
                    {!hasMoreReels && reels.length > 0 && (
                      <p className="text-center text-xs text-text-light py-6">{t("profile.seenAll")}</p>
                    )}
                    <div ref={reelsEndRef} className="h-4" />
                  </>
                )}
              </div>
            )}

            {/* About Tab */}
            {activeTab === 2 && (
              <div className="animate-fadeIn">
                <AboutTab profile={profile} isMyProfile={isMyProfile} />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Followers Modal ── */}
      {showFollowers && (
        <UserListModal
          title="Followers"
          userId={profileId}
          type="followers"
          onClose={() => setShowFollowers(false)}
        />
      )}

      {/* ── Following Modal ── */}
      {showFollowing && (
        <UserListModal
          title="Following"
          userId={profileId}
          type="following"
          companyId={me?.id === profileId ? getActingCompanyId() ?? undefined : undefined}
          onClose={() => setShowFollowing(false)}
        />
      )}

      {/* ── Report Modal ── */}
      {showReportModal && (
        <ReportUserModal
          userId={profileId}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* ── Image Lightbox (avatar / banner) ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-fadeIn cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer z-10"
          >
            <X size={24} />
          </button>
          <img
            src={lightboxUrl}
            alt="Vue agrandie"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Profile Menu (for other users) ─── */
function CompanyIdentityPanel({
  company,
  isMyProfile,
  dashboardLabel,
}: {
  company: Company;
  isMyProfile: boolean;
  dashboardLabel: string;
}) {
  const logoUrl = addBaseURL(company.logo);
  const location = [company.city, company.country].filter(Boolean).join(", ");
  const website = company.website?.trim();
  const websiteUrl = website ? (website.startsWith("http") ? website : `https://${website}`) : "";

  return (
    <section className="relative mt-4 overflow-hidden rounded-lg border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-cyan/10 p-3.5 shadow-sm animate-fadeIn">
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary via-cyan to-magenta" />
      <div className="flex items-start gap-3 pl-1">
        <div className="w-12 h-12 rounded-lg border border-primary/15 bg-card overflow-hidden shrink-0 shadow-sm">
          {logoUrl ? (
            <img src={logoUrl} alt={company.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
              <Building2 size={22} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-black text-text-main truncate">{company.name}</h2>
            {company.is_verified === 1 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green">
                <BadgeCheck size={10} />
                Verifiee
              </span>
            )}
          </div>
          {company.sector && <p className="mt-0.5 text-xs font-medium text-primary">{company.sector}</p>}
          {(location || website) && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-text-light">
              {location && (
                <span className="inline-flex items-center gap-1 rounded-full bg-card/70 px-2 py-1">
                  <MapPin size={11} />
                  {location}
                </span>
              )}
              {website && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-card/70 px-2 py-1 text-primary hover:bg-primary/10 transition-colors"
                >
                  <LinkIcon size={11} />
                  {website}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 divide-x divide-border/30 rounded-lg bg-card/70 px-1 py-2">
        <CompanyMetric value={formatCount(company.published_offers_count ?? 0)} label="Offres actives" />
        <CompanyMetric value={formatCount(company.followers_count ?? 0)} label="Abonnes" />
        <CompanyMetric value={formatCount(company.job_offers_count ?? 0)} label="Jobs crees" />
      </div>
      <div className={cn("mt-3 grid gap-2", isMyProfile ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
        <Link
          href={`/company/${company.id}`}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/95"
        >
          <Building2 size={14} />
          Voir la page entreprise
        </Link>
        {isMyProfile && (
          <Link
            href="/company/dashboard"
            className="flex items-center justify-center gap-2 rounded-lg border border-primary/15 bg-card px-3 py-2 text-xs font-bold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5"
          >
            <Briefcase size={14} />
            {dashboardLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

function CompanyMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2 text-center">
      <span className="block text-sm font-black text-text-main">{value}</span>
      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-text-light">{label}</span>
    </div>
  );
}

function ProfileMenu({
  isBlocked,
  isModerator,
  onShare,
  onReport,
  onBlock,
  onBlockGlobally,
  onClose,
}: {
  isBlocked: boolean;
  isModerator: boolean;
  onShare: () => void;
  onReport: () => void;
  onBlock: () => void;
  onBlockGlobally: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-12 z-50 w-52 bg-card rounded-xl shadow-xl border border-border py-1.5 animate-scaleIn origin-top-right">
        <button onClick={onShare} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-main hover:bg-bg-light transition-colors cursor-pointer">
          <Share2 size={16} className="text-text-light" />
          Partager
        </button>
        <button onClick={onReport} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-main hover:bg-bg-light transition-colors cursor-pointer">
          <Flag size={16} className="text-text-light" />
          Signaler
        </button>
        <button onClick={onBlock} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:bg-bg-light transition-colors cursor-pointer text-red">
          {isBlocked ? <ShieldCheck size={16} /> : <ShieldBan size={16} />}
          {isBlocked ? "Débloquer" : "Bloquer"}
        </button>
        {isModerator && (
          <button onClick={onBlockGlobally} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:bg-bg-light transition-colors cursor-pointer text-red">
            <ShieldBan size={16} />
            Bloquer globalement
          </button>
        )}
      </div>
    </>
  );
}

/* ─── Achievement Badges — identique au mobile AchievementBadges ─── */
function AchievementBadges({ user, postCount, reelCount }: { user: User; postCount: number; reelCount: number }) {
  const badges: { title: string; icon: React.ReactNode; color: string; earned: boolean }[] = [];

  if (user.is_verified >= 2) {
    badges.push({ title: "Vérifiée", icon: <BadgeCheck size={14} />, color: "text-blue-500 bg-blue-500/10 border-blue-500/20", earned: true });
  }
  if (postCount >= 10) {
    badges.push({ title: "Créatrice", icon: <Flame size={14} />, color: "text-orange-500 bg-orange-500/10 border-orange-500/20", earned: true });
  }
  if (postCount >= 50) {
    badges.push({ title: "Prolifique", icon: <Star size={14} />, color: "text-amber-500 bg-amber-500/10 border-amber-500/20", earned: true });
  }
  if (reelCount >= 5) {
    badges.push({ title: "Vidéaste", icon: <Play size={14} />, color: "text-purple-500 bg-purple-500/10 border-purple-500/20", earned: true });
  }
  if ((user.followers ?? 0) >= 100) {
    badges.push({ title: "Influenceuse", icon: <Heart size={14} />, color: "text-magenta bg-magenta/10 border-magenta/20", earned: true });
  }
  if ((user.followers ?? 0) >= 1000) {
    badges.push({ title: "Leader", icon: <Award size={14} />, color: "text-primary bg-primary/10 border-primary/20", earned: true });
  }

  const earned = badges.filter((b) => b.earned);
  if (earned.length === 0) return null;

  return (
    <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
      {earned.map((badge, i) => (
        <span
          key={i}
          className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0", badge.color)}
        >
          {badge.icon}
          {badge.title}
        </span>
      ))}
    </div>
  );
}

/* ─── Reel Thumbnail ─── */
function ReelThumbnail({ reel }: { reel: Reel }) {
  const thumbnailUrl = addBaseURL(reel.thumbnail);
  return (
    <Link
      href={`/reels?id=${reel.id}`}
      className="relative aspect-[9/16] rounded-lg overflow-hidden bg-bg-light group"
    >
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-navy/10 to-primary/10 flex items-center justify-center">
          <Play size={24} className="text-text-light/40" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <Play size={28} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" fill="currentColor" />
      </div>
      {(reel.likes_count ?? 0) > 0 && (
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-white text-[10px] font-semibold drop-shadow-md">
          <Heart size={10} fill="currentColor" />
          {formatCount(reel.likes_count)}
        </div>
      )}
    </Link>
  );
}

/* ─── About Tab — LinkedIn-style sections ─── */
function AboutTab({ profile, isMyProfile }: { profile: User; isMyProfile: boolean }) {
  const hasAbout = !!profile.about?.trim();
  const hasExperience = !!profile.experience?.trim();
  const hasEducation = !!profile.education?.trim();
  const hasSkills = !!profile.skills?.trim();
  const hasPronouns = !!profile.pronouns?.trim();
  const hasWebsite = !!profile.website?.trim();
  const hasLocation = !!profile.location?.trim();
  const hasHeadline = !!profile.headline?.trim();
  const hasAny = hasAbout || hasExperience || hasEducation || hasSkills || hasPronouns || hasWebsite || hasLocation || hasHeadline;

  return (
    <div className="px-4 py-4 space-y-3">
      {/* Edit profile CTA for own profile */}
      {isMyProfile && (
        <Link
          href="/settings"
          className="flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/15 hover:from-primary/15 transition-all"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Pencil size={15} className="text-primary" />
          </div>
          <span className="text-sm font-semibold text-primary">Modifier le profil</span>
          <ArrowLeft size={16} className="text-primary/50 ml-auto rotate-180" />
        </Link>
      )}

      {!hasAny && !isMyProfile && (
        <EmptyState icon={<Info size={32} />} text="Aucune information professionnelle renseignée." />
      )}

      {/* Info Bar — headline, pronouns, location, website */}
      {(hasHeadline || hasPronouns || hasLocation || hasWebsite) && (
        <div className="p-4 bg-bg-light rounded-xl border border-border-light space-y-3">
          {hasHeadline && (
            <p className="text-base font-semibold text-text-main">{profile.headline}</p>
          )}
          {(hasPronouns || hasLocation || hasWebsite) && hasHeadline && (
            <div className="border-t border-border-light" />
          )}
          <div className="flex flex-wrap gap-2">
            {hasPronouns && (
              <span className="flex items-center gap-1 text-xs text-text-light bg-card px-2.5 py-1 rounded-full border border-border/30">
                <BadgeCheck size={12} />
                {profile.pronouns}
              </span>
            )}
            {hasLocation && (
              <span className="flex items-center gap-1 text-xs text-text-light bg-card px-2.5 py-1 rounded-full border border-border/30">
                <MapPin size={12} />
                {profile.location}
              </span>
            )}
            {hasWebsite && (
              <a
                href={profile.website!.startsWith("http") ? profile.website! : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary bg-primary/5 px-2.5 py-1 rounded-full border border-primary/15 hover:bg-primary/10 transition-colors"
              >
                <LinkIcon size={12} />
                {profile.website}
              </a>
            )}
          </div>
          {hasWebsite && <WebsiteLinkCard url={profile.website!} />}
        </div>
      )}

      {/* About section */}
      {hasAbout && (
        <ProfileSection icon={<UserIcon size={16} />} title="À propos">
          <p className="text-sm text-text-light leading-relaxed whitespace-pre-wrap">{profile.about}</p>
        </ProfileSection>
      )}

      {/* Experience section */}
      {hasExperience && (
        <ProfileSection icon={<Briefcase size={16} />} title="Expérience">
          <JsonListItems jsonStr={profile.experience!} isExperience />
        </ProfileSection>
      )}

      {/* Education section */}
      {hasEducation && (
        <ProfileSection icon={<GraduationCap size={16} />} title="Formation">
          <JsonListItems jsonStr={profile.education!} isExperience={false} />
        </ProfileSection>
      )}

      {/* Skills section */}
      {hasSkills && (
        <ProfileSection icon={<Sparkles size={16} />} title="Compétences">
          <SkillsChips skillsStr={profile.skills!} />
        </ProfileSection>
      )}
    </div>
  );
}

/* ─── Profile Section wrapper — identical to mobile _profileSection ─── */
function ProfileSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 bg-bg-light rounded-xl border border-border-light">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <h3 className="text-base font-bold text-text-main">{title}</h3>
      </div>
      <div className="border-t border-border-light pt-3">
        {children}
      </div>
    </div>
  );
}

/* ─── JSON List Items (experience / education) ─── */
function JsonListItems({ jsonStr, isExperience }: { jsonStr: string; isExperience: boolean }) {
  let items: Array<Record<string, string>> = [];
  try {
    if (jsonStr.startsWith("[")) {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) items = parsed;
    }
  } catch { /* fallback to plain text */ }

  if (items.length === 0) {
    return <p className="text-sm text-text-light">{jsonStr}</p>;
  }

  return (
    <div className="space-y-0">
      {items.map((item, i) => {
        const title = item.title || item.position || item.degree || "";
        const subtitle = item.company || item.school || "";
        const period = item.period || "";
        const isLast = i === items.length - 1;
        return (
          <div key={i}>
            <div className="flex gap-3 py-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                {isExperience ? <Briefcase size={18} className="text-primary" /> : <GraduationCap size={18} className="text-primary" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-main">{title}</p>
                {subtitle && <p className="text-sm text-text-light mt-0.5">{subtitle}</p>}
                {period && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-text-light/70">
                    <Calendar size={11} />
                    {period}
                  </div>
                )}
              </div>
            </div>
            {!isLast && <div className="ml-[52px] border-t border-border-light/60" />}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Skills Chips ─── */
function SkillsChips({ skillsStr }: { skillsStr: string }) {
  let skills: string[] = [];
  try {
    if (skillsStr.startsWith("[")) {
      const parsed = JSON.parse(skillsStr);
      if (Array.isArray(parsed)) skills = parsed.map(String);
    } else {
      skills = skillsStr.split(",").map((s) => s.trim()).filter(Boolean);
    }
  } catch {
    skills = skillsStr.split(",").map((s) => s.trim()).filter(Boolean);
  }

  if (skills.length === 0) {
    return <p className="text-sm text-text-light">{skillsStr}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill, i) => (
        <span
          key={i}
          className="px-3 py-1.5 rounded-full bg-primary/15 text-primary text-xs font-semibold border border-primary/20"
        >
          {skill}
        </span>
      ))}
    </div>
  );
}

/* ─── User List Modal (Followers / Following) — Test 13.6 ─── */
function UserListModal({
  title,
  userId,
  type,
  companyId,
  onClose,
}: {
  title: string;
  userId: number;
  type: "followers" | "following";
  companyId?: number;
  onClose: () => void;
}) {
  const { user: me } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!me) return;
    (async () => {
      setIsLoading(true);
      try {
        const res = type === "followers"
          ? await UserService.fetchFollowersList(userId, undefined, 0, 200)
          : await UserService.fetchFollowingList(userId, 0, 200, companyId);
        if (res.status && res.data) {
          setUsers(res.data);
        }
      } catch { /* silent */ }
      setIsLoading(false);
    })();
  }, [me, userId, type, companyId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slideUp overflow-hidden max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light shrink-0">
          <h3 className="text-lg font-bold text-text-main">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-bg-light text-text-light cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <EmptyState icon={<UserIcon size={28} />} text={`Aucun ${type === "followers" ? "abonné" : "abonnement"} pour le moment.`} />
          ) : (
            <div className="divide-y divide-border-light/50">
              {users.map((u) => {
                const company = u.profile_type === "company" ? u.owned_company : null;
                const href = company?.id ? `/company/${company.id}` : `/profile/${u.id}`;
                const name = company?.name ?? u.full_name ?? "Profil";
                const avatar = company?.logo ?? u.profile;
                const subtitle = company?.sector ?? `@${u.username}`;

                return (
                  <Link
                    key={`${company ? "company" : "user"}-${company?.id ?? u.id}`}
                    href={href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-bg-light/50 transition-colors"
                  >
                    <Avatar src={avatar} alt={name} size={40} isVerified={u.is_verified >= 2} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold text-text-main truncate">{name}</span>
                        {u.is_verified >= 2 && <VerifyBadge size={14} />}
                        {company && <Building2 size={13} className="text-primary shrink-0" />}
                      </div>
                      <span className="text-xs text-text-light truncate block">{subtitle}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Bio Text with clickable URLs — like mobile DetectableText ─── */
function BioText({ text }: { text: string }) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlPattern);
  const isUrl = (s: string) => /^https?:\/\//.test(s);
  return (
    <p className="text-sm text-text-main leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) =>
        isUrl(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

/* ─── Website Link Card — web equivalent of mobile _WebsitePreviewCard ─── */
function WebsiteLinkCard({ url }: { url: string }) {
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;
  let domain = url;
  try { domain = new URL(fullUrl).hostname.replace("www.", ""); } catch { /* keep raw */ }
  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-card border border-border/30 hover:border-primary/30 hover:bg-primary/[0.02] transition-all group"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
        <LinkIcon size={18} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-main truncate group-hover:text-primary transition-colors">{domain}</p>
        <p className="text-xs text-text-light truncate">{url}</p>
      </div>
      <ArrowLeft size={14} className="text-text-light/50 rotate-180 shrink-0" />
    </a>
  );
}

/* ─── Shared UI ─── */
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-2 text-text-light/40">
      {icon}
      <p className="text-sm text-text-light">{text}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-6">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
      </div>
    </div>
  );
}

/* ─── Report User Modal — Test 16 (Signaler un utilisateur) ─── */
function ReportUserModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const reportReasons = useSettingsStore((state) => state.reportReasons);
  const availableReportReasons = getReportReasonsWithFallback(reportReasons);
  const [reason, setReason] = useState("");
  const [desc, setDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;
    setIsSubmitting(true);
    try {
      await UserService.reportUser(userId, reason, desc);
      setSubmitted(true);
    } catch { /* silent */ }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slideUp overflow-hidden max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light shrink-0">
          <h3 className="text-lg font-bold text-text-main">Signaler cet utilisateur</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-bg-light text-text-light cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 overscroll-contain">
          {submitted ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-green/10 flex items-center justify-center">
                <BadgeCheck size={24} className="text-green" />
              </div>
              <p className="text-sm font-semibold text-text-main">Signalement envoyé</p>
              <p className="text-xs text-text-light text-center">Merci pour votre signalement. Nous examinerons ce profil.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-text-light mb-4">Sélectionnez la raison du signalement :</p>
              <div className="space-y-2">
                {availableReportReasons.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer border",
                      reason === r
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border-light text-text-main hover:bg-bg-light"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Détails supplémentaires (optionnel)..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="mt-4 w-full h-20 px-3 py-2 rounded-xl border border-border-light text-sm text-text-main placeholder:text-text-light/50 focus:outline-none focus:border-primary resize-none"
              />
              <button
                onClick={handleSubmit}
                disabled={!reason || isSubmitting}
                className={cn(
                  "mt-4 w-full py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer",
                  reason && !isSubmitting
                    ? "bg-red text-white hover:bg-red/90"
                    : "bg-bg-light text-text-light cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin mx-auto" />
                ) : (
                  "Envoyer le signalement"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
