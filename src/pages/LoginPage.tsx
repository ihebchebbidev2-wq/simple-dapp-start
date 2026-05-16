import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, useSearchParams, Navigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import type { User } from "@/lib/api";
import { ArrowRight, AlertCircle, Loader2, ShieldCheck, Mail, Lock } from "lucide-react";
import { RemquipLoadingScreen } from "@/components/RemquipLoadingScreen";

// Default admin role check logic
function isStaffRole(role: User["role"]): boolean {
  return role === "admin" || role === "super_admin" || role === "manager";
}

function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const p = raw.trim();
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  return p;
}

export default function LoginPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const isAdminLogin = location.pathname === "/admin/login";

  const redirectParam = safeInternalPath(searchParams.get("redirect")) ?? safeInternalPath(searchParams.get("returnUrl"));

  if (isAdminLogin && authLoading) {
    return <RemquipLoadingScreen variant="fullscreen" message="Loading secure portal..." />;
  }

  if (isAuthenticated && user) {
    if (isStaffRole(user.role)) {
      const dest = redirectParam?.startsWith("/admin") ? redirectParam : "/admin";
      return <Navigate to={dest} replace />;
    } else {
      const safeDest = (path: string | null) => (path?.startsWith("/admin") ? null : path);
      const dest = safeDest(redirectParam) || "/account";
      return <Navigate to={dest} replace />;
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!formData.email || !formData.password) {
      setError(t("auth.required_fields") || "Please provide both email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const u = await login(formData.email, formData.password);
      const fromState = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;
      const fromPath = fromState ? `${fromState.pathname}${fromState.search ?? ""}` : null;

      if (isAdminLogin) {
        if (!isStaffRole(u.role)) {
          setError(t("auth.admin_access_denied") || "Access Denied. Administrator privileges required.");
          return;
        }
        const dest = redirectParam?.startsWith("/admin") ? redirectParam : fromPath?.startsWith("/admin") ? fromPath : "/admin";
        navigate(dest, { replace: true });
        return;
      } else {
        // Staff accounts can also log in on the storefront (e.g. for testing).
        // They are simply sent to /account like regular customers.
        
        // Prevent redirecting a customer to an admin route somehow
        const safeDest = (path: string | null) => (path?.startsWith("/admin") ? null : path);
        
        const dest = safeDest(fromPath) || safeDest(redirectParam) || "/account";
        navigate(dest, { replace: true });
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please verify your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row relative overflow-hidden">
      {/* Visual / Branding Side */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-950 text-white flex-col justify-between p-12 overflow-hidden items-center border-r border-border">
        {/* Glow Effects */}
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.08),transparent_60%)] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.04),transparent_50%)] pointer-events-none" />
        
        <div className="w-full relative z-10">
          <Link to="/" className="inline-flex font-display font-black text-2xl tracking-tighter text-white hover:opacity-80 transition-opacity">
            REMQUIP
          </Link>
        </div>

        <div className="relative z-10 max-w-lg w-full mt-auto mb-auto">
          <ShieldCheck className="w-16 h-16 text-white/20 mb-8" strokeWidth={1.5} />
          <h2 className="font-display text-4xl lg:text-5xl font-black uppercase tracking-tight text-white leading-tight mb-6">
            {isAdminLogin ? "Operator Portal" : "Account Access"}
          </h2>
          <p className="text-zinc-400 text-lg leading-relaxed font-medium">
            {isAdminLogin 
              ? "Secure infrastructure restricted to authorized administrative personnel and fleet operators."
              : "Sign in to manage your vehicle inventory, trace fleet orders, and update your billing parameters."}
          </p>
        </div>

        <div className="w-full relative z-10 flex items-center justify-between mt-auto">
          <p className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-600">Secure Environment</p>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-6 h-2 rounded-full bg-white/80" />
          </div>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-background relative z-10">
        
        {/* Mobile Header (visible only on lg:hidden) */}
        <div className="lg:hidden w-full max-w-md mb-8">
           <Link to="/" className="inline-flex font-display font-black text-xl tracking-tighter text-foreground hover:opacity-80 transition-opacity mb-8">
            REMQUIP
          </Link>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-foreground leading-tight mb-2">
            {isAdminLogin ? t("auth.admin_login") : t("auth.login")}
          </h2>
          <p className="text-muted-foreground text-sm font-medium">
            {isAdminLogin ? t("auth.admin_login_description") : t("auth.login_description") || "Sign in to manage your orders."}
          </p>
        </div>

        <div className="w-full max-w-md space-y-8">
          
          {/* Desktop Header included in form flow */}
          <div className="hidden lg:block mb-10 border-b border-border/40 pb-6">
            <h2 className="font-display text-4xl font-black uppercase tracking-tight text-foreground leading-tight mb-2">
              {isAdminLogin ? "Authenticate" : "Sign In"}
            </h2>
            <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest font-display font-bold">
              {isAdminLogin ? t("auth.admin_login_description") : "Welcome back to your dashboard"}
            </p>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-[3px] flex-shrink-0" strokeWidth={2.5} />
              <p className="text-sm font-medium text-destructive leading-snug">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" strokeWidth={1.5} />
                </div>
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="off"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  disabled={isLoading}
                  className="peer w-full bg-card border-2 border-border/60 hover:border-border/80 focus:border-foreground rounded-xl py-4 pl-12 pr-4 text-sm font-medium text-foreground outline-none transition-all disabled:opacity-50 shadow-sm"
                />
                <label htmlFor="email" className="absolute -top-3 left-3 bg-background px-2 text-[10px] font-display font-black uppercase tracking-widest text-muted-foreground peer-focus:text-foreground transition-colors">
                  {t("auth.email")}
                </label>
              </div>

              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" strokeWidth={1.5} />
                </div>
                <input
                  id="password"
                  type="password"
                  name="password"
                  autoComplete="off"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="peer w-full bg-card border-2 border-border/60 hover:border-border/80 focus:border-foreground rounded-xl py-4 pl-12 pr-4 text-sm font-medium text-foreground outline-none transition-all disabled:opacity-50 shadow-sm"
                />
                <label htmlFor="password" className="absolute -top-3 left-3 bg-background px-2 text-[10px] font-display font-black uppercase tracking-widest text-muted-foreground peer-focus:text-foreground transition-colors">
                  {t("auth.password")}
                </label>
                <Link to="/forgot-password" className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center z-10">
                  {t("auth.forgot")}
                </Link>
              </div>

            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="group w-full bg-foreground text-background py-4 px-6 rounded-xl font-display font-black text-sm uppercase tracking-widest flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent transition-all shadow-md active:scale-[0.98] mt-8"
            >
              {isLoading ? (
                <span className="flex items-center gap-3 w-full justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" /> Authenticating...
                </span>
              ) : (
                <>
                  <span>{isAdminLogin ? t("auth.admin_login") : t("auth.login")}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="pt-8 border-t border-border/40 flex flex-col items-center justify-center gap-4">
            {isAdminLogin ? (
              <Link to="/login" className="text-xs font-display font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 rotate-180" /> {t("auth.store_sign_in")}
              </Link>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">
                {t("auth.no_account") || "Don't have an account?"}{" "}
                <Link to="/register" className="text-foreground font-bold hover:text-accent transition-colors underline decoration-border underline-offset-4 ml-1">
                  {t("auth.register")}
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
