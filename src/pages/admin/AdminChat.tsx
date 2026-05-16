import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Search, Send, Trash2, X, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "@/config/constants";
import { useConfirm } from "@/components/ConfirmDialog";
import { useLanguage } from "@/contexts/LanguageContext";

/* ── Types ── */
interface Conversation {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  language: string;
  status: "open" | "closed";
  message_count: number;
  last_message: string | null;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  sender_type: "visitor" | "admin";
  sender_name: string | null;
  message: string;
  is_predefined: number;
  created_at: string;
}

/* ── API helper ── */
const adminApi = async (path: string, opts?: RequestInit, extraParams?: Record<string, string>) => {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const token = localStorage.getItem("remquip_admin_token") ?? localStorage.getItem("remquip_auth_token") ?? "";
  const params = new URLSearchParams({ path });
  if (token) params.set("token", token);
  if (extraParams) {
    Object.entries(extraParams).forEach(([k, v]) => params.set(k, v));
  }
  const res = await fetch(`${base}/remquip-api.php?${params}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}`, "X-Auth-Token": token } : {}),
    },
    ...opts,
  });
  return res.json();
};

export default function AdminChat() {
  const confirmAction = useConfirm();
  const { t } = useLanguage();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "open" | "closed">("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const extraParams: Record<string, string> = {};
      if (statusFilter) extraParams.status = statusFilter;
      if (search.trim()) extraParams.search = search.trim();
      const res = await adminApi("chat", undefined, Object.keys(extraParams).length ? extraParams : undefined);
      const items = res?.data?.items ?? res?.data ?? [];
      setConversations(Array.isArray(items) ? items : []);
    } catch { setConversations([]); }
    setLoading(false);
  };

  useEffect(() => { loadConversations(); }, [statusFilter]);

  const loadMessages = async (convId: string) => {
    setSelected(convId);
    try {
      const res = await adminApi(`chat/${convId}`);
      setMessages(res?.data?.messages ?? []);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
    } catch { setMessages([]); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    try {
      await adminApi(`chat/${selected}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: reply, sender_name: "Support" }),
      });
      setReply("");
      await loadMessages(selected);
    } catch { /* */ }
    setSending(false);
  };

  const updateStatus = async (convId: string, status: "open" | "closed") => {
    await adminApi(`chat/${convId}`, { method: "PATCH", body: JSON.stringify({ status }) });
    loadConversations();
    if (selected === convId) loadMessages(convId);
  };

  const deleteConversation = async (convId: string) => {
    const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_conversation"), variant: "danger" });
    if (!ok) return;
    await adminApi(`chat/${convId}`, { method: "DELETE" });
    if (selected === convId) { setSelected(null); setMessages([]); }
    loadConversations();
  };

  const selectedConv = conversations.find((c) => c.id === selected);
  const openCount = conversations.filter((c) => c.status === "open").length;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-accent" />
          <h1 className="font-display font-bold text-xl tracking-tight">Chat Inbox</h1>
          {openCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-accent text-accent-foreground">{openCount} open</span>
          )}
        </div>
        <button onClick={loadConversations} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Split pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: conversation list */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col bg-muted/20">
          <div className="p-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border/50">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadConversations()}
                placeholder="Search name/email..."
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex gap-1 mt-2">
              {(["", "open", "closed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                    statusFilter === s ? "bg-foreground text-background" : "hover:bg-muted"
                  }`}
                >
                  {s || "All"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-center text-sm text-muted-foreground py-8">Loading...</p>
            ) : conversations.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No conversations</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadMessages(conv.id)}
                  className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-muted/50 transition-colors ${
                    selected === conv.id ? "bg-accent/10 border-l-2 border-l-accent" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm truncate">{conv.visitor_name || "Anonymous"}</span>
                    <span className={`text-[10px] font-black uppercase ${conv.status === "open" ? "text-green-500" : "text-muted-foreground"}`}>
                      {conv.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{conv.last_message || "—"}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">{conv.visitor_email || ""}</span>
                    <span className="text-[10px] text-muted-foreground">{conv.message_count} msgs</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: message thread */}
        <div className="flex-1 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border bg-card/50">
                <div>
                  <p className="font-bold text-sm">{selectedConv?.visitor_name || "Anonymous"}</p>
                  <p className="text-xs text-muted-foreground">{selectedConv?.visitor_email} · {selectedConv?.language?.toUpperCase()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateStatus(selected, selectedConv?.status === "open" ? "closed" : "open")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                      selectedConv?.status === "open"
                        ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {selectedConv?.status === "open" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    {selectedConv?.status === "open" ? "Close" : "Reopen"}
                  </button>
                  <button
                    onClick={() => deleteConversation(selected)}
                    className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_type === "admin" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.sender_type === "admin"
                          ? "bg-accent text-accent-foreground rounded-br-md"
                          : "bg-muted/60 text-foreground border border-border/30 rounded-bl-md"
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60">
                        {msg.sender_type === "admin" ? "You" : msg.sender_name || "Visitor"}
                      </p>
                      {msg.message}
                      <p className="text-[9px] opacity-40 mt-1">{new Date(msg.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply input */}
              <form
                onSubmit={(e) => { e.preventDefault(); sendReply(); }}
                className="shrink-0 flex items-center gap-3 px-6 py-4 border-t border-border bg-card/50"
              >
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-muted/40 border border-border/30 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <button
                  type="submit"
                  disabled={!reply.trim() || sending}
                  className="shrink-0 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground font-bold text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <Send className="h-4 w-4" />
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
