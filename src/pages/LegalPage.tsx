import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface LegalPageProps {
  titleKey: string;
  contentKey: string;
}

export default function LegalPage({ titleKey, contentKey }: LegalPageProps) {
  const { t } = useLanguage();

  const paragraphs = t(contentKey).split("\n\n");

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="font-display text-3xl font-bold mb-8">{t(titleKey)}</h1>
      <div className="space-y-4">
        {paragraphs.map((paragraph, i) => (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground">{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
