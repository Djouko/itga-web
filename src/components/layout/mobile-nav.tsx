"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, Users, MessageCircle, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { href: "/feed", label: "Fil", icon: Newspaper },
  { href: "/rooms", label: "Salons", icon: Users },
  { href: "/create", label: "Créer", icon: Plus, isFab: true },
  { href: "/chats", label: "Messages", icon: MessageCircle },
  { href: "/profile", label: "Profil", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom" style={{ background: 'rgba(13,17,23,0.92)', backdropFilter: 'blur(16px) saturate(180%)', WebkitBackdropFilter: 'blur(16px) saturate(180%)' }}>
      <div className="flex items-center justify-around pt-2 pb-1 border-t border-white/[0.06]">
        {mobileNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          // FAB button in center
          if ((item as { isFab?: boolean }).isFab) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center -mt-5"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-cyan flex items-center justify-center shadow-lg shadow-primary/25 active:scale-90 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30">
                  <Plus size={24} strokeWidth={2.5} className="text-white" />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 min-w-[56px] py-1"
            >
              {/* Active dot — matches Flutter TabBarButton */}
              <span
                className={cn(
                  "w-1 h-1 rounded-full transition-colors duration-200",
                  isActive ? "bg-primary" : "bg-transparent"
                )}
              />
              <Icon
                size={22}
                strokeWidth={isActive ? 2 : 1.5}
                className={cn(
                  "transition-all duration-200",
                  isActive ? "text-white scale-105" : "text-text-light/50"
                )}
              />
              <span
                className={cn(
                  "text-[10px] transition-colors duration-200",
                  isActive ? "text-white font-medium" : "text-text-light/50 font-normal"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
