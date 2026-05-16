"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";
import { useAuthStore, useSettingsStore } from "@/lib/store";
import { UserService } from "@/lib/services/user-service";
import { Avatar } from "@/components/ui/avatar";
import { addBaseURL } from "@/lib/utils";
import { InputSanitizer } from "@/lib/input-sanitizer";

const MAX_BIO = 120;
const MAX_ABOUT = 500;
const MAX_INTERESTS = 5;

export default function EditProfilePage() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const { interests: allInterests } = useSettingsStore();
  const profileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [headline, setHeadline] = useState(user?.headline ?? "");
  const [pronouns, setPronouns] = useState(user?.pronouns ?? "");
  const [about, setAbout] = useState(user?.about ?? "");
  const [skills, setSkills] = useState(user?.skills ?? "");
  const [location, setLocation] = useState(user?.location ?? "");
  const [website, setWebsite] = useState(user?.website ?? "");
  const [selectedInterestIds, setSelectedInterestIds] = useState<number[]>(() => {
    if (!user?.interest_ids) return [];
    return user.interest_ids.split(",").filter(Boolean).map(Number);
  });

  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [bgImage, setBgImage] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileImage(file);
    setProfilePreview(URL.createObjectURL(file));
  };

  const handleBgImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgImage(file);
    setBgPreview(URL.createObjectURL(file));
  };

  const checkUsername = useCallback(async (uname: string) => {
    if (!uname.trim() || uname === user?.username) {
      setUsernameError("");
      return;
    }
    setCheckingUsername(true);
    try {
      const res = await UserService.checkUsername(uname);
      if (!res.status) {
        setUsernameError("Ce nom d'utilisateur est déjà pris");
      } else {
        setUsernameError("");
      }
    } catch {
      setUsernameError("");
    } finally {
      setCheckingUsername(false);
    }
  }, [user?.username]);

  const toggleInterest = (id: number) => {
    setSelectedInterestIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    if (!user || saving || usernameError) return;
    setSaving(true);

    const sanitizedName = InputSanitizer.sanitizeText(fullName);
    const sanitizedBio = InputSanitizer.limitLength(bio, MAX_BIO);
    const sanitizedUsername = InputSanitizer.sanitizeUsername(username);
    const sanitizedAbout = InputSanitizer.limitLength(about, MAX_ABOUT);

    const data: Record<string, unknown> = {
      full_name: sanitizedName,
      bio: sanitizedBio,
      username: sanitizedUsername,
      headline: headline.trim(),
      pronouns: pronouns.trim(),
      about: sanitizedAbout,
      skills: skills.trim(),
      location: location.trim(),
      website: InputSanitizer.sanitizeUrl(website),
      interest_ids: selectedInterestIds.join(","),
    };

    try {
      const res = await UserService.editProfile(user.id, data, profileImage ?? undefined, bgImage ?? undefined);
      if (res.status && res.data) {
        updateUser(res.data);
        router.back();
      }
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const profileSrc = profilePreview || (user?.profile ? addBaseURL(user.profile) : null);
  const bgSrc = bgPreview || (user?.background_image ? addBaseURL(user.background_image) : null);

  return (
    <div className="min-h-screen bg-card">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
              <ArrowLeft size={20} className="text-text-main" />
            </button>
            <h1 className="text-lg font-bold text-text-main">Modifier le profil</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !!usernameError}
            className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-teal to-navy rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </header>

      <div className="pb-8">
        {/* Background + Profile Picture */}
        <div className="relative">
          <button
            onClick={() => bgInputRef.current?.click()}
            className="w-full h-32 bg-bg-light relative cursor-pointer group"
          >
            {bgSrc ? (
              <img src={bgSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-teal/20" />
            )}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera size={24} className="text-white" />
            </div>
          </button>
          <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgImageChange} />

          <div className="absolute -bottom-10 left-4">
            <button onClick={() => profileInputRef.current?.click()} className="relative group cursor-pointer">
              <Avatar
                src={profileSrc ?? undefined}
                alt={user?.full_name ?? ""}
                size={80}
                isVerified={(user?.is_verified ?? 0) >= 2}
              />
              <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={20} className="text-white" />
              </div>
            </button>
            <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfileImageChange} />
          </div>
        </div>

        <div className="mt-14 px-4 space-y-5">
          {/* Nom complet */}
          <FieldGroup label="Nom complet">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={50}
              className="w-full px-3 py-2.5 text-sm border border-border-light rounded-xl focus:outline-none focus:border-teal transition-colors"
            />
          </FieldGroup>

          {/* Bio */}
          <FieldGroup label="Bio" counter={`${bio.length}/${MAX_BIO}`}>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
              rows={3}
              maxLength={MAX_BIO}
              className="w-full px-3 py-2.5 text-sm border border-border-light rounded-xl focus:outline-none focus:border-teal transition-colors resize-none"
            />
          </FieldGroup>

          {/* Nom d'utilisateur */}
          <FieldGroup label="Nom d'utilisateur" error={usernameError}>
            <input
              value={username}
              onChange={(e) => {
                const v = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "");
                setUsername(v);
                setUsernameError("");
              }}
              onBlur={() => checkUsername(username)}
              maxLength={30}
              className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none transition-colors ${
                usernameError ? "border-red-400 focus:border-red-400" : "border-border-light focus:border-teal"
              }`}
            />
            {checkingUsername && (
              <p className="mt-1 text-xs text-text-light">{"Vérification du nom d'utilisateur..."}</p>
            )}
          </FieldGroup>

          {/* Centres d'intérêt */}
          <FieldGroup label={`Centres d'intérêt (${selectedInterestIds.length}/${MAX_INTERESTS})`}>
            <div className="flex flex-wrap gap-2">
              {allInterests.map((interest) => {
                const selected = selectedInterestIds.includes(interest.id);
                return (
                  <button
                    key={interest.id}
                    onClick={() => toggleInterest(interest.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer ${
                      selected ? "bg-teal text-white border-teal" : "border-border-light text-text-light hover:bg-bg-light"
                    }`}
                  >
                    {interest.title}
                  </button>
                );
              })}
            </div>
          </FieldGroup>

          <div className="border-t border-border-light pt-5">
            <h3 className="text-xs font-semibold text-text-light uppercase tracking-wider mb-4">Informations du profil</h3>

            <div className="space-y-5">
              <FieldGroup label="Titre">
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  maxLength={100}
                  placeholder="ex. Ingénieure logiciel"
                  className="w-full px-3 py-2.5 text-sm border border-border-light rounded-xl focus:outline-none focus:border-teal transition-colors"
                />
              </FieldGroup>

              <FieldGroup label="Pronoms">
                <input
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  maxLength={30}
                  placeholder="ex. Elle"
                  className="w-full px-3 py-2.5 text-sm border border-border-light rounded-xl focus:outline-none focus:border-teal transition-colors"
                />
              </FieldGroup>

              <FieldGroup label="À propos" counter={`${about.length}/${MAX_ABOUT}`}>
                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value.slice(0, MAX_ABOUT))}
                  rows={4}
                  maxLength={MAX_ABOUT}
                  className="w-full px-3 py-2.5 text-sm border border-border-light rounded-xl focus:outline-none focus:border-teal transition-colors resize-none"
                />
              </FieldGroup>

              <FieldGroup label="Compétences">
                <input
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  maxLength={200}
                  placeholder="ex. React, TypeScript, Node.js"
                  className="w-full px-3 py-2.5 text-sm border border-border-light rounded-xl focus:outline-none focus:border-teal transition-colors"
                />
              </FieldGroup>
            </div>
          </div>

          <div className="border-t border-border-light pt-5">
            <h3 className="text-xs font-semibold text-text-light uppercase tracking-wider mb-4">Coordonnées</h3>

            <div className="space-y-5">
              <FieldGroup label="Localisation">
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={100}
                  placeholder="ex. Paris, France"
                  className="w-full px-3 py-2.5 text-sm border border-border-light rounded-xl focus:outline-none focus:border-teal transition-colors"
                />
              </FieldGroup>

              <FieldGroup label="Site web">
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  maxLength={200}
                  placeholder="ex. https://monsite.com"
                  className="w-full px-3 py-2.5 text-sm border border-border-light rounded-xl focus:outline-none focus:border-teal transition-colors"
                />
              </FieldGroup>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({
  label, counter, error, children,
}: { label: string; counter?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-text-main">{label}</label>
        {counter && <span className="text-[10px] text-text-light">{counter}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
