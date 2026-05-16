"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { useLanguageStore, type Language } from "@/lib/store";

interface LanguageOption {
  code: Language | string;
  nativeName: string;
  englishName: string;
}

const languages: LanguageOption[] = [
  { code: "en", nativeName: "English", englishName: "English" },
  { code: "ar", nativeName: "العربية", englishName: "Arabic" },
  { code: "zh", nativeName: "中文", englishName: "Chinese" },
  { code: "da", nativeName: "Dansk", englishName: "Danish" },
  { code: "nl", nativeName: "Nederlands", englishName: "Dutch" },
  { code: "fr", nativeName: "Français", englishName: "French" },
  { code: "de", nativeName: "Deutsch", englishName: "German" },
  { code: "el", nativeName: "Ελληνικά", englishName: "Greek" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi" },
  { code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian" },
  { code: "it", nativeName: "Italiano", englishName: "Italian" },
  { code: "ja", nativeName: "日本語", englishName: "Japanese" },
  { code: "ko", nativeName: "한국어", englishName: "Korean" },
  { code: "nb", nativeName: "Norsk", englishName: "Norwegian" },
  { code: "pl", nativeName: "Polski", englishName: "Polish" },
  { code: "pt", nativeName: "Português", englishName: "Portuguese" },
  { code: "ru", nativeName: "Русский", englishName: "Russian" },
  { code: "es", nativeName: "Español", englishName: "Spanish" },
  { code: "sv", nativeName: "Svenska", englishName: "Swedish" },
  { code: "th", nativeName: "ไทย", englishName: "Thai" },
  { code: "tr", nativeName: "Türkçe", englishName: "Turkish" },
  { code: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese" },
];

export default function LanguagePage() {
  const router = useRouter();
  const { language: selectedLang, setLanguage } = useLanguageStore();

  const handleSelect = (langCode: string) => {
    // Only fr and en have full translations; others fall back to fr
    const supported = langCode === "en" ? "en" : "fr";
    setLanguage(supported);
  };

  return (
    <div className="min-h-screen bg-card">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <h1 className="text-lg font-bold text-text-main">Languages</h1>
        </div>
      </header>

      <div className="px-4 py-3 space-y-2 pb-8">
        {languages.map((lang) => {
          const isActive = lang.code === selectedLang;
          return (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors cursor-pointer text-left ${
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border/30 hover:bg-bg-light/50"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${isActive ? "text-primary" : "text-text-main"}`}>
                  {lang.nativeName}
                </p>
                <p className="text-xs text-text-light">{lang.englishName}</p>
              </div>
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  isActive ? "border-primary bg-primary" : "border-border"
                }`}
              >
                {isActive && <Check size={14} className="text-white" />}
              </div>
            </button>
          );
        })}
        <p className="text-xs text-text-light text-center pt-2">
          Full translations available in English and French. Other languages use French UI.
        </p>
      </div>
    </div>
  );
}
