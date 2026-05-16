import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/config/constants";

/* ── Types ─────────────────────────────────────────────────── */
interface ChatMessage {
  id: string;
  sender_type: "visitor" | "admin" | "system";
  message: string;
  created_at: string;
}

interface FAQ {
  q: string;
  a: string;
  key: string;
}

/* ── API helpers ───────────────────────────────────────────── */
const chatApi = (path: string, opts?: RequestInit) => {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const params = new URLSearchParams({ path });
  return fetch(`${base}/remquip-api.php?${params}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  }).then((r) => r.json());
};

/* ── Component ─────────────────────────────────────────────── */
export function ChatWidget() {
  const { t, lang: language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"intro" | "chat">("intro");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [convId, setConvId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Move chat button up when footer is visible so it doesn't overlap
  const [footerVisible, setFooterVisible] = useState(false);
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  // Don't render on admin pages
  const isAdmin = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  if (isAdmin) return null;

  const faqs: FAQ[] = [
    { key: "shipping", q: t("chat.faq.shipping_q"), a: t("chat.faq.shipping_a") },
    { key: "returns", q: t("chat.faq.returns_q"), a: t("chat.faq.returns_a") },
    { key: "wholesale", q: t("chat.faq.wholesale_q"), a: t("chat.faq.wholesale_a") },
    { key: "stock", q: t("chat.faq.stock_q"), a: t("chat.faq.stock_a") },
    { key: "contact", q: t("chat.faq.contact_q"), a: t("chat.faq.contact_a") },
    { key: "warranty", q: t("chat.faq.warranty_q"), a: t("chat.faq.warranty_a") },
  ];

  const scrollBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 80);
  }, []);

  // Poll for admin replies
  useEffect(() => {
    if (!convId || !open) return;
    const interval = setInterval(async () => {
      try {
        const res = await chatApi(`chat/${convId}/messages`, { method: "GET" });
        if (res?.data?.messages) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const newMsgs = res.data.messages.filter((m: ChatMessage) => !ids.has(m.id));
            return newMsgs.length ? [...prev, ...newMsgs] : prev;
          });
          scrollBottom();
        }
      } catch { /* silent */ }
    }, 8000);
    return () => clearInterval(interval);
  }, [convId, open, scrollBottom]);

  const startChat = () => {
    if (!name.trim()) return;
    setPhase("chat");
    setMessages([{
      id: "greeting",
      sender_type: "system",
      message: t("chat.greeting"),
      created_at: new Date().toISOString(),
    }]);
  };

  const sendMessage = async (text: string, isPredefined = false) => {
    if (!text.trim() || sending) return;
    setSending(true);
    const tempId = `tmp_${Date.now()}`;
    const visitorMsg: ChatMessage = { id: tempId, sender_type: "visitor", message: text, created_at: new Date().toISOString() };
    setMessages((p) => [...p, visitorMsg]);
    setInput("");
    scrollBottom();

    try {
      if (!convId) {
        const res = await chatApi("chat", {
          method: "POST",
          body: JSON.stringify({ message: text, visitor_name: name, visitor_email: email, language, is_predefined: isPredefined }),
        });
        if (res?.data?.conversation_id) {
          setConvId(res.data.conversation_id);
        }
      } else {
        await chatApi(`chat/${convId}/messages`, {
          method: "POST",
          body: JSON.stringify({ message: text, sender_name: name, is_predefined: isPredefined }),
        });
      }
    } catch { /* silent */ }
    setSending(false);
  };

  const handleFaq = (faq: FAQ) => {
    sendMessage(faq.q, true);
    // Auto-reply after short delay
    setTimeout(() => {
      setMessages((p) => [
        ...p,
        { id: `auto_${Date.now()}`, sender_type: "system", message: faq.a, created_at: new Date().toISOString() },
      ]);
      scrollBottom();
    }, 800);
  };




  return (
    <>
      {/* ── Floating Button ── */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            onClick={() => setOpen(true)}
            className={`fixed right-6 z-[190] w-16 h-16 rounded-2xl bg-accent text-accent-foreground shadow-xl shadow-accent/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 ${footerVisible ? "bottom-24" : "bottom-6"}`}
            aria-label="Open chat"
          >
            <MessageCircle className="h-7 w-7" strokeWidth={2.5} />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "circOut" }}
            className="fixed bottom-6 right-6 z-[195] w-[min(96vw,400px)] h-[min(80vh,620px)] flex flex-col bg-card/90 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.25)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-accent text-accent-foreground shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="font-display font-black text-sm uppercase tracking-widest">{t("chat.title")}</p>
                  <p className="text-[10px] font-medium opacity-80 tracking-wider">{t("chat.powered")}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-white/20 transition-colors">
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Body */}
            {phase === "intro" ? (
              <div className="flex-1 flex flex-col justify-center px-6 py-8 gap-5">
                <p className="font-display font-bold text-lg text-center text-foreground">{t("chat.greeting")}</p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("chat.name_label")}
                  className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border/50 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("chat.email_label")}
                  className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border/50 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <button
                  onClick={startChat}
                  disabled={!name.trim()}
                  className="w-full py-3.5 rounded-xl bg-foreground text-background font-black text-xs uppercase tracking-widest hover:bg-accent hover:text-accent-foreground transition-all disabled:opacity-40 shadow-lg"
                >
                  {t("chat.start")}
                </button>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === "visitor" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.sender_type === "visitor"
                            ? "bg-accent text-accent-foreground rounded-br-md"
                            : msg.sender_type === "admin"
                            ? "bg-foreground/10 text-foreground rounded-bl-md"
                            : "bg-muted/60 text-foreground border border-border/30 rounded-bl-md"
                        }`}
                      >
                        {msg.sender_type === "admin" && (
                          <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-1">Support</p>
                        )}
                        {msg.message}
                      </div>
                    </div>
                  ))}
                </div>

                {/* FAQ chips */}
                {messages.length <= 2 && (
                  <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                    {faqs.map((faq) => (
                      <button
                        key={faq.key}
                        onClick={() => handleFaq(faq)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-muted/50 border border-border/40 text-foreground hover:bg-accent/10 hover:border-accent/30 transition-all"
                      >
                        {faq.q}
                        <ChevronRight className="h-3 w-3 opacity-40" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <form
                  onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
                  className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-border/30 bg-card/50"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t("chat.placeholder")}
                    className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-muted/40 border border-border/30 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="shrink-0 w-10 h-10 rounded-xl bg-accent text-accent-foreground flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" strokeWidth={2.5} />
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
