"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, User as UserIcon, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export function LiveChat({ currentUser }: { currentUser: User }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPeek, setIsPeek] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Reset peek when chat is opened
  useEffect(() => {
    if (isOpen) setIsPeek(false);
  }, [isOpen]);

  // Fetch initial messages and subscribe to real-time updates
  useEffect(() => {
    if (!isOpen || !recipientId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUser.id},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${currentUser.id})`,
        )
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) {
        console.error(
          "Error fetching messages:",
          error.message || error,
          error.details || "",
        );
      } else {
        setMessages(data || []);
      }
    };

    fetchMessages();

    // Subscribe to real-time inserts on the 'messages' table
    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${currentUser.id}`, // Listen for messages sent TO this user
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only add if it's from the currently selected recipient
          if (newMsg.sender_id === recipientId) {
            setMessages((prev) => [...prev, newMsg]);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, recipientId, currentUser.id, supabase]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !recipientId) return;

    const tempMessage = {
      id: crypto.randomUUID(),
      sender_id: currentUser.id,
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
    };

    // Optimistic UI update
    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");

    const { error } = await supabase.from("messages").insert({
      sender_id: currentUser.id,
      receiver_id: recipientId,
      content: tempMessage.content,
    });

    if (error) {
      toast.error("Failed to send message");
      // Revert optimistic update on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
    }
  };

  return (
    <>
      {/* Floating Action Button with Peek Behavior */}
      <motion.div
        initial={false}
        animate={{ 
          x: isPeek ? "calc(100% - 24px)" : 0,
          opacity: isOpen ? 0 : 1,
          pointerEvents: isOpen ? "none" : "auto"
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed bottom-32 right-6 z-50 flex items-center gap-2"
      >
        <button
          onClick={() => isPeek ? setIsPeek(false) : setIsOpen(true)}
          onMouseEnter={() => isPeek && setIsPeek(false)}
          className={`group flex items-center justify-center rounded-full bg-[#27324A] text-white shadow-xl shadow-[#27324A]/25 transition-all duration-300 hover:shadow-2xl active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2 ${
            isPeek ? "h-10 w-10 p-0" : "h-12 w-12"
          }`}
          aria-label="Open Live Chat"
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
            className="fixed bottom-32 right-6 z-50 flex h-[28rem] w-[20rem] sm:w-[22rem] flex-col overflow-hidden rounded-[2rem] border border-[#2E3344]/10 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-[#27324A] px-5 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-bold tracking-tight text-sm uppercase tracking-widest">Neighborhood Chat</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setIsOpen(false); setIsPeek(true); }}
                  className="rounded-full p-1.5 transition hover:bg-white/10 text-white/70 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Contact Selector (Mocked for now) */}
            {!recipientId ? (
              <div className="flex flex-1 flex-col overflow-y-auto bg-[#F7F0E6]/30 p-5">
                <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-[#8D5132]">
                  Select a contact
                </p>
                <div className="grid gap-2.5">
                  <button
                    onClick={() =>
                      setRecipientId("00000000-0000-0000-0000-000000000000")
                    }
                    className="flex items-center gap-4 rounded-[1.25rem] bg-white p-4 text-left shadow-sm border border-[#2E3344]/5 transition-all hover:border-[#A7653A]/20 active:scale-[0.98]"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#27324A] text-white">
                      <UserIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-[#27324A]">
                        Support Team
                      </p>
                      <p className="text-[10px] font-bold text-[#746E73] uppercase tracking-wider">
                        Available 24/7
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Message List */}
                <div className="flex-1 overflow-y-auto bg-[#F7F0E6]/30 p-5">
                  <div className="flex flex-col gap-3.5">
                    {messages.length === 0 ? (
                      <div className="mt-10 text-center px-4">
                        <div className="mx-auto h-12 w-12 rounded-2xl bg-[#E8E3D1] flex items-center justify-center mb-3">
                           <MessageSquare className="h-6 w-6 text-[#626A54]" />
                        </div>
                        <p className="text-xs font-bold text-[#27324A]">New Conversation</p>
                        <p className="text-[10px] text-[#746E73] mt-1 leading-relaxed">
                          Ask anything about local shops or your recent orders.
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = msg.sender_id === currentUser.id;
                        return (
                          <div
                            key={msg.id}
                            className={`flex max-w-[85%] flex-col ${
                              isMe
                                ? "self-end items-end"
                                : "self-start items-start"
                            }`}
                          >
                            <div
                              className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                isMe
                                  ? "rounded-tr-sm bg-[#27324A] text-white shadow-lg shadow-[#27324A]/10"
                                  : "rounded-tl-sm bg-white text-[#27324A] shadow-sm border border-[#2E3344]/5"
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Input Area */}
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-center gap-2 border-t border-[#2E3344]/8 bg-white p-4"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setRecipientId(null);
                      setMessages([]);
                    }}
                    className="p-2 text-[#746E73] hover:text-[#27324A] transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Message..."
                    className="flex-1 rounded-full border border-[#2E3344]/8 bg-[#F7F0E6]/30 px-5 py-2.5 text-sm outline-none transition focus:border-[#A7653A] focus:ring-4 focus:ring-[#A7653A]/5"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#A7653A] text-white shadow-lg shadow-[#A7653A]/20 transition hover:bg-[#8E5432] disabled:opacity-50 active:scale-95"
                  >
                    <Send className="h-4 w-4" />
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
