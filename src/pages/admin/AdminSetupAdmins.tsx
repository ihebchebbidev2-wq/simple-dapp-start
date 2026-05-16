import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import type { AdminSignupRequest } from "@/lib/api";

const ADMIN_SETUP_KEY = "remquip_admin_setup_default";

export default function AdminSetupAdmins() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState<AdminSignupRequest>({
    email: "",
    password: "",
    full_name: "",
    phone: "",
  });

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.email || !form.password || !form.full_name) {
      setError(t("auth.required_fields") || "Email, password, and name are required");
      return;
    }

    setIsLoading(true);
    try {
      await api.adminSignup(
        {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          phone: form.phone?.trim() || undefined,
        },
        ADMIN_SETUP_KEY
      );

      await login(form.email.trim(), form.password);
      navigate("/admin", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Admin creation failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold mb-2">{t("auth.admin_login") || "Create Admin"}</h1>
          <p className="text-muted-foreground text-sm">
            {t("auth.admin_login_description") || "Create an admin account with full access."}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-sm flex items-start gap-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">{t("auth.email")}</label>
            <input
              type="email"
              name="email"
              autoComplete="off"
              value={form.email}
              onChange={handleChange}
              placeholder="admin@example.com"
              disabled={isLoading}
              className="w-full border border-border rounded-sm px-3 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            <input
              type="text"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              placeholder="Your admin name"
              disabled={isLoading}
              className="w-full border border-border rounded-sm px-3 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t("auth.password")}</label>
            <input
              type="password"
              name="password"
              autoComplete="off"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              disabled={isLoading}
              className="w-full border border-border rounded-sm px-3 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone (optional)</label>
            <input
              type="tel"
              name="phone"
              value={form.phone ?? ""}
              onChange={handleChange}
              placeholder="+1-555-0100"
              disabled={isLoading}
              className="w-full border border-border rounded-sm px-3 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-accent py-2.5 rounded-sm font-semibold uppercase tracking-wide flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (t("auth.signing_in") || "Working...") : "Create Admin"}
          </button>
        </form>
      </div>
    </div>
  );
}

