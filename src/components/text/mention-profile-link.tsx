"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useAuthStore } from "@/lib/store";
import { UserService } from "@/lib/services/user-service";
import { cn } from "@/lib/utils";

interface MentionProfileLinkProps {
  username: string;
  children: ReactNode;
  className?: string;
}

export function MentionProfileLink({ username, children, className }: MentionProfileLinkProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const cleanUsername = username.replace(/^@/, "").trim();
  const fallbackHref = `/search?q=${encodeURIComponent(cleanUsername)}`;

  const openMention = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const companyMatch = cleanUsername.match(/^company-(\d+)$/i);
    if (companyMatch?.[1]) {
      router.push(`/company/${companyMatch[1]}`);
      return;
    }

    if (!cleanUsername || !user) {
      router.push(fallbackHref);
      return;
    }

    try {
      const res = await UserService.searchProfile(user.id, cleanUsername, 0);
      const users = Array.isArray(res.data) ? res.data : [];
      const exact = users.find(
        (candidate) => candidate.username?.toLowerCase() === cleanUsername.toLowerCase()
      );
      const target = exact ?? users[0];
      if (target?.profile_type === "company" && target.owned_company?.id) {
        router.push(`/company/${target.owned_company.id}`);
        return;
      }
      router.push(target?.id ? `/profile/${target.id}` : fallbackHref);
    } catch {
      router.push(fallbackHref);
    }
  };

  return (
    <Link
      href={fallbackHref}
      onClick={openMention}
      className={cn("font-medium hover:underline", className)}
    >
      {children}
    </Link>
  );
}
