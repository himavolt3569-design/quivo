"use client";

import { useState, useTransition, useEffect, useCallback, useMemo, useRef } from "react";
import { Reorder, useDragControls } from "framer-motion";
import {
  QrCode, Download, Share2, Globe2, Palette, Eye,
  CheckCircle2, Copy, MessageSquare, Send,
  List, Type, Megaphone, Star, Phone, X,
  RefreshCw, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/validated-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateStorefrontSettings } from "@/app/actions/storefront";
import { createClient } from "@/lib/supabase/client";
import { sendOwnerChatReply, markChatSessionRead } from "@/app/actions/storefront";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatSession {
  session_id: string;
  customer_name: string | null;
  last_message: string;
  last_at: string;
  unread: number;
}

interface ChatMessage {
  id: string;
  sender: "customer" | "owner";
  message: string;
  created_at: string;
}

interface StorefrontManagerProps {
  shopId: string;
  shopName: string;
  shopSlug: string;
  publicUrl: string | null;
  qrDataUrl: string | null;
  scanCount: number;
  initialThemeColor: string;
  initialThemeLayout: "modern" | "list";
  initialTemplate: string;
  initialFontFamily: string;
  initialHeroHeadline: string;
  initialHeroSubtext: string;
  initialAnnouncementText: string;
  initialAnnouncementActive: boolean;
  initialSectionsOrder: string[];
  initialWhatsapp: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME_COLORS = ["#A7653A", "#27324A", "#41A560", "#D84B4B", "#6B46C1", "#0EA5E9", "#F59E0B", "#EC4899"];

const TEMPLATES = [
  { id: "modern", name: "Modern", desc: "Grid layout, colorful & energetic", preview: "bg-gradient-to-br from-amber-500 to-amber-600" },
  { id: "boutique", name: "Boutique", desc: "Elegant imagery, fashion-forward", preview: "bg-gradient-to-br from-slate-800 to-slate-900" },
  { id: "minimal", name: "Minimal", desc: "Clean, white-space driven", preview: "bg-white border border-gray-200" },
  { id: "dark", name: "Dark", desc: "Bold & luxurious, dark theme", preview: "bg-gradient-to-br from-gray-950 to-slate-900" },
];

const FONTS = [
  { id: "inter", name: "Inter", style: "font-sans" },
  { id: "poppins", name: "Poppins", style: "font-sans" },
  { id: "playfair", name: "Playfair Display", style: "font-serif" },
  { id: "space", name: "Space Grotesk", style: "font-sans" },
  { id: "dmsans", name: "DM Sans", style: "font-sans" },
];

// Sections the owner can reorder in the storefront body. Hero, announcement and
// category filter are structural (always at top) and not in this list.
const ALL_SECTIONS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: "featured", label: "Featured Products", icon: <Star className="h-3.5 w-3.5" /> },
  { id: "products", label: "Product Grid", icon: <List className="h-3.5 w-3.5" /> },
  { id: "about", label: "About Section", icon: <Type className="h-3.5 w-3.5" /> },
  { id: "contact", label: "Contact Info", icon: <Phone className="h-3.5 w-3.5" /> },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Drag Item ────────────────────────────────────────────────────────────────

function SectionDragItem({
  sId,
  section,
}: {
  sId: string;
  section: { id: string; label: string; icon: React.ReactNode };
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={sId}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-3 p-3 bg-[#f8f8f7] rounded-xl border border-[#2E3344]/5 select-none"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 20px rgba(0,0,0,0.08)" }}
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        className="touch-none cursor-grab active:cursor-grabbing p-1 text-[#746E73]/50 hover:text-[#746E73] transition-colors"
        aria-label="Drag to reorder"
        type="button"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-[#A7653A]">{section.icon}</span>
      <span className="text-sm font-bold text-[#27324A] flex-1">{section.label}</span>
    </Reorder.Item>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StorefrontManager({
  shopId, shopName, shopSlug, publicUrl, qrDataUrl, scanCount,
  initialThemeColor, initialThemeLayout, initialTemplate, initialFontFamily,
  initialHeroHeadline, initialHeroSubtext, initialAnnouncementText,
  initialAnnouncementActive, initialSectionsOrder, initialWhatsapp,
}: StorefrontManagerProps) {
  const [activeTab, setActiveTab] = useState<"qr" | "customize" | "chat">("qr");
  const [isPending, startTransition] = useTransition();

  // Customize state
  const [themeColor, setThemeColor] = useState(initialThemeColor);
  const [template, setTemplate] = useState(initialTemplate || "modern");
  const [fontFamily, setFontFamily] = useState(initialFontFamily || "inter");
  const [heroHeadline, setHeroHeadline] = useState(initialHeroHeadline || "");
  const [heroSubtext, setHeroSubtext] = useState(initialHeroSubtext || "");
  const [announcementText, setAnnouncementText] = useState(initialAnnouncementText || "");
  const [announcementActive, setAnnouncementActive] = useState(initialAnnouncementActive);
  const [sectionsOrder, setSectionsOrder] = useState<string[]>(
    initialSectionsOrder?.length ? initialSectionsOrder : ALL_SECTIONS.map((s) => s.id)
  );
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp || "");

  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatPending, startChatTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);
  const activeSessionRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);

  const handlePublish = () => {
    startTransition(async () => {
      const result = await updateStorefrontSettings(shopId, {
        theme_color: themeColor,
        theme_layout: "modern",
        template,
        font_family: fontFamily,
        hero_headline: heroHeadline || null,
        hero_subtext: heroSubtext || null,
        announcement_text: announcementText || null,
        announcement_active: announcementActive,
        sections_order: sectionsOrder,
        whatsapp_number: whatsapp || null,
      });
      if (result.error) toast.error(result.error);
      else toast.success("Storefront updated!");
    });
  };

  const handleCopyUrl = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    toast.success("URL copied!");
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.download = `${shopSlug}-qr.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const loadChatSessions = useCallback(async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("session_id, customer_name, message, created_at, read, sender")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

    if (!data) return;

    const sessionMap: Record<string, ChatSession> = {};
    for (const msg of data) {
      if (!sessionMap[msg.session_id]) {
        sessionMap[msg.session_id] = {
          session_id: msg.session_id,
          customer_name: msg.customer_name,
          last_message: msg.message,
          last_at: msg.created_at,
          unread: 0,
        };
      }
      if (!msg.read && msg.sender === "customer") {
        sessionMap[msg.session_id].unread++;
      }
    }
    setSessions(Object.values(sessionMap).sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime()));
  }, [supabase, shopId]);

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, sender, message, created_at")
      .eq("shop_id", shopId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (data) setSessionMessages(data as ChatMessage[]);
  }, [supabase, shopId]);

  const openSession = useCallback(async (sessionId: string) => {
    setActiveSession(sessionId);
    await loadSessionMessages(sessionId);
    await markChatSessionRead(shopId, sessionId);
    setSessions((prev) => prev.map((s) => s.session_id === sessionId ? { ...s, unread: 0 } : s));
  }, [loadSessionMessages, shopId]);

  // Realtime: subscribe once for the shop. Inserts trigger session list refresh
  // and, if the message belongs to the currently open thread, append it live.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadChatSessions();

    const channel = supabase
      .channel(`owner-chat:${shopId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `shop_id=eq.${shopId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage & { session_id: string; customer_name: string | null };
          loadChatSessions();
          if (activeSessionRef.current === msg.session_id) {
            setSessionMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, { id: msg.id, sender: msg.sender, message: msg.message, created_at: msg.created_at }];
            });
            if (msg.sender === "customer") {
              markChatSessionRead(shopId, msg.session_id).catch(() => {});
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, shopId, loadChatSessions]);

  // Auto-scroll thread on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionMessages]);

  const handleSendReply = () => {
    if (!chatInput.trim() || !activeSession) return;
    const text = chatInput.trim();
    const sessionId = activeSession;
    setChatInput("");
    // Optimistic: realtime echo will reconcile by id
    const tempId = `temp_${Date.now()}`;
    setSessionMessages((prev) => [...prev, {
      id: tempId, sender: "owner", message: text, created_at: new Date().toISOString(),
    }]);
    startChatTransition(async () => {
      const result = await sendOwnerChatReply(shopId, sessionId, text);
      if (result.error) {
        toast.error(result.error);
        setSessionMessages((prev) => prev.filter((m) => m.id !== tempId));
        setChatInput(text);
        return;
      }
      // Replace optimistic with server row (realtime will also fire)
      await loadSessionMessages(sessionId);
    });
  };

  const shopInitial = shopName[0]?.toUpperCase() ?? "?";

  const TABS = [
    { id: "qr", label: "QR & Share", icon: <QrCode className="h-4 w-4" /> },
    { id: "customize", label: "Customize", icon: <Palette className="h-4 w-4" /> },
    { id: "chat", label: "Chat Inbox", icon: <MessageSquare className="h-4 w-4" /> },
  ] as const;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#27324A]">Storefront & QR</h1>
        <p className="text-sm font-medium text-[#746E73] mt-1">
          Customize your public shop page, manage your QR code, and reply to customer chats.
        </p>
        {publicUrl && (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#A7653A] hover:underline mt-1 inline-flex items-center gap-1">
            <Globe2 className="h-3.5 w-3.5" /> {publicUrl} ↗
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#2E3344]/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 pb-3 px-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-[#A7653A] text-[#A7653A]"
                : "border-transparent text-[#746E73] hover:text-[#27324A]"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── QR Tab ── */}
      {activeTab === "qr" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm">
              <h2 className="text-lg font-black text-[#27324A]">Share Your Shop</h2>
              <p className="text-xs text-[#746E73] font-medium mt-1">
                Customers scan this QR to visit your storefront, browse products, and place orders.
              </p>
              {scanCount > 0 && (
                <p className="text-xs font-bold text-[#A7653A] mt-2">
                  📊 Scanned {scanCount} time{scanCount !== 1 ? "s" : ""}
                </p>
              )}

              <div className="mt-6 space-y-4">
                {publicUrl && (
                  <div>
                    <Label className="font-bold text-[#27324A]">Public URL</Label>
                    <div className="flex items-center mt-1.5 gap-2">
                      <Input readOnly value={publicUrl} className="h-12 rounded-xl bg-[#f8f8f7] font-mono text-sm" />
                      <Button type="button" variant="outline" onClick={handleCopyUrl} className="h-12 rounded-xl border-[#2E3344]/10 text-[#27324A] font-bold px-4">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {!publicUrl && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs font-medium text-amber-900">
                    Your shop needs a slug to get a public URL. Complete shop setup first.
                  </div>
                )}
                {qrDataUrl && (
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#2E3344]/5">
                    <Button type="button" onClick={handleDownloadQR} className="h-12 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold w-full">
                      <Download className="h-4 w-4 mr-2" /> Download PNG
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { if (publicUrl) navigator.share?.({ url: publicUrl, title: shopName }); else handleCopyUrl(); }} className="h-12 rounded-xl border-[#2E3344]/10 text-[#27324A] font-bold w-full">
                      <Share2 className="h-4 w-4 mr-2" /> Share
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#E8E3D1]/50 p-6 rounded-[2rem] border border-[#2E3344]/5">
              <h3 className="text-sm font-black text-[#27324A] flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-[#A7653A]" /> Usage Ideas
              </h3>
              <ul className="mt-3 space-y-2 text-xs font-medium text-[#746E73]">
                {["Print on billing receipts", "Stick on shop counter", "Share in WhatsApp broadcasts", "Add to Instagram bio link"].map((tip) => (
                  <li key={tip} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" /> {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* QR Preview */}
          <div className="flex items-center justify-center bg-[#f8f8f7] p-8 rounded-[2.5rem] border border-[#2E3344]/5">
            <div className="bg-white p-8 rounded-[2rem] shadow-xl text-center w-full max-w-sm border border-[#2E3344]/5">
              <div className="mx-auto h-16 w-16 text-white rounded-2xl flex items-center justify-center font-black text-xl mb-4 shadow-sm" style={{ backgroundColor: themeColor }}>
                {shopInitial}
              </div>
              <h3 className="text-xl font-black text-[#27324A]">{shopName}</h3>
              <p className="text-[10px] uppercase tracking-widest text-[#A7653A] font-bold mt-1">Scan to order online</p>
              <div className="mt-8 mb-6 p-4 bg-white border-4 border-[#2E3344] rounded-3xl inline-block">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Shop QR Code" className="h-48 w-48 object-contain" />
                ) : (
                  <QrCode className="h-48 w-48 text-[#27324A]" />
                )}
              </div>
              <p className="text-xs font-bold text-[#746E73] font-mono">
                {shopSlug ? `quivo-hazel.vercel.app/s/${shopSlug}` : "QR not generated yet"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Customize Tab ── */}
      {activeTab === "customize" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">

            {/* Template Picker */}
            <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm">
              <Label className="font-black text-[#27324A] text-sm uppercase tracking-wider mb-4 block">Choose Template</Label>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={`border-2 rounded-2xl p-4 text-left transition ${template === t.id ? "border-[#A7653A]" : "border-[#2E3344]/10 hover:border-[#A7653A]/40"}`}
                  >
                    {/* Mini preview swatch */}
                    <div className={`h-12 rounded-xl mb-3 ${t.preview} flex items-center justify-center`}>
                      <Eye className={`h-4 w-4 ${t.id === "minimal" ? "text-gray-400" : "text-white/60"}`} />
                    </div>
                    <p className={`text-sm font-black ${template === t.id ? "text-[#A7653A]" : "text-[#27324A]"}`}>{t.name}</p>
                    <p className="text-[10px] text-[#746E73] font-medium mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Appearance */}
            <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
              <h2 className="text-sm font-black text-[#27324A] uppercase tracking-wider">Appearance</h2>

              <div>
                <Label className="font-bold text-[#27324A] mb-2 block">Brand Color</Label>
                <div className="flex flex-wrap gap-2">
                  {THEME_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setThemeColor(color)}
                      className={`h-9 w-9 rounded-full shadow-sm hover:scale-110 transition-transform ring-2 ring-offset-2 ${themeColor === color ? "ring-[#27324A]" : "ring-transparent"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="h-9 w-9 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                    title="Custom color"
                  />
                </div>
              </div>

              <div>
                <Label className="font-bold text-[#27324A] mb-2 block">Font Family</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FONTS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFontFamily(f.id)}
                      className={`border-2 rounded-xl p-3 text-sm font-bold transition ${f.style} ${fontFamily === f.id ? "border-[#A7653A] bg-[#F7F0E6] text-[#A7653A]" : "border-[#2E3344]/10 text-[#746E73] hover:bg-[#f8f8f7]"}`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Hero Section */}
            <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-[#27324A] uppercase tracking-wider">Hero Section</h2>
              <div>
                <Label className="font-bold text-[#27324A]">Headline</Label>
                <Input
                  value={heroHeadline}
                  onChange={(e) => setHeroHeadline(e.target.value)}
                  placeholder={shopName}
                  className="h-12 rounded-xl mt-1.5"
                  maxLength={80}
                />
              </div>
              <div>
                <Label className="font-bold text-[#27324A]">Subtext / Tagline</Label>
                <Input
                  value={heroSubtext}
                  onChange={(e) => setHeroSubtext(e.target.value)}
                  placeholder="Fresh products delivered to your door"
                  className="h-12 rounded-xl mt-1.5"
                  maxLength={120}
                />
              </div>
            </div>

            {/* Announcement */}
            <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-[#27324A] uppercase tracking-wider flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-[#A7653A]" /> Announcement Ribbon
                </h2>
                <button
                  type="button"
                  onClick={() => setAnnouncementActive(!announcementActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${announcementActive ? "bg-[#A7653A]" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${announcementActive ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              <Input
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="🎉 Grand Opening Sale — 20% off everything today!"
                className="h-12 rounded-xl"
                maxLength={160}
                disabled={!announcementActive}
              />
            </div>

            {/* Section Order — drag-and-drop */}
            <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-[#27324A] uppercase tracking-wider">Section Order</h2>
              <p className="text-xs text-[#746E73] font-medium -mt-2">
                Drag sections to reorder how they appear on your storefront.
              </p>
              <Reorder.Group
                axis="y"
                values={sectionsOrder}
                onReorder={setSectionsOrder}
                className="space-y-2"
              >
                {sectionsOrder.map((sId) => {
                  const section = ALL_SECTIONS.find((s) => s.id === sId);
                  if (!section) return null;
                  return (
                    <SectionDragItem key={sId} sId={sId} section={section} />
                  );
                })}
              </Reorder.Group>
            </div>

            {/* Contact */}
            <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-[#27324A] uppercase tracking-wider">Contact & Integrations</h2>
              <div>
                <Label className="font-bold text-[#27324A]">WhatsApp Number</Label>
                <div className="flex items-start mt-1.5">
                  <span className="h-12 px-3 flex items-center bg-[#f8f8f7] border border-r-0 border-[#2E3344]/10 rounded-l-xl text-sm font-bold text-[#746E73]">+977</span>
                  <div className="flex-1">
                    <PhoneInput
                      name="whatsapp_number"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="98XXXXXXXX"
                      className="h-12 rounded-l-none rounded-r-xl border-l-0"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-[#746E73] mt-1">Customers can reach you directly via WhatsApp from the storefront.</p>
              </div>
            </div>
          </div>

          {/* Sticky Publish Button */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              <div className="bg-white p-5 rounded-[2rem] border border-[#2E3344]/8 shadow-sm">
                <h3 className="text-sm font-black text-[#27324A] mb-3">Live Preview</h3>
                {publicUrl ? (
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="block w-full py-3 rounded-xl text-center text-xs font-bold bg-[#f8f8f7] text-[#A7653A] hover:bg-[#F7F0E6] transition border border-[#2E3344]/5">
                    <Eye className="h-4 w-4 inline mr-1.5" /> Open Storefront ↗
                  </a>
                ) : (
                  <p className="text-xs text-[#746E73] text-center">Set up your shop slug to enable preview.</p>
                )}

                {/* Mini preview */}
                <div className="mt-4 rounded-2xl overflow-hidden border border-[#2E3344]/8" style={{ height: "200px", backgroundColor: template === "dark" ? "#0c0c12" : template === "minimal" ? "#fff" : themeColor }}>
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-white mb-2">
                      {shopInitial}
                    </div>
                    <p className="font-black text-white text-sm">{heroHeadline || shopName}</p>
                    {heroSubtext && <p className="text-white/60 text-[10px] mt-1 line-clamp-2">{heroSubtext}</p>}
                    <div className="mt-3 h-1 w-16 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.3)" }} />
                  </div>
                </div>
              </div>

              <Button
                type="button"
                disabled={isPending}
                onClick={handlePublish}
                className="w-full h-12 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold"
              >
                {isPending ? "Publishing..." : "Publish Changes"}
              </Button>
              <p className="text-[10px] text-center text-[#746E73] font-medium">Changes go live immediately for all visitors.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Chat Inbox Tab ── */}
      {activeTab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: "500px" }}>
          {/* Session list */}
          <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-[#2E3344]/8 flex items-center justify-between">
              <h2 className="font-black text-[#27324A] text-sm">Customer Chats</h2>
              <button onClick={loadChatSessions} className="h-8 w-8 rounded-xl bg-[#f8f8f7] flex items-center justify-center text-[#746E73] hover:bg-[#F7F0E6] transition">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="p-6 text-center text-[#746E73]">
                  <MessageSquare className="h-10 w-10 mx-auto opacity-20 mb-2" />
                  <p className="text-xs font-medium">No customer chats yet.</p>
                  <p className="text-[10px] mt-1">Chats from your storefront appear here.</p>
                </div>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.session_id}
                    onClick={() => openSession(s.session_id)}
                    className={`w-full text-left px-5 py-4 border-b border-[#2E3344]/5 hover:bg-[#f8f8f7] transition ${activeSession === s.session_id ? "bg-[#F7F0E6]/60" : ""}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-bold text-[#27324A]">{s.customer_name || "Anonymous"}</span>
                      <div className="flex items-center gap-1.5">
                        {s.unread > 0 && <span className="h-4 w-4 bg-[#A7653A] text-white text-[9px] font-black rounded-full flex items-center justify-center">{s.unread}</span>}
                        <span className="text-[10px] text-[#746E73]">{timeAgo(s.last_at)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#746E73] line-clamp-1 font-medium">{s.last_message}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message thread */}
          <div className="lg:col-span-2 bg-white rounded-[2rem] border border-[#2E3344]/8 shadow-sm flex flex-col overflow-hidden">
            {!activeSession ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[#746E73] p-6 text-center">
                <MessageSquare className="h-12 w-12 opacity-20 mb-3" />
                <p className="text-sm font-medium">Select a conversation</p>
                <p className="text-xs mt-1">Click a chat from the left panel to view and reply.</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="p-5 border-b border-[#2E3344]/8 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-[#27324A] text-sm">
                      {sessions.find((s) => s.session_id === activeSession)?.customer_name || "Anonymous"}
                    </h3>
                    <p className="text-[10px] text-[#746E73] font-medium mt-0.5">Session: {activeSession.slice(-12)}</p>
                  </div>
                  <button onClick={() => setActiveSession(null)} className="h-8 w-8 rounded-xl bg-[#f8f8f7] flex items-center justify-center text-[#746E73] hover:bg-red-50 hover:text-red-500 transition">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8f8f7]/50" style={{ minHeight: "300px" }}>
                  {sessionMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === "owner" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${msg.sender === "owner" ? "text-white rounded-tr-sm" : "bg-white text-[#27324A] rounded-tl-sm shadow-sm border border-[#2E3344]/5"}`}
                        style={msg.sender === "owner" ? { backgroundColor: "#27324A" } : {}}>
                        {msg.message}
                        <p className="text-[9px] mt-1 opacity-50">{timeAgo(msg.created_at)}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply */}
                <div className="p-4 border-t border-[#2E3344]/8 flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSendReply())}
                    placeholder="Type your reply..."
                    className="flex-1 h-11 rounded-xl"
                  />
                  <Button
                    type="button"
                    onClick={handleSendReply}
                    disabled={chatPending || !chatInput.trim()}
                    className="h-11 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
