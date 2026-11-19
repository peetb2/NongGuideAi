"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { SkeletonDemo } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Palette,
  Check,
  Copy,
  Sparkles,
  Bot,
  Send,
  RefreshCw,
  Eye,
  Code2,
  Sliders,
  HelpCircle,
  Plus,
  Trash2,
  ExternalLink,
  MessageSquare,
  Zap,
  RotateCcw,
} from "lucide-react";

function renderInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#0F172A]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderAssistantMarkdown(rawText: string): React.ReactNode {
  const normalized = (rawText || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return null;

  const blocks = normalized.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, bIdx) => {
        const lines = block.split("\n");
        const nodes: React.ReactNode[] = [];
        let listItems: string[] = [];
        let paraLines: string[] = [];

        const flushList = (keyPrefix: string) => {
          if (listItems.length > 0) {
            nodes.push(
              <ul key={`${keyPrefix}-ul-${nodes.length}`} className="list-disc pl-4 space-y-1">
                {listItems.map((item, liIdx) => (
                  <li key={liIdx}>{renderInlineBold(item)}</li>
                ))}
              </ul>
            );
            listItems = [];
          }
        };

        const flushPara = (keyPrefix: string) => {
          if (paraLines.length > 0) {
            nodes.push(
              <p key={`${keyPrefix}-p-${nodes.length}`} className="leading-relaxed">
                {paraLines.map((line, lIdx) => (
                  <React.Fragment key={lIdx}>
                    {lIdx > 0 && <br />}
                    {renderInlineBold(line)}
                  </React.Fragment>
                ))}
              </p>
            );
            paraLines = [];
          }
        };

        for (const rawLine of lines) {
          const trimmed = rawLine.trim();
          const bulletMatch = trimmed.match(/^(?:[-•*])\s+(.+)$/);
          if (bulletMatch) {
            flushPara(`b${bIdx}`);
            listItems.push(bulletMatch[1]);
          } else {
            flushList(`b${bIdx}`);
            if (trimmed) paraLines.push(rawLine);
          }
        }
        flushList(`b${bIdx}`);
        flushPara(`b${bIdx}`);

        return <React.Fragment key={bIdx}>{nodes}</React.Fragment>;
      })}
    </div>
  );
}

interface BotData {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  widgetConfig?: string | null;
  apiKeys?: Array<{
    id: string;
    keyPrefix: string;
    type: string;
  }>;
}

interface WidgetThemeConfig {
  presetName: string;
  primaryColor: string;
  position: "right" | "left";
  botName: string;
  botSubtitle: string;
  avatarUrl: string;
  greetingMessage: string;
  placeholderText: string;
  quickPrompts: string[];
  enableStreaming: boolean;
}

const PRESET_THEMES = [
  { id: "sage", name: "NongGuide Sage", color: "#334539", bg: "#EBF3EE" },
  { id: "emerald", name: "Forest Emerald", color: "#065F46", bg: "#ECFDF5" },
  { id: "ocean", name: "Ocean Blue", color: "#1E40AF", bg: "#EFF6FF" },
  { id: "midnight", name: "Midnight Dark", color: "#0F172A", bg: "#F1F5F9" },
  { id: "sunset", name: "Sunset Amber", color: "#C2410C", bg: "#FFF7ED" },
  { id: "purple", name: "Royal Purple", color: "#7E22CE", bg: "#FAF5FF" },
];

function WidgetCustomizerInner() {
  const searchParams = useSearchParams();
  const urlBotId = searchParams.get("botId");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bots, setBots] = useState<BotData[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [publicApiKey, setPublicApiKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<"html" | "wordpress" | "react">("html");

  // Customizer Configuration State
  const [config, setConfig] = useState<WidgetThemeConfig>({
    presetName: "sage",
    primaryColor: "#334539",
    position: "right",
    botName: "NongGuide AI",
    botSubtitle: "พร้อมให้บริการ 24 ชม.",
    avatarUrl: "",
    greetingMessage: "สวัสดีครับ! ยินดีต้อนรับสู่บริการท่องเที่ยว มีข้อมูลหรือสถานที่ใดให้แนะนำไหมครับ?",
    placeholderText: "พิมพ์คำถามของคุณที่นี่...",
    quickPrompts: [
      "แนะนำแพ็กเกจเที่ยวยอดฮิต",
      "เวลาเช็คอิน / เช็คเอาต์",
      "ติดต่อเจ้าหน้าที่ฝ่ายบริการ",
    ],
    enableStreaming: true,
  });

  const [newPromptInput, setNewPromptInput] = useState("");

  // Live Interactive Preview Chat State
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewMessages, setPreviewMessages] = useState<
    Array<{
      sender: "bot" | "user" | "error";
      text: string;
      sources?: Array<{ title: string; relevance: number }>;
    }>
  >([]);
  const [previewInput, setPreviewInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const previewChatBottomRef = useRef<HTMLDivElement>(null);
  const quickPromptsRowRef = useRef<HTMLDivElement>(null);

  const handleClearPreviewChat = () => {
    setPreviewMessages([{ sender: "bot", text: config.greetingMessage }]);
    setPreviewInput("");
    setCopiedMsgIdx(null);
  };

  const handleCopyPreviewMessage = async (text: string, idx: number) => {
    const clean = (text || "").replace(/\*\*/g, "").trim();
    if (!clean) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(clean);
      }
      setCopiedMsgIdx(idx);
      setTimeout(() => {
        setCopiedMsgIdx((prev) => (prev === idx ? null : prev));
      }, 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      toast.error(msg);
    } else {
      toast.success(msg);
    }
  };

  // 1. Fetch Bots and API Keys
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [botsRes, keysRes] = await Promise.all([
          fetch("/api/bots", { cache: "no-store" }),
          fetch("/api/keys", { cache: "no-store" }),
        ]);

        let fetchedBots: BotData[] = [];
        if (botsRes.ok) {
          const data = await botsRes.json();
          fetchedBots = data.bots || [];
          setBots(fetchedBots);
        }

        let keysList: any[] = [];
        if (keysRes.ok) {
          const kData = await keysRes.json();
          keysList = kData.apiKeys || kData.keys || [];
        }

        // Determine which bot to select
        let targetBot = fetchedBots[0];
        if (urlBotId) {
          const found = fetchedBots.find((b) => b.id === urlBotId);
          if (found) targetBot = found;
        }

        if (targetBot) {
          setSelectedBotId(targetBot.id);
          applyBotConfig(targetBot);

          // Find public API key for this bot
          const matchingKey = keysList.find(
            (k) => k.botId === targetBot.id && k.type === "PUBLIC_WIDGET"
          );
          if (matchingKey) {
            setPublicApiKey(matchingKey.rawKey || matchingKey.key || matchingKey.keyPrefix || "");
          } else if (targetBot.apiKeys && targetBot.apiKeys.length > 0) {
            setPublicApiKey(targetBot.apiKeys[0].keyPrefix);
          } else {
            // Auto-provision a PUBLIC_WIDGET key if this bot has none yet
            try {
              const createKeyRes = await fetch("/api/keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ botId: targetBot.id, type: "PUBLIC_WIDGET" }),
              });
              if (createKeyRes.ok) {
                const createdData = await createKeyRes.json();
                setPublicApiKey(createdData.rawKey || createdData.apiKey?.keyPrefix || "");
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        console.error("Failed to load customizer data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [urlBotId]);

  // Apply a bot's existing config or sensible defaults
  const applyBotConfig = (bot: BotData) => {
    if (bot.widgetConfig) {
      try {
        const parsed = JSON.parse(bot.widgetConfig);
        setConfig({
          presetName: parsed.presetName || "sage",
          primaryColor: parsed.primaryColor || "#334539",
          position: parsed.position || "right",
          botName: parsed.botName || bot.name || "NongGuide AI",
          botSubtitle: parsed.botSubtitle || "พร้อมให้บริการ 24 ชม.",
          avatarUrl: parsed.avatarUrl || "",
          greetingMessage: parsed.greetingMessage || "สวัสดีครับ! ยินดีต้อนรับสู่บริการท่องเที่ยว มีข้อมูลหรือสถานที่ใดให้แนะนำไหมครับ?",
          placeholderText: parsed.placeholderText || "พิมพ์คำถามของคุณที่นี่...",
          quickPrompts: parsed.quickPrompts || [
            "แนะนำแพ็กเกจเที่ยวยอดฮิต",
            "เวลาเช็คอิน / เช็คเอาต์",
            "ติดต่อเจ้าหน้าที่ฝ่ายบริการ",
          ],
          enableStreaming: parsed.enableStreaming !== false,
        });
        return;
      } catch (e) {
        // continue to defaults
      }
    }

    // Default configuration based on bot name
    setConfig((prev) => ({
      ...prev,
      botName: bot.name || prev.botName,
      greetingMessage: `สวัสดีครับ! ผมคือ ${bot.name} มีข้อมูลท่องเที่ยวหรือคำถามใดให้ช่วยเหลือไหมครับ?`,
    }));
  };

  // Change selected bot
  const handleSelectBot = async (botId: string) => {
    setSelectedBotId(botId);
    const found = bots.find((b) => b.id === botId);
    if (found) {
      applyBotConfig(found);
      if (found.apiKeys && found.apiKeys.length > 0) {
        setPublicApiKey(found.apiKeys[0].keyPrefix);
      } else {
        try {
          const createKeyRes = await fetch("/api/keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ botId: found.id, type: "PUBLIC_WIDGET" }),
          });
          if (createKeyRes.ok) {
            const createdData = await createKeyRes.json();
            setPublicApiKey(createdData.rawKey || createdData.apiKey?.keyPrefix || "");
          }
        } catch {
          // ignore
        }
      }
    }
  };

  // Reset preview chat whenever greeting or bot changes
  useEffect(() => {
    setPreviewMessages([
      {
        sender: "bot",
        text: config.greetingMessage,
      },
    ]);
  }, [config.greetingMessage]);

  useEffect(() => {
    previewChatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [previewMessages, isStreaming]);

  // Handle Preset Theme Click
  const handleSelectPreset = (preset: typeof PRESET_THEMES[0]) => {
    setConfig((prev) => ({
      ...prev,
      presetName: preset.id,
      primaryColor: preset.color,
    }));
  };

  // Add Quick Prompt
  const handleAddPrompt = () => {
    const text = newPromptInput.trim();
    if (!text) return;
    if (config.quickPrompts.length >= 8) {
      showToast("สามารถใส่ปุ่มคำถามด่วนได้สูงสุด 8 ปุ่ม");
      return;
    }
    setConfig((prev) => ({
      ...prev,
      quickPrompts: [...prev.quickPrompts, text],
    }));
    setNewPromptInput("");
  };

  // Remove Quick Prompt
  const handleRemovePrompt = (idx: number) => {
    setConfig((prev) => ({
      ...prev,
      quickPrompts: prev.quickPrompts.filter((_, i) => i !== idx),
    }));
  };

  // Save Config to Database
  const handleSaveConfig = async () => {
    if (!selectedBotId) {
      showToast("กรุณาเลือกบอทก่อนบันทึก");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/bots/${selectedBotId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetConfig: JSON.stringify(config),
        }),
      });

      if (res.ok) {
        showToast("บันทึกการตั้งค่าธีมและวิดเจ็ตเรียบร้อยแล้ว!");
        // Update local bots state
        setBots((prev) =>
          prev.map((b) =>
            b.id === selectedBotId
              ? { ...b, widgetConfig: JSON.stringify(config) }
              : b
          )
        );
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (err: any) {
      showToast(err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setSaving(false);
    }
  };

  // Live Preview Chat Send Message (Supports Real-Time Streaming)
  const handleSendPreviewMessage = async (overrideText?: string) => {
    const text = (overrideText || previewInput).trim();
    if (!text || isStreaming) return;

    // Conversation memory: previous turns (oldest first), excluding errors and the current message
    const historyPayload = previewMessages
      .filter((m) => m.sender !== "error" && m.text.trim())
      .slice(-10)
      .map((m) => ({ role: m.sender === "user" ? "user" : "assistant", text: m.text }));

    setPreviewInput("");
    setPreviewMessages((prev) => [...prev, { sender: "user", text }]);
    setIsStreaming(true);

    try {
      if (config.enableStreaming) {
        // --- Real-time Streaming SSE Call ---
        const res = await fetch("/api/v1/widget/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            publicKey: publicApiKey || "pk_live_preview_demo",
            botId: selectedBotId,
            message: text,
            history: historyPayload,
            stream: true,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setPreviewMessages((prev) => [
            ...prev,
            {
              sender: "error",
              text: errData.error || "ขออภัยครับ ขณะนี้ระบบประมวลผลข้อความขัดข้อง",
            },
          ]);
          setIsStreaming(false);
          return;
        }

        // Add empty bot message bubble to receive stream
        setPreviewMessages((prev) => [...prev, { sender: "bot", text: "" }]);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let partialChunk = "";
        let accumulatedReply = "";
        let finalSources: Array<{ title: string; relevance: number }> | undefined = undefined;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            partialChunk += decoder.decode(value, { stream: true });
            const lines = partialChunk.split("\n");
            partialChunk = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data:")) {
                const jsonStr = trimmed.slice(5).trim();
                if (!jsonStr) continue;
                try {
                  const event = JSON.parse(jsonStr);
                  if (event.type === "chunk" && event.text) {
                    accumulatedReply += event.text;
                    const cleanReply = accumulatedReply.replace(/\*\*/g, "");
                    setPreviewMessages((prev) => {
                      const copy = [...prev];
                      copy[copy.length - 1] = {
                        sender: "bot",
                        text: cleanReply,
                        sources: finalSources,
                      };
                      return copy;
                    });
                  } else if (event.type === "done") {
                    finalSources = event.sources;
                    const cleanReply = accumulatedReply.replace(/\*\*/g, "");
                    setPreviewMessages((prev) => {
                      const copy = [...prev];
                      copy[copy.length - 1] = {
                        sender: "bot",
                        text: cleanReply,
                        sources: finalSources,
                      };
                      return copy;
                    });
                  }
                } catch {
                  // ignore JSON parse errors
                }
              }
            }
          }
        }
      } else {
        // --- Non-Streaming Call ---
        const res = await fetch("/api/v1/widget/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: publicApiKey || "pk_live_preview_demo",
            botId: selectedBotId,
            message: text,
            history: historyPayload,
            stream: false,
          }),
        });

        const data = await res.json();
        if (res.ok && data.reply) {
          const cleanReply = String(data.reply).replace(/\*\*/g, "");
          setPreviewMessages((prev) => [
            ...prev,
            { sender: "bot", text: cleanReply, sources: data.sources },
          ]);
        } else {
          setPreviewMessages((prev) => [
            ...prev,
            {
              sender: "error",
              text: data.error || "เกิดข้อผิดพลาดในการประมวลผลข้อความ",
            },
          ]);
        }
      }
    } catch {
      setPreviewMessages((prev) => [
        ...prev,
        {
          sender: "error",
          text: "ไม่สามารถเชื่อมต่อระบบแชทได้ กรุณาตรวจสอบว่ามี Public API Key",
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  // Embed script snippet generator
  const envAppUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  const initialOrigin =
    envAppUrl && !envAppUrl.includes("localhost") && !envAppUrl.includes("127.0.0.1")
      ? envAppUrl
      : "https://nong-guide-ai.vercel.app";
  const [originUrl, setOriginUrl] = useState(initialOrigin);
  useEffect(() => {
    const browserOrigin = window.location.origin.replace(/\/+$/, "");
    if (!browserOrigin.includes("localhost") && !browserOrigin.includes("127.0.0.1")) {
      setOriginUrl(browserOrigin);
    } else if (envAppUrl && !envAppUrl.includes("localhost") && !envAppUrl.includes("127.0.0.1")) {
      setOriginUrl(envAppUrl);
    } else {
      setOriginUrl(browserOrigin);
    }
  }, [envAppUrl]);
  const activeKeyForSnippet = publicApiKey || "pk_live_YOUR_API_KEY";
  const embedSnippet = `<script
  src="${originUrl}/widget.js"
  data-bot-key="${activeKeyForSnippet}"${selectedBotId ? `\n  data-bot="${selectedBotId}"` : ""}
  data-position="${config.position}"
  defer
></script>`;

  const reactSnippet = `import Script from "next/script";

export function NongGuideWidget() {
  return (
    <Script
      src="${originUrl}/widget.js"
      data-bot-key="${activeKeyForSnippet}"${selectedBotId ? `\n      data-bot="${selectedBotId}"` : ""}
      data-position="${config.position}"
      strategy="lazyOnload"
    />
  );
}`;

  const curlSnippet = `curl -X POST "${originUrl}/api/v1/widget/chat" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${activeKeyForSnippet}" \\
  -d '${JSON.stringify({
    botId: selectedBotId || undefined,
    message: "แนะนำทริปเที่ยว 2 วัน 1 คืนหน่อยครับ",
    stream: false,
  })}'`;

  const [embedTab, setEmbedTab] = useState<"html" | "react" | "curl">("html");
  const activeEmbedCode =
    embedTab === "html" ? embedSnippet : embedTab === "react" ? reactSnippet : curlSnippet;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    toast.success("คัดลอกโค้ดเรียบร้อยแล้ว!");
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  return (
    <div className="flex h-screen w-full bg-[#F8FAF9] font-sans antialiased text-[#1A231E] overflow-hidden">

      {/* Main Sidebar */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      {/* lg:ml-64 offsets the fixed-position Sidebar (w-64) so it no longer covers the settings panel */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden lg:ml-64">
        <Header
          title="ปรับแต่งวิดเจ็ต (Widget Customizer)"
          subtitle="ปรับแต่งธีม สี ข้อความต้อนรับ และทดสอบ Real-Time Streaming แชทบอทแบบเรียลไทม์"
          onOpenMobileSidebar={() => setMobileMenuOpen(true)}
        />

        {/* Top Action Sub-Header */}
        <div className="bg-white border-b border-[#E2E8E3] px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EBF3EE] text-[#4E6955] flex items-center justify-center shadow-xs">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1A231E] tracking-tight flex items-center gap-2">
                <span>Visual Widget Customizer</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Live Preview
                </span>
              </h1>
              <p className="text-xs text-[#6B7D72]">
                ปรับแต่งหน้าตา สี ปุ่มคำถามด่วน และทดสอบการตอบแบบ Real-Time Streaming แบบทันที
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Select Bot */}
            <div className="flex items-center gap-2 bg-[#F3F5F2] px-3 py-1.5 rounded-xl border border-[#D5DFD8]">
              <Bot className="w-4 h-4 text-[#4E6955]" />
              <select
                value={selectedBotId}
                onChange={(e) => handleSelectBot(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#1A231E] outline-none cursor-pointer"
              >
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4E6955] hover:bg-[#3E5343] text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>บันทึกการตั้งค่า</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Workspace Split View: Controls (Left) vs Interactive Preview (Right) */}
        {/* Stacked + page-scroll on small screens; balanced 40/60 grid with independent column scroll on lg+ */}
        {loading ? (
          <div className="flex-1 p-6 sm:p-8 space-y-6 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-[#E2E8E3] p-6 space-y-6">
                <SkeletonDemo />
                <SkeletonDemo />
                <SkeletonDemo />
              </div>
              <div className="bg-white rounded-2xl border border-[#E2E8E3] p-6 space-y-6">
                <SkeletonDemo />
                <SkeletonDemo />
              </div>
            </div>
          </div>
        ) : (
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:grid lg:grid-cols-[minmax(360px,2fr)_minmax(0,3fr)]">
          {/* LEFT: CONTROLS PANEL */}
          <div className="min-w-0 lg:h-full lg:overflow-y-auto overflow-x-hidden p-5 sm:p-6 xl:p-8 space-y-6 bg-white border-b lg:border-b-0 lg:border-r border-[#E2E8E3] shrink-0">
            {/* 1. PRESET THEMES */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#385241] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#4E6955]" />
                <span>ธีมสีสำเร็จรูป (Color Presets)</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3 gap-2.5">
                {PRESET_THEMES.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    title={preset.name}
                    className={`min-w-0 flex items-center gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      config.primaryColor === preset.color
                        ? "border-[#4E6955] bg-[#FAFBF9] ring-2 ring-[#4E6955]/20 shadow-xs"
                        : "border-[#E2E8E3] hover:border-[#CBD5E1] bg-white"
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-lg shrink-0 shadow-2xs"
                      style={{ backgroundColor: preset.color }}
                    />
                    <span className="text-[11.5px] font-medium text-[#1A231E] truncate">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. CUSTOM COLOR & POSITION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4 pt-4 border-t border-[#F0F2EF]">
              <div>
                <label className="block text-xs font-medium text-[#1A231E] mb-1.5">
                  รหัสสีหลัก (Primary Hex)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, primaryColor: e.target.value }))
                    }
                    className="w-9 h-9 rounded-xl border border-[#D5DFD8] p-0.5 cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={config.primaryColor}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, primaryColor: e.target.value }))
                    }
                    className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-[#F9FAF8] border border-[#D5DFD8] rounded-xl outline-none focus:border-[#4E6955]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A231E] mb-1.5">
                  ตำแหน่งปุ่ม (Position)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, position: "left" }))}
                    className={`py-2 text-xs font-medium rounded-xl border transition ${
                      config.position === "left"
                        ? "border-[#4E6955] bg-[#EBF3EE] text-[#385241] font-semibold"
                        : "border-[#D5DFD8] bg-white text-[#6B7D72]"
                    }`}
                  >
                    มุมซ้ายล่าง
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, position: "right" }))}
                    className={`py-2 text-xs font-medium rounded-xl border transition ${
                      config.position === "right"
                        ? "border-[#4E6955] bg-[#EBF3EE] text-[#385241] font-semibold"
                        : "border-[#D5DFD8] bg-white text-[#6B7D72]"
                    }`}
                  >
                    มุมขวาล่าง
                  </button>
                </div>
              </div>
            </div>

            {/* 3. BOT PERSONA & HEADERS */}
            <div className="space-y-3 pt-4 border-t border-[#F0F2EF]">
              <label className="text-xs font-bold uppercase tracking-wider text-[#385241] flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 text-[#4E6955]" />
                <span>ข้อมูลตัวแทน & หัวข้อ (Persona & Header)</span>
              </label>

              <div>
                <label className="block text-xs font-medium text-[#1A231E] mb-1">
                  ชื่อที่จะแสดงบนหัววิดเจ็ต (Bot Display Name)
                </label>
                <input
                  type="text"
                  value={config.botName}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, botName: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-[#D5DFD8] rounded-xl outline-none focus:border-[#4E6955]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A231E] mb-1">
                  ข้อความสถานะย่อย (Status Subtitle)
                </label>
                <input
                  type="text"
                  value={config.botSubtitle}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, botSubtitle: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-[#D5DFD8] rounded-xl outline-none focus:border-[#4E6955]"
                />
              </div>
            </div>

            {/* 4. GREETING & INPUT PLACEHOLDER */}
            <div className="space-y-3 pt-4 border-t border-[#F0F2EF]">
              <label className="text-xs font-bold uppercase tracking-wider text-[#385241] flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-[#4E6955]" />
                <span>ข้อความเริ่มต้น & ช่องพิมพ์</span>
              </label>

              <div>
                <label className="block text-xs font-medium text-[#1A231E] mb-1">
                  ข้อความทักทายแรกเมื่อเปิดแชท (Welcome Greeting)
                </label>
                <textarea
                  rows={3}
                  value={config.greetingMessage}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, greetingMessage: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-[#D5DFD8] rounded-xl outline-none focus:border-[#4E6955] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A231E] mb-1">
                  Placeholder ในช่องพิมพ์
                </label>
                <input
                  type="text"
                  value={config.placeholderText}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, placeholderText: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-[#D5DFD8] rounded-xl outline-none focus:border-[#4E6955]"
                />
              </div>
            </div>

            {/* 5. QUICK-REPLY PROMPT CHIPS */}
            <div className="space-y-3 pt-4 border-t border-[#F0F2EF]">
              <label className="text-xs font-bold uppercase tracking-wider text-[#385241] flex items-center justify-between">
                <span>ปุ่มคำถามด่วน (Quick Prompts)</span>
                <span className="text-[11px] font-mono text-[#6B7D72]">
                  {config.quickPrompts.length}/8
                </span>
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPromptInput}
                  onChange={(e) => setNewPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddPrompt();
                    }
                  }}
                  placeholder="พิมพ์ข้อความคำถามด่วน เช่น ขอใบเสนอราคา..."
                  className="flex-1 px-3 py-2 text-xs bg-white border border-[#D5DFD8] rounded-xl outline-none focus:border-[#4E6955]"
                />
                <button
                  type="button"
                  onClick={handleAddPrompt}
                  className="px-3.5 py-2 bg-[#EBF3EE] hover:bg-[#D8E9DC] text-[#385241] text-xs font-semibold rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่ม</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {config.quickPrompts.map((prompt, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F3F5F2] border border-[#D5DFD8] text-[11.5px] rounded-full text-[#1A231E]"
                  >
                    <span>{prompt}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePrompt(idx)}
                      className="text-slate-400 hover:text-rose-600 transition"
                      title="ลบปุ่มนี้"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* 6. ADVANCED AI SETTINGS */}
            <div className="space-y-3 pt-4 border-t border-[#F0F2EF]">
              <label className="text-xs font-bold uppercase tracking-wider text-[#385241] flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-[#4E6955]" />
                <span>ประสิทธิภาพ AI และการแสดงผล</span>
              </label>

              <div className="flex items-center justify-between p-3 bg-[#FAFBF9] border border-[#E2E8E3] rounded-xl">
                <div>
                  <h4 className="text-xs font-semibold text-[#1A231E]">
                    Real-Time Streaming Response
                  </h4>
                  <p className="text-[11px] text-[#6B7D72]">
                    พิมพ์คำตอบทีละคำแบบความเร็วสูงผ่าน Server-Sent Events (SSE)
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableStreaming}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      enableStreaming: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 text-[#4E6955] accent-[#4E6955] rounded cursor-pointer"
                />
              </div>
            </div>

            {/* 7. EMBED CODE GENERATOR WITH SHADCN TABS */}
            <div className="space-y-3 pt-4 border-t border-[#F0F2EF]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#385241] flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5 text-[#4E6955]" />
                  <span>โค้ดสำหรับนำไปติดตั้ง (Embed Code)</span>
                </label>
                <button
                  type="button"
                  onClick={() => copyToClipboard(activeEmbedCode)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#4E6955] hover:underline cursor-pointer"
                >
                  {copiedSnippet ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>คัดลอกแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>คัดลอกโค้ด</span>
                    </>
                  )}
                </button>
              </div>

              <Tabs value={embedTab} onValueChange={(v) => setEmbedTab(v as "html" | "react" | "curl")}>
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="html">HTML &lt;script&gt;</TabsTrigger>
                  <TabsTrigger value="react">React / Next.js</TabsTrigger>
                  <TabsTrigger value="curl">API cURL</TabsTrigger>
                </TabsList>

                <TabsContent value="html">
                  <div className="p-3 bg-[#1A231E] rounded-xl text-emerald-300 font-mono text-[11px] overflow-x-auto select-all leading-relaxed">
                    <pre>{embedSnippet}</pre>
                  </div>
                </TabsContent>

                <TabsContent value="react">
                  <div className="p-3 bg-[#1A231E] rounded-xl text-emerald-300 font-mono text-[11px] overflow-x-auto select-all leading-relaxed">
                    <pre>{reactSnippet}</pre>
                  </div>
                </TabsContent>

                <TabsContent value="curl">
                  <div className="p-3 bg-[#1A231E] rounded-xl text-emerald-300 font-mono text-[11px] overflow-x-auto select-all leading-relaxed">
                    <pre>{curlSnippet}</pre>
                  </div>
                </TabsContent>
              </Tabs>

              <p className="text-[11px] text-[#6B7D72]">
                นำโค้ดไปวางในเว็บไซต์ของคุณ (HTML, WordPress, Shopify, Webflow หรือ Next.js) เพื่อเปิดใช้งาน NongGuide AI ทันที
              </p>
            </div>
          </div>

          {/* RIGHT: LIVE INTERACTIVE PREVIEW CANVAS */}
          <div className="min-w-0 h-[720px] lg:h-full shrink-0 bg-[#E5EAE7] p-4 sm:p-6 lg:p-8 flex flex-col justify-center items-center overflow-hidden relative select-none">
            {/* Mockup Browser Window Container */}
            {/* Fills the available canvas height (capped at 750px) so the bottom edge is never clipped */}
            <div className="w-full max-w-4xl flex-1 min-h-0 max-h-[750px] bg-white rounded-3xl shadow-2xl border border-slate-300/80 flex flex-col overflow-hidden relative">
              {/* Browser Bar */}
              <div className="h-10 bg-[#EDF1EE] border-b border-[#D8DFD9] px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-3 h-3 rounded-full bg-rose-400" />
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 min-w-0 max-w-[320px] mx-3 px-4 py-1 bg-white border border-[#D8DFD9] rounded-lg text-[11px] font-mono text-slate-500 text-center truncate">
                  https://nongguide-travel.com
                </div>
                <div className="hidden sm:block shrink-0 text-[11px] font-medium text-slate-400">
                  Live Preview
                </div>
              </div>

              {/* Mockup Travel Website Content */}
              <div className="flex-1 bg-[#F9FAF8] p-6 sm:p-8 overflow-hidden relative flex flex-col justify-between">
                {/* Hero Banner Mockup */}
                <div className="space-y-4 max-w-lg z-0">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    🌿 Chiang Mai Luxury Villas & Eco Resort
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A231E] leading-tight">
                    ค้นพบเสน่ห์การพักผ่อนท่ามกลางธรรมชาติ
                  </h2>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    สัมผัสประสบการณ์เหนือระดับ พร้อมบริการสปา ร้านอาหารออร์แกนิก และทริปล่องแพชมธรรมชาติสุดประทับใจ
                  </p>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-xs"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      จองห้องพักตอนนี้
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-medium bg-white"
                    >
                      ดูโปรโมชั่น
                    </button>
                  </div>
                </div>

                {/* --- FLOATING CHAT WIDGET CONTAINER (LIVE PREVIEW) --- */}
                {/* Spans the preview content area (inset 20px) so the chat window and launcher
                    are stacked in normal flow and can never overflow or overlap each other */}
                <div
                  className={`absolute inset-5 z-40 flex flex-col justify-end gap-3 pointer-events-none transition-all duration-300 ${
                    config.position === "left" ? "items-start" : "items-end"
                  }`}
                >
                  {/* Chat Window Frame - Stacked ABOVE the launcher bubble, shrinks to fit the preview */}
                  {previewOpen && (
                    <div
                      className="pointer-events-auto w-full sm:w-[385px] max-w-full flex-1 min-h-0 max-h-[490px] bg-[#F8FAF9] rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200"
                    >
                      {/* Header */}
                      <div
                        className="p-3.5 sm:p-4 text-white flex items-center justify-between gap-2 shrink-0 shadow-xs"
                        style={{ backgroundColor: config.primaryColor }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-bold text-xs sm:text-sm text-white shrink-0">
                            {config.botName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs sm:text-sm leading-none truncate">
                              {config.botName}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[10.5px] sm:text-[11px] text-white/90 mt-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              <span className="truncate">{config.botSubtitle}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={handleClearPreviewChat}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                            title="เริ่มแชทใหม่ (Clear chat)"
                            aria-label="Clear chat"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewOpen(false)}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer leading-none text-xs"
                            title="ปิดหน้าต่างแชท"
                            aria-label="Close chat"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Messages Stream */}
                      <div className="flex-1 min-h-0 p-3.5 overflow-y-auto space-y-2.5 bg-[#F8FAF9] widget-scrollbar">
                        {previewMessages.map((msg, index) => (
                          <div
                            key={index}
                            className={`flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200 ${
                              msg.sender === "user"
                                ? "items-end"
                                : "items-start"
                            }`}
                          >
                            <div
                              className={`group relative max-w-[86%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                                msg.sender === "user"
                                  ? "text-white rounded-br-xs shadow-sm font-medium"
                                  : msg.sender === "error"
                                  ? "bg-rose-50 border border-rose-200 text-rose-800"
                                  : "bg-white border border-[#E2E8E3] text-[#1A231E] rounded-bl-xs shadow-2xs"
                              }`}
                              style={
                                msg.sender === "user"
                                  ? { backgroundColor: config.primaryColor }
                                  : {}
                              }
                            >
                              {msg.sender === "bot" ? (
                                <>
                                  {renderAssistantMarkdown(msg.text)}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPreviewMessage(msg.text, index)}
                                    title="คัดลอกข้อความ"
                                    aria-label="Copy reply"
                                    className={`absolute top-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-1 rounded-md border text-[10px] transition shadow-2xs cursor-pointer ${
                                      copiedMsgIdx === index
                                        ? "opacity-100 bg-emerald-50 border-emerald-200 text-emerald-700"
                                        : "opacity-0 group-hover:opacity-100 bg-white/95 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                    }`}
                                  >
                                    {copiedMsgIdx === index ? (
                                      <>
                                        <Check className="w-2.5 h-2.5" />
                                        <span>คัดลอกแล้ว</span>
                                      </>
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                </>
                              ) : (
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Streaming Indicator */}
                        {isStreaming && (
                          <div className="flex items-center gap-1.5 p-2 bg-white rounded-xl w-16 border border-slate-200">
                            <span
                              className="w-2 h-2 rounded-full animate-bounce"
                              style={{ backgroundColor: config.primaryColor }}
                            />
                            <span
                              className="w-2 h-2 rounded-full animate-bounce [animation-delay:0.2s]"
                              style={{ backgroundColor: config.primaryColor }}
                            />
                            <span
                              className="w-2 h-2 rounded-full animate-bounce [animation-delay:0.4s]"
                              style={{ backgroundColor: config.primaryColor }}
                            />
                          </div>
                        )}

                        <div ref={previewChatBottomRef} />
                      </div>

                      {/* Quick Prompt Chips */}
                      {config.quickPrompts.length > 0 && (
                        <div
                          ref={quickPromptsRowRef}
                          onWheel={(e) => {
                            if (quickPromptsRowRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                              e.preventDefault();
                              quickPromptsRowRef.current.scrollLeft += e.deltaY;
                            }
                          }}
                          className="px-3 py-2 bg-[#F1F5F3] border-t border-[#E5E9E7] flex gap-1.5 overflow-x-auto shrink-0 no-scrollbar scroll-smooth"
                        >
                          {config.quickPrompts.map((p, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => handleSendPreviewMessage(p)}
                              className="px-2.5 py-1 rounded-full bg-white border border-[#CBD5E1] text-[11px] text-[#385241] hover:bg-[#EBF3EE] transition shrink-0 whitespace-nowrap cursor-pointer shadow-2xs"
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Input Box */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendPreviewMessage();
                        }}
                        className="p-2.5 sm:p-3 bg-white border-t border-[#E2E8E3] flex items-center gap-2 shrink-0"
                      >
                        <input
                          type="text"
                          value={previewInput}
                          onChange={(e) => setPreviewInput(e.target.value)}
                          placeholder={config.placeholderText}
                          className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs text-[#1A231E] outline-none focus:border-[#4E6955]"
                        />
                        <button
                          type="submit"
                          disabled={!previewInput.trim() || isStreaming}
                          className="w-8 h-8 rounded-xl text-white flex items-center justify-center transition disabled:opacity-40 cursor-pointer shadow-2xs shrink-0"
                          style={{ backgroundColor: config.primaryColor }}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>

                      {/* Branding Footer */}
                      <div className="py-1.5 bg-white text-center text-[10px] text-slate-400 border-t border-slate-100 shrink-0">
                        ขับเคลื่อนโดย{" "}
                        <span
                          className="font-semibold"
                          style={{ color: config.primaryColor }}
                        >
                          NongGuide AI
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Launcher Bubble */}
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(!previewOpen)}
                    className="pointer-events-auto shrink-0 w-[52px] h-[52px] sm:w-14 sm:h-14 rounded-full text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition cursor-pointer z-40"
                    style={{ backgroundColor: config.primaryColor }}
                    aria-label="Toggle chat preview"
                  >
                    {previewOpen ? (
                      <span className="text-lg font-bold">✕</span>
                    ) : (
                      <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default function WidgetCustomizerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#F8FAF9] p-6">
          <div className="bg-white rounded-3xl border border-[#E2E8E3] p-8 shadow-sm">
            <SkeletonDemo />
          </div>
        </div>
      }
    >
      <WidgetCustomizerInner />
    </Suspense>
  );
}
