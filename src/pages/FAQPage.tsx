import React, { useState } from "react";
import { ChevronDown, ChevronRight, HelpCircle, Search, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePublicSettings } from "@/hooks/useApi";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FAQItem[] = [
  // Ordering
  {
    category: "Ordering",
    question: "How do I place an order?",
    answer: "Browse our product catalog, add items to your cart, and proceed to checkout. You can pay via credit card or request a purchase order if you have an approved wholesale account.",
  },
  {
    category: "Ordering",
    question: "What is the minimum order quantity?",
    answer: "There is no minimum order for retail customers. Wholesale and fleet accounts may have specific minimums based on their pricing tier — contact our sales team for details.",
  },
  {
    category: "Ordering",
    question: "Can I modify or cancel my order after placing it?",
    answer: "You can modify or cancel your order within 1 hour of placement by contacting our support team. Once an order enters processing, changes may not be possible.",
  },

  // Shipping
  {
    category: "Shipping",
    question: "What are your shipping options?",
    answer: "We offer standard shipping (5-7 business days), express shipping (2-3 business days), and next-day delivery for in-stock items within select Canadian provinces. Freight shipping is available for large orders.",
  },
  {
    category: "Shipping",
    question: "Do you ship internationally?",
    answer: "Currently we ship across Canada and to the continental United States. For international inquiries, please contact our sales team for a custom quote.",
  },
  {
    category: "Shipping",
    question: "How can I track my order?",
    answer: "Once your order ships, you'll receive a tracking number via email. You can also check your order status in your account dashboard under 'My Orders'.",
  },

  // Returns & Warranty
  {
    category: "Returns & Warranty",
    question: "What is your return policy?",
    answer: "We accept returns within 30 days of delivery for unused items in original packaging. A restocking fee of 15% may apply. Defective items can be returned at no cost.",
  },
  {
    category: "Returns & Warranty",
    question: "Do your products come with a warranty?",
    answer: "Yes, all products carry a minimum 12-month manufacturer warranty against defects. Some items carry extended warranties — check the product detail page for specifics.",
  },

  // Account & Wholesale
  {
    category: "Account & Wholesale",
    question: "How do I apply for a wholesale account?",
    answer: "Visit our Account Application page to submit your business details. Our team reviews applications within 2 business days. Approved accounts get access to fleet pricing and net payment terms.",
  },
  {
    category: "Account & Wholesale",
    question: "What are the benefits of a wholesale account?",
    answer: "Wholesale accounts receive tiered volume pricing, dedicated account management, priority shipping, net-30 payment terms, and access to exclusive inventory.",
  },

  // Products
  {
    category: "Products",
    question: "How do I find the right part for my vehicle?",
    answer: "Use our search bar to look up by part number, OEM cross-reference, or description. You can also browse by category or contact our technical team for assistance.",
  },
  {
    category: "Products",
    question: "Are your parts OEM-compatible?",
    answer: "Yes. All our parts meet or exceed OEM specifications and are tested for compatibility with major North American heavy-duty truck and trailer brands.",
  },
];

export default function FAQPage() {
  const { t } = useLanguage();
  const { data: pubRes } = usePublicSettings();
  const pub = (pubRes?.data ?? {}) as Record<string, string>;
  const contactEmail = pub.contact_email || "info@remquip.ca";
  const contactPhone = pub.contact_phone || "(514) 359-3366";

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = [...new Set(FAQ_DATA.map((f) => f.category))];

  const filtered = FAQ_DATA.filter((item) => {
    const matchesSearch =
      !searchQuery.trim() ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !activeCategory || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const toggle = (idx: number) => setOpenIndex(openIndex === idx ? null : idx);

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="bg-muted/30 border-b border-border">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-6">
            <HelpCircle className="h-8 w-8 text-accent" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground mb-4">
            {t("footer.faq") || "FAQ"}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            Find answers to common questions about ordering, shipping, returns, and wholesale accounts.
          </p>

          {/* Search */}
          <div className="mt-8 max-w-md mx-auto relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions…"
              className="w-full pl-11 pr-4 py-3.5 text-sm rounded-xl bg-card border border-border/60 hover:border-border outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all font-medium placeholder:text-muted-foreground/60"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border ${
              !activeCategory
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border ${
                activeCategory === cat
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-3">
          {filtered.map((item, idx) => {
            const globalIdx = FAQ_DATA.indexOf(item);
            const isOpen = openIndex === globalIdx;
            return (
              <div
                key={globalIdx}
                className={`bg-card border rounded-xl overflow-hidden transition-all ${
                  isOpen ? "border-accent/30 shadow-md" : "border-border/60 hover:border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(globalIdx)}
                  className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-accent bg-accent/10 px-2 py-1 rounded shrink-0 mt-0.5">
                      {item.category.split(" ")[0]}
                    </span>
                    <span className="font-display font-bold text-sm sm:text-base text-foreground leading-snug">
                      {item.question}
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180 text-accent" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-0 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="pl-0 sm:pl-[calc(2rem+12px)] border-t border-border/40 pt-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-display font-bold text-lg mb-2 text-foreground">No matching questions</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Try a different search term or{" "}
              <button onClick={() => { setSearchQuery(""); setActiveCategory(null); }} className="text-accent font-semibold hover:underline">
                clear filters
              </button>
            </p>
          </div>
        )}

        {/* Contact CTA */}
        <div className="mt-14 bg-card border border-border/60 rounded-2xl p-8 sm:p-10 text-center">
          <h3 className="font-display font-black text-xl uppercase tracking-tight text-foreground mb-3">
            Still have questions?
          </h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Our technical support team is here to help with parts compatibility, order issues, and wholesale inquiries.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-lg font-display font-bold text-xs uppercase tracking-widest hover:bg-accent hover:text-accent-foreground transition-all active:scale-[0.98]"
            >
              <Mail className="h-4 w-4" /> Contact Us
            </Link>
            <a
              href={`tel:${contactPhone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-2 bg-card border border-border px-6 py-3 rounded-lg font-display font-bold text-xs uppercase tracking-widest text-foreground hover:bg-muted transition-all"
            >
              <Phone className="h-4 w-4" /> {contactPhone}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
