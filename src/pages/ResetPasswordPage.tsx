import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { Loader2, ArrowLeft, Lock, ChevronRight, ShieldCheck } from "lucide-react";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      showErrorToast(t("auth.reset_missing_token"));
      return;
    }
    if (password.length < 8) {
      showErrorToast(t("validation.min_password"));
      return;
    }
    if (password !== confirm) {
      showErrorToast(t("validation.password_mismatch"));
      return;
    }
    setIsLoading(true);
    try {
      await api.resetPassword(token, password);
      showSuccessToast(t("auth.reset_done"));
      navigate("/login", { replace: true });
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : t("auth.reset_error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-[80vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--accent)/0.03),transparent_40%)] pointer-events-none" />
      
      <div className="w-full max-w-lg bg-card border border-border/80 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl pointer-events-none" />
        
        <header className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-6 bg-accent/40" />
            <span className="font-display font-black uppercase tracking-[0.3em] text-[10px] text-accent"> Security Override </span>
            <div className="h-px w-6 bg-accent/40" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tighter text-foreground mb-4">
            {t("auth.reset_password")}
          </h1>
          <p className="text-muted-foreground font-medium text-sm leading-relaxed max-w-xs mx-auto">
            {t("auth.reset_password_hint")}
          </p>
          {!token && (
            <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-xs font-bold text-destructive uppercase tracking-wide">
                Critical: Secret Token Missing from Request
            </div>
          )}
        </header>

        <form className="space-y-8 relative z-10" onSubmit={handleSubmit}>
          <div className="group relative">
            <label className="absolute -top-3 left-4 bg-card px-2 text-[10px] font-display font-black uppercase tracking-widest text-muted-foreground group-focus-within:text-accent transition-colors z-10">
                {t("auth.new_password")}
            </label>
            <div className="relative">
                <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full bg-transparent border-2 border-border/60 hover:border-border rounded-xl px-4 py-4 pl-12 text-sm font-medium text-foreground outline-none focus:border-accent transition-all shadow-sm"
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="group relative">
            <label className="absolute -top-3 left-4 bg-card px-2 text-[10px] font-display font-black uppercase tracking-widest text-muted-foreground group-focus-within:text-accent transition-colors z-10">
                {t("auth.confirm_password")}
            </label>
            <div className="relative">
                <input
                    type="password"
                    name="confirm"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full bg-transparent border-2 border-border/60 hover:border-border rounded-xl px-4 py-4 pl-12 text-sm font-medium text-foreground outline-none focus:border-accent transition-all shadow-sm"
                />
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !token}
            className="group w-full bg-foreground text-background py-5 px-8 rounded-xl font-display font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-between disabled:opacity-50 hover:bg-accent hover:shadow-xl transition-all active:scale-[0.98]"
          >
            {isLoading ? (
                <span className="flex items-center gap-3"><Loader2 className="h-4 w-4 animate-spin" /> SYNCHRONIZING...</span>
            ) : (
                <>
                    <span>Confirm Security Update</span>
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
                </>
            )}
          </button>
          
          <div className="text-center pt-4">
            <Link to="/login" className="inline-flex items-center gap-2 text-xs font-display font-black uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors group">
              <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
              {t("auth.back_to_login")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
