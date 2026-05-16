import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Truck, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface AnnouncementBarProps {
  announcement: string;
  announcementHref?: string;
  announcementLinkLabel?: string;
  trustChips?: string[];
  headerEditLink?: React.ReactNode;
}

export function AnnouncementBar({
  announcement,
  announcementHref,
  announcementLinkLabel,
  trustChips = [],
  headerEditLink,
}: AnnouncementBarProps) {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(true);

  if (!announcement || !isVisible) return null;

  return (
    <div className="bg-[#1f354d] text-white relative overflow-hidden transition-all duration-300 ease-in-out border-b border-white/5" role="region" aria-label={t("nav.announcement")}>
      {/* Decorative gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-accent/20 via-transparent to-accent/10 opacity-70 pointer-events-none" />
      
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between py-2 sm:py-2.5">
          {/* Main text centered on mobile, left on desktop */}
          <div className="flex flex-1 items-center justify-center sm:justify-start gap-2 text-[11px] sm:text-xs text-background/95">
            <Truck className="h-3.5 w-3.5 text-accent shrink-0 hidden sm:inline-block drop-shadow-sm" aria-hidden />
            <span className="font-semibold tracking-wide drop-shadow-sm">{announcement}</span>
            {announcementHref && announcementLinkLabel && (
              <span className="hidden sm:inline-block text-background/50 mx-1">•</span>
            )}
            {announcementHref && announcementLinkLabel && (
              <Link
                to={announcementHref}
                className="text-accent hover:text-accent-foreground font-bold hover:underline underline-offset-4 decoration-2 inline-flex items-center gap-1 transition-colors group"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.1)" }}
              >
                {announcementLinkLabel}
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            )}
          </div>
          
          {/* Action chips and close right aligned */}
          <div className="flex items-center gap-3 shrink-0">
            {trustChips.length > 0 && (
              <div className="hidden md:flex items-center gap-2">
                {trustChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-background/90 backdrop-blur-sm border border-white/5"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
            {headerEditLink && (
              <div className="hidden sm:block">
                {headerEditLink}
              </div>
            )}
            {/* Close button */}
            <button
              onClick={() => setIsVisible(false)}
              className="p-1 -mr-2 rounded-full text-background/60 hover:text-background hover:bg-white/10 transition-colors ml-2"
              aria-label={t("close")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
