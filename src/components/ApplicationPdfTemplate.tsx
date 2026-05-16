import React from 'react';
import { resolveAssetUrl } from '@/lib/resolveAssetUrl';

interface ApplicationPdfTemplateProps {
  data: any;
  signatureData?: string | null;
}

const BLUE = '#1e3a5f';
const BLUE_LIGHT = '#e8eef5';

const SectionHeader: React.FC<{ number: string; title: string }> = ({ number, title }) => (
  <div className="flex items-stretch mb-3" style={{ pageBreakAfter: 'avoid' }}>
    <div style={{ background: BLUE, color: '#fff', padding: '6px 14px', fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {number}
    </div>
    <div style={{ background: BLUE_LIGHT, flex: 1, padding: '6px 14px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: BLUE }}>
      {title}
    </div>
  </div>
);

const Field: React.FC<{ label: string; value?: string | number | null; span2?: boolean }> = ({ label, value, span2 }) => (
  <div className={span2 ? 'col-span-2' : ''} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
    <span style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{label}</span>
    <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#111', minHeight: '16px', whiteSpace: 'pre-wrap' }}>
      {value || '—'}
    </span>
  </div>
);

const ApplicationPdfTemplate: React.FC<ApplicationPdfTemplateProps> = ({ data, signatureData }) => {
  const getDistributorLabel = (val: string) => {
    const options: Record<string, string> = {
      reseller: "Revendeur / Reseller",
      logistics: "Logistique / Logistics Co.",
      garage: "Garage / Repair Shop",
      other: "Autre / Other"
    };
    return options[val] || val;
  };

  const currentYear = new Date().getFullYear();

  const pageStyle: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm',
    padding: '18mm 16mm 14mm 16mm',
    margin: '0 auto',
    background: '#fff',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#090a0f',
    lineHeight: 1.35,
    position: 'relative',
  };

  const footerContent = (pageNum: number) => (
    <div style={{
      position: 'absolute', bottom: '10mm', left: '16mm', right: '16mm',
      textAlign: 'center', fontSize: '8px', fontWeight: 600, color: '#b0b0b0',
      borderTop: '1px solid #e5e7eb', paddingTop: '8px',
    }}>
      REMQUIP — Pièces de remorques & camions — © {currentYear} &nbsp;|&nbsp; Page {pageNum}/2
    </div>
  );

  return (
    <div id="application-pdf-template">
      {/* ═══════════ PAGE 1 ═══════════ */}
      <div style={pageStyle} data-pdf-page="1">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px solid ${BLUE}`, paddingBottom: '14px', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 900, color: BLUE, letterSpacing: '-0.03em', margin: 0, textTransform: 'uppercase' }}>REMQUIP</h1>
            <p style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '3px 0 0' }}>
              Pièces de remorques & camions / Trailer & Truck Parts
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 900, color: BLUE, margin: 0, textTransform: 'uppercase' }}>Ouverture de compte</h2>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', margin: '2px 0 0' }}>Customer Account Application</p>
            {data.created_at && (
              <p style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px' }}>
                Reçu / Received: {new Date(data.created_at).toLocaleDateString('en-CA')}
              </p>
            )}
          </div>
        </div>

        {/* Section 1 */}
        <SectionHeader number="01" title="Informations de l'entreprise / Company Information" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-5" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
          <Field label="Raison sociale / Company Name" value={data.company_name} />
          <Field label="No d'entreprise / NEQ / TVA" value={data.neq_tva} />
          <Field label="Personne contact / Contact Person" value={data.contact_person} />
          <Field label="Titre / Fonction / Title" value={data.contact_title} />
          <Field label="Téléphone / Phone" value={data.phone} />
          <Field label="Courriel / Email" value={data.email} />
        </div>

        {/* Distributor type */}
        <div style={{ padding: '0 4px', marginBottom: '16px' }}>
          <span style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Type de distributeur / Distributor Type
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {['reseller', 'logistics', 'garage', 'other'].map(opt => {
              const checked = data.distributor_type?.includes(opt);
              return (
                <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                  <div style={{
                    width: '12px', height: '12px', border: `1.5px solid ${checked ? BLUE : '#d1d5db'}`,
                    background: checked ? BLUE : '#fff', borderRadius: '2px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '9px', fontWeight: 900
                  }}>
                    {checked && '✓'}
                  </div>
                  <span style={{ fontWeight: checked ? 700 : 400, color: checked ? '#111' : '#6b7280' }}>
                    {getDistributorLabel(opt)}
                  </span>
                </div>
              );
            })}
          </div>
          {data.distributor_type?.includes('other') && data.distributor_type_other && (
            <p style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', marginTop: '4px' }}>Précision: {data.distributor_type_other}</p>
          )}
        </div>

        {/* Fleet */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
          <Field label="Nombre de camions / Number of Trucks" value={data.num_trucks || '0'} />
          <Field label="Nombre de remorques / Number of Trailers" value={data.num_trailers || '0'} />
          <Field label="Pièces recherchées / Parts Needed" value={data.parts_needed} span2 />
          <Field label="Demandes spéciales / Special Requests" value={data.special_requests} span2 />
        </div>

        {/* Section 2 */}
        <SectionHeader number="02" title="Adresses / Addresses" />
        <div className="grid grid-cols-2 gap-8 mb-6" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
          <div>
            <span style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              Adresse de facturation / Billing Address
            </span>
            <div style={{ fontSize: '12px', fontWeight: 600, minHeight: '50px', whiteSpace: 'pre-wrap', padding: '8px 10px', background: BLUE_LIGHT, borderRadius: '4px', border: '1px solid #dbe4ef' }}>
              {data.billing_address || '—'}
            </div>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              Adresse de livraison / Shipping Address
            </span>
            <div style={{ fontSize: '12px', fontWeight: 600, minHeight: '50px', whiteSpace: 'pre-wrap', padding: '8px 10px', background: BLUE_LIGHT, borderRadius: '4px', border: '1px solid #dbe4ef' }}>
              {data.shipping_address || '—'}
            </div>
          </div>
        </div>

        {/* Section 3 */}
        <SectionHeader number="03" title="Comptabilité et paiement / Accounting & Payment" />
        <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-4" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
          <Field label="Contact comptabilité / Contact" value={data.accounting_contact} />
          <Field label="Téléphone / Phone" value={data.accounting_phone} />
          <Field label="Courriel / Billing Email" value={data.billing_email} />
        </div>

        <div className="grid grid-cols-2 gap-8" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
          <div>
            <span style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
              Conditions / Payment Terms
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {['on_delivery', 'net_15', 'net_30', 'on_order'].map(t => {
                const checked = data.payment_terms === t;
                return (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      border: `1.5px solid ${checked ? BLUE : '#d1d5db'}`,
                      background: checked ? BLUE : '#fff',
                    }} />
                    <span style={{ fontWeight: checked ? 700 : 400, color: checked ? '#111' : '#6b7280' }}>
                      {t.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
              Mode de paiement / Payment Method
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {['transfer', 'cheque', 'credit_card', 'other'].map(m => {
                const checked = data.payment_method === m;
                return (
                  <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      border: `1.5px solid ${checked ? BLUE : '#d1d5db'}`,
                      background: checked ? BLUE : '#fff',
                    }} />
                    <span style={{ fontWeight: checked ? 700 : 400, color: checked ? '#111' : '#6b7280' }}>
                      {m.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {footerContent(1)}
      </div>

      {/* ═══════════ PAGE 2 ═══════════ */}
      <div style={pageStyle} data-pdf-page="2">
        {/* Mini header for page 2 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${BLUE}`, paddingBottom: '10px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: 900, color: BLUE, letterSpacing: '-0.02em' }}>REMQUIP</span>
            <span style={{ fontSize: '9px', color: '#9ca3af', fontWeight: 600 }}>Ouverture de compte / Account Application</span>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280' }}>
            {data.company_name || '—'}
          </span>
        </div>

        {/* Section 4: Credit References */}
        <SectionHeader number="04" title="Références de crédit / Credit References" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-5" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
          <Field label="Référence bancaire / Bank Reference" value={data.bank_reference} />
          <Field label="Limite de crédit demandée / Credit Limit Requested" value={data.credit_limit_requested ? `$${data.credit_limit_requested}` : undefined} />
        </div>
        <div style={{ paddingLeft: '4px', paddingRight: '4px', marginBottom: '24px' }}>
          <div className="grid grid-cols-1 gap-y-3">
            <Field label="Référence fournisseur 1 / Supplier Reference 1" value={data.supplier_ref_1} span2 />
            <Field label="Référence fournisseur 2 / Supplier Reference 2" value={data.supplier_ref_2} span2 />
          </div>
        </div>

        {/* Section 5: Terms */}
        <SectionHeader number="05" title="Conditions générales / Terms & Conditions" />
        <div style={{
          padding: '14px 16px', background: '#fafbfc', border: '1px solid #e5e7eb',
          borderRadius: '4px', fontSize: '9px', lineHeight: 1.6, color: '#4b5563', marginBottom: '24px',
        }}>
          <p style={{ marginBottom: '6px' }}>
            Le client reconnaît avoir pris connaissance et accepté les conditions générales de vente de REMQUIP Inc.
            Le client s'engage à régler toutes les factures conformément aux conditions de paiement convenues.
          </p>
          <p style={{ marginBottom: '6px' }}>
            The customer acknowledges having read and accepted the general terms and conditions of sale of REMQUIP Inc.
            The customer agrees to settle all invoices in accordance with the agreed payment terms.
          </p>
          <p style={{ margin: 0 }}>
            En cas de défaut de paiement, REMQUIP se réserve le droit de suspendre tout service et d'appliquer les frais d'intérêt prévus par la loi. /
            In case of default of payment, REMQUIP reserves the right to suspend services and apply interest charges as provided by law.
          </p>
        </div>

        {/* Section 6: Signature */}
        <SectionHeader number="06" title="Validation et signature / Authorization & Signature" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-5" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
          <Field label="Nom du signataire / Signatory Name" value={data.signatory_name} />
          <Field label="Titre / Fonction / Title" value={data.signatory_title} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', padding: '0 4px', marginBottom: '16px' }}>
          <div>
            <span style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              Date de signature / Date
            </span>
            <div style={{
              fontSize: '14px', fontWeight: 700, padding: '12px 14px',
              background: BLUE_LIGHT, borderRadius: '4px', border: '1px solid #dbe4ef',
              minHeight: '44px', display: 'flex', alignItems: 'center',
            }}>
              {data.signature_date || new Date().toLocaleDateString('en-CA')}
            </div>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '8px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              Signature autorisée / Authorized Signature
            </span>
            <div style={{
              border: `2px dashed ${BLUE}40`, borderRadius: '6px', padding: '12px',
              minHeight: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#fafbfc', position: 'relative',
            }}>
              {data.signature_url ? (
                <img src={resolveAssetUrl(data.signature_url)} alt="Signature" crossOrigin="anonymous" style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain' }} />
              ) : signatureData ? (
                <img src={signatureData} alt="Signature" style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '11px', color: '#d1d5db', fontStyle: 'italic' }}>Aucune signature / No signature provided</span>
              )}
            </div>
          </div>
        </div>

        {/* Internal use only */}
        <div style={{
          marginTop: '32px', padding: '14px 16px', border: `1px dashed #d1d5db`, borderRadius: '4px',
        }}>
          <span style={{ display: 'block', fontSize: '8px', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            Réservé à l'administration / For Internal Use Only
          </span>
          <div className="grid grid-cols-3 gap-6">
            {['Approuvé par / Approved by', 'Date d\'approbation / Date', 'Numéro de compte / Account #'].map(label => (
              <div key={label}>
                <span style={{ display: 'block', fontSize: '7px', fontWeight: 700, color: '#b0b0b0', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</span>
                <div style={{ borderBottom: '1px solid #d1d5db', minHeight: '24px' }} />
              </div>
            ))}
          </div>
        </div>

        {footerContent(2)}
      </div>
    </div>
  );
};

export default ApplicationPdfTemplate;
