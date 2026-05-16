import React, { useRef, useState, useCallback } from 'react';
import { X, Printer, Download, Globe, FileText, Package, Receipt, Loader2, ChevronDown } from 'lucide-react';
import {
  ReportType, ReportLang, TaxMethod, ReportData, ReportItem, ReportCustomer, ReportCompany,
  TAX_METHODS, computeTaxBreakdown, totalTax, t,
} from './reportTypes';
import { DocumentTemplate } from './DocumentTemplate';

// ──────────────────────────────────────────────────────────────
// PRINT CSS (injected into document head)
// ──────────────────────────────────────────────────────────────

const PRINT_CSS = `
@media print {
  body > *:not(#remquip-print-portal) { display: none !important; }
  #remquip-print-portal { display: block !important; position: static !important; }
  #report-print-area {
    padding: 20mm !important;
    max-width: 100% !important;
    box-shadow: none !important;
    margin: 0 !important;
  }
  @page { size: A4; margin: 10mm; }
}
`;

function injectPrintCSS() {
  if (document.getElementById('remquip-print-css')) return;
  const s = document.createElement('style');
  s.id = 'remquip-print-css';
  s.textContent = PRINT_CSS;
  document.head.appendChild(s);
}

// ──────────────────────────────────────────────────────────────
// PROPS
// ──────────────────────────────────────────────────────────────

export interface ReportModalSource {
  documentNumber: string;
  issueDate: string;
  validUntil?: string;
  dueDate?: string;
  customer: ReportCustomer;
  items: ReportItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  notes?: string;
  paymentTerms?: string;
}

export interface ReportPreviewModalProps {
  onClose: () => void;
  source: ReportModalSource;
  defaultType?: ReportType;
  company?: Partial<ReportCompany>;
}

// ──────────────────────────────────────────────────────────────
// TOOLBAR BUTTON
// ──────────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick, active, children, variant = 'default',
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'danger';
}) {
  const base = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all';
  const colors = {
    default: active
      ? 'bg-[#1f354d] text-white shadow'
      : 'bg-white/10 text-white/80 hover:bg-white/20',
    primary: 'bg-white text-[#1f354d] hover:bg-white/90 shadow',
    danger: 'bg-red-500/20 text-red-200 hover:bg-red-500/40',
  };
  return (
    <button onClick={onClick} className={`${base} ${colors[variant]}`}>
      {children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────
// DEFAULT COMPANY
// ──────────────────────────────────────────────────────────────

const DEFAULT_COMPANY: ReportCompany = {
  name: 'REMQUIP',
  address: '123 Commercial Blvd',
  city: 'Montréal, QC  H0H 0H0',
  phone: '+1 (514) 000-0000',
  email: 'info@remquip.com',
  gst_number: '12345 6789 RT0001',
  qst_number: '1234567890 TQ0001',
};

// ──────────────────────────────────────────────────────────────
// MAIN MODAL
// ──────────────────────────────────────────────────────────────

export default function ReportPreviewModal({
  onClose,
  source,
  defaultType = 'quote',
  company,
}: ReportPreviewModalProps) {
  const [lang, setLang] = useState<ReportLang>('fr');
  const [reportType, setReportType] = useState<ReportType>(defaultType);
  const [taxMethod, setTaxMethod] = useState<TaxMethod>('GST_QST');
  const [isDownloading, setIsDownloading] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Compute tax on subtotal net of discount
  const taxableBase = Math.max(0, source.subtotal - source.discount);
  const taxBreakdown = computeTaxBreakdown(taxableBase, taxMethod);
  const taxTotal = totalTax(taxBreakdown);
  const computedTotal = taxableBase + taxTotal + source.shipping;

  const reportData: ReportData = {
    type: reportType,
    lang,
    documentNumber: source.documentNumber,
    issueDate: source.issueDate,
    validUntil: source.validUntil,
    dueDate: source.dueDate,
    company: { ...DEFAULT_COMPANY, ...company },
    customer: source.customer,
    items: source.items,
    taxMethod,
    subtotal: source.subtotal,
    discount: source.discount,
    shipping: source.shipping,
    taxBreakdown,
    total: computedTotal,
    notes: source.notes,
    paymentTerms: source.paymentTerms,
  };

  // ── Print ──
  const handlePrint = useCallback(() => {
    injectPrintCSS();
    // Create or reuse the print portal
    let portal = document.getElementById('remquip-print-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'remquip-print-portal';
      portal.style.display = 'none';
      document.body.appendChild(portal);
    }
    portal.innerHTML = printRef.current?.outerHTML ?? '';
    window.print();
  }, []);

  // ── PDF Download ──
  const handleDownload = useCallback(async () => {
    if (!printRef.current) return;
    setIsDownloading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const ratio = canvas.height / canvas.width;
      const pdfH = pdfW * ratio;

      let yPos = 0;
      const pageH = pdf.internal.pageSize.getHeight();

      // Multi-page support
      while (yPos < pdfH) {
        if (yPos > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -yPos, pdfW, pdfH);
        yPos += pageH;
      }

      const fileLabels: Record<ReportLang, Record<ReportType, string>> = {
        fr: { quote: 'Devis', invoice: 'Facture', delivery_slip: 'BonLivraison' },
        en: { quote: 'Quote', invoice: 'Invoice', delivery_slip: 'DeliverySlip' },
        es: { quote: 'Cotizacion', invoice: 'Factura', delivery_slip: 'NotaEntrega' },
      };
      const typeLabel = fileLabels[lang][reportType];

      pdf.save(`${typeLabel}_${source.documentNumber}.pdf`);
    } catch (e) {
      console.error('PDF generation failed', e);
    } finally {
      setIsDownloading(false);
    }
  }, [lang, reportType, source.documentNumber]);

  const typeIcons: Record<ReportType, React.ReactNode> = {
    quote: <FileText className="w-3.5 h-3.5" />,
    invoice: <Receipt className="w-3.5 h-3.5" />,
    delivery_slip: <Package className="w-3.5 h-3.5" />,
  };

  const typeLabels: Record<ReportType, Record<ReportLang, string>> = {
    quote: { fr: 'Devis', en: 'Quote', es: 'Cotización' },
    invoice: { fr: 'Facture', en: 'Invoice', es: 'Factura' },
    delivery_slip: { fr: 'Bon de livraison', en: 'Delivery Slip', es: 'Nota de entrega' },
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: 'rgba(10,20,35,0.85)' }}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap" style={{ background: '#1f354d', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {/* Close */}
        <button
          onClick={onClose}
          className="flex items-center justify-center h-8 w-8 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-white/20" />

        {/* Document type switcher */}
        <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
          {(['quote', 'invoice', 'delivery_slip'] as ReportType[]).map((rt) => (
            <ToolbarBtn key={rt} onClick={() => setReportType(rt)} active={reportType === rt}>
              {typeIcons[rt]}
              <span className="hidden sm:inline">{typeLabels[rt][lang]}</span>
            </ToolbarBtn>
          ))}
        </div>

        <div className="w-px h-6 bg-white/20" />

        {/* Language */}
        <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
          {(['fr', 'en', 'es'] as ReportLang[]).map((l) => (
            <ToolbarBtn key={l} onClick={() => setLang(l)} active={lang === l}>
              <Globe className="w-3.5 h-3.5" />
              <span>{l.toUpperCase()}</span>
            </ToolbarBtn>
          ))}
        </div>

        <div className="w-px h-6 bg-white/20" />

        {/* Tax method */}
        <div className="relative">
          <button
            onClick={() => setTaxOpen(!taxOpen)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white/80 hover:bg-white/20 transition"
          >
            <span className="text-xs">🇨🇦</span>
            <span className="hidden md:inline text-xs">{TAX_METHODS[taxMethod].label}</span>
            <span className="md:hidden text-xs">Tax</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {taxOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-72 overflow-hidden">
              {(Object.entries(TAX_METHODS) as [TaxMethod, typeof TAX_METHODS[TaxMethod]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => { setTaxMethod(key); setTaxOpen(false); }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition border-b last:border-0 ${taxMethod === key ? 'bg-blue-50 text-blue-800' : 'text-slate-700'}`}
                >
                  <div className="font-semibold">{cfg.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{cfg.description}</div>
                  {cfg.rates.length > 0 && (
                    <div className="flex gap-2 mt-1">
                      {cfg.rates.map((r) => (
                        <span key={r.key} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                          {r.name} {(r.rate * 100).toFixed(3).replace(/\.?0+$/, '')}%
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <ToolbarBtn onClick={handlePrint} variant="default">
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline">{{ fr: 'Imprimer', en: 'Print', es: 'Imprimir' }[lang]}</span>
        </ToolbarBtn>

        <ToolbarBtn onClick={handleDownload} variant="primary">
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{{ fr: 'Télécharger PDF', en: 'Download PDF', es: 'Descargar PDF' }[lang]}</span>
        </ToolbarBtn>
      </div>

      {/* ── Preview Area ── */}
      <div className="flex-1 overflow-auto py-8 px-4" style={{ background: '#e5e9ef' }}>
        {/* Close dropdown on outside click */}
        {taxOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setTaxOpen(false)} />
        )}

        <div className="shadow-2xl rounded-lg overflow-hidden mx-auto" style={{ maxWidth: 860 }}>
          <DocumentTemplate data={reportData} printRef={printRef} />
        </div>
      </div>
    </div>
  );
}
