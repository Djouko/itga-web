"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  BookmarkCheck,
  MoreHorizontal,
  Share2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Pencil,
  Trash2,
  Flag,
  X,
  AlertTriangle,
  Loader2,
  Users,
} from "lucide-react";
import { Avatar, VerifyBadge } from "@/components/ui/avatar";
import { cn, formatTimeAgo, formatCount, addBaseURL } from "@/lib/utils";
import type { Company, Post, PostContent, User } from "@/lib/types";
import { useAuthStore, useSettingsStore } from "@/lib/store";
import { PostService } from "@/lib/services/post-service";
import { UserService } from "@/lib/services/user-service";
import { getActingCompanyId } from "@/lib/company-acting";
import { getReportReasonsWithFallback } from "@/lib/report-reasons";
import { MentionProfileLink } from "@/components/text/mention-profile-link";

interface PostCardProps {
  post: Post;
  onComment?: (postId: number) => void;
  onRepost?: (postId: number) => void;
  onDelete?: (postId: number) => void;
}

interface ActorListItem {
  key: string;
  href: string;
  name: string;
  subtitle: string;
  avatar: string | null;
  isVerified: boolean;
  isCompany: boolean;
}

export function PostCard({ post, onComment, onRepost, onDelete }: PostCardProps) {
  const { user, updateUser } = useAuthStore();

  const displayPost = post.original_post_id && post.original_post ? post.original_post : post;
  const isRepost = !!post.original_post_id;
  const isQuoteRepost = isRepost && post.desc && post.desc.trim().length > 0;
  const actingCompanyId = getActingCompanyId();
  const authorCompanyId = displayPost.company?.id ?? displayPost.company_id ?? null;
  const isCompanyAuthor = authorCompanyId != null;
  const authorHref = isCompanyAuthor ? `/company/${authorCompanyId}` : `/profile/${displayPost.user_id}`;
  const authorName = isCompanyAuthor ? displayPost.company?.name : displayPost.user?.full_name;
  const authorHandle = isCompanyAuthor ? (displayPost.company?.sector ?? "Entreprise ITGA") : `@${displayPost.user?.username ?? ""}`;
  const authorAvatar = isCompanyAuthor ? displayPost.company?.logo : displayPost.user?.profile;
  const authorVerified = isCompanyAuthor
    ? (displayPost.company?.is_verified ?? 0) >= 1
    : displayPost.user?.is_verified != null && displayPost.user.is_verified >= 2;
  const repostCompanyId = post.company?.id ?? post.company_id ?? null;
  const repostActorHref = repostCompanyId ? `/company/${repostCompanyId}` : `/profile/${post.user_id}`;
  const repostActorName = repostCompanyId ? post.company?.name : post.user?.full_name;
  const isOwner = actingCompanyId
    ? displayPost.company_id === actingCompanyId
    : displayPost.user_id === user?.id && !displayPost.company_id;

  const [isLiked, setIsLiked] = useState(displayPost.is_like === 1);
  const [likeCount, setLikeCount] = useState(displayPost.likes_count ?? 0);
  const [repostCount, setRepostCount] = useState(displayPost.repost_count ?? 0);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [likeAnimKey, setLikeAnimKey] = useState(0);

  const savedIds = user?.saved_post_ids
    ? user.saved_post_ids.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n))
    : [];
  const [isSaved, setIsSaved] = useState(savedIds.includes(displayPost.id));
  const [showMenu, setShowMenu] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [localDesc, setLocalDesc] = useState(displayPost.desc ?? "");
  const [editText, setEditText] = useState(displayPost.desc ?? "");
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [localIsEdited, setLocalIsEdited] = useState(displayPost.is_edited === 1);

  const [showRepostModal, setShowRepostModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showWhoLiked, setShowWhoLiked] = useState(false);
  const [showWhoReposted, setShowWhoReposted] = useState(false);

  // ── toggleFav — identique au mobile post_controller.dart ──
  const handleLike = useCallback(async () => {
    if (!user || isActionLoading) return;
    setIsActionLoading(true);
    const wasLiked = isLiked;
    const prevCount = likeCount;

    if (wasLiked) {
      setLikeCount((c) => Math.max(0, c - 1));
      setIsLiked(false);
      try { await PostService.dislikePost(user.id, displayPost.id, actingCompanyId ?? undefined); }
      catch { setLikeCount(prevCount); setIsLiked(true); }
    } else {
      setLikeCount((c) => c + 1);
      setIsLiked(true);
      setLikeAnimKey((k) => k + 1);
      try { await PostService.likePost(user.id, displayPost.id, actingCompanyId ?? undefined); }
      catch { setLikeCount(prevCount); setIsLiked(false); }
    }
    setIsActionLoading(false);
  }, [user, isLiked, likeCount, displayPost.id, isActionLoading, actingCompanyId]);

  // ── likeFromDoubleTap — identique au mobile ──
  const handleDoubleTapLike = useCallback(async () => {
    if (!user || isLiked) return;
    setShowDoubleTapHeart(true);
    setTimeout(() => setShowDoubleTapHeart(false), 800);
    setLikeCount((c) => c + 1);
    setIsLiked(true);
    try { await PostService.likePost(user.id, displayPost.id, actingCompanyId ?? undefined); }
    catch { setLikeCount((c) => Math.max(0, c - 1)); setIsLiked(false); }
  }, [user, isLiked, displayPost.id, actingCompanyId]);

  // ── onSaved — identique au mobile post_controller.dart ──
  const handleSave = useCallback(async () => {
    if (!user || isActionLoading) return;
    setIsActionLoading(true);
    const currentIds = user.saved_post_ids
      ? user.saved_post_ids.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n))
      : [];
    const wasSaved = isSaved;
    const newIds = wasSaved
      ? currentIds.filter((id) => id !== displayPost.id)
      : [...currentIds, displayPost.id];

    setIsSaved(!wasSaved);
    try {
      await UserService.editProfile(user.id, { saved_post_ids: newIds.join(",") });
      updateUser({ saved_post_ids: newIds.join(",") });
    } catch { setIsSaved(wasSaved); }
    setIsActionLoading(false);
  }, [user, isSaved, displayPost.id, isActionLoading, updateUser]);

  // ── repostPost — avec ou sans message, identique au mobile ──
  const handleRepostSubmit = useCallback(async (desc?: string) => {
    if (!user || isActionLoading) return;
    if (isOwner) return;
    setIsActionLoading(true);
    setShowRepostModal(false);
    try {
      const res = await PostService.repostPost(user.id, displayPost.id, desc, actingCompanyId ?? undefined);
      if (res.status) {
        setRepostCount((c) => c + 1);
        onRepost?.(displayPost.id);
      }
    } catch { /* silent */ }
    setIsActionLoading(false);
  }, [user, displayPost.id, isActionLoading, onRepost, actingCompanyId, isOwner]);

  // ── sharePost ──
  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/post/${displayPost.id}`;
    if (navigator.share) {
      navigator.share({ title: displayPost.user?.full_name ?? "", text: displayPost.desc ?? "", url });
    } else {
      navigator.clipboard.writeText(url);
    }
  }, [displayPost]);

  // ── editPost — identique au mobile ──
  const handleEditSubmit = useCallback(async () => {
    if (!user || isEditSaving || !editText.trim()) return;
    setIsEditSaving(true);
    try {
      const res = await PostService.editPost(user.id, displayPost.id, editText.trim(), actingCompanyId ?? undefined);
      if (res.status) {
        setLocalDesc(editText.trim());
        setLocalIsEdited(true);
        setIsEditing(false);
      }
    } catch { /* silent */ }
    setIsEditSaving(false);
  }, [user, displayPost.id, editText, isEditSaving, actingCompanyId]);

  // ── deleteMyPost — avec confirmation ──
  const handleDeleteConfirmed = useCallback(async () => {
    if (!user) return;
    setShowDeleteConfirm(false);
    try {
      const res = await PostService.deleteMyPost(user.id, displayPost.id, actingCompanyId ?? undefined);
      if (res.status) onDelete?.(displayPost.id);
    } catch { /* silent */ }
  }, [user, displayPost.id, onDelete, actingCompanyId]);

  // ── Catégoriser le contenu — identique au mobile Post.type getter ──
  const contentItems = displayPost.content ?? [];
  const firstContentType = contentItems.length > 0 ? (contentItems[0].content_type ?? 0) : -1;
  const images = firstContentType === 0 ? contentItems : [];
  const videos = firstContentType === 1 ? contentItems : [];
  const audios = firstContentType === 2 ? contentItems : [];

  return (
    <>
      <article className="card overflow-hidden group/card">
        {/* Repost Header — identique au mobile: "🔁 Username a repartagé" */}
        {isRepost && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-0">
            <Repeat2 size={14} className="text-text-light" />
            <Link
              href={repostActorHref}
              className="text-xs font-medium text-text-light hover:underline hover:text-primary transition-colors"
            >
              {repostActorName} a repartagé
            </Link>
          </div>
        )}

        {/* Quote repost description — identique au mobile: post.desc du reposter */}
        {isQuoteRepost && (
          <div className="px-4 pt-2">
            <p className="text-[14px] text-text-main/80 italic leading-relaxed">
              « {post.desc} »
            </p>
          </div>
        )}

        {/* Conteneur du post original — bordure si quote repost */}
        <div className={cn(
          isQuoteRepost && "mx-3 mt-2 border border-border rounded-xl overflow-hidden"
        )}>
          <div className="px-4 pt-2.5 pb-0">
            {/* Header row */}
            <div className="flex items-start gap-2.5 mb-2">
              <Link href={authorHref} className="shrink-0">
                <Avatar
                  src={authorAvatar}
                  alt={authorName ?? "User"}
                  size={38}
                  isVerified={authorVerified}
                />
              </Link>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <Link
                        href={authorHref}
                        className="text-[13px] font-semibold text-text-main truncate hover:underline hover:text-primary transition-colors duration-200"
                      >
                        {authorName}
                      </Link>
                      {authorVerified && <VerifyBadge size={13} />}
                      {isCompanyAuthor && (
                        <Link
                          href={authorHref}
                          className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ color: "#00c4d4", background: "rgba(0,196,212,0.12)", border: "1px solid rgba(0,196,212,0.25)" }}
                        >
                          Entreprise
                        </Link>
                      )}
                    </div>
                    <p className="text-[11px] text-text-light leading-tight truncate">
                      {authorHandle} · {formatTimeAgo(displayPost.created_at)}
                      {localIsEdited && <span className="ml-1 text-text-light/60">(modifié)</span>}
                    </p>
                  </div>
                  <div className="relative shrink-0 ml-2">
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-1.5 rounded-full hover:bg-bg-light text-text-light hover:text-text-dark transition-all duration-200 cursor-pointer opacity-0 group-hover/card:opacity-100 focus:opacity-100"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {showMenu && (
                      <PostMenu
                        isOwner={isOwner}
                        isSaved={isSaved}
                        onClose={() => setShowMenu(false)}
                        onEdit={() => { setShowMenu(false); setIsEditing(true); }}
                        onDelete={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                        onReport={() => { setShowMenu(false); setShowReportModal(true); }}
                        onShare={() => { setShowMenu(false); handleShare(); }}
                        onSave={() => { setShowMenu(false); handleSave(); }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Description / Inline Edit */}
            {isEditing ? (
              <div className="mb-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full min-h-[80px] text-[15px] text-text-main leading-relaxed bg-bg-light rounded-lg p-3 border border-primary/20 outline-none focus:border-primary resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    onClick={() => { setIsEditing(false); setEditText(localDesc); }}
                    className="px-3 py-1.5 text-xs font-semibold text-text-light hover:text-text-main rounded-full hover:bg-bg-light transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleEditSubmit}
                    disabled={isEditSaving || !editText.trim()}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-primary rounded-full hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isEditSaving ? "..." : "Enregistrer"}
                  </button>
                </div>
              </div>
            ) : (
              localDesc && <PostDescription text={localDesc} />
            )}
          </div>

          {/* Media — full width, avec double-tap to like sur images */}
          {images.length > 0 && <PostImages images={images} onDoubleTap={handleDoubleTapLike} showHeart={showDoubleTapHeart} />}
          {videos.length > 0 && <PostVideo video={videos[0]} />}
          {audios.length > 0 && <PostAudio audio={audios[0]} />}

          {/* Link preview */}
          {displayPost.link_preview_json && contentItems.length === 0 && (
            <LinkPreview json={displayPost.link_preview_json} />
          )}
        </div>

        {/* Engagement counts — LinkedIn style */}
        {(likeCount > 0 || (displayPost.comments_count ?? 0) > 0 || repostCount > 0) && (
          <div className="flex items-center justify-between px-4 py-1.5 text-xs text-text-light">
            <div className="flex items-center gap-1.5">
              {likeCount > 0 && (
                <button
                  onClick={() => setShowWhoLiked(true)}
                  className="flex items-center gap-1.5 hover:underline cursor-pointer transition-colors"
                >
                  <span className="w-[18px] h-[18px] rounded-full bg-gradient-to-br from-magenta to-magenta/70 flex items-center justify-center">
                    <Heart size={10} className="text-white" fill="currentColor" />
                  </span>
                  <span>{formatCount(likeCount)}</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {(displayPost.comments_count ?? 0) > 0 && (
                <button
                  onClick={() => onComment?.(displayPost.id)}
                  className="hover:underline hover:text-primary transition-colors cursor-pointer"
                >
                  {formatCount(displayPost.comments_count)} commentaire{displayPost.comments_count > 1 ? "s" : ""}
                </button>
              )}
              {repostCount > 0 && (
                <button
                  onClick={() => setShowWhoReposted(true)}
                  className="hover:underline hover:text-primary transition-colors cursor-pointer"
                >
                  {formatCount(repostCount)} partage{repostCount > 1 ? "s" : ""}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Bar — LinkedIn style */}
        <div className="flex items-center border-t border-border/30 mx-1">
          <ActionButton
            icon={<Heart key={likeAnimKey} size={18} fill={isLiked ? "currentColor" : "none"} className={isLiked ? "animate-heart-bounce" : ""} />}
            onClick={handleLike}
            label="J'aime"
            activeColor="text-magenta"
            isActive={isLiked}
            disabled={isActionLoading}
          />
          <ActionButton
            icon={<MessageCircle size={18} />}
            onClick={() => onComment?.(displayPost.id)}
            label="Commenter"
          />
          <ActionButton
            icon={<Repeat2 size={18} />}
            onClick={() => {
              if (displayPost.user_id === user?.id) return;
              setShowRepostModal(true);
            }}
            label="Repartager"
            activeColor="text-green"
            disabled={isActionLoading || displayPost.user_id === user?.id}
          />
          <ActionButton
            icon={<Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />}
            onClick={handleSave}
            label="Enregistrer"
            activeColor="text-primary"
            isActive={isSaved}
            disabled={isActionLoading}
          />
          <ActionButton
            icon={<Share2 size={18} />}
            onClick={handleShare}
            label="Envoyer"
          />
        </div>
      </article>

      {/* ── Modals ── */}
      {showRepostModal && (
        <RepostModal
          onClose={() => setShowRepostModal(false)}
          onRepostInstant={() => handleRepostSubmit()}
          onRepostWithMessage={(msg) => handleRepostSubmit(msg)}
        />
      )}
      {showReportModal && (
        <ReportModal
          postId={displayPost.id}
          onClose={() => setShowReportModal(false)}
        />
      )}
      {showWhoLiked && (
        <WhoLikedModal
          postId={displayPost.id}
          onClose={() => setShowWhoLiked(false)}
        />
      )}
      {showWhoReposted && (
        <WhoRepostedModal
          postId={displayPost.id}
          onClose={() => setShowWhoReposted(false)}
        />
      )}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Supprimer la publication"
          message="Êtes-vous sûre de vouloir supprimer cette publication ? Cette action est irréversible."
          confirmLabel="Supprimer"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setShowDeleteConfirm(false)}
          danger
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

function PostDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 220;
  const display = isLong && !expanded ? text.slice(0, 240) + "..." : text;
  const parts = display.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g);

  return (
    <div className="mb-2">
      <p className="text-[13px] text-text-main leading-relaxed whitespace-pre-wrap break-words">
        {parts.map((part, i) => {
          if (part.startsWith("#")) {
            return (
              <Link key={i} href={`/tag?tag=${encodeURIComponent(part.slice(1))}`} className="text-magenta font-medium hover:underline">
                {part}
              </Link>
            );
          }
          if (part.startsWith("@")) {
            return (
              <MentionProfileLink key={i} username={part.slice(1)} className="text-magenta">
                {part}
              </MentionProfileLink>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-text-light font-medium hover:text-primary transition-colors mt-0.5 cursor-pointer"
        >
          {expanded ? "Voir moins" : "Voir plus"}
        </button>
      )}
    </div>
  );
}

function PostImages({ images, onDoubleTap, showHeart }: { images: PostContent[]; onDoubleTap: () => void; showHeart: boolean }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const lastTapRef = useRef(0);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onDoubleTap();
    } else {
      setLightboxOpen(true);
    }
    lastTapRef.current = now;
  };

  const allUrls = images.map((img) => addBaseURL(img.content) ?? "");

  return (
    <>
      {images.length === 1 ? (
        <div className="mt-1 overflow-hidden relative cursor-zoom-in" onClick={handleTap}>
          <img
            src={allUrls[0]}
            alt="Post"
            className="w-full object-cover max-h-[460px]"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          {showHeart && <DoubleTapHeartAnimation />}
        </div>
      ) : (
        <div className="mt-1 relative group">
          <div className="relative overflow-hidden cursor-zoom-in" onClick={handleTap}>
            <div
              className="flex transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {images.map((img, index) => (
                <div key={img.id} className="w-full shrink-0">
                  <img
                    src={addBaseURL(img.content)}
                    alt={`Photo ${index + 1}`}
                    className="w-full max-h-[460px] object-cover"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              ))}
            </div>
            {showHeart && <DoubleTapHeartAnimation />}
          </div>
          {currentIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => i - 1); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-black/70"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {currentIndex < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => i + 1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-black/70"
            >
              <ChevronRight size={18} />
            </button>
          )}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(index); }}
                className={cn(
                  "h-[6px] rounded-full transition-all duration-200 cursor-pointer",
                  index === currentIndex ? "w-5 bg-white" : "w-[6px] bg-white/50 hover:bg-white/70"
                )}
              />
            ))}
          </div>
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {currentIndex + 1}/{images.length}
          </div>
        </div>
      )}

      {lightboxOpen && (
        <PostImageLightbox
          images={allUrls}
          initialIndex={currentIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

function PostImageLightbox({ images, initialIndex, onClose }: { images: string[]; initialIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) setIndex((i) => i - 1);
      if (e.key === "ArrowRight" && index < images.length - 1) setIndex((i) => i + 1);
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [index, images.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer z-10"
      >
        <X size={24} />
      </button>

      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm font-medium px-4 py-1.5 rounded-full z-10">
          {index + 1} / {images.length}
        </div>
      )}

      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => i - 1); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer z-10"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      {index < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => i + 1); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer z-10"
        >
          <ChevronRight size={24} />
        </button>
      )}

      <img
        src={images[index]}
        alt={`Photo ${index + 1}`}
        className="max-w-[90vw] max-h-[85vh] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setIndex(i); }}
              className={cn(
                "w-12 h-12 rounded-md overflow-hidden border-2 transition-all cursor-pointer",
                i === index ? "border-white scale-110" : "border-white/30 opacity-60 hover:opacity-100"
              )}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DoubleTapHeartAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <Heart
        size={80}
        className="text-white drop-shadow-xl animate-ping"
        fill="currentColor"
        style={{ animationDuration: "0.6s", animationIterationCount: "1" }}
      />
    </div>
  );
}

function PostVideo({ video }: { video: PostContent }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (!videoRef.current) { setIsPlaying(true); return; }
    if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
    else { videoRef.current.pause(); setIsPlaying(false); }
  };

  return (
    <div className="mt-1 overflow-hidden relative bg-black/95">
      {!isPlaying && video.thumbnail ? (
        <div className="relative cursor-pointer" onClick={togglePlay}>
          <img
            src={addBaseURL(video.thumbnail)}
            alt="Miniature vidéo"
            className="w-full object-cover max-h-[400px]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <div className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-105">
              <Play size={28} className="text-primary ml-1" fill="currentColor" />
            </div>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={addBaseURL(video.content)}
          controls
          autoPlay={isPlaying}
          className="w-full max-h-[460px]"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}
    </div>
  );
}

function PostAudio({ audio }: { audio: PostContent }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      setCurrentTime(el.currentTime);
      setProgress(el.duration > 0 ? (el.currentTime / el.duration) * 100 : 0);
    };
    const onLoaded = () => setDuration(el.duration);
    const onEnded = () => { setIsPlaying(false); setProgress(0); setCurrentTime(0); };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) { audioRef.current.play(); setIsPlaying(true); }
    else { audioRef.current.pause(); setIsPlaying(false); }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="mx-4 mt-2 mb-1 rounded-xl bg-gradient-to-br from-primary/5 to-cyan/5 border border-primary/10 p-4">
      <audio ref={audioRef} src={addBaseURL(audio.content)} preload="metadata" />
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary-hover transition-colors cursor-pointer shrink-0"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Volume2 size={14} className="text-primary shrink-0" />
              <span className="text-sm font-medium text-text-main truncate">Message audio</span>
            </div>
            {duration > 0 && (
              <span className="text-[11px] text-text-light tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            )}
          </div>
          <div
            className="h-1.5 bg-primary/10 rounded-full overflow-hidden cursor-pointer"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkPreview({ json }: { json: string }) {
  let data: { url?: string; image?: string; title?: string; description?: string } | null = null;
  try {
    data = JSON.parse(json) as { url?: string; image?: string; title?: string; description?: string };
  } catch {
    return null;
  }

  if (!data?.url) return null;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mx-4 mt-2 mb-1 rounded-xl border border-border/50 overflow-hidden hover:bg-bg-light/50 transition-colors"
    >
      {data.image && (
        <img
          src={data.image}
          alt=""
          className="w-full h-40 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="p-3">
        {data.title && <p className="text-sm font-semibold text-text-main line-clamp-2">{data.title}</p>}
        {data.description && <p className="text-xs text-text-light mt-0.5 line-clamp-2">{data.description}</p>}
        <p className="text-[11px] text-text-light/60 mt-1 truncate">{new URL(data.url).hostname}</p>
      </div>
    </a>
  );
}

/* ─── Action Button ─── */

interface ActionButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  label: string;
  activeColor?: string;
  isActive?: boolean;
  disabled?: boolean;
}

function ActionButton({ icon, onClick, label, activeColor = "text-primary", isActive, disabled }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold transition-all duration-200 rounded-lg group/action",
        disabled
          ? "cursor-not-allowed opacity-40 text-text-light/50"
          : "cursor-pointer hover:bg-bg-light/60 active:scale-[0.96]",
        !disabled && (isActive ? activeColor : "text-text-dark/70 hover:text-text-main")
      )}
    >
      <span className={cn("transition-all duration-200 group-hover/action:scale-110", isActive && activeColor)}>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ─── Post Menu — identique au mobile PostMenuButton ─── */

function PostMenu({
  isOwner,
  isSaved,
  onClose,
  onEdit,
  onDelete,
  onReport,
  onShare,
  onSave,
}: {
  isOwner: boolean;
  isSaved: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
  onShare: () => void;
  onSave: () => void;
}) {
  const items: { key: string; label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] = [];

  if (isOwner) {
    items.push({ key: "edit", label: "Modifier", icon: <Pencil size={16} />, onClick: onEdit });
    items.push({ key: "delete", label: "Supprimer", icon: <Trash2 size={16} />, onClick: onDelete, danger: true });
  } else {
    items.push({ key: "report", label: "Signaler", icon: <Flag size={16} />, onClick: onReport });
  }
  items.push({ key: "save", label: isSaved ? "Retirer des favoris" : "Enregistrer", icon: isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />, onClick: onSave });
  items.push({ key: "share", label: "Partager", icon: <Share2 size={16} />, onClick: onShare });

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-8 z-50 w-52 bg-card rounded-xl shadow-xl border border-border/50 py-1.5 animate-scaleIn origin-top-right">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={item.onClick}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer",
              item.danger
                ? "text-red hover:bg-red/10 font-medium"
                : "text-text-main hover:bg-bg-light/80"
            )}
          >
            <span className={item.danger ? "text-red" : "text-text-light"}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

/* ─── Repost Modal — identique au mobile RepostSheet ─── */

function RepostModal({
  onClose,
  onRepostInstant,
  onRepostWithMessage,
}: {
  onClose: () => void;
  onRepostInstant: () => void;
  onRepostWithMessage: (msg: string) => void;
}) {
  const [showTextField, setShowTextField] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slideUp overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-text-main">Repartager</h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-bg-light text-text-light cursor-pointer">
              <X size={20} />
            </button>
          </div>

          {!showTextField ? (
            <div className="space-y-2.5">
              <button
                onClick={onRepostInstant}
                className="w-full flex items-center gap-3.5 p-4 rounded-xl border border-border/50 hover:bg-bg-light/80 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Repeat2 size={20} className="text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-text-main">Repartager instantanément</p>
                  <p className="text-xs text-text-light">Partager sans ajouter de commentaire</p>
                </div>
              </button>
              <button
                onClick={() => setShowTextField(true)}
                className="w-full flex items-center gap-3.5 p-4 rounded-xl border border-border/50 hover:bg-bg-light/80 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-cyan/10 flex items-center justify-center">
                  <Pencil size={18} className="text-cyan" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-text-main">Repartager avec vos pensées</p>
                  <p className="text-xs text-text-light">Ajouter un commentaire au partage</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ajoutez vos pensées..."
                className="w-full min-h-[100px] text-sm text-text-main leading-relaxed bg-bg-light/60 rounded-xl p-3.5 border border-border/50 outline-none focus:border-primary/40 resize-none placeholder:text-text-light/50"
                autoFocus
              />
              <button
                onClick={() => onRepostWithMessage(message)}
                disabled={!message.trim()}
                className="w-full py-3 text-sm font-semibold text-white bg-primary rounded-full hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50"
              >
                Repartager
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Report Modal — identique au mobile ReportSheet ─── */

function ReportModal({ postId, onClose }: { postId: number; onClose: () => void }) {
  const reportReasons = useSettingsStore((state) => state.reportReasons);
  const availableReportReasons = getReportReasonsWithFallback(reportReasons);
  const [reason, setReason] = useState("");
  const [desc, setDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!reason || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await PostService.reportPost(postId, reason, desc.trim());
      setIsSubmitted(true);
      setTimeout(onClose, 1500);
    } catch { /* silent */ }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slideUp overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flag size={18} className="text-red" />
              <h3 className="text-lg font-bold text-text-main">Signaler la publication</h3>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-bg-light text-text-light cursor-pointer">
              <X size={20} />
            </button>
          </div>

          {isSubmitted ? (
            <div className="py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-green/10 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={24} className="text-green" />
              </div>
              <p className="text-sm font-semibold text-text-main">Signalement envoyé</p>
              <p className="text-xs text-text-light mt-1">Merci, nous examinerons cette publication.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-dark mb-1.5 block">Raison du signalement</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-bg-light/60 border border-border/50 rounded-xl outline-none focus:border-primary/40 text-text-main cursor-pointer"
                >
                  <option value="">Sélectionner une raison...</option>
                  {availableReportReasons.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-dark mb-1.5 block">Détails (optionnel)</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Décrivez le problème..."
                  className="w-full min-h-[80px] text-sm text-text-main bg-bg-light/60 rounded-xl p-3.5 border border-border/50 outline-none focus:border-primary/40 resize-none placeholder:text-text-light/50"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!reason || isSubmitting}
                className="w-full py-3 text-sm font-semibold text-white bg-red rounded-full hover:bg-red/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Envoi..." : "Envoyer le signalement"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Who Liked Modal — identique au mobile LikesListScreen ─── */

function companyToActor(company: Company): ActorListItem {
  return {
    key: `company-${company.id}`,
    href: `/company/${company.id}`,
    name: company.name,
    subtitle: company.sector ?? "Entreprise ITGA",
    avatar: company.logo,
    isVerified: (company.is_verified ?? 0) >= 1,
    isCompany: true,
  };
}

function userToActor(user: User): ActorListItem {
  return {
    key: `user-${user.id}`,
    href: `/profile/${user.id}`,
    name: user.full_name,
    subtitle: `@${user.username}`,
    avatar: user.profile,
    isVerified: user.is_verified >= 2,
    isCompany: false,
  };
}

function ActorListRow({ actor, onClose }: { actor: ActorListItem; onClose: () => void }) {
  return (
    <Link
      href={actor.href}
      onClick={onClose}
      className="flex items-center gap-3 px-5 py-3 hover:bg-bg-light/50 transition-colors"
    >
      <Avatar src={actor.avatar} alt={actor.name} size={40} isVerified={actor.isVerified} />
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-text-main truncate">{actor.name}</span>
          {actor.isVerified && <VerifyBadge size={14} />}
          {actor.isCompany && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-cyan bg-cyan/10 border border-cyan/25">
              Entreprise
            </span>
          )}
        </div>
        <span className="text-xs text-text-light truncate block">{actor.subtitle}</span>
      </div>
    </Link>
  );
}

function WhoLikedModal({ postId, onClose }: { postId: number; onClose: () => void }) {
  const { user } = useAuthStore();
  const [actors, setActors] = useState<ActorListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setIsLoading(true);
      try {
        const res = await PostService.fetchUsersWhoLikedPost(user.id, postId);
        if (res.status && res.data) {
          const likes = res.data as Array<{ user?: User; company?: Company | null }>;
          setActors(likes
            .map((l) => l.company ? companyToActor(l.company) : l.user ? userToActor(l.user) : null)
            .filter(Boolean) as ActorListItem[]);
        }
      } catch { /* silent */ }
      setIsLoading(false);
    })();
  }, [user, postId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slideUp overflow-hidden max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light shrink-0">
          <div className="flex items-center gap-2">
            <Heart size={18} className="text-magenta" fill="currentColor" />
            <h3 className="text-lg font-bold text-text-main">J&apos;aime</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-bg-light text-text-light cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : actors.length === 0 ? (
            <div className="py-12 text-center">
              <Users size={28} className="mx-auto text-text-light/40 mb-2" />
              <p className="text-sm text-text-light">Aucun j&apos;aime pour le moment.</p>
            </div>
          ) : (
            <div className="divide-y divide-border-light/50">
              {actors.map((actor) => <ActorListRow key={actor.key} actor={actor} onClose={onClose} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Who Reposted Modal — identique au mobile RepostsListScreen ─── */

function WhoRepostedModal({ postId, onClose }: { postId: number; onClose: () => void }) {
  const [actors, setActors] = useState<ActorListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const res = await PostService.fetchReposts(postId, 0, 100);
        if (res.status && res.data) {
          const reposts = res.data as Array<{ user?: User; company?: Company | null }>;
          setActors(reposts
            .map((r) => r.company ? companyToActor(r.company) : r.user ? userToActor(r.user) : null)
            .filter(Boolean) as ActorListItem[]);
        }
      } catch { /* silent */ }
      setIsLoading(false);
    })();
  }, [postId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slideUp overflow-hidden max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light shrink-0">
          <div className="flex items-center gap-2">
            <Repeat2 size={18} className="text-green" />
            <h3 className="text-lg font-bold text-text-main">Partages</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-bg-light text-text-light cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : actors.length === 0 ? (
            <div className="py-12 text-center">
              <Users size={28} className="mx-auto text-text-light/40 mb-2" />
              <p className="text-sm text-text-light">Aucun partage pour le moment.</p>
            </div>
          ) : (
            <div className="divide-y divide-border-light/50">
              {actors.map((actor) => <ActorListRow key={actor.key} actor={actor} onClose={onClose} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Confirm Dialog — identique au mobile ConfirmationSheet ─── */

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = false,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm mx-auto bg-card rounded-2xl shadow-2xl animate-scaleIn p-6 text-center">
        <div className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4",
          danger ? "bg-red/10" : "bg-primary/10"
        )}>
          <AlertTriangle size={24} className={danger ? "text-red" : "text-primary"} />
        </div>
        <h3 className="text-base font-bold text-text-main mb-1">{title}</h3>
        <p className="text-sm text-text-light mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-semibold text-text-dark bg-bg-light rounded-full hover:bg-bg-light/80 transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "flex-1 py-2.5 text-sm font-semibold text-white rounded-full transition-colors cursor-pointer",
              danger ? "bg-red hover:bg-red/90" : "bg-primary hover:bg-primary-hover"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
