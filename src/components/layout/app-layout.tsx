"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, LayoutDashboard, X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { RightPanel } from "./right-panel";
import { MobileNav } from "./mobile-nav";
import { MiniSpaceWidget } from "./mini-space-widget";
import { IncomingCallOverlay } from "@/components/call/incoming-call-overlay";
import { companyModeEventName, disableCompanyActingMode, getActingCompanyId, getCompanyFromStorage } from "@/lib/company-acting";
import { addBaseURL } from "@/lib/utils";
import type { Company } from "@/lib/types";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [actingCompanyId, setActingCompanyId] = useState<number | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    const sync = () => {
      setActingCompanyId(getActingCompanyId());
      setCompany(getCompanyFromStorage());
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(companyModeEventName(), sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(companyModeEventName(), sync);
    };
  }, []);

  const isActingCompany = actingCompanyId !== null && company?.id === actingCompanyId;
  const companyLogo = addBaseURL(company?.logo);

  return (
    <div className="min-h-screen">
      {isActingCompany && (
        <div className="fixed right-3 top-3 z-50 lg:right-5">
          <div
            className="flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-2xl px-2 py-1.5 shadow-[0_18px_48px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
            style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(124,58,237,0.18)" }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl"
              style={{ background: "linear-gradient(135deg,rgba(0,196,212,0.15),rgba(124,58,237,0.12))", border: "1px solid rgba(0,196,212,0.2)" }}
            >
              {companyLogo ? (
                <img src={companyLogo} alt="" className="h-full w-full object-cover" />
              ) : (
                <Building2 size={15} className="text-[#7c3aed]" />
              )}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Identite active</p>
              <p className="max-w-[160px] truncate text-[12px] font-black text-slate-900">{company?.name}</p>
            </div>
            <Link
              href="/company/dashboard"
              onClick={() => {
                disableCompanyActingMode();
                setActingCompanyId(null);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-bold text-[#7c3aed] transition-colors hover:bg-violet-50"
            >
              <LayoutDashboard size={13} />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                disableCompanyActingMode();
                setActingCompanyId(null);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              title="Quitter le mode entreprise"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main Content — LinkedIn-style centered with gap */}
      <main className="lg:ml-[var(--sidebar-width)] min-h-screen pb-20 lg:pb-0">
        <div className="max-w-[980px] mx-auto flex gap-4 px-3 lg:px-4 pt-3">
          {/* Center Feed Column */}
          <div className="flex-1 min-w-0 max-w-[var(--feed-max-width)]">
            {children}
          </div>

          {/* Desktop Right Panel */}
          <div className="hidden xl:block w-[var(--right-panel-width)] shrink-0">
            <RightPanel />
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden">
        <MobileNav />
      </div>

      {/* Floating mini player for minimized space calls */}
      <MiniSpaceWidget />

      {/* Incoming video call overlay (FCM listener) */}
      <IncomingCallOverlay />
    </div>
  );
}
