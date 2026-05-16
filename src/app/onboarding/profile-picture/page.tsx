"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, ImagePlus, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store";
import { UserService } from "@/lib/services/user-service";

export default function ProfilePicturePage() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setError("");
    setFile(selected);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(selected);
  };

  const handleUpload = async () => {
    if (!user || !file) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await UserService.editProfile(user.id, {}, file);
      if (res.status && res.data) {
        updateUser({ profile: res.data.profile });
      } else {
        updateUser({ profile: "uploaded" });
      }
      router.push("/feed");
    } catch {
      setError("Failed to upload. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    updateUser({ profile: "skipped" });
    router.push("/feed");
  };

  return (
    <div className="min-h-screen bg-card flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[40%] bg-gradient-to-br from-[#1B3A5C] via-[#122840] to-[#0F172A] relative overflow-hidden items-center justify-center">
        <div className="absolute top-20 right-10 w-72 h-72 rounded-full bg-[#E91E8C]/8 blur-[80px]" />
        <div className="absolute bottom-20 -left-10 w-64 h-64 rounded-full bg-[#2AABAB]/10 blur-[60px]" />
        <div className="relative z-10 px-12 xl:px-16 max-w-lg">
          <div className="w-16 h-16 rounded-2xl bg-[#2AABAB]/20 flex items-center justify-center mb-8">
            <Camera size={28} className="text-[#2AABAB]" />
          </div>
          <h2 className="text-3xl xl:text-4xl font-black text-white leading-tight mb-4">
            Show the world<br />
            <span className="text-[#E91E8C]">who you are</span>
          </h2>
          <p className="text-white/50 leading-relaxed">
            A profile picture helps others recognize you and builds trust within the community. You can always change it later.
          </p>
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1 flex flex-col">
        {/* Progress */}
        <div className="px-6 sm:px-10 pt-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-[#2AABAB] uppercase tracking-wider">Step 3 of 3</span>
          </div>
          <div className="flex gap-1.5">
            <div className="h-1 flex-1 rounded-full bg-[#2AABAB]" />
            <div className="h-1 flex-1 rounded-full bg-[#2AABAB]" />
            <div className="h-1 flex-1 rounded-full bg-[#2AABAB]" />
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-8">
          <div className="w-full max-w-md text-center">
            <h1 className="text-2xl font-bold text-[#1E293B] mb-1">Add a profile picture</h1>
            <p className="text-sm text-[#94A3B8] mb-10">Help people recognize you</p>

            {/* Image picker */}
            <div className="relative mx-auto w-48 h-48 mb-8">
              {preview ? (
                <div className="relative w-full h-full">
                  <Image
                    src={preview}
                    alt="Profile preview"
                    fill
                    className="rounded-full object-cover border-4 border-[#2AABAB]/20"
                  />
                  <button
                    onClick={() => { setPreview(null); setFile(null); }}
                    className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#2AABAB] text-white flex items-center justify-center shadow-lg hover:bg-[#239494] transition-colors cursor-pointer"
                  >
                    <Camera size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full rounded-full border-[3px] border-dashed border-[#CBD5E1] flex flex-col items-center justify-center gap-2 text-[#94A3B8] hover:border-[#2AABAB] hover:text-[#2AABAB] hover:bg-[#2AABAB]/5 transition-all cursor-pointer group"
                >
                  <ImagePlus size={32} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium">Choose photo</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={handleUpload}
                disabled={!file}
                isLoading={isLoading}
                className="w-full h-12"
              >
                Continue
                <ArrowRight size={16} />
              </Button>
              <button
                onClick={handleSkip}
                disabled={isLoading}
                className="w-full h-10 text-sm font-medium text-[#94A3B8] hover:text-[#1E293B] transition-colors cursor-pointer"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
