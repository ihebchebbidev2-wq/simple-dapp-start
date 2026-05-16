import React from 'react';
import {
  ReportData, ReportType, TaxBreakdown, TaxLineItem, TAX_METHODS,
  t, fmtDate, fmtCurrency, totalTax, totalTaxLines,
} from './reportTypes';

// ──────────────────────────────────────────────────────────────
// SHARED STYLES (injected inline for print fidelity)
// ──────────────────────────────────────────────────────────────

const BRAND_DARK = '#1f354d';
const BRAND_MID = '#48698e';
const BRAND_LIGHT = '#e8eef5';

// ──────────────────────────────────────────────────────────────
// DOCUMENT HEADER (shared across all 3 types)
// ──────────────────────────────────────────────────────────────

function DocHeader({ data }: { data: ReportData }) {
  const lang = data.lang;
  const titles: Record<ReportType, string> = {
    quote: t(lang, 'quote'),
    invoice: t(lang, 'invoice'),
    delivery_slip: t(lang, 'delivery_slip'),
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
      {/* Left — Company / Logo */}
      <div style={{ flex: 1 }}>
        {data.company.logo_url ? (
          <img src={data.company.logo_url} alt="Logo" style={{ height: 56, objectFit: 'contain', marginBottom: 8 }} />
        ) : (
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 24,
            fontWeight: 800,
            color: BRAND_DARK,
            letterSpacing: 2,
            marginBottom: 8,
          }}>
            {data.company.name}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#555', lineHeight: 1.6 }}>
          {data.company.address && <div>{data.company.address}</div>}
          {data.company.city && <div>{data.company.city}</div>}
          {data.company.phone && <div>{t(lang, 'phone')}: {data.company.phone}</div>}
          {data.company.email && <div>{t(lang, 'email')}: {data.company.email}</div>}
          {data.company.gst_number && (
            <div style={{ marginTop: 4 }}>{t(lang, 'gst_number')} {data.company.gst_number}</div>
          )}
          {data.company.qst_number && (
            <div>{t(lang, 'qst_number')} {data.company.qst_number}</div>
          )}
        </div>
      </div>

      {/* Right — Document Title & Meta */}
      <div style={{ textAlign: 'right', minWidth: 200 }}>
        <div style={{
          fontSize: 28,
          fontWeight: 900,
          color: BRAND_DARK,
          letterSpacing: 3,
          marginBottom: 12,
          fontFamily: 'Georgia, serif',
        }}>
          {titles[data.type]}
        </div>
        <div style={{ fontSize: 11, color: '#444', lineHeight: 2 }}>
          <div>
            <span style={{ color: '#888', marginRight: 6 }}>{t(lang, 'doc_number')}</span>
            <strong style={{ color: BRAND_DARK }}>{data.documentNumber}</strong>
          </div>
          <div>
            <span style={{ color: '#888', marginRight: 6 }}>{t(lang, 'date')}</span>
            {fmtDate(data.issueDate, lang)}
          </div>
          {data.type === 'quote' && data.validUntil && (
            <div>
              <span style={{ color: '#c05c05', marginRight: 6 }}>{t(lang, 'valid_until')}</span>
              <span style={{ color: '#c05c05', fontWeight: 600 }}>{fmtDate(data.validUntil, lang)}</span>
            </div>
          )}
          {data.type === 'invoice' && data.dueDate && (
            <div>
              <span style={{ color: '#c05c05', marginRight: 6 }}>{t(lang, 'due_date')}</span>
              <span style={{ color: '#c05c05', fontWeight: 600 }}>{fmtDate(data.dueDate, lang)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ADDRESS BLOCK
// ──────────────────────────────────────────────────────────────

function AddressBlock({ data }: { data: ReportData }) {
  const lang = data.lang;
  const customerLabel =
    data.type === 'delivery_slip' ? t(lang, 'deliver_to') :
    data.type === 'invoice' ? t(lang, 'bill_to') : t(lang, 'quote_to');

  return (
    <div style={{
      display: 'flex',
      gap: 24,
      marginBottom: 28,
      padding: '16px 20px',
      background: BRAND_LIGHT,
      borderRadius: 8,
      borderLeft: `4px solid ${BRAND_DARK}`,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: BRAND_MID, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
          {customerLabel}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND_DARK, marginBottom: 2 }}>
          {data.customer.company || data.customer.name}
        </div>
        {data.customer.company && (
          <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>{data.customer.name}</div>
        )}
        {data.customer.address && <div style={{ fontSize: 11, color: '#555' }}>{data.customer.address}</div>}
        {data.customer.city && <div style={{ fontSize: 11, color: '#555' }}>{data.customer.city}</div>}
        {data.customer.phone && <div style={{ fontSize: 11, color: '#555' }}>{t(lang, 'phone')}: {data.customer.phone}</div>}
        <div style={{ fontSize: 11, color: '#555' }}>{t(lang, 'email')}: {data.customer.email}</div>
        {data.customer.tax_number && (
          <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>{t(lang, 'tax_reg_number')}: {data.customer.tax_number}</div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// LINE ITEMS TABLE
// ──────────────────────────────────────────────────────────────

function ItemsTable({ data }: { data: ReportData }) {
  const lang = data.lang;
  const showPrices = data.type !== 'delivery_slip';
  const th: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 10,
    fontWeight: 700,
    color: '#fff',
    background: BRAND_DARK,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    borderBottom: `2px solid ${BRAND_MID}`,
    whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 11,
    color: '#333',
    verticalAlign: 'top',
    borderBottom: '1px solid #e5e7eb',
  };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
      <thead>
        <tr>
          <th style={{ ...th, width: '50%', textAlign: 'left' }}>{t(lang, 'item')}</th>
          <th style={{ ...th, width: '10%', textAlign: 'center' }}>{t(lang, 'qty')}</th>
          {showPrices && (
            <>
              <th style={{ ...th, width: '15%', textAlign: 'right' }}>{t(lang, 'unit_price')}</th>
              <th style={{ ...th, width: '15%', textAlign: 'right' }}>{t(lang, 'total')}</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {data.items.map((item, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
            <td style={td}>
              <div style={{ fontWeight: 600, color: BRAND_DARK, marginBottom: 2 }}>{item.description}</div>
              {item.notes && <div style={{ fontSize: 10, color: '#888', fontStyle: 'italic' }}>{item.notes}</div>}
            </td>
            <td style={{ ...td, textAlign: 'center', fontWeight: 600 }}>{item.qty}</td>
            {showPrices && (
              <>
                <td style={{ ...td, textAlign: 'right' }}>{fmtCurrency(item.unitPrice, lang)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(item.lineTotal, lang)}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ──────────────────────────────────────────────────────────────
// TOTALS SUMMARY (quote & invoice only)
// ──────────────────────────────────────────────────────────────

function TotalsSummary({ data }: { data: ReportData }) {
  const lang = data.lang;
  const taxConfig = TAX_METHODS[data.taxMethod];
  const hasDynamicLines = data.taxLines && data.taxLines.length > 0;

  const row = (label: string, value: string, accent?: boolean, negative?: boolean) => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '5px 0',
      borderBottom: accent ? 'none' : '1px solid #e5e7eb',
    }}>
      <span style={{ fontSize: accent ? 13 : 11, color: accent ? BRAND_DARK : '#555', fontWeight: accent ? 800 : 400 }}>
        {label}
      </span>
      <span style={{
        fontSize: accent ? 15 : 12,
        fontWeight: accent ? 900 : 500,
        color: negative ? '#dc2626' : accent ? BRAND_DARK : '#333',
      }}>
        {value}
      </span>
    </div>
  );

  /** Get the localized label for a tax line. */
  const taxLabel = (tl: TaxLineItem) => {
    const lbl = lang === 'fr' ? tl.label_fr : lang === 'es' ? tl.label_es : tl.label_en;
    const pct = tl.rate.toFixed(3).replace(/\.?0+$/, '');
    return `${lbl || tl.name} (${pct}%)`;
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
      <div style={{
        width: 280,
        background: BRAND_LIGHT,
        borderRadius: 8,
        padding: '16px 20px',
        border: `1px solid ${BRAND_MID}30`,
      }}>
        {row(t(lang, 'subtotal'), fmtCurrency(data.subtotal, lang))}
        {data.discount > 0 && row(t(lang, 'discount'), `-${fmtCurrency(data.discount, lang)}`, false, true)}
        {data.shipping > 0 && row(t(lang, 'shipping'), fmtCurrency(data.shipping, lang))}

        {/* Tax lines — prefer dynamic lines, fall back to static config */}
        {hasDynamicLines
          ? data.taxLines!.map((tl, i) => (
              row(taxLabel(tl), fmtCurrency(tl.amount, lang))
            ))
          : taxConfig.rates.map((r, i) => {
              const amount = (data.taxBreakdown as any)[r.key] ?? 0;
              return row(
                `${r.name} (${(r.rate * 100).toFixed(3).replace(/\.?0+$/, '')}%)`,
                fmtCurrency(amount, lang),
              );
            })
        }

        <div style={{ height: 8 }} />
        <div style={{
          borderTop: `2px solid ${BRAND_DARK}`,
          paddingTop: 10,
        }}>
          {row(t(lang, 'grand_total'), fmtCurrency(data.total, lang), true)}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// FOOTER
// ──────────────────────────────────────────────────────────────

function DocFooter({ data }: { data: ReportData }) {
  const lang = data.lang;
  return (
    <div>
      {/* Notes */}
      {data.notes && (
        <div style={{
          padding: '12px 16px',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 6,
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            {t(lang, 'notes')}
          </div>
          <p style={{ fontSize: 11, color: '#78350f', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{data.notes}</p>
        </div>
      )}

      {/* Payment Terms (invoice only) */}
      {data.type === 'invoice' && data.paymentTerms && (
        <div style={{ marginBottom: 20, padding: '10px 16px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#14532d', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
            {t(lang, 'payment_terms')}
          </div>
          <p style={{ fontSize: 11, color: '#15803d', margin: 0 }}>{data.paymentTerms}</p>
        </div>
      )}

      {/* Quote validity note */}
      {data.type === 'quote' && (
        <p style={{ fontSize: 10, color: '#888', fontStyle: 'italic', marginBottom: 20 }}>
          {t(lang, 'validity')}
        </p>
      )}

      {/* Signature lines */}
      {data.type !== 'delivery_slip' && (
        <div style={{ display: 'flex', gap: 40, marginBottom: 28 }}>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: '1px solid #ccc', paddingTop: 6, marginTop: 40 }}>
              <div style={{ fontSize: 10, color: '#888' }}>{t(lang, 'signature')}</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: '1px solid #ccc', paddingTop: 6, marginTop: 40 }}>
              <div style={{ fontSize: 10, color: '#888' }}>{t(lang, 'approved_by')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Slip — receiver signature */}
      {data.type === 'delivery_slip' && (
        <div style={{ display: 'flex', gap: 40, marginTop: 40, marginBottom: 28 }}>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: '1px solid #ccc', paddingTop: 6, marginTop: 40 }}>
              <div style={{ fontSize: 10, color: '#888' }}>{t(lang, 'received_by')}</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: '1px solid #ccc', paddingTop: 6, marginTop: 40 }}>
              <div style={{ fontSize: 10, color: '#888' }}>{t(lang, 'date')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div style={{
        borderTop: `3px solid ${BRAND_DARK}`,
        paddingTop: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ fontSize: 10, color: '#888' }}>{t(lang, 'thank_you')}</div>
        <div style={{ fontSize: 10, color: '#aaa' }}>{data.company.name} · {data.documentNumber}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// DELIVERY SLIP BANNER
// ──────────────────────────────────────────────────────────────

function DeliverySlipBanner({ data }: { data: ReportData }) {
  const lang = data.lang;
  return (
    <div style={{
      padding: '10px 16px',
      background: BRAND_DARK,
      borderRadius: 6,
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <span style={{ fontSize: 14 }}>📦</span>
      <div>
        <div style={{ fontSize: 10, color: '#ffffffaa', letterSpacing: 1 }}>{t(lang, 'items_ordered')}</div>
        <div style={{ fontSize: 11, color: '#ffffffcc' }}>{t(lang, 'no_prices_shown')}</div>
      </div>
      <div style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: '#ffffff80', letterSpacing: 2, textTransform: 'uppercase' }}>
        {t(lang, 'confidential')}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// MAIN DOCUMENT TEMPLATE
// ──────────────────────────────────────────────────────────────

export interface DocumentTemplateProps {
  data: ReportData;
  /** ref forwarded to the printable container */
  printRef?: React.RefObject<HTMLDivElement>;
}

export function DocumentTemplate({ data, printRef }: DocumentTemplateProps) {
  const showPrices = data.type !== 'delivery_slip';

  return (
    <div
      ref={printRef}
      id="report-print-area"
      style={{
        background: '#fff',
        fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
        fontSize: 12,
        color: '#1a1a1a',
        padding: '40px 48px',
        maxWidth: 794,             // A4-ish at 96dpi
        margin: '0 auto',
        boxSizing: 'border-box',
        lineHeight: 1.5,
        minHeight: 1123,           // A4 height
      }}
    >
      <DocHeader data={data} />
      <AddressBlock data={data} />
      {data.type === 'delivery_slip' && <DeliverySlipBanner data={data} />}
      <ItemsTable data={data} />
      {showPrices && <TotalsSummary data={data} />}
      <DocFooter data={data} />
    </div>
  );
}
