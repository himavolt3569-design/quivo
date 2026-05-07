"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, User as UserIcon } from "lucide-react";
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

  // Fetch initial messages and subscribe to real-time updates
  useEffect(() => {
    if (!isOpen || !recipientId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${currentUser.id})`)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) {
        console.error("Error fetching messages:", error);
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
        }
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
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#27324A] text-white shadow-xl shadow-[#27324A]/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2"
        aria-label="Open Live Chat"
      >
        <MessageSquare className="h-6 w-6" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[28rem] w-[22rem] flex-col overflow-hidden rounded-[1.5rem] border border-[#2E3344]/10 bg-white shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center justify-between bg-[#27324A] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#D8C99A]" />
              <span className="font-semibold tracking-tight">Live Chat</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 transition hover:bg-white/20 focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Contact Selector (Mocked for now) */}
          {!recipientId ? (
            <div className="flex flex-1 flex-col overflow-y-auto bg-[#F7F0E6]/50 p-4">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#8D5132]">
                Select a contact
              </p>
              <div className="grid gap-2">
                {/* Mock contacts - in reality, fetch these based on role (owners vs customers) */}
                <button
                  onClick={() => setRecipientId("mock-shop-owner-id")}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[#E8E3D1] text-[#626A54]">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#27324A]">Support Team</p>
                    <p className="text-xs text-[#746E73]">Always here to help</p>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Message List */}
              <div className="flex-1 overflow-y-auto bg-[#F7F0E6]/50 p-4">
                <div className="flex flex-col gap-3">
                  {messages.length === 0 ? (
                    <div className="mt-10 text-center text-sm font-medium text-[#746E73]">
                      Send a message to start the conversation.
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === currentUser.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex max-w-[80%] flex-col ${
                            isMe ? "self-end items-end" : "self-start items-start"
                          }`}
                        >
                          <div
                            className={`rounded-2xl px-4 py-2 text-sm ${
                              isMe
                                ? "rounded-tr-sm bg-[#A7653A] text-white shadow-md shadow-[#A7653A]/20"
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
                className="flex items-center gap-2 border-t border-[#2E3344]/10 bg-white p-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    setRecipientId(null);
                    setMessages([]);
                  }}
                  className="p-2 text-[#746E73] hover:text-[#27324A] transition-colors"
                  title="Back to contacts"
                >
                  <X className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-full border border-[#2E3344]/10 bg-[#FFFBF4] px-4 py-2 text-sm outline-none transition focus:border-[#A7653A] focus:ring-2 focus:ring-[#A7653A]/20"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#27324A] text-white shadow-md transition hover:bg-[#1B2030] disabled:opacity-50 active:scale-95"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
