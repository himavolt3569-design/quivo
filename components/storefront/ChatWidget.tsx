"use client";

import { useState, useEffect, useMemo, useRef, useTransition } from "react";
import { MessageCircle, X, Send, Bot } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCustomerChatMessages, sendCustomerChatMessage } from "@/app/actions/storefront";

interface ChatMessage {
  id: string;
  sender: "customer" | "owner";
  message: string;
  created_at: string;
  customer_name: string | null;
}

interface ChatWidgetProps {
  shopId: string;
  shopName: string;
  themeColor: string;
}

export function ChatWidget({ shopId, shopName, themeColor }: ChatWidgetProps) {
  const sessionKey = `chat_session_${shopId}`;
  const secretKey = `chat_secret_${shopId}`;
  const nameKey = `chat_name_${shopId}`;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [nameEntered, setNameEntered] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [sessionSecret, setSessionSecret] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  // Init session
  useEffect(() => {
    let sid = localStorage.getItem(sessionKey);
    if (!sid) {
      sid = `session_${crypto.randomUUID()}`;
      localStorage.setItem(sessionKey, sid);
    }
    let secret = localStorage.getItem(secretKey);
    if (!secret) {
      secret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(secretKey, secret);
    }
    const savedName = localStorage.getItem(nameKey);
    queueMicrotask(() => {
      setSessionId(sid);
      setSessionSecret(secret);
      if (savedName) {
        setCustomerName(savedName);
        setNameEntered(true);
      }
    });
  }, [sessionKey, secretKey, nameKey]);

  // Fetch existing messages for this session
  useEffect(() => {
    if (!sessionId || !sessionSecret) return;
    const fetch = async () => {
      const res = await getCustomerChatMessages(shopId, sessionId, sessionSecret);
      if (res.messages) setMessages(res.messages as ChatMessage[]);
    };
    fetch();
  }, [sessionId, sessionSecret, shopId, supabase]);

  // Subscribe to realtime
  useEffect(() => {
    if (!sessionId || !sessionSecret) return;
    const channel = supabase
      .channel(`chat:${shopId}:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `shop_id=eq.${shopId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage & { session_id: string };
          if (msg.session_id === sessionId) {
            getCustomerChatMessages(shopId, sessionId, sessionSecret).then((res) => {
              if (res.messages) setMessages(res.messages as ChatMessage[]);
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, sessionSecret, shopId]);

  // Auto-scroll
  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!input.trim() || !sessionId || !sessionSecret) return;
    const text = input.trim();
    setInput("");
    startTransition(async () => {
      await sendCustomerChatMessage(shopId, sessionId, sessionSecret, customerName || "Customer", text);
      const res = await getCustomerChatMessages(shopId, sessionId, sessionSecret);
      if (res.messages) setMessages(res.messages as ChatMessage[]);
    });
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return;
    localStorage.setItem(nameKey, customerName.trim());
    setNameEntered(true);
  };

  const unreadOwnerMessages = messages.filter((m) => m.sender === "owner").length;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition active:scale-95 z-30"
        style={{ backgroundColor: themeColor }}
      >
        <MessageCircle className="h-6 w-6 text-white" />
        {!isOpen && unreadOwnerMessages > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
            {unreadOwnerMessages}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col z-30 overflow-hidden" style={{ maxHeight: "480px" }}>
          {/* Header */}
          <div className="flex items-center justify-between p-4" style={{ backgroundColor: themeColor }}>
            <div className="flex items-center gap-2 text-white">
              <Bot className="h-5 w-5" />
              <div>
                <p className="text-sm font-bold">{shopName}</p>
                <p className="text-[10px] opacity-80">Live Chat Support</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {!nameEntered ? (
            /* Name entry */
            <form onSubmit={handleNameSubmit} className="p-4 flex flex-col gap-3">
              <p className="text-sm text-gray-600 font-medium">
                Hi! What&apos;s your name so we can assist you better?
              </p>
              <input
                autoFocus
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your name"
                className="h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
              />
              <button
                type="submit"
                className="h-11 rounded-xl text-white font-bold text-sm"
                style={{ backgroundColor: themeColor }}
              >
                Start Chat
              </button>
            </form>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50" style={{ minHeight: "240px", maxHeight: "300px" }}>
                {messages.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-xs text-gray-400 font-medium">
                      👋 Hi {customerName}! Send us a message and we&apos;ll reply shortly.
                    </p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                        msg.sender === "customer"
                          ? "text-white rounded-tr-sm"
                          : "bg-white text-gray-800 rounded-tl-sm shadow-sm"
                      }`}
                      style={msg.sender === "customer" ? { backgroundColor: themeColor } : {}}
                    >
                      {msg.message}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-100 flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder="Type a message..."
                  className="flex-1 h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                />
                <button
                  onClick={handleSend}
                  disabled={isPending || !input.trim()}
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition"
                  style={{ backgroundColor: themeColor }}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
