"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, HelpCircle, ChevronDown } from "lucide-react";
import { CommonService, type FAQType } from "@/lib/services/common-service";

export default function FAQPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<FAQType[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFAQs = useCallback(async () => {
    try {
      const res = await CommonService.fetchFAQs();
      if (res.status && Array.isArray(res.data)) {
        setCategories(res.data);
        if (res.data.length > 0) {
          setSelectedCategoryId(res.data[0].id);
        }
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFAQs();
  }, [loadFAQs]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const faqs = selectedCategory?.faqs ?? [];

  return (
    <div className="min-h-screen bg-card">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <h1 className="text-lg font-bold text-text-main">FAQs</h1>
        </div>
      </header>

      {loading ? (
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-24 h-8 bg-bg-light rounded-full animate-pulse" />
            ))}
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-bg-light rounded-xl animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <HelpCircle size={32} className="text-text-light/40" />
          <p className="text-base font-semibold text-text-main">FAQs</p>
          <p className="text-sm text-text-light">No FAQs available</p>
        </div>
      ) : (
        <div className="pb-8">
          {/* Category Tabs */}
          <div className="px-4 py-3 overflow-x-auto">
            <div className="flex gap-2 min-w-min">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setExpandedFAQ(null);
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategoryId === cat.id
                      ? "bg-teal text-white"
                      : "bg-bg-light text-text-light hover:bg-gray-200"
                  }`}
                >
                  {cat.title}
                </button>
              ))}
            </div>
          </div>

          {/* FAQ Items */}
          <div className="px-4 space-y-2">
            {faqs.length === 0 ? (
              <p className="text-sm text-text-light py-8 text-center">No questions in this category</p>
            ) : (
              faqs.map((faq) => (
                <div key={faq.id} className="border border-border-light rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left cursor-pointer hover:bg-bg-light/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-text-main pr-4">{faq.question}</span>
                    <ChevronDown
                      size={16}
                      className={`text-text-light shrink-0 transition-transform duration-200 ${
                        expandedFAQ === faq.id ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {expandedFAQ === faq.id && (
                    <div className="px-4 pb-4 border-t border-border-light">
                      <p className="text-sm text-text-light pt-3 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
