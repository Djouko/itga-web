"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  User,
  Bell,
  Shield,
  Globe,
  HelpCircle,
  FileText,
  Bookmark,
  Film,
  Users,
  Mail,
  LogOut,
  ChevronRight,
  Trash2,
  Rocket,
  BadgeCheck,
  Lock,
  Building2,
  LayoutDashboard,
  X,
} from "lucide-react";
import { useAuthStore, useSettingsStore, useThemeStore, useTranslation } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { UserService } from "@/lib/services/user-service";
import { clearApiAuthToken } from "@/lib/api-auth-token";
import {
  companyModeEventName,
  disableCompanyActingMode,
  enableCompanyActingMode,
  getActingCompanyId,
  getCompanyFromStorage,
} from "@/lib/company-acting";
import { addBaseURL } from "@/lib/utils";

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuthStore();
  const { settings } = useSettingsStore();
  const { mode: themeMode, setMode: setThemeMode } = useThemeStore();
  const { t } = useTranslation();
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isPushNotif, setIsPushNotif] = useState(user?.is_push_notifications === 1);
  const [isInvitedToRoom, setIsInvitedToRoom] = useState(user?.is_invited_to_room === 1);
  const [togglingPush, setTogglingPush] = useState(false);
  const [togglingInvite, setTogglingInvite] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [, setIdentityRefreshToken] = useState(0);
  const company = getCompanyFromStorage();
  const actingCompanyId = getActingCompanyId();
  const isCompanyModeActive = company?.id === actingCompanyId;

  useEffect(() => {
    const refreshIdentity = () => setIdentityRefreshToken((value) => value + 1);
    window.addEventListener("storage", refreshIdentity);
    window.addEventListener(companyModeEventName(), refreshIdentity);
    return () => {
      window.removeEventListener("storage", refreshIdentity);
      window.removeEventListener(companyModeEventName(), refreshIdentity);
    };
  }, []);

  const handleTogglePush = useCallback(async () => {
    if (!user || togglingPush) return;
    setTogglingPush(true);
    const newVal = isPushNotif ? 0 : 1;
    try {
      const res = await UserService.editProfile(user.id, { is_push_notifications: newVal });
      if (res.status) {
        setIsPushNotif(newVal === 1);
        updateUser({ is_push_notifications: newVal });
      } else {
        // Rollback visuel si l’API échoue
        setIsPushNotif(isPushNotif);
      }
    } catch { setIsPushNotif(isPushNotif); } finally {
      setTogglingPush(false);
    }
  }, [user, isPushNotif, togglingPush, updateUser]);

  const handleToggleInvite = useCallback(async () => {
    if (!user || togglingInvite) return;
    setTogglingInvite(true);
    const newVal = isInvitedToRoom ? 0 : 1;
    try {
      const res = await UserService.editProfile(user.id, { is_invited_to_room: newVal });
      if (res.status) {
        setIsInvitedToRoom(newVal === 1);
        updateUser({ is_invited_to_room: newVal });
      } else {
        setIsInvitedToRoom(isInvitedToRoom);
      }
    } catch { setIsInvitedToRoom(isInvitedToRoom); } finally {
      setTogglingInvite(false);
    }
  }, [user, isInvitedToRoom, togglingInvite, updateUser]);

  const handleLogout = useCallback(async () => {
    if (!user || loggingOut) return;
    setLoggingOut(true);
    try {
      await UserService.logOut(user.id);
    } catch { /* ignore */ }
    try {
      await signOut(auth);
    } catch { /* ignore */ }
    clearApiAuthToken();
    logout();
    setShowLogoutModal(false);
  }, [user, loggingOut, logout]);

  const handleDeleteAccount = useCallback(async () => {
    if (!user || deleting) return;
    setDeleting(true);
    try {
      await UserService.deleteUser(user.id);
    } catch { /* ignore */ }
    try {
      await signOut(auth);
    } catch { /* ignore */ }
    clearApiAuthToken();
    logout();
    setShowDeleteModal(false);
  }, [user, deleting, logout]);

  const openURL = (url: string | null | undefined) => {
    if (url) window.open(url.startsWith("http") ? url : `https://${url}`, "_blank", "noopener,noreferrer");
  };

  // Profile verification: pending = is_verified === 1 (demande soumise, en attente admin)
  // already_verified = is_verified >= 2 (vérifié ou abonné vérifié)
  const showVerification = user && user.is_verified !== 2 && user.is_verified !== 3;
  const verificationPending = user?.is_verified === 1;

  return (
    <div className="min-h-screen bg-card">
        <header className="sticky top-0 z-20 glass-header border-b border-border/20">
        <div className="px-4 py-3">
          <h1 className="text-base font-bold text-text-main">{t("settings.title")}</h1>
        </div>
      </header>

      <div className="pb-8">
        {company && (
          <ActiveIdentityCard
            companyName={company.name}
            companyLogo={company.logo}
            isActive={isCompanyModeActive}
            canAct={(company.owner_user_id ?? 0) > 0}
            onEnable={() => {
              enableCompanyActingMode(company.id);
              setIdentityRefreshToken((value) => value + 1);
            }}
            onDisable={() => {
              disableCompanyActingMode();
              setIdentityRefreshToken((value) => value + 1);
            }}
          />
        )}

        {/* COMPTE */}
        <SettingsSection title={t("settings.account")}>
          <SettingsLink href="/settings/edit-profile" icon={User} iconBg="bg-navy" label={t("settings.editProfile")} />
          <SettingsLink href="/settings/my-rooms" icon={Users} iconBg="bg-[#C62168]" label={t("settings.myRooms")} />
          <SettingsLink href="/settings/invitations" icon={Mail} iconBg="bg-[#E87722]" label={t("settings.invitations")} />
          <SettingsLink href="/notifications" icon={Bell} iconBg="bg-[#E53E3E]" label={t("settings.notifications")} />
          {showVerification && (
            <SettingsButton
              icon={BadgeCheck}
              iconBg="bg-teal"
              label="Vérification du profil"
              onClick={() => {
                if (verificationPending) {
                  alert("Votre demande de vérification est en cours d'examen. Veuillez patienter.");
                } else {
                  router.push("/settings/verification");
                }
              }}
            />
          )}
          <SettingsLink href="/settings/blocked" icon={Shield} iconBg="bg-[#4A5568]" label={t("settings.blocked")} />
        </SettingsSection>

        {/* ÉLÉMENTS SAUVEGARDÉS */}
        <SettingsSection title={t("settings.saved")}>
          <SettingsLink href="/settings/saved-reels" icon={Film} iconBg="bg-[#C62168]" label={t("settings.savedReels")} />
          <SettingsLink href="/settings/saved-posts" icon={Bookmark} iconBg="bg-[#F5C040]" label={t("settings.savedPosts")} />
        </SettingsSection>

        {/* PRÉFÉRENCES */}
        <SettingsSection title={t("settings.preferences")}>
          <SettingsLink href="/settings/language" icon={Globe} iconBg="bg-[#5DCCC6]" label={t("settings.language")} />
          <SettingsToggle
            label="Mode sombre"
            description="Activer le thème sombre"
            checked={themeMode === "dark"}
            disabled={false}
            onChange={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
          />
          <SettingsToggle
            label={t("settings.pushNotif")}
            description={t("settings.pushNotifDesc")}
            checked={isPushNotif}
            disabled={togglingPush}
            onChange={handleTogglePush}
          />
          <SettingsToggle
            label={t("settings.roomInvites")}
            description={t("settings.roomInvitesDesc")}
            checked={isInvitedToRoom}
            disabled={togglingInvite}
            onChange={handleToggleInvite}
          />
        </SettingsSection>

        {/* FEMMES DANS LA TECH */}
        <SettingsSection title={t("settings.womenInTech")}>
          <SettingsLink href="/settings/tech-resources" icon={Rocket} iconBg="bg-[#E87722]" label={t("settings.techResources")} />
        </SettingsSection>

        {/* AIDE ET SUPPORT */}
        <SettingsSection title={t("settings.help")}>
          <SettingsButton
            icon={Lock}
            iconBg="bg-navy"
            label={t("settings.privacy")}
            onClick={() => openURL(settings?.privacy_policy)}
          />
          <SettingsButton
            icon={FileText}
            iconBg="bg-[#C62168]"
            label={t("settings.terms")}
            onClick={() => openURL(settings?.terms_of_use)}
          />
          <SettingsLink href="/settings/faq" icon={HelpCircle} iconBg="bg-teal" label={t("settings.faq")} />
        </SettingsSection>

        {/* LOG OUT */}
        <div className="mt-2 border-t border-border/20">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red/5 transition-all duration-200 cursor-pointer text-left group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-red/10 flex items-center justify-center shrink-0 group-hover:bg-red/15 transition-colors duration-200">
              <LogOut size={16} className="text-red" />
            </div>
            <span className="text-sm font-semibold text-red">{t("settings.logout")}</span>
          </button>
        </div>

        {/* VERSION + LOGO */}
        <div className="flex flex-col items-center py-8 gap-2">
          <div className="w-[88px] h-[50px] rounded-xl border border-border/30 bg-bg-light/40 flex items-center justify-center px-2">
            <Image src="/itga_logo.png" alt="ITGA" width={72} height={40} className="w-[72px] h-auto object-contain" />
          </div>
          <p className="text-xs text-text-light">Version 1.0.0</p>
        </div>

        {/* DELETE ACCOUNT */}
        <div className="border-t border-border/20">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red/5 transition-all duration-200 cursor-pointer text-left group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-red/10 flex items-center justify-center shrink-0 group-hover:bg-red/15 transition-colors duration-200">
              <Trash2 size={16} className="text-red" />
            </div>
            <span className="text-sm font-semibold text-red">{t("settings.deleteAccount")}</span>
          </button>
        </div>
      </div>

      {/* LOGOUT CONFIRMATION MODAL */}
      <Modal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} title={t("settings.logout")} size="sm">
        <div className="px-6 pb-6">
          <p className="text-sm text-text-light mb-6">{t("settings.logoutConfirm")}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowLogoutModal(false)}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-border/40 hover:bg-bg-light transition-all duration-200 cursor-pointer active:scale-[0.98]"
            >
              {t("settings.cancel")}
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red text-white hover:bg-red/90 transition-all duration-200 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              {loggingOut ? t("common.loading") : t("settings.logoutBtn")}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL SUPPRESSION DE COMPTE */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title={t("settings.deleteAccount")} size="sm">
        <div className="px-6 pb-6">
          <p className="text-sm text-text-light mb-2">{t("settings.deleteConfirm")}</p>
          <p className="text-xs text-red-500 mb-6">{t("settings.deleteWarning")}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-border/40 hover:bg-bg-light transition-all duration-200 cursor-pointer active:scale-[0.98]"
            >
              {t("settings.cancel")}
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red text-white hover:bg-red/90 transition-all duration-200 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              {deleting ? t("common.loading") : t("settings.deleteBtn")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Sub-components ─── */

function ActiveIdentityCard({
  companyName,
  companyLogo,
  isActive,
  canAct,
  onEnable,
  onDisable,
}: {
  companyName: string;
  companyLogo: string | null;
  isActive: boolean;
  canAct: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const logo = addBaseURL(companyLogo);

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-teal/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/10">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <Building2 size={20} className="text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-light">Identité active</p>
          <h2 className="mt-0.5 truncate text-[15px] font-black text-text-main">{companyName}</h2>
          <p className="mt-1 text-xs leading-relaxed text-text-light">
            {isActive
              ? "Toutes vos actions sociales compatibles partent au nom de cette entreprise."
              : canAct
                ? "Activez cette identité pour publier, commenter, discuter et rejoindre des espaces comme entreprise."
                : "Associez d'abord cette entreprise à un compte ITGA pour agir sur les interfaces utilisateur."}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Link
          href="/company/dashboard"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/20 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/5"
        >
          <LayoutDashboard size={14} />
          Dashboard
        </Link>
        {isActive ? (
          <button
            type="button"
            onClick={onDisable}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-bg-light px-3 py-2 text-xs font-bold text-text-main transition-colors hover:bg-border/40"
          >
            <X size={14} />
            Désactiver
          </button>
        ) : (
          <button
            type="button"
            onClick={onEnable}
            disabled={!canAct}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Building2 size={14} />
            Agir comme entreprise
          </button>
        )}
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <h3 className="px-4 py-2 text-[11px] font-semibold text-text-light uppercase tracking-[1.5px]">
        {title}
      </h3>
      <div className="mx-4 bg-card rounded-[14px] border border-border/30 overflow-hidden divide-y divide-border/30">
        {children}
      </div>
    </div>
  );
}

function SettingsLink({
  href, icon: Icon, iconBg, label,
}: {
  href: string; icon: React.ElementType; iconBg: string; label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 hover:bg-bg-light/50 transition-all duration-200 group"
    >
      <div className={`w-[30px] h-[30px] rounded-[7px] ${iconBg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200`}>
        <Icon size={15} className="text-white" />
      </div>
      <span className="flex-1 text-[15px] text-text-main">{label}</span>
      <ChevronRight size={16} className="text-text-light group-hover:translate-x-0.5 transition-transform duration-200" />
    </Link>
  );
}

function SettingsButton({
  icon: Icon, iconBg, label, onClick,
}: {
  icon: React.ElementType; iconBg: string; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-light/50 transition-all duration-200 cursor-pointer text-left group active:scale-[0.99]"
    >
      <div className={`w-[30px] h-[30px] rounded-[7px] ${iconBg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200`}>
        <Icon size={15} className="text-white" />
      </div>
      <span className="text-sm font-medium text-text-main flex-1">{label}</span>
      <ChevronRight size={16} className="text-text-light group-hover:translate-x-0.5 transition-transform duration-200" />
    </button>
  );
}

function SettingsToggle({
  label, description, checked, disabled, onChange,
}: {
  label: string; description: string; checked: boolean; disabled: boolean; onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-main">{label}</p>
        <p className="text-xs text-text-light">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        className={`relative w-[51px] h-[31px] rounded-full transition-all duration-300 shrink-0 cursor-pointer disabled:opacity-50 shadow-inner ${
          checked ? "bg-gradient-to-r from-primary to-teal" : "bg-bg-light dark:bg-[#3A3F50]"
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-[27px] h-[27px] bg-white rounded-full shadow transition-transform duration-200 ${
            checked ? "translate-x-[20px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
