import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { ArrowRight, AlertCircle, CheckCircle, Loader2, ShieldCheck, Mail, Lock, User, Building2, Phone } from "lucide-react";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  [key: string]: string;
}

export default function RegisterPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = t("validation.required") || "First name required";
    if (!formData.lastName.trim()) newErrors.lastName = t("validation.required") || "Last name required";
    if (!formData.email.trim()) newErrors.email = t("validation.required") || "Email required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = t("validation.invalid_email") || "Invalid email";
    if (!formData.password) newErrors.password = t("validation.required") || "Password required";
    else if (formData.password.length < 8) newErrors.password = t("validation.min_password") || "Password must be at least 8 characters";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = t("validation.password_mismatch") || "Passwords don't match";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await api.register({
        email: formData.email.trim(),
        password: formData.password,
        full_name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        phone: formData.phone.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate("/login?email=" + encodeURIComponent(formData.email));
      }, 2000);
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : "Registration failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,hsl(var(--success)/0.15),transparent_60%)] pointer-events-none" />
        <div className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-border rounded-3xl p-10 text-center shadow-2xl relative z-10 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-8 ring-8 ring-success/5">
            <CheckCircle className="w-10 h-10 text-success" strokeWidth={2.5} />
          </div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-foreground mb-4">
            {t("auth.register_success") || "Account Created!"}
          </h2>
          <p className="text-muted-foreground mb-10 text-lg leading-relaxed font-medium">
            {t("auth.check_email") || "Check your email to verify your account, then sign in to access your portal."}
          </p>
          <Link to="/login" className="group w-full bg-foreground text-background py-4 px-6 rounded-xl font-display font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-accent hover:text-accent-foreground transition-all shadow-xl active:scale-95">
            {t("auth.go_to_login") || "Proceed to Login"} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row relative overflow-hidden">
      {/* Visual / Branding Side */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-950 text-white flex-col justify-between p-12 overflow-hidden items-center border-r border-border">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_100%_0%,rgba(255,255,255,0.08),transparent_60%)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[radial-gradient(circle_at_0%_100%,rgba(255,255,255,0.04),transparent_50%)] pointer-events-none" />
        
        <div className="w-full relative z-10">
          <Link to="/" className="inline-flex font-display font-black text-2xl tracking-tighter text-white hover:opacity-80 transition-opacity">
            REMQUIP
          </Link>
        </div>

        <div className="relative z-10 max-w-lg w-full mt-auto mb-auto">
          <ShieldCheck className="w-16 h-16 text-white/20 mb-8" strokeWidth={1.5} />
          <h2 className="font-display text-4xl lg:text-5xl font-black uppercase tracking-tight text-white leading-tight mb-6">
            Join the Fleet Network
          </h2>
          <p className="text-zinc-400 text-lg leading-relaxed font-medium">
            Register for access to bulk pricing, detailed part schematics, and accelerated shipping parameters built for institutional operators.
          </p>
        </div>

        <div className="w-full relative z-10 flex items-center justify-between mt-auto">
          <p className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-600">Enterprise Procurement</p>
          <div className="flex gap-1">
            <div className="w-6 h-2 rounded-full bg-white/80" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
          </div>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-background relative z-10 overflow-y-auto">
        
        {/* Mobile Header (visible only on lg:hidden) */}
        <div className="lg:hidden w-full max-w-md mb-8">
           <Link to="/" className="inline-flex font-display font-black text-xl tracking-tighter text-foreground hover:opacity-80 transition-opacity mb-8">
            REMQUIP
          </Link>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-foreground leading-tight mb-2">
            {t("auth.register")}
          </h2>
          <p className="text-muted-foreground text-sm font-medium">
            {t("auth.create_account") || "Create an account to manage your supply chain."}
          </p>
        </div>

        <div className="w-full max-w-md space-y-8 my-auto">
          
          {/* Desktop Header */}
          <div className="hidden lg:block mb-8 border-b border-border/40 pb-6">
            <h2 className="font-display text-4xl font-black uppercase tracking-tight text-foreground leading-tight mb-2">
              Registration
            </h2>
            <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest font-display font-bold">
              Establish your operator profile
            </p>
          </div>

          {errors.submit && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-[3px] flex-shrink-0" strokeWidth={2.5} />
              <p className="text-sm font-medium text-destructive leading-snug">{errors.submit}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" strokeWidth={1.5} />
                </div>
                <input
                  id="firstName" type="text" name="firstName" autoComplete="off" value={formData.firstName} onChange={handleChange} placeholder="First Name" disabled={isLoading}
                  className={`peer w-full bg-card border-2 hover:border-border/80 rounded-xl py-3.5 pl-11 pr-4 text-sm font-medium text-foreground outline-none transition-all shadow-sm ${errors.firstName ? 'border-destructive focus:border-destructive' : 'border-border/60 focus:border-foreground'}`}
                />
                {errors.firstName && <p className="absolute -bottom-5 left-0 text-[10px] text-destructive font-bold uppercase tracking-wider">{errors.firstName}</p>}
              </div>

              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" strokeWidth={1.5} />
                </div>
                <input
                  id="lastName" type="text" name="lastName" autoComplete="off" value={formData.lastName} onChange={handleChange} placeholder="Last Name" disabled={isLoading}
                  className={`peer w-full bg-card border-2 hover:border-border/80 rounded-xl py-3.5 pl-11 pr-4 text-sm font-medium text-foreground outline-none transition-all shadow-sm ${errors.lastName ? 'border-destructive focus:border-destructive' : 'border-border/60 focus:border-foreground'}`}
                />
                {errors.lastName && <p className="absolute -bottom-5 left-0 text-[10px] text-destructive font-bold uppercase tracking-wider">{errors.lastName}</p>}
              </div>
            </div>

            <div className="group relative mt-6">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Building2 className="h-5 w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" strokeWidth={1.5} />
              </div>
              <input
                id="company" type="text" name="company" autoComplete="off" value={formData.company} onChange={handleChange} placeholder="Company Name (Optional)" disabled={isLoading}
                className="peer w-full bg-card border-2 border-border/60 hover:border-border/80 focus:border-foreground rounded-xl py-3.5 pl-11 pr-4 text-sm font-medium text-foreground outline-none transition-all disabled:opacity-50 shadow-sm"
              />
            </div>

            <div className="group relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" strokeWidth={1.5} />
              </div>
              <input
                id="phone" type="tel" name="phone" autoComplete="off" value={formData.phone} onChange={handleChange} placeholder="Phone Number (Optional)" disabled={isLoading}
                className="peer w-full bg-card border-2 border-border/60 hover:border-border/80 focus:border-foreground rounded-xl py-3.5 pl-11 pr-4 text-sm font-medium text-foreground outline-none transition-all disabled:opacity-50 shadow-sm"
              />
            </div>

            <div className="group relative mt-6">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" strokeWidth={1.5} />
              </div>
              <input
                id="email" type="email" name="email" autoComplete="off" value={formData.email} onChange={handleChange} placeholder="Email Address" disabled={isLoading}
                className={`peer w-full bg-card border-2 hover:border-border/80 rounded-xl py-3.5 pl-11 pr-4 text-sm font-medium text-foreground outline-none transition-all shadow-sm ${errors.email ? 'border-destructive focus:border-destructive' : 'border-border/60 focus:border-foreground'}`}
              />
              <label htmlFor="email" className="absolute -top-3 left-3 bg-background px-2 text-[10px] font-display font-black uppercase tracking-widest text-muted-foreground peer-focus:text-foreground transition-colors">
                {t("auth.email")}
              </label>
              {errors.email && <p className="absolute -bottom-5 left-0 text-[10px] text-destructive font-bold uppercase tracking-wider">{errors.email}</p>}
            </div>

            <div className="group relative mt-6">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" strokeWidth={1.5} />
              </div>
              <input
                id="password" type="password" name="password" autoComplete="new-password" value={formData.password} onChange={handleChange} placeholder="Password (Min 8 characters)" disabled={isLoading}
                className={`peer w-full bg-card border-2 hover:border-border/80 rounded-xl py-3.5 pl-11 pr-4 text-sm font-medium text-foreground outline-none transition-all shadow-sm ${errors.password ? 'border-destructive focus:border-destructive' : 'border-border/60 focus:border-foreground'}`}
              />
              <label htmlFor="password" className="absolute -top-3 left-3 bg-background px-2 text-[10px] font-display font-black uppercase tracking-widest text-muted-foreground peer-focus:text-foreground transition-colors">
                {t("auth.password")}
              </label>
              {errors.password && <p className="absolute -bottom-5 left-0 text-[10px] text-destructive font-bold uppercase tracking-wider">{errors.password}</p>}
            </div>

            <div className="group relative mt-6">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" strokeWidth={1.5} />
              </div>
              <input
                id="confirmPassword" type="password" name="confirmPassword" autoComplete="new-password" value={formData.confirmPassword} onChange={handleChange} placeholder="Confirm Password" disabled={isLoading}
                className={`peer w-full bg-card border-2 hover:border-border/80 rounded-xl py-3.5 pl-11 pr-4 text-sm font-medium text-foreground outline-none transition-all shadow-sm ${errors.confirmPassword ? 'border-destructive focus:border-destructive' : 'border-border/60 focus:border-foreground'}`}
              />
              {errors.confirmPassword && <p className="absolute -bottom-5 left-0 text-[10px] text-destructive font-bold uppercase tracking-wider">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-foreground text-background py-4 px-6 rounded-xl font-display font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent transition-all shadow-md active:scale-[0.98] mt-8"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> {t("auth.creating") || "Provisioning Access..."}
                </>
              ) : (
                <>{t("auth.register")}</>
              )}
            </button>
          </form>

          <div className="pt-8 border-t border-border/40 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {t("auth.has_account") || "Already deployed an account?"}{" "}
              <Link to="/login" className="text-foreground font-bold hover:text-accent transition-colors underline decoration-border underline-offset-4 ml-1">
                {t("auth.login")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
