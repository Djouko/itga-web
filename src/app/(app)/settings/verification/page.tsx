"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, Camera, BadgeCheck } from "lucide-react";
import { useAuthStore, useSettingsStore } from "@/lib/store";
import { apiCall } from "@/lib/api";

export default function ProfileVerificationPage() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const { settings } = useSettingsStore();
  const documentInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [documentType, setDocumentType] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);

  useEffect(() => {
    // Document types come from global settings
    try {
      const raw = (settings as unknown as Record<string, unknown>)?.document_type;
      if (typeof raw === "string") {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setDocumentTypes(parsed.map(String));
      } else if (Array.isArray(raw)) {
        setDocumentTypes(raw.map(String));
      }
    } catch {
      // Default types
      setDocumentTypes(["Passport", "National ID", "Driver License"]);
    }
  }, [settings]);

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocumentFile(file);
    setDocumentPreview(URL.createObjectURL(file));
  };

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  const handleSubmit = useCallback(async () => {
    if (!user || !fullName.trim() || !documentType || !documentFile || !selfieFile || submitting) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("user_id", String(user.id));
      formData.append("full_name", fullName.trim());
      formData.append("document_type", documentType);
      formData.append("document", documentFile);
      formData.append("selfie", selfieFile);

      const res = await apiCall({ endpoint: "profileVerification", formData });
      if (res.status) {
        updateUser({ is_verified: 1 });
        router.back();
      }
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  }, [user, fullName, documentType, documentFile, selfieFile, submitting, updateUser, router]);

  const canSubmit = fullName.trim() && documentType && documentFile && selfieFile && !submitting;

  return (
    <div className="min-h-screen bg-card">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <h1 className="text-lg font-bold text-text-main">Profile Verification</h1>
        </div>
      </header>

      <div className="px-4 pb-8">
        {/* Info Banner */}
        <div className="mt-4 p-4 bg-teal/10 rounded-xl flex items-start gap-3">
          <BadgeCheck size={20} className="text-teal shrink-0 mt-0.5" />
          <p className="text-sm text-text-main leading-relaxed">
            Get verified to show a blue badge next to your name. Submit your identity document and a selfie for review.
          </p>
        </div>

        <div className="mt-6 space-y-5">
          {/* Full Name */}
          <div>
            <label className="text-xs font-semibold text-text-main mb-1.5 block">Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={50}
              className="w-full px-3 py-2.5 text-sm border border-border-light rounded-xl focus:outline-none focus:border-teal transition-colors"
            />
          </div>

          {/* Document Type */}
          <div>
            <label className="text-xs font-semibold text-text-main mb-1.5 block">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-border-light rounded-xl focus:outline-none focus:border-teal transition-colors bg-card"
            >
              <option value="">Select a document type</option>
              {documentTypes.map((dt) => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
          </div>

          {/* Document Upload */}
          <div>
            <label className="text-xs font-semibold text-text-main mb-1.5 block">Identity Document</label>
            <button
              onClick={() => documentInputRef.current?.click()}
              className="w-full h-40 rounded-xl border-2 border-dashed border-border-light hover:border-teal transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer overflow-hidden"
            >
              {documentPreview ? (
                <img src={documentPreview} alt="Document" className="w-full h-full object-contain" />
              ) : (
                <>
                  <Upload size={24} className="text-text-light" />
                  <p className="text-sm text-text-light">Tap to upload document</p>
                </>
              )}
            </button>
            <input ref={documentInputRef} type="file" accept="image/*" className="hidden" onChange={handleDocumentChange} />
          </div>

          {/* Selfie Upload */}
          <div>
            <label className="text-xs font-semibold text-text-main mb-1.5 block">Selfie Photo</label>
            <button
              onClick={() => selfieInputRef.current?.click()}
              className="w-full h-40 rounded-xl border-2 border-dashed border-border-light hover:border-teal transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer overflow-hidden"
            >
              {selfiePreview ? (
                <img src={selfiePreview} alt="Selfie" className="w-full h-full object-contain" />
              ) : (
                <>
                  <Camera size={24} className="text-text-light" />
                  <p className="text-sm text-text-light">Tap to take a selfie</p>
                </>
              )}
            </button>
            <input ref={selfieInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleSelfieChange} />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-teal to-navy rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Submitting..." : "Submit for Verification"}
          </button>
        </div>
      </div>
    </div>
  );
}
