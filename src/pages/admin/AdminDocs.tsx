import React, { useState } from "react";
import {
  BookOpen, ChevronDown, ChevronRight, Search,
  LayoutDashboard, Package, Warehouse, ShoppingBag, ShoppingCart, Users, FileText,
  BarChart3, Settings, Tag, Shield, Layers, LayoutTemplate, Phone, MessageCircle,
  Receipt, Globe, ShoppingCart as CartIcon, UserPlus, Percent, FileCheck,
  HelpCircle, Truck, CreditCard, Mail, Lock, Image, Palette,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

/* ── Documentation data ── */

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  items: DocItem[];
}

interface DocItem {
  title: string;
  path?: string;
  description: string;
  details: string[];
  tips?: string[];
}

const docs: DocSection[] = [
  {
    id: "overview",
    title: "Dashboard & Analytics",
    icon: LayoutDashboard,
    description: "Your command center — see how your business is doing at a glance.",
    items: [
      {
        title: "Overview (Dashboard)",
        path: "/admin",
        description: "The main dashboard shows a summary of your store's performance.",
        details: [
          "See today's orders, revenue, and new customers",
          "Quick stats cards with trends (up/down arrows)",
          "Recent orders list so you can jump straight to them",
          "Low-stock alerts if any products need restocking",
        ],
        tips: ["Check this page every morning to stay on top of things."],
      },
      {
        title: "Analytics",
        path: "/admin/analytics",
        description: "Deeper insights into your sales, traffic, and customer behavior.",
        details: [
          "Revenue charts over time (daily, weekly, monthly)",
          "Top-selling products and categories",
          "Customer acquisition trends",
          "Export data as needed for reports",
        ],
      },
    ],
  },
  {
    id: "catalog",
    title: "Catalog Management",
    icon: Package,
    description: "Everything about your products, categories, and stock levels.",
    items: [
      {
        title: "Products",
        path: "/admin/products",
        description: "Add, edit, and manage all your products.",
        details: [
          "Create new products with name, SKU, price, description, and images",
          "Edit existing products — changes go live immediately",
          "Upload multiple product images (drag & drop supported)",
          "Set products as active/inactive to show or hide them from the store",
          "View detailed product info and change history in the logs",
        ],
        tips: [
          "Always add a clear product image — it boosts sales!",
          "Use the SKU field for your internal reference numbers.",
        ],
      },
      {
        title: "Categories",
        path: "/admin/categories",
        description: "Organize products into browsable categories.",
        details: [
          "Create categories with names in English, French, and Spanish",
          "Set display order to control how they appear in the store navigation",
          "Assign products to categories for easy browsing",
          "Category images show up on the storefront navigation bar",
        ],
      },
      {
        title: "Inventory",
        path: "/admin/inventory",
        description: "Track stock levels and avoid running out.",
        details: [
          "See current stock for every product at a glance",
          "Update quantities when new stock arrives",
          "Set minimum stock thresholds — you'll get alerts when stock is low",
          "Bulk update stock levels to save time",
        ],
        tips: ["Set minimum stock to at least 5 units for popular items to avoid stockouts."],
      },
    ],
  },
  {
    id: "sales",
    title: "Sales & Orders",
    icon: ShoppingBag,
    description: "Manage customer orders, quotes, carts, and pricing.",
    items: [
      {
        title: "Orders",
        path: "/admin/orders",
        description: "View and manage all customer orders.",
        details: [
          "See all orders with status (pending, confirmed, shipped, delivered)",
          "Click any order to see full details: items, customer info, shipping address",
          "Update order status (e.g., mark as shipped)",
          "View payment status and Stripe transaction details",
          "Print or download invoices, quotes, and delivery slips",
          "Tax breakdown is automatically calculated using your configured tax rates",
        ],
        tips: ["Use the status filter to quickly find orders that need attention."],
      },
      {
        title: "Offers / Quotes",
        path: "/admin/offers",
        description: "Create and manage price quotes for customers.",
        details: [
          "Create custom offers with specific products and pricing",
          "Send quotes to customers via email",
          "Track offer status: draft, sent, accepted, declined",
          "Convert accepted offers directly into orders",
          "Add discount amounts and custom notes",
          "Digital signature support — customers can sign offers online",
        ],
      },
      {
        title: "Abandoned Carts",
        path: "/admin/carts",
        description: "See carts that customers started but didn't finish.",
        details: [
          "View what products customers added but didn't buy",
          "See customer email if they were logged in",
          "Identify patterns — maybe a product's price is too high",
          "Useful for follow-up email campaigns",
        ],
      },
      {
        title: "Customers",
        path: "/admin/customers",
        description: "Your customer database with contact info and order history.",
        details: [
          "Search customers by name, email, or company",
          "View each customer's order history and total spend",
          "See customer category (retail, wholesale, etc.)",
          "Edit customer details and contact information",
        ],
      },
      {
        title: "Applications",
        path: "/admin/applications",
        description: "Review and approve new account applications.",
        details: [
          "Wholesale and business customers can apply for accounts",
          "Review application details: company name, tax number, references",
          "Approve or reject applications",
          "Download application PDFs for your records",
        ],
      },
      {
        title: "Discounts",
        path: "/admin/discounts",
        description: "Create discount codes and special pricing.",
        details: [
          "Create percentage or fixed-amount discount codes",
          "Set start and end dates for promotions",
          "Limit usage per customer or total uses",
          "Track how many times each code has been used",
        ],
      },
    ],
  },
  {
    id: "finance",
    title: "Finance & Taxes",
    icon: Receipt,
    description: "Configure tax rates for Canadian provinces and territories.",
    items: [
      {
        title: "Tax Rates",
        path: "/admin/tax-rates",
        description: "Set up and manage all your tax rates (GST, QST, HST, PST, etc.).",
        details: [
          "Add as many tax rates as you need — perfect for Canadian multi-tax",
          "Default setup includes GST (5%) and QST (9.975%) for Quebec",
          "Each tax has multilingual labels (English, French, Spanish) for reports",
          "Toggle taxes active/inactive without deleting them",
          "Compound tax option: calculates tax on top of subtotal + previous taxes",
          "Tax rates automatically apply to cart, checkout, orders, offers, and all reports/PDFs",
          "Change display order to control how taxes appear on invoices",
        ],
        tips: [
          "Ontario uses HST (13%) instead of GST+QST — just add one HST rate.",
          "Alberta only has GST (5%) — deactivate QST if you're in Alberta.",
        ],
      },
    ],
  },
  {
    id: "content",
    title: "Content & Design",
    icon: LayoutTemplate,
    description: "Control what your storefront looks like and what it says.",
    items: [
      {
        title: "Landing Page",
        path: "/admin/landing",
        description: "Customize your store's home page hero section.",
        details: [
          "Change the hero title, subtitle, and call-to-action buttons",
          "Upload a custom hero image or set up a carousel of images",
          "Choose between 'spotlight' (full-width image) and 'split' (text + image) layouts",
          "Add secondary info items (free shipping, bulk pricing, etc.)",
          "All changes preview in real-time",
        ],
      },
      {
        title: "CMS (Content Pages)",
        path: "/admin/cms",
        description: "Edit content on other pages like About, Contact, Legal, etc.",
        details: [
          "Edit page sections with a simple text editor",
          "Upload banners and images for each page",
          "Content supports multiple languages — edit EN, FR, ES versions",
          "Changes save instantly and appear on the public site",
        ],
      },
    ],
  },
  {
    id: "system",
    title: "System & Administration",
    icon: Settings,
    description: "User management, security, communication, and store settings.",
    items: [
      {
        title: "Admin Users",
        path: "/admin/users",
        description: "Manage who has access to this admin panel.",
        details: [
          "Add new admin users with different roles (Admin, Manager)",
          "Admins have full access to everything",
          "Managers have limited access (orders, customers, inventory — but not settings or users)",
          "Deactivate users without deleting their account",
        ],
      },
      {
        title: "Admin Contacts",
        path: "/admin/admin-contacts",
        description: "Manage the contact persons shown on the admin side.",
        details: [
          "Add team members with name, role, phone, and email",
          "These contacts can be shown to customers or used internally",
        ],
      },
      {
        title: "Access Control",
        path: "/admin/access",
        description: "Fine-tune which pages each user can view, edit, or delete.",
        details: [
          "Grant or revoke access per page per user",
          "Three permission levels: View, Edit, Delete",
          "Useful when you want a user to see orders but not change them",
        ],
      },
      {
        title: "Chat Inbox",
        path: "/admin/chat",
        description: "Respond to live chat messages from website visitors.",
        details: [
          "See all conversations from your website's chat widget",
          "Reply to visitors in real-time",
          "Close resolved conversations",
          "Unread message count shows in the sidebar",
          "Automatic toast notifications when new messages arrive",
        ],
      },
      {
        title: "Settings",
        path: "/admin/settings",
        description: "General store configuration, email, and shipping.",
        details: [
          "Store name, contact email, phone, and address",
          "Default currency and language",
          "Shipping: set free shipping threshold and flat shipping rate",
          "Email notifications: configure SMTP (OVH), toggle which emails are sent",
          "Supported locales for multilingual content",
          "File registry for uploaded documents",
        ],
        tips: [
          "The legacy GST/QST fields in Settings are for backward compatibility — use the Tax Rates page instead.",
        ],
      },
    ],
  },
  {
    id: "storefront",
    title: "Customer-Facing Pages",
    icon: Globe,
    description: "What your customers see when they visit your store.",
    items: [
      {
        title: "Home Page",
        description: "The landing page with hero banner, featured products, and calls to action.",
        details: [
          "Hero section is controlled from Admin → Landing",
          "Content sections come from CMS",
          "Dynamically themed — colors come from Landing Theme settings",
        ],
      },
      {
        title: "Products & Search",
        path: "/products",
        description: "Customers browse and search your catalog.",
        details: [
          "Product grid with images, names, prices, and SKUs",
          "Filter by category using the top navigation strip",
          "Search by product name or SKU",
          "Click a product to see full details, images, and add to cart",
        ],
      },
      {
        title: "Cart & Checkout",
        path: "/cart",
        description: "Customers review their cart and complete their purchase.",
        details: [
          "Cart shows all items with quantities and line totals",
          "Individual tax lines displayed (GST, QST, etc.) from your configured rates",
          "Shipping calculated automatically based on your settings",
          "Discount codes can be applied at checkout",
          "Payment processed securely through Stripe",
        ],
      },
      {
        title: "Customer Account",
        description: "Logged-in customers can manage their account.",
        details: [
          "View order history and track shipments",
          "Update profile and contact information",
          "Apply for wholesale/business accounts",
          "Sign offers and quotes digitally",
        ],
      },
      {
        title: "Contact Page",
        path: "/contact",
        description: "Customers can reach you via the contact form or live chat.",
        details: [
          "Contact form sends you an email notification",
          "Live chat widget available on every page",
          "Interactive map showing your location (configurable)",
          "Phone number and email displayed",
        ],
      },
    ],
  },
];

/* ── FAQ data ── */

interface FaqItem {
  question: string;
  answer: string;
  link?: string;
}

const faqs: FaqItem[] = [
  {
    question: "How do I add a new product?",
    answer: "Go to Products, click 'Add Product' (or 'New'), fill in the name, SKU, price, description, and upload at least one image. Hit Save and your product will appear in the store immediately.",
    link: "/admin/products",
  },
  {
    question: "How do I change tax rates?",
    answer: "Go to Tax Rates under the Finance section. You can edit existing rates (GST, QST), add new ones (like HST or PST), toggle them active/inactive, and set compound calculations. Changes apply automatically to the cart, checkout, and all reports.",
    link: "/admin/tax-rates",
  },
  {
    question: "How do I create a quote / offer for a customer?",
    answer: "Go to Offers, click 'New Offer'. Search and add products, set quantities and prices, add any discount, then save. You can email it to the customer, and they can sign it digitally. Once accepted, convert it to an order with one click.",
    link: "/admin/offers",
  },
  {
    question: "How do I mark an order as shipped?",
    answer: "Go to Orders, click the order you want to update, then click the 'Mark as Shipped' button or change the status dropdown to 'Shipped'. The customer will receive an email notification if email notifications are enabled in Settings.",
    link: "/admin/orders",
  },
  {
    question: "How do I add a new admin user?",
    answer: "Go to Admin Users, click 'Add User'. Enter their name, email, and password, and choose their role: Admin (full access) or Manager (limited access — no settings, users, or CMS). You can fine-tune per-page permissions in Access Control.",
    link: "/admin/users",
  },
  {
    question: "How do I change what's on the home page?",
    answer: "Go to Landing to change the hero section (title, subtitle, buttons, images). For other page content and banners, use CMS. Changes are instant — no need to publish or deploy.",
    link: "/admin/landing",
  },
  {
    question: "How do I add or edit categories?",
    answer: "Go to Categories, click 'Add Category' or edit an existing one. Set the name in each language (EN/FR/ES), upload a category image, and set the display order. Products can be assigned to categories from the product edit page.",
    link: "/admin/categories",
  },
  {
    question: "How do I handle low stock?",
    answer: "Go to Inventory to see stock levels at a glance. Set a 'minimum stock' threshold for each product — you'll get alerts on the dashboard when stock falls below that level. Update quantities when new shipments arrive.",
    link: "/admin/inventory",
  },
  {
    question: "How do I create a discount code?",
    answer: "Go to Discounts, click 'Add Discount'. Choose percentage or fixed amount, enter the code customers will use, set optional start/end dates and usage limits. The code will work automatically at checkout.",
    link: "/admin/discounts",
  },
  {
    question: "How do I respond to a chat message?",
    answer: "Go to Chat Inbox, click the conversation, type your reply, and hit Send. You'll see a notification badge and toast alert when new messages arrive. Close resolved conversations to keep your inbox tidy.",
    link: "/admin/chat",
  },
  {
    question: "How do I change the store name, email, or shipping rates?",
    answer: "Go to Settings. The General section has store name, contact info, currency, and language. Tax & Shipping has the shipping threshold and flat rate. Email Notifications lets you configure SMTP and toggle which emails are sent.",
    link: "/admin/settings",
  },
  {
    question: "Can I switch the admin panel to French or Spanish?",
    answer: "Yes! Click the language/globe icon in the top-right corner of the admin header. The entire admin interface, navigation, and labels will switch to your selected language. Content (products, descriptions) is managed separately per language.",
  },
  {
    question: "How do taxes work for different Canadian provinces?",
    answer: "Go to Tax Rates and configure for your province. Quebec uses GST (5%) + QST (9.975%). Ontario uses HST (13%) — just add one rate. Alberta only has GST (5%). BC uses GST (5%) + PST (7%). You can add as many rates as needed, and toggle them active/inactive.",
    link: "/admin/tax-rates",
  },
  {
    question: "How do I print an invoice or delivery slip?",
    answer: "Open any order or offer, then click the 'Print / PDF' or report icon. Choose the document type (Invoice, Quote, or Delivery Slip), select the language, and it will generate a professional PDF with your company info, tax breakdown, and all line items.",
  },
  {
    question: "What's the difference between Admin and Manager roles?",
    answer: "Admins have full access to everything including settings, user management, CMS, and tax configuration. Managers can manage orders, customers, inventory, and discounts but cannot access settings, user management, analytics, CMS, or tax rates.",
  },
];

/* ── Components ── */

function SectionAccordion({ section }: { section: DocSection }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;

  return (
    <div className="dashboard-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 text-left py-1 group"
      >
        <div className="stat-icon stat-icon--accent shrink-0">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-sm uppercase tracking-wider">{section.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          {section.items.map((item) => (
            <DocItemCard key={item.title} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocItemCard({ item }: { item: DocItem }) {
  return (
    <div className="rounded-xl bg-muted/30 border border-border/50 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-display font-bold text-sm">{item.title}</h4>
        {item.path && (
          <a
            href={item.path}
            className="text-[10px] font-bold uppercase tracking-wider text-accent hover:underline shrink-0"
          >
            Go →
          </a>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
      <ul className="space-y-1.5">
        {item.details.map((d, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            <span>{d}</span>
          </li>
        ))}
      </ul>
      {item.tips && item.tips.length > 0 && (
        <div className="mt-3 rounded-lg bg-accent/5 border border-accent/20 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent mb-1">💡 Tip</p>
          {item.tips.map((tip, i) => (
            <p key={i} className="text-xs text-foreground/80">{tip}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function FaqAccordionItem({ faq }: { faq: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 text-left py-4 px-1 group"
      >
        <HelpCircle className="h-4 w-4 text-accent shrink-0" />
        <span className="flex-1 text-sm font-medium">{faq.question}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="pb-4 pl-8 pr-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
          {faq.link && (
            <a href={faq.link} className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-accent hover:underline">
              Go to this page →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminDocs() {
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();

  const filteredDocs = q
    ? docs
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              item.title.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q) ||
              item.details.some((d) => d.toLowerCase().includes(q))
          ),
        }))
        .filter((s) => s.items.length > 0)
    : docs;

  const filteredFaqs = q
    ? faqs.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q))
    : faqs;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Documentation"
        subtitle="Everything you need to know about managing your store — explained simply"
      />

      {/* Search */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/50 max-w-lg">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documentation & FAQ..."
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="dashboard-card text-center py-4">
          <p className="text-2xl font-display font-black text-accent">{docs.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Sections</p>
        </div>
        <div className="dashboard-card text-center py-4">
          <p className="text-2xl font-display font-black text-accent">{docs.reduce((n, s) => n + s.items.length, 0)}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Pages Documented</p>
        </div>
        <div className="dashboard-card text-center py-4">
          <p className="text-2xl font-display font-black text-accent">{faqs.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">FAQ Answers</p>
        </div>
        <div className="dashboard-card text-center py-4">
          <p className="text-2xl font-display font-black text-accent">3</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Languages</p>
        </div>
      </div>

      {/* FAQ Section */}
      {filteredFaqs.length > 0 && (
        <div className="dashboard-card">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
            <div className="stat-icon stat-icon--accent">
              <HelpCircle className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm uppercase tracking-wider">Frequently Asked Questions</h3>
              <p className="text-xs text-muted-foreground">Quick answers to the most common questions</p>
            </div>
          </div>
          <div>
            {filteredFaqs.map((faq, i) => (
              <FaqAccordionItem key={i} faq={faq} />
            ))}
          </div>
        </div>
      )}

      {/* Documentation Sections */}
      <div className="space-y-3">
        {filteredDocs.length === 0 && filteredFaqs.length === 0 ? (
          <div className="dashboard-card text-center py-12">
            <HelpCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No results found for "{search}"</p>
          </div>
        ) : (
          filteredDocs.map((section) => (
            <SectionAccordion key={section.id} section={section} />
          ))
        )}
      </div>
    </div>
  );
}
