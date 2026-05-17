"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Send,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Avatar, VerifyBadge } from "@/components/ui/avatar";
import { PostCard } from "@/components/post/post-card";
import { MentionProfileLink } from "@/components/text/mention-profile-link";
import { useAuthStore, useTranslation } from "@/lib/store";
import { PostService } from "@/lib/services/post-service";
import { cn, formatTimeAgo } from "@/lib/utils";
import type { Post, Comment } from "@/lib/types";
import { getActingCompanyId } from "@/lib/company-acting";

const COMMENTS_PAGE_SIZE = 20;

type CommentWithLegacyFields = Comment & {
  desc?: string | null;
  reply_count?: number;
  replies_count?: number;
};

function getCommentMessage(comment: CommentWithLegacyFields): string {
  return String(comment.comment ?? comment.desc ?? "");
}

function getRepliesCount(comment: CommentWithLegacyFields): number {
  return Number(comment.replies_count ?? comment.reply_count ?? 0);
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const postId = Number(params.id);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingPost, setIsLoadingPost] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const fetchPost = useCallback(async () => {
    if (!user || !postId) return;
    setIsLoadingPost(true);
    const res = await PostService.fetchPostByPostId(user.id, postId, getActingCompanyId() ?? undefined);
    if (res.status && res.data) setPost(res.data);
    setIsLoadingPost(false);
  }, [user, postId]);

  const fetchComments = useCallback(
    async (start: number, reset = false) => {
      if (!user || !postId) return;
      setIsLoadingComments(true);
      const res = await PostService.fetchComments(
        user.id,
        postId,
        start,
        COMMENTS_PAGE_SIZE,
        getActingCompanyId() ?? undefined
      );
      if (res.status && res.data) {
        setComments((prev) => (reset ? res.data! : [...prev, ...res.data!]));
        setHasMoreComments(res.data.length >= COMMENTS_PAGE_SIZE);
      }
      setIsLoadingComments(false);
    },
    [user, postId]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchPost();
      fetchComments(0, true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchPost, fetchComments]);

  // ── Add or Edit comment ──
  const handleSendComment = useCallback(async () => {
    if (!user || !commentText.trim() || isSending) return;
    setIsSending(true);

    if (editingComment) {
      const res = await PostService.editComment(
        editingComment.id,
        user.id,
        commentText.trim(),
        getActingCompanyId() ?? undefined
      );
      if (res.status) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === editingComment.id
              ? { ...c, comment: commentText.trim(), is_edited: 1 }
              : c
          )
        );
        setEditingComment(null);
        setCommentText("");
      }
    } else {
      const res = await PostService.addComment(
        user.id,
        postId,
        commentText.trim(),
        replyTo?.id,
        undefined,
        getActingCompanyId() ?? undefined
      );
      if (res.status && res.data) {
        setComments((prev) => [...prev, res.data!]);
        setCommentText("");
        setReplyTo(null);
        setPost((prev) =>
          prev ? { ...prev, comments_count: (prev.comments_count ?? 0) + 1 } : prev
        );
        setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }
    setIsSending(false);
  }, [user, postId, commentText, isSending, replyTo, editingComment]);

  const handleLikeComment = useCallback(
    async (commentId: number) => {
      if (!user) return;
      const actingCompanyId = getActingCompanyId() ?? undefined;
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                is_like: c.is_like === 1 ? 0 : 1,
                comment_like_count:
                  c.is_like === 1 ? c.comment_like_count - 1 : c.comment_like_count + 1,
              }
            : c
        )
      );
      await PostService.likeDislikeComment(user.id, commentId, actingCompanyId);
    },
    [user]
  );

  const handleDeleteComment = useCallback(
    async (commentId: number) => {
      if (!user) return;
      await PostService.deleteComment(commentId, user.id, getActingCompanyId() ?? undefined);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setPost((prev) =>
        prev ? { ...prev, comments_count: Math.max(0, (prev.comments_count ?? 0) - 1) } : prev
      );
    },
    [user]
  );

  const handleStartEdit = useCallback((comment: Comment) => {
    setEditingComment(comment);
    setCommentText(getCommentMessage(comment));
    setReplyTo(null);
    inputRef.current?.focus();
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingComment(null);
    setCommentText("");
  }, []);

  const handleDeletePost = useCallback(() => {
    router.replace("/feed");
  }, [router]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingComments && hasMoreComments) {
      fetchComments(comments.length);
    }
  }, [isLoadingComments, hasMoreComments, comments.length, fetchComments]);

  if (isLoadingPost) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-text-light text-sm">{t("post.notFound")}</p>
        <button
          onClick={() => router.back()}
          className="text-primary text-sm font-semibold hover:underline cursor-pointer"
        >
          {t("post.back")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 glass-header border-b border-border/20">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-full hover:bg-bg-light transition-all duration-200 cursor-pointer active:scale-95"
          >
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <h1 className="text-lg font-bold text-text-main">{t("post.pageTitle")}</h1>
        </div>
      </header>

      {/* Post */}
      <div className="animate-fadeIn">
        <PostCard
          post={post}
          onComment={() => inputRef.current?.focus()}
          onDelete={handleDeletePost}
        />
      </div>

      {/* Comments Section */}
      <div className="border-t border-border/20">
        <div className="px-4 py-3 border-b border-border/20">
          <h2 className="text-sm font-bold text-text-main">
            {(post.comments_count ?? 0) > 0
              ? `${t("post.pageTitle")} (${post.comments_count})`
              : t("post.pageTitle")}
          </h2>
        </div>

        {/* Comments List */}
        <div className="divide-y divide-border/20">
          {comments.length === 0 && !isLoadingComments && (
            <div className="py-12 text-center">
              <MessageCircle size={32} className="mx-auto text-text-light/40 mb-2" />
              <p className="text-sm text-text-light">
                {t("comment.noComments")}
              </p>
            </div>
          )}

          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              onLike={handleLikeComment}
              onReply={(c) => {
                setEditingComment(null);
                setReplyTo(c);
                setCommentText("");
                inputRef.current?.focus();
              }}
              onEdit={handleStartEdit}
              onDelete={handleDeleteComment}
              fetchReplies={async (commentId: number, start: number) => {
                if (!user) return [];
                const res = await PostService.fetchReplies(
                  user.id,
                  commentId,
                  start,
                  COMMENTS_PAGE_SIZE,
                  getActingCompanyId() ?? undefined
                );
                return res.status && res.data ? res.data : [];
              }}
            />
          ))}

          {hasMoreComments && comments.length > 0 && (
            <button
              onClick={handleLoadMore}
              disabled={isLoadingComments}
              className="w-full py-3 text-sm text-primary font-semibold hover:bg-bg-light/60 transition-all duration-200 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
            >
              {isLoadingComments ? t("comment.loadingMore") : t("comment.loadMore")}
            </button>
          )}

          {isLoadingComments && comments.length === 0 && (
            <div className="flex justify-center py-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
              </div>
            </div>
          )}

          <div ref={commentsEndRef} />
        </div>
      </div>

      {/* Editing / Replying indicator */}
      {(editingComment || replyTo) && (
        <div className={cn(
          "px-4 py-2 flex items-center justify-between border-t",
          editingComment ? "bg-amber-50 border-l-4 border-l-amber-400" : "bg-primary/5 border-l-4 border-l-primary"
        )}>
          <div className="flex items-center gap-2 min-w-0">
            {editingComment ? (
              <>
                <Pencil size={14} className="text-amber-600 shrink-0" />
                <span className="text-xs font-semibold text-amber-700 truncate">
                  {t("comment.editingLabel")}
                </span>
              </>
            ) : (
              <>
                <MessageCircle size={14} className="text-primary shrink-0" />
                <span className="text-xs font-semibold text-primary truncate">
                  {t("comment.replyingTo")} @{replyTo?.user?.username}
                </span>
              </>
            )}
          </div>
          <button
            onClick={() => { handleCancelEdit(); setReplyTo(null); }}
            className="p-1 rounded-full hover:bg-black/5 text-text-light cursor-pointer shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Comment Input */}
      <div className="sticky bottom-0 z-10 glass-header border-t border-border/20 px-4 py-3 mt-auto">
        <div className="flex items-center gap-2">
          <Avatar
            src={user?.profile}
            alt={user?.full_name ?? ""}
            size={34}
          />
          <div className="flex-1 flex items-center bg-bg-light rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-primary/15 transition-all duration-200">
            <input
              ref={inputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendComment();
                }
              }}
              placeholder={
                editingComment
                  ? t("comment.editPlaceholder")
                  : replyTo
                    ? `${t("comment.replyPlaceholder")} @${replyTo.user?.username}...`
                    : t("comment.writePlaceholder")
              }
              className="flex-1 bg-transparent text-sm text-text-main placeholder:text-text-light/60 outline-none min-w-0"
            />
            <button
              onClick={handleSendComment}
              disabled={!commentText.trim() || isSending}
              className={cn(
                "ml-2 p-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-90",
                commentText.trim()
                  ? "text-primary hover:bg-primary/10"
                  : "text-text-light/40"
              )}
            >
              {isSending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMMENT ITEM — with edit/delete/reply/like + nested replies
   ═══════════════════════════════════════════════════════════════════ */

interface CommentItemProps {
  comment: Comment;
  currentUserId?: number;
  onLike: (commentId: number) => void;
  onReply: (comment: Comment) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (commentId: number) => void;
  fetchReplies: (commentId: number, start: number) => Promise<Comment[]>;
  isReply?: boolean;
}

function CommentItem({
  comment,
  currentUserId,
  onLike,
  onReply,
  onEdit,
  onDelete,
  fetchReplies,
  isReply = false,
}: CommentItemProps) {
  const isLiked = comment.is_like === 1;
  const actingCompanyId = getActingCompanyId();
  const isOwner = actingCompanyId
    ? comment.company_id === actingCompanyId
    : comment.user_id === currentUserId && !comment.company_id;
  const actorHref = comment.company?.id ? `/company/${comment.company.id}` : `/profile/${comment.user_id}`;
  const actorName = comment.company?.name ?? comment.user?.full_name ?? "User";
  const actorAvatar = comment.company?.logo ?? comment.user?.profile;
  const [showMenu, setShowMenu] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [showReplies, setShowReplies] = useState(false);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);

  const handleToggleReplies = async () => {
    if (showReplies) {
      setShowReplies(false);
      return;
    }
    if (replies.length === 0) {
      setIsLoadingReplies(true);
      const data = await fetchReplies(comment.id, 0);
      setReplies(data);
      setIsLoadingReplies(false);
    }
    setShowReplies(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCommentMessage(comment));
    setShowMenu(false);
  };

  return (
    <div className={cn(!isReply && "py-1 hover:bg-bg-light/30 transition-colors duration-200", isReply && "hover:bg-bg-light/20 transition-colors duration-200")}>
      <div className={cn("flex gap-3 px-4 py-2", isReply && "pl-14")}>
        <Link href={actorHref} className="shrink-0">
          <Avatar
            src={actorAvatar}
            alt={actorName}
            size={isReply ? 28 : 34}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Link
              href={actorHref}
              className={cn(
                "font-bold text-text-main hover:underline hover:text-primary transition-colors duration-200 truncate",
                isReply ? "text-[13px]" : "text-sm"
              )}
            >
              {actorName}
            </Link>
            {comment.company_id && comment.company?.id && (
              <Link
                href={`/company/${comment.company.id}`}
                className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ color: "#00c4d4", background: "rgba(0,196,212,0.12)", border: "1px solid rgba(0,196,212,0.25)" }}
              >
                Entreprise
              </Link>
            )}
            {comment.user?.is_verified != null && comment.user.is_verified >= 2 && <VerifyBadge size={13} />}
            <span className="text-text-light text-xs shrink-0">
              {formatTimeAgo(comment.created_at)}
            </span>
            {comment.is_edited === 1 && (
              <span className="text-text-light/50 text-[11px] shrink-0">· modifié</span>
            )}

            {/* Like button — aligned right */}
            <div className="ml-auto flex flex-col items-center shrink-0">
              <button
                onClick={() => onLike(comment.id)}
                className={cn(
                  "p-1 transition-all duration-200 cursor-pointer active:scale-110",
                  isLiked ? "text-magenta" : "text-text-light hover:text-magenta"
                )}
              >
                <Heart size={14} fill={isLiked ? "currentColor" : "none"} className={isLiked ? "animate-heart-bounce" : ""} />
              </button>
              {comment.comment_like_count > 0 && (
                <span className="text-[10px] text-text-light -mt-0.5">{comment.comment_like_count}</span>
              )}
            </div>

            {/* Menu — only for own comments */}
            {isOwner && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 rounded-full hover:bg-bg-light text-text-light cursor-pointer transition-colors duration-200 opacity-0 group-hover:opacity-100"
                >
                  <MoreHorizontal size={14} />
                </button>
                {showMenu && (
                  <CommentMenu
                    onEdit={() => { setShowMenu(false); onEdit(comment); }}
                    onCopy={handleCopy}
                    onDelete={() => { setShowMenu(false); onDelete(comment.id); }}
                    onClose={() => setShowMenu(false)}
                  />
                )}
              </div>
            )}
          </div>

          <p className={cn(
            "text-text-main leading-relaxed whitespace-pre-wrap break-words",
            isReply ? "text-[13px]" : "text-sm"
          )}>
            <CommentText text={getCommentMessage(comment)} />
          </p>

          <div className="flex items-center gap-4 mt-1.5">
            {!isReply && (
              <button
                onClick={() => onReply(comment)}
                className="text-xs text-text-light hover:text-text-dark transition-colors cursor-pointer font-semibold"
              >
                Répondre
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies toggle — identique au mobile "── Voir les réponses (N)" */}
      {!isReply && getRepliesCount(comment) > 0 && (
        <div className="pl-14 px-4">
          <button
            onClick={handleToggleReplies}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover transition-colors cursor-pointer py-1"
          >
            <span className="w-6 h-[1px] bg-text-light/30" />
            {isLoadingReplies ? (
              <Loader2 size={12} className="animate-spin" />
            ) : showReplies ? (
              <>Masquer les réponses <ChevronUp size={12} /></>
            ) : (
              <>Voir les réponses ({getRepliesCount(comment)}) <ChevronDown size={12} /></>
            )}
          </button>
        </div>
      )}

      {/* Nested replies */}
      {showReplies && replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          currentUserId={currentUserId}
          onLike={onLike}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          fetchReplies={fetchReplies}
          isReply
        />
      ))}
    </div>
  );
}

/* ─── Comment Text — styled hashtags & mentions ─── */

function CommentText({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g);
  return (
    <>
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
    </>
  );
}

/* ─── Comment Context Menu ─── */

function CommentMenu({
  onEdit,
  onCopy,
  onDelete,
  onClose,
}: {
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-6 z-50 w-40 bg-card rounded-xl shadow-xl border border-border py-1 animate-scaleIn origin-top-right">
        <button
          onClick={onEdit}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-text-main hover:bg-bg-light transition-colors cursor-pointer"
        >
          <Pencil size={14} className="text-text-light" />
          Modifier
        </button>
        <button
          onClick={onCopy}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-text-main hover:bg-bg-light transition-colors cursor-pointer"
        >
          <Copy size={14} className="text-text-light" />
          Copier
        </button>
        <button
          onClick={onDelete}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-red font-medium hover:bg-red/5 transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
          Supprimer
        </button>
      </div>
    </>
  );
}
