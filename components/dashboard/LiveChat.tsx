"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, ChevronLeft, Store, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { getVerifiedShopsForChat, type ChatShop } from "@/app/actions/customer";
import { sendCustomerChatMessage } from "@/app/actions/storefront";

interface ChatMessage {
  id: string;
  sender: "customer" | "owner";
  message: string;
  created_at: string;
}

interface LiveChatProps {
  currentUser: User;
  customerName: string;
}

function makeSessionId(userId: string, shopId: string): string {
  // Deterministic per customer-shop pair so chat history persists across sessions
  return `cust-${userId.slice(0, 8)}-${shopId.slice(0, 8)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export function LiveChat({ currentUser, customerName }: LiveChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPeek, setIsPeek] = useState(true);

  // Contact list state
  const [shops, setShops] = useState<ChatShop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopSearch, setShopSearch] = useState("");
  const [selectedShop, setSelectedShop] = useState<ChatShop | null>(null);

  // Message state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Load shops when chat first opens
  useEffect(() => {
    if (!isOpen || shops.length > 0) return;
    setShopsLoading(true);
    getVerifiedShopsForChat()
      .then(setShops)
      .catch(() => toast.error("Could not load shops"))
      .finally(() => setShopsLoading(false));
  }, [isOpen, shops.length]);

  // Load messages + realtime when a shop is selected
  useEffect(() => {
    if (!selectedShop) return;
    const sessionId = makeSessionId(currentUser.id, selectedShop.id);

    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender, message, created_at")
        .eq("shop_id", selectedShop.id)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(60);
      setMessages((data as ChatMessage[]) ?? []);
    };

    load();

    const channel = supabase
      .channel(`livechat:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedShop, currentUser.id, supabase]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && selectedShop) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, selectedShop]);

  const handleSend = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedShop || sending) return;
    const text = input.trim();
    const sessionId = makeSessionId(currentUser.id, selectedShop.id);

    // Optimistic
    const tempId = crypto.randomUUID();
    const tempMsg: ChatMessage = {
      id: tempId,
      sender: "customer",
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setInput("");
    setSending(true);

    const result = await sendCustomerChatMessage(
      selectedShop.id,
      sessionId,
      customerName,
      text
    );

    setSending(false);
    if (result.error) {
      toast.error("Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    }
  };

  const filteredShops = shopSearch.trim()
    ? shops.filter((s) =>
        s.name.toLowerCase().includes(shopSearch.toLowerCase())
      )
    : shops;

  return (
    <>
      {/* FAB */}
      <motion.div
        initial={false}
        animate={{
          x: isPeek ? "calc(100% - 24px)" : 0,
          opacity: isOpen ? 0 : 1,
          pointerEvents: isOpen ? "none" : "auto",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed bottom-32 right-6 z-50 flex items-center gap-2"
      >
        <button
          onClick={() => { setIsPeek(false); setIsOpen(true); }}
          onMouseEnter={() => isPeek && setIsPeek(false)}
          className={`group flex items-center justify-center rounded-full bg-[#27324A] text-white shadow-xl shadow-[#27324A]/25 transition-all duration-300 hover:shadow-2xl active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2 ${
            isPeek ? "h-10 w-10" : "h-12 w-12"
          }`}
          aria-label="Open Shop Chat"
        >
          {isPeek ? (
            <ChevronLeft className="h-4 w-4 text-[#D8C99A]" />
          ) : (
            <MessageSquare className="h-5 w-5" />
          )}
        </button>
        {!isPeek && (
          <button
            onClick={() => setIsPeek(true)}
            className="h-8 w-8 rounded-full bg-white/80 border border-[#2E3344]/10 flex items-center justify-center text-[#746E73] hover:text-[#27324A] transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </motion.div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-32 right-6 z-50 flex h-120 w-80 sm:w-88 flex-col overflow-hidden rounded-4xl border border-[#2E3344]/10 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-[#27324A] px-5 py-4 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                {selectedShop && (
                  <button
                    onClick={() => { setSelectedShop(null); setMessages([]); }}
                    className="rounded-full p-1 hover:bg-white/10 transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm font-bold tracking-wide">
                  {selectedShop ? selectedShop.name : "Shop Chat"}
                </span>
              </div>
              <button
                onClick={() => { setIsOpen(false); setIsPeek(true); }}
                className="rounded-full p-1.5 hover:bg-white/10 text-white/70 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shop selector */}
            {!selectedShop ? (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="p-3 border-b border-[#2E3344]/8">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#746E73]" />
                    <input
                      type="text"
                      value={shopSearch}
                      onChange={(e) => setShopSearch(e.target.value)}
                      placeholder="Search shops…"
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-[#f8f8f7] border border-[#2E3344]/8 outline-none focus:border-[#A7653A] transition"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#8D5132] px-1 mb-2">
                    Select a shop to chat
                  </p>

                  {shopsLoading && (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-[#f8f8f7] animate-pulse">
                          <div className="h-9 w-9 rounded-xl bg-[#2E3344]/10 shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-2.5 w-24 rounded-full bg-[#2E3344]/10" />
                            <div className="h-2 w-16 rounded-full bg-[#2E3344]/5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!shopsLoading && filteredShops.length === 0 && (
                    <div className="py-8 text-center">
                      <Store className="h-8 w-8 mx-auto text-[#746E73]/30 mb-2" />
                      <p className="text-xs text-[#746E73] font-medium">
                        {shopSearch ? "No shops match your search" : "No verified shops yet"}
                      </p>
                    </div>
                  )}

                  {!shopsLoading && filteredShops.map((shop) => (
                    <button
                      key={shop.id}
                      onClick={() => { setSelectedShop(shop); setMessages([]); }}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#F7F0E6]/60 border border-transparent hover:border-[#A7653A]/10 transition text-left"
                    >
                      <div className="h-9 w-9 rounded-xl bg-[#F7F0E6] overflow-hidden shrink-0 flex items-center justify-center">
                        {shop.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={shop.image_url} alt={shop.name} className="h-9 w-9 object-cover" />
                        ) : (
                          <span className="text-sm font-black text-[#A7653A]">{shop.name[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#27324A] truncate">{shop.name}</p>
                        <p className="text-[10px] text-[#746E73] font-medium">Tap to chat</p>
                      </div>
                      <ChevronLeft className="h-3.5 w-3.5 text-[#746E73]/40 rotate-180 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto bg-[#F7F0E6]/20 p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                      <div className="h-12 w-12 rounded-2xl bg-[#E8E3D1] flex items-center justify-center mb-3">
                        <MessageSquare className="h-6 w-6 text-[#626A54]" />
                      </div>
                      <p className="text-xs font-bold text-[#27324A]">Start the conversation</p>
                      <p className="text-[10px] text-[#746E73] mt-1 leading-relaxed">
                        Ask {selectedShop.name} about products, availability, or your order.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender === "customer";
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[82%] ${isMe ? "self-end items-end ml-auto" : "self-start items-start"}`}
                        >
                          <div
                            className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                              isMe
                                ? "rounded-tr-sm bg-[#27324A] text-white shadow-lg shadow-[#27324A]/10"
                                : "rounded-tl-sm bg-white text-[#27324A] shadow-sm border border-[#2E3344]/5"
                            }`}
                          >
                            {msg.message}
                          </div>
                          <p className="text-[9px] text-[#746E73]/60 mt-0.5 px-1">
                            {timeAgo(msg.created_at)}
                          </p>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form
                  onSubmit={handleSend}
                  className="flex items-center gap-2 border-t border-[#2E3344]/8 bg-white p-3 shrink-0"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Message ${selectedShop.name}…`}
                    className="flex-1 rounded-full border border-[#2E3344]/8 bg-[#F7F0E6]/30 px-4 py-2 text-xs outline-none focus:border-[#A7653A] focus:ring-4 focus:ring-[#A7653A]/5 transition"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#A7653A] text-white shadow-md shadow-[#A7653A]/20 transition hover:bg-[#8E5432] disabled:opacity-50 active:scale-95"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
