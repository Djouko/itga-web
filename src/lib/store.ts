import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Interest, Setting } from "./types";
import { getTranslation, type Language, type TranslationKey } from "./i18n";

export type { Language, TranslationKey };

/* ─── Onboarding Step ─── */
export type OnboardingStep = "complete" | "interests" | "username";

export function getOnboardingStep(user: User | null): OnboardingStep {
  if (!user) return "interests";
  const ids = user.interest_ids?.trim();
  if (!ids || ids === "null") return "interests";
  const uname = user.username?.trim();
  if (!uname || uname === "null") return "username";
  return "complete";
}

/* ─── Auth Store ─── */
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  setUser: (user: User) => void;
  updateUser: (partial: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setHydrated: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,
      setUser: (user) =>
        set({ user, isAuthenticated: true, isLoading: false }),
      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),
      setLoading: (isLoading) => set({ isLoading }),
      setHydrated: () => set({ isHydrated: true }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),
    }),
    {
      name: "itga-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

/* ─── Settings Store ─── */
interface SettingsState {
  settings: Setting | null;
  interests: Interest[];
  reportReasons: string[];
  restrictedUsernames: string[];
  isLoaded: boolean;
  setSettings: (settings: Setting) => void;
  setInterests: (interests: Interest[]) => void;
  setReportReasons: (reasons: string[]) => void;
  setRestrictedUsernames: (list: string[]) => void;
  setLoaded: () => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: null,
  interests: [],
  reportReasons: [],
  restrictedUsernames: [],
  isLoaded: false,
  setSettings: (settings) => set({ settings }),
  setInterests: (interests) => set({ interests }),
  setReportReasons: (reportReasons) => set({ reportReasons }),
  setRestrictedUsernames: (restrictedUsernames) => set({ restrictedUsernames }),
  setLoaded: () => set({ isLoaded: true }),
}));

/* ─── Feed Store ─── */
interface FeedState {
  activeTab: "forYou" | "following";
  setActiveTab: (tab: "forYou" | "following") => void;
}

export const useFeedStore = create<FeedState>()((set) => ({
  activeTab: "forYou",
  setActiveTab: (activeTab) => set({ activeTab }),
}));

/* ─── UI Store ─── */
interface UIState {
  isSidebarCollapsed: boolean;
  notifCount: number;
  toggleSidebar: () => void;
  setNotifCount: (count: number) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isSidebarCollapsed: false,
  notifCount: 0,
  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setNotifCount: (count) => set({ notifCount: count }),
}));

/* ─── Theme Store (light / dark / system) ─── */
export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "light" as ThemeMode,
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "itga-theme",
    }
  )
);

/* ─── Language Store ─── */
interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: "fr" as Language,
      setLanguage: (language) => set({ language }),
      t: (key: TranslationKey) => getTranslation(get().language, key),
    }),
    {
      name: "itga-language-v2",
    }
  )
);

/** Convenience hook — returns a `t` function for the current language */
export function useTranslation() {
  const { language, t } = useLanguageStore();
  return { t, language };
}

/* ─── Space Call Store (PiP / minimize mode — non-persisted) ─── */
interface SpaceCallRefs {
  agoraClient: unknown;
  agoraRTC: unknown;
  localAudioTrack: unknown;
  localVideoTrack: unknown;
  localScreenTrack: unknown;
}

interface SpaceCallState {
  activeSpaceId: string | null;
  isMinimized: boolean;
  spaceTitle: string;
  participantCount: number;
  isMicOn: boolean;
  userId: number;
  _refs: SpaceCallRefs;
  startCall: (spaceId: string, title: string, userId: number) => void;
  setRefs: (refs: Partial<SpaceCallRefs>) => void;
  minimize: () => void;
  restore: () => void;
  updateMeta: (data: Partial<Pick<SpaceCallState, "participantCount" | "isMicOn" | "spaceTitle">>) => void;
  clearCall: () => void;
}

const EMPTY_REFS: SpaceCallRefs = {
  agoraClient: null,
  agoraRTC: null,
  localAudioTrack: null,
  localVideoTrack: null,
  localScreenTrack: null,
};

export const useSpaceCallStore = create<SpaceCallState>()((set) => ({
  activeSpaceId: null,
  isMinimized: false,
  spaceTitle: "",
  participantCount: 0,
  isMicOn: false,
  userId: 0,
  _refs: { ...EMPTY_REFS },
  startCall: (spaceId, title, userId) =>
    set({ activeSpaceId: spaceId, isMinimized: false, spaceTitle: title, userId }),
  setRefs: (refs) =>
    set((state) => ({ _refs: { ...state._refs, ...refs } })),
  minimize: () => set({ isMinimized: true }),
  restore: () => set({ isMinimized: false }),
  updateMeta: (data) => set(data),
  clearCall: () =>
    set({
      activeSpaceId: null,
      isMinimized: false,
      spaceTitle: "",
      participantCount: 0,
      isMicOn: false,
      userId: 0,
      _refs: { ...EMPTY_REFS },
    }),
}));
