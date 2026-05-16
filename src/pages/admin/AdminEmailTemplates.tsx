import React, { useState } from "react";
import { Mail, Eye, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";

const TEMPLATES = [
  {
    id: "order_confirmation",
    name: "Order Confirmation",
    description: "Sent when a new order is placed",
    subject: "Your REMQUIP Order #{{order_number}} is Confirmed",
    variables: ["order_number", "customer_name", "order_total", "order_items", "shipping_address"],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#0f172a;padding:32px 24px;text-align:center">
    <h1 style="color:#ffffff;font-size:24px;font-weight:900;margin:0;letter-spacing:2px">REMQUIP</h1>
    <p style="color:#94a3b8;font-size:11px;margin:8px 0 0;letter-spacing:3px;text-transform:uppercase">Order Confirmation</p>
  </div>
  <div style="padding:32px 24px">
    <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Thank you for your order!</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px">Hi {{customer_name}}, your order <strong>#{{order_number}}</strong> has been received and is being processed.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;font-weight:700">Order Total</p>
      <p style="font-size:24px;font-weight:900;color:#0f172a;margin:0">{{order_total}}</p>
    </div>
    <p style="color:#64748b;font-size:13px;line-height:1.6">We'll send you a shipping confirmation once your order is on its way.</p>
  </div>
  <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="color:#94a3b8;font-size:11px;margin:0">© REMQUIP — Heavy-Duty Parts Distributor</p>
  </div>
</div>`,
  },
  {
    id: "shipping_notification",
    name: "Shipping Notification",
    description: "Sent when an order is shipped",
    subject: "Your REMQUIP Order #{{order_number}} Has Shipped!",
    variables: ["order_number", "customer_name", "tracking_number", "carrier", "estimated_delivery"],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#0f172a;padding:32px 24px;text-align:center">
    <h1 style="color:#ffffff;font-size:24px;font-weight:900;margin:0;letter-spacing:2px">REMQUIP</h1>
    <p style="color:#94a3b8;font-size:11px;margin:8px 0 0;letter-spacing:3px;text-transform:uppercase">Shipping Update</p>
  </div>
  <div style="padding:32px 24px">
    <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Your order is on its way! 🚚</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px">Hi {{customer_name}}, great news — your order <strong>#{{order_number}}</strong> has been shipped.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px">
      <div style="margin-bottom:12px"><p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0;font-weight:700">Carrier</p><p style="font-size:16px;font-weight:700;color:#0f172a;margin:4px 0 0">{{carrier}}</p></div>
      <div style="margin-bottom:12px"><p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0;font-weight:700">Tracking Number</p><p style="font-size:14px;font-weight:600;color:#3b82f6;margin:4px 0 0;font-family:monospace">{{tracking_number}}</p></div>
      <div><p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0;font-weight:700">Est. Delivery</p><p style="font-size:14px;font-weight:600;color:#0f172a;margin:4px 0 0">{{estimated_delivery}}</p></div>
    </div>
  </div>
  <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="color:#94a3b8;font-size:11px;margin:0">© REMQUIP — Heavy-Duty Parts Distributor</p>
  </div>
</div>`,
  },
  {
    id: "invoice_email",
    name: "Invoice Email",
    description: "Sent when an invoice is issued to the customer",
    subject: "Invoice {{invoice_number}} from REMQUIP",
    variables: ["invoice_number", "customer_name", "total", "due_date", "payment_link"],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#0f172a;padding:32px 24px;text-align:center">
    <h1 style="color:#ffffff;font-size:24px;font-weight:900;margin:0;letter-spacing:2px">REMQUIP</h1>
    <p style="color:#94a3b8;font-size:11px;margin:8px 0 0;letter-spacing:3px;text-transform:uppercase">Invoice</p>
  </div>
  <div style="padding:32px 24px">
    <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Invoice {{invoice_number}}</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px">Hi {{customer_name}}, please find your invoice details below.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px"><div><p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0;font-weight:700">Amount Due</p><p style="font-size:24px;font-weight:900;color:#0f172a;margin:4px 0 0">{{total}}</p></div><div style="text-align:right"><p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0;font-weight:700">Due Date</p><p style="font-size:16px;font-weight:700;color:#ef4444;margin:4px 0 0">{{due_date}}</p></div></div>
    </div>
    <a href="{{payment_link}}" style="display:block;background:#0f172a;color:#ffffff;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase">Pay Now</a>
  </div>
  <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="color:#94a3b8;font-size:11px;margin:0">© REMQUIP — Heavy-Duty Parts Distributor</p>
  </div>
</div>`,
  },
  {
    id: "contact_confirmation",
    name: "Contact Form Confirmation",
    description: "Auto-reply when someone submits the contact form",
    subject: "We received your message — REMQUIP",
    variables: ["customer_name", "message_preview"],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#0f172a;padding:32px 24px;text-align:center">
    <h1 style="color:#ffffff;font-size:24px;font-weight:900;margin:0;letter-spacing:2px">REMQUIP</h1>
    <p style="color:#94a3b8;font-size:11px;margin:8px 0 0;letter-spacing:3px;text-transform:uppercase">Message Received</p>
  </div>
  <div style="padding:32px 24px">
    <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Thank you for reaching out!</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px">Hi {{customer_name}}, we've received your message and our team will get back to you within 24 business hours.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;font-weight:700">Your Message</p>
      <p style="font-size:13px;color:#475569;margin:0;line-height:1.5;font-style:italic">"{{message_preview}}"</p>
    </div>
  </div>
  <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="color:#94a3b8;font-size:11px;margin:0">© REMQUIP — Heavy-Duty Parts Distributor</p>
  </div>
</div>`,
  },
];

export default function AdminEmailTemplates() {
  const { t } = useLanguage();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const previewTemplate = TEMPLATES.find(tp => tp.id === previewId);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Email Templates"
        subtitle="Preview and manage email templates sent to customers"
      />

      <div className="grid gap-4">
        {TEMPLATES.map(tp => {
          const isExpanded = expandedId === tp.id;
          return (
            <div key={tp.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : tp.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{tp.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{tp.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewId(tp.id); }}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors flex items-center gap-1.5"
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border p-5 bg-muted/10 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Subject Line</label>
                    <p className="text-sm font-medium text-foreground mt-1 font-mono bg-background border border-border rounded-lg px-3 py-2">{tp.subject}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Available Variables</label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {tp.variables.map(v => (
                        <span key={v} className="px-2 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold font-mono">{`{{${v}}}`}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewId(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h3 className="font-bold text-sm">{previewTemplate.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Subject: {previewTemplate.subject}</p>
              </div>
              <button onClick={() => setPreviewId(null)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] bg-muted/20">
              <div className="bg-white rounded-xl shadow-sm mx-auto" style={{ maxWidth: 600 }}>
                <div dangerouslySetInnerHTML={{ __html: previewTemplate.html }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
