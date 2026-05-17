"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { useState } from "react";

interface AvatarProps {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  isVerified?: boolean;
  onClick?: () => void;
}

export function Avatar({ src, alt, size = 40, className, isVerified, onClick }: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const initials = alt
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn("relative inline-flex shrink-0 overflow-visible rounded-full", className)}
      style={{ width: size, height: size }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {src && !hasError ? (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="block rounded-full object-cover"
          style={{ width: size, height: size, minWidth: size, minHeight: size }}
          onError={() => setHasError(true)}
          unoptimized
        />
      ) : (
        <div
          className="rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold"
          style={{ width: size, height: size, fontSize: size * 0.36 }}
        >
          {initials || "?"}
        </div>
      )}
      {isVerified && (
        <div
          className="absolute -bottom-0.5 -right-0.5 bg-card rounded-sm flex items-center justify-center"
          style={{ width: size * 0.36, height: size * 0.36, padding: 1 }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            {/* Losange bleu — identique au mobile VerifyIcon */}
            <path d="M12 2 L22 12 L12 22 L2 12 Z" fill="#1D9BF0" />
            <path
              d="M8.5 12 L10.8 14.5 L15.5 9.5"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

interface VerifyBadgeProps {
  size?: number;
}

export function VerifyBadge({ size = 16 }: VerifyBadgeProps) {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 ml-0.5"
      style={{ width: size, height: size }}
      title="Compte vérifié"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {/* Losange bleu — identique au mobile Flutter VerifyIcon */}
        <path
          d="M12 2 L22 12 L12 22 L2 12 Z"
          fill="#1D9BF0"
        />
        {/* Checkmark blanc */}
        <path
          d="M8.5 12 L10.8 14.5 L15.5 9.5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
