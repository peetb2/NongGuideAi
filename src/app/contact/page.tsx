"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, Mail, Copy, Check, ArrowLeft, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";

interface Developer {
  name: string;
  email: string;
}

const DEVELOPERS: Developer[] = [
  { name: "รชฏะ พิมทรัพย์ศิริ", email: "monchai.chai23@gmail.com" },
  { name: "ธัญเทพ สมไสยา", email: "thanyatepsoms@gmail.com" },
  { name: "นรวุฒิ ศิริมาตย์", email: "narawutforwork@gmail.com" },
  { name: "นวพล สวัสดี", email: "nwphlswasdi058@gmail.com" },
  { name: "ปรเมศวร์ ฟุ้งเจริญกุล", email: "porramatefung@gmail.com" },
];

export default function ContactPage() {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleCopyEmail = async (email: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = email;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedEmail(email);
      setTimeout(() => {
        setCopiedEmail((prev) => (prev === email ? null : prev));
      }, 2000);
    } catch {
      // Fallback silently if clipboard is unavailable
    }
  };

  return (
    <div className="min-h-screen w-full topo-bg text-charcoal font-sans antialiased selection:bg-sage-300 selection:text-charcoal flex flex-col">
      {/* Shared Fixed Floating Navbar (identical on / and /contact) */}
      <Navbar />

      {/* Main Content (top padding clears the fixed navbar) */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16">
        {/* Top Section Badge & Heading */}
        <div className="text-center flex flex-col items-center space-y-4 mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-[#334539] text-white text-sm font-medium tracking-wide shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-sage-200" />
            <span>ผู้พัฒนาโครงงาน</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1F2F24]">
            ติดต่อทีมพัฒนา NongGuide AI
          </h1>

          <p className="text-sm sm:text-base text-textMuted max-w-2xl leading-relaxed">
            หากมีคำถาม ข้อเสนอแนะ หรือสนใจร่วมพัฒนาโครงงาน NongGuide AI สามารถติดต่อสมาชิกทีมพัฒนาได้โดยตรงทางอีเมลด้านล่าง
            <span className="block mt-1 text-xs sm:text-sm text-textSubtle font-normal">
              Questions, feedback, or collaboration inquiries for NongGuide AI? Reach out to any of our project developers directly.
            </span>
          </p>
        </div>

        {/* Developer Directory Cards */}
        <section aria-label="รายชื่อผู้พัฒนาโครงงาน" className="space-y-3.5">
          {DEVELOPERS.map((dev, index) => {
            const isCopied = copiedEmail === dev.email;
            return (
              <div
                key={dev.email}
                className="group w-full bg-white/90 backdrop-blur-sm border border-sage-200/80 hover:border-[#4A6B4E]/50 rounded-2xl sm:rounded-full px-5 py-4 sm:px-6 sm:py-4 shadow-[0_2px_12px_rgba(51,69,57,0.04)] hover:shadow-[0_8px_24px_rgba(51,69,57,0.09)] transition-all duration-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
              >
                {/* Left: Avatar + Name */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-sage-100 border border-sage-200/80 flex items-center justify-center text-[#334539] shrink-0 group-hover:bg-[#334539] group-hover:text-white transition-colors duration-200">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-base sm:text-lg text-[#1A231E] truncate">
                      {dev.name}
                    </p>
                    <p className="text-xs text-textSubtle sm:hidden">
                      ผู้พัฒนาโครงงาน #{index + 1}
                    </p>
                  </div>
                </div>

                {/* Right: Email link + Copy button */}
                <div className="flex items-center justify-between sm:justify-end gap-2.5 pl-[60px] sm:pl-0">
                  <a
                    href={`mailto:${dev.email}`}
                    className="inline-flex items-center gap-2 text-sm font-mono text-[#334539] hover:text-[#4A6B4E] hover:underline underline-offset-4 transition-colors break-all"
                  >
                    <Mail className="w-4 h-4 text-[#4A6B4E] shrink-0" />
                    <span>{dev.email}</span>
                  </a>

                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyEmail(dev.email)}
                      aria-label={`Copy ${dev.email}`}
                      title="คัดลอกอีเมล"
                      className={`p-2 rounded-full border transition-all cursor-pointer btn-press ${
                        isCopied
                          ? "bg-[#334539] border-[#334539] text-white"
                          : "bg-sage-50 border-sage-200/80 text-[#334539] hover:bg-sage-100 hover:border-[#4A6B4E]/40"
                      }`}
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Copied Tooltip */}
                    {isCopied && (
                      <span
                        role="status"
                        className="absolute -top-9 right-0 whitespace-nowrap bg-[#334539] text-white text-[11px] font-medium px-2.5 py-1 rounded-lg shadow-md pointer-events-none"
                      >
                        คัดลอกแล้ว!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Bottom Back-to-Home CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/85 hover:bg-white border border-sage-200 text-sm font-medium text-[#334539] hover:text-[#4A6B4E] shadow-sm transition-all btn-press"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับสู่หน้าหลัก (Back to Home)</span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-sage-200/70 bg-[#FAFCFA]/70 backdrop-blur-sm py-5 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-charcoal/60 font-mono">
          <span>&copy; 2026 NongGuide AI. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-[#334539] transition-colors">
              Home
            </Link>
            <Link href="/contact" className="text-[#334539] font-semibold">
              ติดต่อเรา (Contact)
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
