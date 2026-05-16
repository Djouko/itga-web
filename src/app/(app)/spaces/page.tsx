"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Mic, Video, Users, Radio, X, Loader2, Lock, Globe, Camera,
  Search, ChevronLeft, Check,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Tabs } from "@/components/ui/tabs";
import { useAuthStore, useSettingsStore } from "@/lib/store";
import {
  SpaceService, getSpaceHostsWithAdmin, getActiveUsers,
} from "@/lib/services/space-service";
import type { AudioSpace, AudioSpaceUser, Interest, User } from "@/lib/types";
import { addBaseURL } from "@/lib/utils";
import { UserService } from "@/lib/services/user-service";
import { buildActorIdentity, type ActorIdentity } from "@/lib/actor-identity";
import { companyModeEventName } from "@/lib/company-acting";
import { v4 as uuidv4 } from "uuid";

const spaceTabs = [
  { id: "all", label: "Tous" },
  { id: "audio", label: "Audio" },
  { id: "video", label: "Vidéo" },
];

export default function SpacesPage() {
  const router = useRouter();
  const { user: me } = useAuthStore();
  const { interests: allInterests } = useSettingsStore();
  const [activeTab, setActiveTab] = useState("all");
  const [spaces, setSpaces] = useState<AudioSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [, setActorRefreshToken] = useState(0);
  const actor = me ? buildActorIdentity(me) : null;

  useEffect(() => {
    const syncActor = () => setActorRefreshToken((value) => value + 1);
    window.addEventListener("storage", syncActor);
    window.addEventListener(companyModeEventName(), syncActor);
    return () => {
      window.removeEventListener("storage", syncActor);
      window.removeEventListener(companyModeEventName(), syncActor);
    };
  }, []);

  useEffect(() => {
    if (!me) return;
    let unsub: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      setLoading(true);
      unsub = SpaceService.subscribeToSpaces(me.id, (data) => {
        setSpaces(data);
        setLoading(false);
      }, actor?.companyId);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      unsub?.();
    };
  }, [me, actor?.companyId]);

  const filtered = spaces.filter((s) => {
    if (activeTab === "audio") return !s.is_video_conference;
    if (activeTab === "video") return s.is_video_conference;
    return true;
  });

  const openSpace = (space: AudioSpace) => {
    router.push(`/spaces/${space.id}`);
  };

  if (!me) return null;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header Card */}
      <div className="card">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h1 className="text-lg font-bold text-text-main">Espaces</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-cyan text-white rounded-xl text-sm font-semibold hover:shadow-md transition-all cursor-pointer"
          >
            <Plus size={16} />
            Créer
          </button>
        </div>
        <div className="px-4 pb-3">
          <Tabs tabs={spaceTabs} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {/* Spaces List */}
      <div className="space-y-3">
        {loading ? (
          <SpacesSkeleton />
        ) : filtered.length === 0 ? (
          <EmptySpaces />
        ) : (
          <div className="stagger-children space-y-3">
            {filtered.map((space) => (
              <SpaceCard
                key={space.id}
                space={space}
                allInterests={allInterests}
                onClick={() => openSpace(space)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Space Modal */}
      {showCreate && (
        <CreateSpaceModal
          me={me}
          actor={actor}
          allInterests={allInterests}
          onClose={() => setShowCreate(false)}
          onCreated={(space) => {
            setShowCreate(false);
            router.push(`/spaces/${space.id}`);
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SPACE CARD
   ═══════════════════════════════════════════════════ */
function SpaceCard({
  space, allInterests, onClick,
}: {
  space: AudioSpace;
  allInterests: Interest[];
  onClick: () => void;
}) {
  const hosts = getSpaceHostsWithAdmin(space);
  const active = getActiveUsers(space);
  const admin = hosts.find((u) => u.type === "ADMIN") ?? hosts[0];

  const topicIds = (space.topics ?? "").split(",").filter(Boolean).map(Number);
  const topics = allInterests.filter((i) => topicIds.includes(i.id));

  return (
    <div
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0d1117] via-navy to-[#0d1117] p-5 cursor-pointer hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 group border border-white/[0.06] hover:border-primary/20"
    >
      {/* Subtle gradient shine on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Badges */}
      <div className="flex items-center gap-2 mb-3 relative">
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-magenta to-magenta/70 rounded-full text-white text-[11px] font-bold shadow-lg shadow-magenta/20">
          <Radio size={10} className="animate-pulse" />
          LIVE
        </span>
        {space.is_video_conference && (
          <span className="flex items-center gap-1 px-2 py-1 bg-primary/80 rounded-full text-white text-[11px] font-bold">
            <Video size={10} />
            VIDÉO
          </span>
        )}
        {space.type === "PRIVATE" && (
          <span className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-full text-white/70 text-[11px] font-bold">
            <Lock size={10} />
            PRIVÉ
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-bold text-white mb-2 group-hover:text-cyan transition-colors">
        {space.title || "Espace sans titre"}
      </h3>

      {/* Description */}
      {space.description && (
        <p className="text-xs text-white/50 mb-2 line-clamp-2">{space.description}</p>
      )}

      {/* Topics */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {topics.map((t) => (
            <span key={t.id} className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[10px]">
              {t.title}
            </span>
          ))}
        </div>
      )}

      {/* Host info */}
      {admin && (
        <div className="flex items-center gap-2 mb-3">
          <Avatar
            src={(admin.display_avatar || admin.image) ? addBaseURL(admin.display_avatar || admin.image || "") : null}
            alt={admin.display_name || admin.fullName || ""}
            size={24}
          />
          <span className="text-sm text-white/80">{admin.display_name || admin.fullName || "Hôte"}</span>
          <span className="text-xs text-white/50">· Admin</span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-xs text-white/60">
          <Mic size={12} />
          {hosts.length} intervenant{hosts.length > 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-white/60">
          <Users size={12} />
          {active.length} participant{active.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Speaker Avatars */}
      {hosts.length > 0 && (
        <div className="flex -space-x-2 mt-3">
          {hosts.slice(0, 6).map((h) => (
            <div key={`${h.id}-${h.company_id ?? "user"}`} className="w-8 h-8 rounded-full border-2 border-bg-dark overflow-hidden">
              <Avatar
                src={(h.display_avatar || h.image) ? addBaseURL(h.display_avatar || h.image || "") : null}
                alt={h.display_name || h.fullName || ""}
                size={32}
              />
            </div>
          ))}
          {hosts.length > 6 && (
            <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-bg-dark flex items-center justify-center text-[10px] font-bold text-white/70">
              +{hosts.length - 6}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CREATE SPACE MODAL — 2-step flow matching mobile
   Step 1: Title, Description, Topics, Type, Video toggle
   Step 2: Select Hosts from followers
   ═══════════════════════════════════════════════════ */
function CreateSpaceModal({
  me, actor, allInterests, onClose, onCreated,
}: {
  me: { id: number; full_name: string; username: string; profile: string | null; is_verified: number; device_token?: string | null };
  actor: ActorIdentity | null;
  allInterests: Interest[];
  onClose: () => void;
  onCreated: (space: AudioSpace) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [spaceType, setSpaceType] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [isVideo, setIsVideo] = useState(false);
  const [creating, setCreating] = useState(false);

  // Step 2: Host selection
  const [followers, setFollowers] = useState<User[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedHosts, setSelectedHosts] = useState<AudioSpaceUser[]>([]);

  const toggleTopic = (id: number) => {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const canProceedToStep2 = title.trim() && description.trim() && selectedTopics.length > 0;

  const handleNext = async () => {
    if (!canProceedToStep2) return;
    setStep(2);
    setLoadingFollowers(true);
    try {
      const res = await UserService.fetchFollowersList(me.id, "", 0, 200);
      if (res.status && res.data) {
        setFollowers(res.data);
      }
    } catch { /* ignore */ }
    setLoadingFollowers(false);
  };

  const toggleHost = (user: User) => {
    setSelectedHosts((prev) => {
      const exists = prev.some((h) => h.id === user.id);
      if (exists) return prev.filter((h) => h.id !== user.id);
      const asSpaceUser: AudioSpaceUser = {
        id: user.id,
        userName: user.username,
        fullName: user.full_name,
        image: user.profile ?? "",
        deviceToken: user.device_token ?? undefined,
        deviceType: user.device_type ?? undefined,
        isVerified: user.is_verified >= 2,
        company_id: null,
        profile_type: "user",
        display_name: user.full_name,
        display_avatar: user.profile ?? "",
        type: "HOST",
        mic_status: "MUTED",
        is_camera_on: false,
      };
      return [...prev, asSpaceUser];
    });
  };

  const filteredFollowers = searchKeyword.trim()
    ? followers.filter(
        (f) =>
          f.full_name?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
          f.username?.toLowerCase().includes(searchKeyword.toLowerCase()),
      )
    : followers;

  const handleCreate = async () => {
    if (!canProceedToStep2) return;
    setCreating(true);

    try {
      const spaceId = uuidv4();
      const token = await SpaceService.generateAgoraToken(spaceId);
      if (!token) { setCreating(false); return; }
      const creatorActor = actor ?? buildActorIdentity(me);

      const adminUser: AudioSpaceUser = {
        id: me.id,
        userName: creatorActor.username,
        fullName: creatorActor.name,
        image: creatorActor.avatar ?? "",
        isVerified: me.is_verified >= 2,
        company_id: creatorActor.companyId,
        profile_type: creatorActor.profileType,
        display_name: creatorActor.name,
        display_avatar: creatorActor.avatar ?? "",
        type: "ADMIN",
        mic_status: "ON",
        is_camera_on: isVideo,
      };

      const allUsers: AudioSpaceUser[] = [adminUser, ...selectedHosts];

      const space: AudioSpace = {
        id: spaceId,
        title: title.trim(),
        description: description.trim(),
        topics: selectedTopics.join(","),
        token,
        type: spaceType,
        is_video_conference: isVideo,
        screen_sharing_uid: 0,
        created_at: new Date(),
        users: allUsers,
        leaved_users: [],
      };

      await SpaceService.createSpace(space);

      // Notify selected hosts via push notification
      for (const host of selectedHosts) {
        if (host.deviceToken) {
          SpaceService.sendPushNotification(
            host.deviceToken,
            host.deviceType,
            creatorActor.name,
            `${creatorActor.name} vous a ajouté comme hôte dans l'espace '${title.trim()}'`,
          );
        }
      }

      onCreated(space);
    } catch (e) {
      console.error("Create space error:", e);
    }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-light">
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="w-8 h-8 rounded-full hover:bg-bg-light flex items-center justify-center cursor-pointer">
                <ChevronLeft size={18} className="text-text-main" />
              </button>
            )}
            <h2 className="text-lg font-bold text-text-main">
              {step === 1 ? "Créer un espace" : "Inviter des hôtes"}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-bg-light flex items-center justify-center cursor-pointer">
            <X size={18} className="text-text-light" />
          </button>
        </div>

        {step === 1 ? (
          <div className="p-4 space-y-4">
            {/* Title */}
            <div>
              <label className="text-sm font-semibold text-text-main mb-1 block">Titre *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Discussion sur l'IA en Afrique"
                className="w-full px-3 py-2.5 rounded-xl bg-bg-light text-sm border border-transparent focus:outline-none focus:border-primary focus:bg-card transition-colors"
                maxLength={100}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-semibold text-text-main mb-1 block">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez le sujet de votre espace..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-light text-sm border border-transparent focus:outline-none focus:border-primary focus:bg-card transition-colors resize-none"
                maxLength={300}
              />
            </div>

            {/* Topics */}
            <div>
              <label className="text-sm font-semibold text-text-main mb-2 block">Catégories *</label>
              <div className="flex flex-wrap gap-2">
                {allInterests.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => toggleTopic(i.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      selectedTopics.includes(i.id)
                        ? "bg-primary text-white"
                        : "bg-bg-light text-text-light hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    {i.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Type + Video toggles */}
            <div className="flex gap-3">
              <button
                onClick={() => setSpaceType(spaceType === "PUBLIC" ? "PRIVATE" : "PUBLIC")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  spaceType === "PRIVATE"
                    ? "bg-navy text-white"
                    : "border border-border-light text-text-main hover:bg-bg-light"
                }`}
              >
                {spaceType === "PRIVATE" ? <Lock size={14} /> : <Globe size={14} />}
                {spaceType === "PRIVATE" ? "Privé" : "Public"}
              </button>
              <button
                onClick={() => setIsVideo(!isVideo)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  isVideo
                    ? "bg-primary text-white"
                    : "border border-border-light text-text-main hover:bg-bg-light"
                }`}
              >
                <Camera size={14} />
                {isVideo ? "Vidéo activée" : "Audio seul"}
              </button>
            </div>

            {/* Next button → go to host selection */}
            <button
              onClick={handleNext}
              disabled={!canProceedToStep2}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-cyan text-white font-semibold text-sm hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              Suivant — Inviter des hôtes
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Rechercher parmi vos abonnés..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-bg-light text-sm border border-transparent focus:outline-none focus:border-primary focus:bg-card transition-colors"
              />
            </div>

            {/* Selected hosts count */}
            {selectedHosts.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-text-main">
                  {selectedHosts.length} hôte{selectedHosts.length > 1 ? "s" : ""} sélectionné{selectedHosts.length > 1 ? "s" : ""}
                </span>
                <div className="flex -space-x-2">
                  {selectedHosts.slice(0, 5).map((h) => (
                    <div key={h.id} className="w-6 h-6 rounded-full border-2 border-white overflow-hidden">
                      <Avatar src={h.image ? addBaseURL(h.image) : null} alt={h.fullName ?? ""} size={24} />
                    </div>
                  ))}
                  {selectedHosts.length > 5 && (
                    <div className="w-6 h-6 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
                      +{selectedHosts.length - 5}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Followers list */}
            <div className="max-h-[40vh] overflow-y-auto space-y-1">
              {loadingFollowers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary" />
                </div>
              ) : filteredFollowers.length === 0 ? (
                <p className="text-center text-sm text-text-light py-8">
                  {searchKeyword ? "Aucun résultat" : "Aucun abonné trouvé"}
                </p>
              ) : (
                filteredFollowers.map((user) => {
                  const isSelected = selectedHosts.some((h) => h.id === user.id);
                  return (
                    <div
                      key={user.id}
                      onClick={() => toggleHost(user)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                        isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-bg-light"
                      }`}
                    >
                      <Avatar
                        src={user.profile ? addBaseURL(user.profile) : null}
                        alt={user.full_name ?? ""}
                        size={40}
                        isVerified={user.is_verified >= 2}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-main truncate">{user.full_name}</p>
                        <p className="text-xs text-text-light truncate">@{user.username}</p>
                      </div>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? "bg-primary text-white" : "border-2 border-border-light"
                      }`}>
                        {isSelected && <Check size={14} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Create button (can create without hosts too) */}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-cyan text-white font-semibold text-sm hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {creating ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Création en cours...
                </span>
              ) : selectedHosts.length > 0 ? (
                `Lancer avec ${selectedHosts.length} hôte${selectedHosts.length > 1 ? "s" : ""}`
              ) : (
                "Lancer sans hôte"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SKELETON / EMPTY
   ═══════════════════════════════════════════════════ */
function SpacesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card bg-gradient-to-br from-bg-dark to-navy p-5 animate-pulse">
          <div className="flex gap-2 mb-3">
            <div className="w-14 h-5 bg-white/10 rounded-full" />
          </div>
          <div className="h-5 bg-white/10 rounded w-3/4 mb-2" />
          <div className="h-3 bg-white/10 rounded w-1/2 mb-3" />
          <div className="flex gap-3">
            <div className="h-3 bg-white/10 rounded w-24" />
            <div className="h-3 bg-white/10 rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptySpaces() {
  return (
    <div className="card flex flex-col items-center justify-center py-16 gap-3">
      <Radio size={40} className="text-primary/30" />
      <p className="text-sm text-text-light font-medium">Aucun espace en direct</p>
      <p className="text-xs text-text-light/70">Créez un espace pour lancer une discussion</p>
    </div>
  );
}
