import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Landmark, Loader2, ChevronRight, MapPin, ShieldCheck, ArrowLeft, PackageCheck, FileSignature, Banknote, FileCheck, CalendarClock, AlertTriangle, Phone, HelpCircle, Minus, Plus, Trash2, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateOrder, useCreateStripeSession } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ConfirmDialog";

// ==================== HELPERS ====================

/** Try to extract city, province, postal from a combined address string like
 *  "40, RUE PRINCIPALE ST-ARSÈNE, QC GoL 2KO" */
function parseAddressString(raw: string): { city: string; province: string; postal: string } {
  const result = { city: '', province: '', postal: '' };
  if (!raw) return result;

  // Canadian postal code pattern: A1A 1A1 or A1A1A1
  const postalMatch = raw.match(/[A-Za-z]\d[A-Za-z]\s*\d[A-Za-z]\d/);
  if (postalMatch) result.postal = postalMatch[0].trim();

  // Province codes (2-letter after a comma or space)
  const provMatch = raw.match(/,\s*([A-Z]{2})\s/);
  if (provMatch) result.province = provMatch[1];

  // City: text between the last comma before province and the province
  const parts = raw.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    // Last segment usually has "QC GoL 2KO" — province + postal
    // Second-to-last or the part before province is often the city
    const lastPart = parts[parts.length - 1];
    // Check if city is embedded: "ST-ARSÈNE, QC GoL 2KO"
    const cityCandidate = parts.length >= 3 ? parts[parts.length - 2] : '';
    if (cityCandidate) {
      // Remove province/postal from city candidate
      result.city = cityCandidate.replace(/\s*[A-Z]{2}\s+[A-Za-z]\d[A-Za-z]\s*\d[A-Za-z]\d\s*$/, '').trim();
    }
    if (!result.city) {
      // Try extracting city from the last part before province code
      const beforeProv = lastPart.replace(/\s*[A-Z]{2}\s+[A-Za-z]\d[A-Za-z]\s*\d[A-Za-z]\d\s*$/, '').trim();
      if (beforeProv && beforeProv !== lastPart) result.city = beforeProv;
    }
  }

  return result;
}

// ==================== VALIDATION ====================
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s\-().]{7,20}$/;
const POSTAL_RE = /^[A-Za-z\d\s\-]{3,10}$/;

interface ValidationErrors {
  [key: string]: string;
}

function validateBilling(data: Record<string, string>): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!data.firstName?.trim()) errors.firstName = "First name is required";
  if (!data.lastName?.trim()) errors.lastName = "Last name is required";
  if (!data.email?.trim() || !EMAIL_RE.test(data.email)) errors.email = "Valid email is required";
  if (!data.phone?.trim() || !PHONE_RE.test(data.phone)) errors.phone = "Valid phone number is required";
  if (!data.address?.trim()) errors.address = "Street address is required";
  if (!data.city?.trim()) errors.city = "City is required";
  if (!data.province?.trim()) errors.province = "Province is required";
  if (!data.postal?.trim() || !POSTAL_RE.test(data.postal)) errors.postal = "Valid postal code is required";
  if (!data.country?.trim()) errors.country = "Country is required";
  return errors;
}

function validateShipping(data: Record<string, string>): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!data.address?.trim()) errors.address = "Street address is required";
  if (!data.city?.trim()) errors.city = "City is required";
  if (!data.province?.trim()) errors.province = "Province is required";
  if (!data.postal?.trim() || !POSTAL_RE.test(data.postal)) errors.postal = "Valid postal code is required";
  if (!data.country?.trim()) errors.country = "Country is required";
  return errors;
}

const InputField = ({ label, name, type = "text", required = true, value, onChange, onBlur, placeholder, error }: { label: string; name: string; type?: string; required?: boolean; value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder?: string; error?: string }) => (
  <div className="group relative">
    <label className="absolute -top-3 left-3 bg-background px-2 text-[10px] font-display font-black uppercase tracking-widest text-muted-foreground group-focus-within:text-accent transition-colors z-10">
      {label}
    </label>
    <input 
      type={type} 
      name={name} 
      required={required} 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`w-full bg-transparent border-2 ${error ? 'border-destructive' : 'border-border/60 hover:border-border'} rounded-xl px-4 py-4 text-sm font-medium text-foreground outline-none focus:border-accent transition-all shadow-sm`}
    />
    {error && <p className="text-[10px] text-destructive mt-1 font-medium">{error}</p>}
  </div>
);

export default function CheckoutPage() {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { items, subtotal, tax, shipping, total, clearCart, taxLines, updateQuantity, removeItem } = useCart();
  const { isAuthenticated, isContractCustomer, user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const orderSubmittedRef = useRef(false);
  
  // Prefill billing from authenticated user
  const userAny = user as any;
  const cust = userAny?.customer || {};
  
  // Parse structured fields from combined address strings as fallback
  const parsedAddr = parseAddressString(cust?.address || '');
  const parsedShip = parseAddressString(cust?.shipping_address || '');

  const [billingData, setBillingData] = useState({
    firstName: userAny?.full_name?.split(' ')[0] || cust?.contact_person?.split(' ')[0] || "",
    lastName: userAny?.full_name?.split(' ').slice(1).join(' ') || cust?.contact_person?.split(' ').slice(1).join(' ') || "",
    email: userAny?.email || cust?.email || "",
    phone: userAny?.phone || cust?.phone || "",
    company: cust?.company_name || cust?.company || "",
    taxId: cust?.tax_number || cust?.tax_id || cust?.neq_tva || "",
    address: cust?.billing_address || cust?.address || "",
    address2: cust?.billing_address_2 || cust?.address_2 || "",
    city: cust?.billing_city || cust?.city || parsedAddr.city || "",
    province: cust?.billing_province || cust?.province || cust?.state || parsedAddr.province || "",
    postal: cust?.billing_postal_code || cust?.postal_code || parsedAddr.postal || "",
    country: cust?.billing_country || cust?.country || (parsedAddr.postal ? "Canada" : ""),
  });
  
  const [shippingData, setShippingData] = useState({
    company: cust?.company_name || "",
    address: cust?.shipping_address || "",
    address2: cust?.shipping_address_2 || "",
    city: cust?.shipping_city || parsedShip.city || "",
    province: cust?.shipping_province || parsedShip.province || "",
    postal: cust?.shipping_postal_code || parsedShip.postal || "",
    country: cust?.shipping_country || (parsedShip.postal ? "Canada" : ""),
  });
  
  const [paymentMethod, setPaymentMethod] = useState("stripe");
  const [paymentOtherNote, setPaymentOtherNote] = useState("");
  const [installmentCount, setInstallmentCount] = useState(3);
  const [showContractPrompt, setShowContractPrompt] = useState(false);
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [billingErrors, setBillingErrors] = useState<ValidationErrors>({});
  const [shippingErrors, setShippingErrors] = useState<ValidationErrors>({});
  
  const createOrderMutation = useCreateOrder();
  const createStripeSessionMutation = useCreateStripeSession();

  // Prefill billing & shipping when user data becomes available (handles async auth restore)
  useEffect(() => {
    if (!user) return;
    const u = user as any;
    const c = u.customer || {};
    const pa = parseAddressString(c?.address || '');
    const ps = parseAddressString(c?.shipping_address || '');
    
    setBillingData(prev => ({
      firstName: prev.firstName || u.full_name?.split(' ')[0] || c.contact_person?.split(' ')[0] || "",
      lastName: prev.lastName || u.full_name?.split(' ').slice(1).join(' ') || c.contact_person?.split(' ').slice(1).join(' ') || "",
      email: prev.email || u.email || c.email || "",
      phone: prev.phone || u.phone || c.phone || "",
      company: prev.company || c.company_name || c.company || "",
      taxId: prev.taxId || c.tax_number || c.tax_id || c.neq_tva || "",
      address: prev.address || c.billing_address || c.address || "",
      address2: prev.address2 || c.billing_address_2 || c.address_2 || "",
      city: prev.city || c.billing_city || c.city || pa.city || "",
      province: prev.province || c.billing_province || c.province || c.state || pa.province || "",
      postal: prev.postal || c.billing_postal_code || c.postal_code || pa.postal || "",
      country: prev.country || c.billing_country || c.country || (pa.postal ? "Canada" : ""),
    }));
    
    setShippingData(prev => ({
      company: prev.company || c.company_name || "",
      address: prev.address || c.shipping_address || "",
      address2: prev.address2 || c.shipping_address_2 || "",
      city: prev.city || c.shipping_city || ps.city || "",
      province: prev.province || c.shipping_province || ps.province || "",
      postal: prev.postal || c.shipping_postal_code || ps.postal || "",
      country: prev.country || c.shipping_country || (ps.postal ? "Canada" : ""),
    }));
  }, [user]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (items.length === 0) {
      navigate("/cart");
    }
  }, [items.length, navigate]);

  const handlePlaceOrder = async () => {
    // Prevent double submission
    if (isSubmitting || orderSubmittedRef.current) return;
    orderSubmittedRef.current = true;
    setIsSubmitting(true);
    
    try {
      // Stock validation: check each product is still available
      const stockErrors: string[] = [];
      await Promise.all(
        items.map(async ({ product, quantity }) => {
          try {
            const res = await api.getProduct(product.id);
            const current = res?.data as any;
            if (!current) {
              stockErrors.push(`${product.name} is no longer available`);
            } else {
              const stock = Number(current.stock_quantity ?? 999);
              if (stock < quantity) {
                stockErrors.push(`${product.name}: only ${stock} in stock (you requested ${quantity})`);
              }
              // Price freshness check
              const livePrice = Number(current.base_price ?? current.price ?? 0);
              const liveDiscount = Number(current.discount_percent ?? 0);
              const liveSalePrice = livePrice * (1 - liveDiscount / 100);
              if (liveSalePrice > 0 && Math.abs(liveSalePrice - product.salePrice) > 0.01) {
                stockErrors.push(`${product.name}: price changed from ${product.salePrice.toFixed(2)} to ${liveSalePrice.toFixed(2)}. Please refresh your cart.`);
              }
            }
          } catch {
            // If product lookup fails, proceed (backend will validate)
          }
        })
      );

      if (stockErrors.length > 0) {
        toast({
          title: "Cart Issue",
          description: stockErrors.join('. '),
          variant: "destructive",
        });
        setIsSubmitting(false);
        orderSubmittedRef.current = false;
        return;
      }

      // Resolve shipping address — use billing when sameAsBilling is true
      const resolvedShipping = sameAsBilling
        ? {
            company: billingData.company,
            address_line1: billingData.address,
            address_line2: billingData.address2,
            city: billingData.city,
            state: billingData.province,
            postal_code: billingData.postal,
            country: billingData.country,
          }
        : {
            company: shippingData.company,
            address_line1: shippingData.address,
            address_line2: shippingData.address2,
            city: shippingData.city,
            state: shippingData.province,
            postal_code: shippingData.postal,
            country: shippingData.country,
          };

      const orderData = {
        customer_email: billingData.email,
        billing_address: {
          first_name: billingData.firstName,
          last_name: billingData.lastName,
          company: billingData.company,
          phone: billingData.phone,
          address_line1: billingData.address,
          address_line2: billingData.address2,
          city: billingData.city,
          state: billingData.province,
          postal_code: billingData.postal,
          country: billingData.country,
        },
        shipping_address: resolvedShipping,
        items: items.map(({ product, quantity }) => ({
          product_id: product.id,
          product_name: product.name,
          quantity,
          unit_price: product.salePrice,
          subtotal: product.salePrice * quantity,
        })),
        subtotal,
        tax_amount: tax,
        shipping_amount: shipping,
        total_amount: total,
        payment_method: paymentMethod,
        installment_count: paymentMethod === "installments" ? installmentCount : undefined,
        status: "pending" as const,
        payment_status: "pending" as const,
        notes: [billingData.taxId ? `Tax ID: ${billingData.taxId}` : '', paymentMethod === 'other' && paymentOtherNote ? `Payment note: ${paymentOtherNote}` : ''].filter(Boolean).join(' | ') || undefined,
      };

      // 1. Create order in the backend (status=pending)
      const newOrder: any = await createOrderMutation.mutateAsync(orderData);
      const orderPayload: any = newOrder?.data ?? newOrder;
      const orderId = orderPayload?.id;

      if (!orderId) {
        throw new Error("Order ID not returned");
      }

      // 1b. Save checkout address/tax data back to customer profile for future orders
      if (isAuthenticated) {
        try {
          await api.request('PUT', 'user/dashboard/address', {
            phone: billingData.phone || '',
            tax_number: billingData.taxId || '',
            billing_address: billingData.address || '',
            billing_address_2: billingData.address2 || '',
            billing_city: billingData.city || '',
            billing_province: billingData.province || '',
            billing_postal_code: billingData.postal || '',
            billing_country: billingData.country || '',
            shipping_address: sameAsBilling ? billingData.address : (shippingData.address || ''),
            shipping_address_2: sameAsBilling ? billingData.address2 : (shippingData.address2 || ''),
            shipping_city: sameAsBilling ? billingData.city : (shippingData.city || ''),
            shipping_province: sameAsBilling ? billingData.province : (shippingData.province || ''),
            shipping_postal_code: sameAsBilling ? billingData.postal : (shippingData.postal || ''),
            shipping_country: sameAsBilling ? billingData.country : (shippingData.country || ''),
            city: billingData.city || '',
            province: billingData.province || '',
            postal_code: billingData.postal || '',
            country: billingData.country || '',
          });
        } catch {
          console.warn('Failed to save address back to customer profile');
        }
      }
      
      // 2. If payment method is Stripe, redirect to payment — order is only confirmed after successful payment
      if (paymentMethod === "stripe") {
        toast({
          title: "Redirecting to Payment",
          description: "Your order will be confirmed once payment is complete.",
        });

        const sessionResponse: any = await createStripeSessionMutation.mutateAsync(orderId);
        const sessionData: any = sessionResponse?.data ?? sessionResponse;
        const checkoutUrl = sessionData?.url;
        
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
        } else {
          throw new Error("No checkout URL returned from payment gateway");
        }
        return; // Early return to let redirect happen (keep cart intact)
      }

      // 3. For non-Stripe payment methods, send order confirmation email via backend
      try {
        const orderNumber = orderPayload?.orderNumber || orderPayload?.order_number || orderId;
        await api.request('POST', `orders/${orderId}/send`, {
          email_type: 'status',
          subject: `REMQUIP: Order ${orderNumber} — Confirmation`,
        });
      } catch {
        // Email send failure should not block checkout
        console.warn('Failed to send order confirmation email');
      }

      // 4. Clear cart and show confirmation
      toast({
        title: "Order Processed",
        description: "Your equipment logistics are being finalized.",
      });
      
      clearCart();
      const confirmedOrderNumber =
        orderPayload?.orderNumber || orderPayload?.order_number || orderId;
      navigate("/order-confirmed", { state: { orderId, orderNumber: confirmedOrderNumber } });
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Logistics Error",
        description: error instanceof Error ? error.message : "Failed to initialize order sequence. Please retry.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      orderSubmittedRef.current = false;
    }
  };
  
  const handleBillingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateBilling(billingData);
    setBillingErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast({ title: "Please fix the highlighted fields", variant: "destructive" });
      return;
    }
    setStep(2);
  };
  
  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sameAsBilling) {
      const errors = validateShipping(shippingData);
      setShippingErrors(errors);
      if (Object.keys(errors).length > 0) {
        toast({ title: "Please fix the highlighted fields", variant: "destructive" });
        return;
      }
    }
    setStep(3);
  };

  if (items.length === 0) return null;

  const handleEmailBlur = async () => {
    if (billingData.email && billingData.email.includes('@')) {
      try {
        await api.saveCart({
          email: billingData.email,
          cart_data: { items, subtotal, tax, shipping, total }
        });
      } catch (error) {
        console.error('Failed to track cart:', error);
      }
    }
  };

  const steps = [
    { id: 1, name: t("checkout.billing") },
    { id: 2, name: t("checkout.shipping") },
    { id: 3, name: t("checkout.payment") },
    { id: 4, name: t("checkout.review") },
  ];

  return (
    <div className="bg-background min-h-screen text-foreground font-sans lowercase-buttons">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-20 lg:py-24">
        
        {/* Modern Minimal Header */}
        <header className="mb-12 md:mb-20 flex flex-col md:flex-row md:items-end md:justify-between gap-8 border-b border-border pb-12">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px w-6 bg-accent/60" />
              <span className="font-display font-black uppercase tracking-[0.3em] text-[10px] text-accent"> Secure Procurement Pipeline </span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter leading-none">
              {t("checkout.title")}
            </h1>
          </div>
          
          {/* Progress Indicator */}
          <nav className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {steps.map((s, i) => (
              <React.Fragment key={s.id}>
                <div 
                  className={`flex items-center gap-2 shrink-0 transition-opacity ${step >= s.id ? "opacity-100" : "opacity-30"}`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-black text-xs border-2 ${step >= s.id ? "border-accent bg-accent text-white shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]" : "border-border text-muted-foreground"}`}>
                    {s.id}
                  </span>
                  <span className="text-[10px] font-display font-black uppercase tracking-widest hidden sm:block">{s.name}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-[2px] w-6 bg-border mx-2 shrink-0 ${step > s.id ? "bg-accent" : "bg-border transition-colors duration-500"}`} />
                )}
              </React.Fragment>
            ))}
          </nav>
        </header>

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-start">
          
          {/* Main Form Area */}
          <div className="lg:col-span-8">
            <div className="bg-card/30 backdrop-blur-sm border border-border/80 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] rounded-full pointer-events-none" />
              
              {/* Step 1: Billing */}
              {step === 1 && (
                <form onSubmit={handleBillingSubmit} className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-8">
                    <h2 className="font-display font-black text-2xl uppercase tracking-tight flex items-center gap-4">
                        <span className="text-accent">01.</span> {t("checkout.billing")}
                    </h2>
                    {isAuthenticated && (billingData.firstName || billingData.email) && (
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/5 border border-accent/20 text-xs font-bold text-accent uppercase tracking-wider">
                        <ShieldCheck className="h-3.5 w-3.5" /> {t("checkout.prefilled_notice")}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <InputField label={t("checkout.first_name")} name="firstName" value={billingData.firstName} onChange={(v) => { setBillingData({...billingData, firstName: v}); setBillingErrors(e => { const {firstName, ...rest} = e; return rest; }); }} placeholder="John" error={billingErrors.firstName} />
                      <InputField label={t("checkout.last_name")} name="lastName" value={billingData.lastName} onChange={(v) => { setBillingData({...billingData, lastName: v}); setBillingErrors(e => { const {lastName, ...rest} = e; return rest; }); }} placeholder="Doe" error={billingErrors.lastName} />
                      <InputField label={t("checkout.email")} name="email" type="email" value={billingData.email} onChange={(v) => { setBillingData({...billingData, email: v}); setBillingErrors(e => { const {email, ...rest} = e; return rest; }); }} onBlur={handleEmailBlur} placeholder="procurement@corp.com" error={billingErrors.email} />
                      <InputField label={t("checkout.phone")} name="phone" value={billingData.phone} onChange={(v) => { setBillingData({...billingData, phone: v}); setBillingErrors(e => { const {phone, ...rest} = e; return rest; }); }} placeholder="+1 555-0100" error={billingErrors.phone} />
                      <div className="sm:col-span-2">
                        <InputField label={t("checkout.company")} name="company" required={false} value={billingData.company} onChange={(v) => setBillingData({...billingData, company: v})} placeholder="Enterprise Logistics Inc" />
                      </div>
                      <div className="sm:col-span-2">
                         <InputField label={t("checkout.tax_id")} name="taxId" required={false} value={billingData.taxId} onChange={(v) => setBillingData({...billingData, taxId: v})} placeholder="VAT/Tax ID (Optional)" />
                      </div>
                      <div className="sm:col-span-2">
                        <InputField label={t("checkout.street_address_1")} name="address" value={billingData.address} onChange={(v) => { setBillingData({...billingData, address: v}); setBillingErrors(e => { const {address, ...rest} = e; return rest; }); }} placeholder="1113 Rte Harwood" error={billingErrors.address} />
                      </div>
                      <div className="sm:col-span-2">
                        <InputField label={t("checkout.street_address_2")} name="address2" required={false} value={billingData.address2} onChange={(v) => setBillingData({...billingData, address2: v})} placeholder="Suite, Unit, Apt..." />
                      </div>
                      <InputField label={t("checkout.city")} name="city" value={billingData.city} onChange={(v) => { setBillingData({...billingData, city: v}); setBillingErrors(e => { const {city, ...rest} = e; return rest; }); }} placeholder="Vaudreuil-Dorion" error={billingErrors.city} />
                      <InputField label={t("checkout.province")} name="province" value={billingData.province} onChange={(v) => { setBillingData({...billingData, province: v}); setBillingErrors(e => { const {province, ...rest} = e; return rest; }); }} placeholder="QC" error={billingErrors.province} />
                      <InputField label={t("checkout.postal")} name="postal" value={billingData.postal} onChange={(v) => { setBillingData({...billingData, postal: v}); setBillingErrors(e => { const {postal, ...rest} = e; return rest; }); }} placeholder="J7V 8P2" error={billingErrors.postal} />
                      <InputField label={t("checkout.country")} name="country" value={billingData.country} onChange={(v) => { setBillingData({...billingData, country: v}); setBillingErrors(e => { const {country, ...rest} = e; return rest; }); }} placeholder="CA" error={billingErrors.country} />
                    </div>
                  </div>
                  <button type="submit" className="group bg-foreground text-background px-10 py-5 rounded-2xl font-display font-black uppercase tracking-[0.2em] text-[11px] hover:bg-accent hover:shadow-2xl transition-all flex items-center justify-between w-full sm:w-auto ml-auto">
                    <span>{t("checkout.continue")}</span>
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform ml-4" strokeWidth={3} />
                  </button>
                </form>
              )}

              {/* Step 2: Shipping */}
              {step === 2 && (
                <form onSubmit={handleShippingSubmit} className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-8">
                    <h2 className="font-display font-black text-2xl uppercase tracking-tight flex items-center gap-4">
                        <span className="text-accent">02.</span> {t("checkout.shipping")}
                    </h2>

                    {/* Same as billing checkbox */}
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${sameAsBilling ? "border-accent bg-accent" : "border-border group-hover:border-accent/50"}`}>
                        {sameAsBilling && <MapPin className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                      </div>
                      <input
                        type="checkbox"
                        checked={sameAsBilling}
                        onChange={(e) => {
                          setSameAsBilling(e.target.checked);
                          if (e.target.checked) {
                            setShippingData({
                              company: billingData.company,
                              address: billingData.address,
                              address2: billingData.address2,
                              city: billingData.city,
                              province: billingData.province,
                              postal: billingData.postal,
                              country: billingData.country,
                            });
                          }
                        }}
                        className="sr-only"
                      />
                      <span className="text-sm font-black uppercase tracking-tight">{t("checkout.same_as_billing") !== "checkout.same_as_billing" ? t("checkout.same_as_billing") : "Ship to billing address"}</span>
                    </label>

                    {/* Shipping fields — hidden when same as billing */}
                    {!sameAsBilling && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="sm:col-span-2">
                          <InputField label={t("checkout.company")} name="shipCompany" required={false} value={shippingData.company} onChange={(v) => setShippingData({...shippingData, company: v})} placeholder="Recipient Company" />
                        </div>
                        <div className="sm:col-span-2">
                          <InputField label={t("checkout.street_address_1")} name="shipAddress" value={shippingData.address} onChange={(v) => { setShippingData({...shippingData, address: v}); setShippingErrors(e => { const {address, ...rest} = e; return rest; }); }} placeholder="Street address" error={shippingErrors.address} />
                        </div>
                        <div className="sm:col-span-2">
                          <InputField label={t("checkout.street_address_2")} name="shipAddress2" required={false} value={shippingData.address2} onChange={(v) => setShippingData({...shippingData, address2: v})} placeholder="Suite, Unit, Apt..." />
                        </div>
                        <InputField label={t("checkout.city")} name="shipCity" value={shippingData.city} onChange={(v) => { setShippingData({...shippingData, city: v}); setShippingErrors(e => { const {city, ...rest} = e; return rest; }); }} placeholder="City" error={shippingErrors.city} />
                        <InputField label={t("checkout.province")} name="shipProvince" value={shippingData.province} onChange={(v) => { setShippingData({...shippingData, province: v}); setShippingErrors(e => { const {province, ...rest} = e; return rest; }); }} placeholder="Province" error={shippingErrors.province} />
                        <InputField label={t("checkout.postal")} name="shipPostal" value={shippingData.postal} onChange={(v) => { setShippingData({...shippingData, postal: v}); setShippingErrors(e => { const {postal, ...rest} = e; return rest; }); }} placeholder="Postal Code" error={shippingErrors.postal} />
                        <InputField label={t("checkout.country")} name="shipCountry" value={shippingData.country} onChange={(v) => { setShippingData({...shippingData, country: v}); setShippingErrors(e => { const {country, ...rest} = e; return rest; }); }} placeholder="Country" error={shippingErrors.country} />
                      </div>
                    )}

                    {sameAsBilling && (
                      <div className="p-6 rounded-2xl bg-accent/5 border-2 border-accent/20">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-accent" />
                          {billingData.address}, {billingData.city}, {billingData.province} {billingData.postal}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6">
                    <button type="button" onClick={() => setStep(1)} className="group flex items-center gap-3 text-xs font-display font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                      <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> {t("checkout.back")}
                    </button>
                    <button type="submit" className="group bg-foreground text-background px-10 py-5 rounded-2xl font-display font-black uppercase tracking-[0.2em] text-[11px] hover:bg-accent hover:shadow-2xl transition-all flex items-center justify-between w-full sm:w-auto">
                      <span>{t("checkout.continue")}</span>
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform ml-4" strokeWidth={3} />
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: Payment */}
              {step === 3 && (
                <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-8">
                    <h2 className="font-display font-black text-2xl uppercase tracking-tight flex items-center gap-4">
                        <span className="text-accent">03.</span> {t("checkout.payment")}
                    </h2>
                    <div className="space-y-4">
                      {[
                        { key: "checkout.payment_stripe", value: "stripe", icon: CreditCard, descKey: "checkout.payment_stripe_desc", descFallback: "Instant clearance via secure gateway.", show: true, badge: null },
                        { key: "checkout.payment_bank", value: "bank", icon: Landmark, descKey: "checkout.payment_bank_desc", descFallback: "Direct wire transfer protocols.", show: true, badge: "Wire" },
                        { key: "checkout.payment_cash", value: "cash", icon: Banknote, descKey: "checkout.payment_cash_desc", descFallback: "Pay with cash upon delivery.", show: true, badge: "COD" },
                        { key: "checkout.payment_check", value: "check", icon: FileCheck, descKey: "checkout.payment_check_desc", descFallback: "Pay by check upon delivery.", show: true, badge: "COD" },
                        { key: "checkout.payment_contract", value: "contract", icon: FileSignature, descKey: "checkout.payment_contract_desc", descFallback: "Invoiced per your contract terms.", show: isAuthenticated && isContractCustomer, badge: "Contract" },
                        { key: "checkout.payment_installments", value: "installments", icon: CalendarClock, descKey: "checkout.payment_installments_desc", descFallback: "Split payment into multiple phases.", show: isAuthenticated, badge: "Multi-Phase" },
                        { key: "checkout.payment_other", value: "other", icon: HelpCircle, descKey: "checkout.payment_other_desc", descFallback: "Specify your preferred payment method.", show: true, badge: null },
                      ].filter(o => o.show).map(({ key, value, icon: Icon, descKey, descFallback, badge }) => (
                        <label 
                          key={key} 
                          className={`group flex items-center gap-6 border-2 rounded-2xl p-6 cursor-pointer transition-all ${paymentMethod === value ? "border-accent bg-accent/5 ring-4 ring-accent/10" : "border-border/60 hover:border-border hover:bg-white/5"}`}
                          onClick={() => {
                            if (value === "installments" && !isContractCustomer) {
                              setShowContractPrompt(true);
                            }
                          }}
                        >
                          <div className="relative flex items-center justify-center">
                            <input 
                              type="radio" 
                              name="payment" 
                              value={value}
                              checked={paymentMethod === value}
                              onChange={(e) => {
                                if (value === "installments" && !isContractCustomer) {
                                  e.preventDefault();
                                  setShowContractPrompt(true);
                                  return;
                                }
                                setPaymentMethod(e.target.value);
                              }}
                              className="sr-only" 
                            />
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === value ? "border-accent bg-accent" : "border-border"}`}>
                                {paymentMethod === value && <div className="w-2 h-2 rounded-full bg-white shadow-lg" />}
                            </div>
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center border border-border group-hover:scale-110 transition-transform">
                            <Icon className={`h-6 w-6 ${paymentMethod === value ? "text-accent" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1">
                            <span className="block text-sm font-black uppercase tracking-tight">{t(key)}</span>
                            <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-tighter opacity-80">{t(descKey) !== descKey ? t(descKey) : descFallback}</p>
                          </div>
                          {badge && <span className="text-[9px] font-black text-muted-foreground bg-muted px-2 py-1 rounded uppercase tracking-[0.2em]">{badge}</span>}
                        </label>
                      ))}

                      {/* Cash/Check COD notice */}
                      {(paymentMethod === "cash" || paymentMethod === "check") && (
                        <div className="flex items-start gap-4 p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 mt-2">
                          <Phone className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-black uppercase tracking-tight text-amber-700">{t("checkout.cod_call_notice_title")}</p>
                            <p className="text-xs text-amber-600/80 mt-1">{t("checkout.cod_call_notice_desc")}</p>
                          </div>
                        </div>
                      )}

                      {/* Other payment method text input */}
                      {paymentMethod === "other" && (
                        <div className="p-6 rounded-2xl bg-accent/5 border-2 border-accent/20 mt-2 space-y-3">
                          <h4 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                            <HelpCircle className="h-4 w-4 text-accent" />
                            {t("checkout.payment_other")}
                          </h4>
                          <textarea
                            className="w-full bg-background border-2 border-border/60 hover:border-border rounded-xl px-4 py-3.5 text-sm font-medium text-foreground outline-none focus:border-accent transition-all shadow-sm resize-none"
                            rows={3}
                            value={paymentOtherNote}
                            onChange={(e) => setPaymentOtherNote(e.target.value)}
                            placeholder={t("checkout.payment_other_placeholder")}
                          />
                        </div>
                      )}

                      {/* Installment count selector (contract customers only) */}
                      {paymentMethod === "installments" && isContractCustomer && (
                        <div className="p-6 rounded-2xl bg-accent/5 border-2 border-accent/20 mt-2 space-y-4">
                          <h4 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-accent" />
                            {t("checkout.select_installments")}
                          </h4>
                          <div className="grid grid-cols-4 gap-3">
                            {[2, 3, 4, 6].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setInstallmentCount(n)}
                                className={`py-3 rounded-xl text-center font-black text-sm border-2 transition-all ${
                                  installmentCount === n
                                    ? "border-accent bg-accent text-white shadow-lg"
                                    : "border-border bg-background hover:border-accent/50"
                                }`}
                              >
                                {n}x
                                <span className="block text-[10px] font-medium mt-0.5 opacity-70">
                                  {formatPrice(total / n)}/mo
                                </span>
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {t("checkout.installments_note")}
                          </p>
                        </div>
                      )}

                      {/* Contract prompt modal */}
                      {showContractPrompt && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                          <div className="bg-card rounded-3xl p-8 max-w-md mx-4 shadow-2xl border border-border space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                                <AlertTriangle className="h-6 w-6 text-amber-500" />
                              </div>
                              <h3 className="font-display font-black text-lg uppercase tracking-tight">{t("checkout.contract_required_title")}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {t("checkout.contract_required_desc")}
                            </p>
                            <div className="flex gap-3">
                              <button
                                onClick={() => setShowContractPrompt(false)}
                                className="flex-1 px-4 py-3 rounded-xl border-2 border-border text-sm font-black uppercase tracking-wider hover:bg-muted transition-colors"
                              >
                                {t("checkout.back")}
                              </button>
                              <button
                                onClick={() => navigate("/apply")}
                                className="flex-1 px-4 py-3 rounded-xl bg-accent text-white text-sm font-black uppercase tracking-wider hover:bg-accent/90 transition-colors shadow-lg"
                              >
                                {t("checkout.sign_contract")}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6">
                    <button type="button" onClick={() => setStep(2)} className="group flex items-center gap-3 text-xs font-display font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                      <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> {t("checkout.back")}
                    </button>
                    <button onClick={() => setStep(4)} className="group bg-foreground text-background px-10 py-5 rounded-2xl font-display font-black uppercase tracking-[0.2em] text-[11px] hover:bg-accent hover:shadow-2xl transition-all flex items-center justify-between w-full sm:w-auto">
                      <span>{t("checkout.continue")}</span>
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform ml-4" strokeWidth={3} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Final Review */}
              {step === 4 && (
                <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <h2 className="font-display font-black text-2xl uppercase tracking-tight flex items-center gap-4">
                            <span className="text-accent">04.</span> Final Authorization
                        </h2>
                        <ShieldCheck className="h-8 w-8 text-accent animate-pulse" />
                    </div>
                    
                    <div className="space-y-6">
                      <div className="bg-muted/40 rounded-3xl p-8 border border-border/60">
                         <div className="flex items-center justify-between mb-6">
                           <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t("checkout.items_in_order")}</h4>
                           <button
                             type="button"
                             onClick={async () => {
                               const ok = await confirm({
                                 title: t("checkout.clear_cart"),
                                 message: t("checkout.clear_cart_confirm"),
                                 confirmLabel: t("cart.clear_all"),
                                 variant: "danger",
                               });
                               if (ok) { clearCart(); navigate("/products"); }
                             }}
                             className="inline-flex items-center gap-1.5 text-destructive hover:text-destructive/80 font-display font-bold uppercase tracking-widest text-[9px] transition-colors"
                           >
                             <XCircle className="h-3 w-3" strokeWidth={2.5} />
                             {t("cart.clear_all")}
                           </button>
                         </div>
                         <div className="space-y-4">
                            {items.map(({ product, quantity }) => (
                                <div key={product.id} className="flex items-center gap-4 border-b border-border/40 pb-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black uppercase tracking-tight truncate">{product.name}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1 uppercase font-medium">{t("checkout.unit_price")}: {formatPrice(product.salePrice)}</p>
                                    </div>
                                    <div className="flex items-center border border-border/80 bg-background rounded-lg shadow-sm h-8 overflow-hidden shrink-0">
                                      <button type="button" onClick={() => updateQuantity(product.id, quantity - 1)} className="w-8 h-full flex items-center justify-center hover:bg-muted/50 text-foreground transition-colors"><Minus className="h-3 w-3" strokeWidth={2.5} /></button>
                                      <span className="w-8 h-full flex items-center justify-center font-display font-bold text-xs bg-muted/10 border-x border-border/50">{quantity}</span>
                                      <button type="button" onClick={() => updateQuantity(product.id, quantity + 1)} className="w-8 h-full flex items-center justify-center hover:bg-muted/50 text-foreground transition-colors"><Plus className="h-3 w-3" strokeWidth={2.5} /></button>
                                    </div>
                                    <button type="button" onClick={() => removeItem(product.id)} className="text-muted-foreground/50 hover:text-destructive p-1.5 rounded-lg transition-colors shrink-0" aria-label={t("cart.remove")}>
                                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    </button>
                                    <div className="text-right shrink-0 w-20">
                                      <span className="text-sm font-black text-foreground">{formatPrice(product.salePrice * quantity)}</span>
                                      {product.discountPercent > 0 && (
                                        <p className="text-[10px] text-muted-foreground line-through">{formatPrice(product.price * quantity)}</p>
                                      )}
                                    </div>
                                </div>
                            ))}
                         </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-6">
                         <div className="p-6 border border-border/60 rounded-3xl bg-white/5">
                            <div className="flex items-center gap-2 text-accent mb-3">
                                <PackageCheck className="h-4 w-4" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Delivery Protocol</span>
                            </div>
                            <p className="text-xs font-bold leading-relaxed opacity-80">
                                {sameAsBilling ? billingData.company : shippingData.company}<br />
                                {sameAsBilling ? billingData.address : shippingData.address}<br />
                                {sameAsBilling ? billingData.city : shippingData.city}, {sameAsBilling ? billingData.province : shippingData.province}
                            </p>
                         </div>
                         <div className="p-6 border border-border/60 rounded-3xl bg-white/5">
                            <div className="flex items-center gap-2 text-accent mb-3">
                                <CreditCard className="h-4 w-4" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Settlement Layer</span>
                            </div>
                             <p className="text-xs font-black uppercase tracking-widest opacity-80">
                                {paymentMethod === 'stripe' ? t('checkout.payment_stripe') 
                                  : paymentMethod === 'contract' ? t('checkout.payment_contract') 
                                  : paymentMethod === 'installments' ? `${t('checkout.payment_installments')} (${installmentCount}x)`
                                  : paymentMethod === 'cash' ? t('checkout.payment_cash')
                                  : paymentMethod === 'check' ? t('checkout.payment_check')
                                  : paymentMethod === 'other' ? t('checkout.payment_other')
                                  : t('checkout.payment_bank')}
                             </p>
                             {paymentMethod === 'other' && paymentOtherNote && (
                               <p className="text-[10px] text-muted-foreground mt-1 font-medium">{paymentOtherNote}</p>
                             )}
                            <p className="text-[10px] text-muted-foreground mt-2 font-medium">Auto-invoice generated upon sequence completion.</p>
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6">
                    <button 
                      type="button" 
                      onClick={() => setStep(3)} 
                      disabled={isSubmitting}
                      className="group flex items-center gap-3 text-xs font-display font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> {t("checkout.back")}
                    </button>
                    <button 
                      onClick={handlePlaceOrder} 
                      disabled={isSubmitting}
                      className="group bg-accent text-white px-12 py-6 rounded-2xl font-display font-black uppercase tracking-[0.2em] text-[12px] shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)] hover:shadow-[0_0_40px_rgba(var(--accent-rgb),0.5)] transition-all flex items-center justify-between w-full sm:w-auto active:scale-[0.98] disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-4"><Loader2 className="h-5 w-5 animate-spin" /> SECURING TRANSIT...</span>
                        ) : (
                            <>
                                <span>{t("checkout.place_order")}</span>
                                <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform ml-6" strokeWidth={3} />
                            </>
                        )}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer Notice */}
            <div className="mt-8 flex items-center justify-center gap-6 opacity-40">
                <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all cursor-default">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" className="h-4" />
                </div>
                <div className="h-1 w-1 rounded-full bg-border" />
                <span className="text-[9px] font-black uppercase tracking-widest">SSL Secure End-to-End Encryption</span>
            </div>
          </div>

          {/* Sidebar Summary */}
          <div className="lg:col-span-4 sticky top-24">
            <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors pointer-events-none" />
              
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-display font-black text-[10px] uppercase tracking-[0.3em] text-accent">{t("checkout.order_summary")}</h3>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: t("checkout.clear_cart"),
                      message: t("checkout.clear_cart_confirm"),
                      confirmLabel: t("cart.clear_all"),
                      variant: "danger",
                    });
                    if (ok) { clearCart(); navigate("/products"); }
                  }}
                  className="inline-flex items-center gap-1 text-destructive hover:text-destructive/80 font-display font-bold uppercase tracking-widest text-[8px] transition-colors"
                >
                  <XCircle className="h-3 w-3" strokeWidth={2.5} />
                  {t("cart.clear_all")}
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="flex justify-between items-center group/row">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest group-hover/row:text-foreground transition-colors">{t("cart.subtotal")}</span>
                  <span className="text-sm font-black">{formatPrice(subtotal)}</span>
                </div>
                {taxLines.length > 0 ? (
                  taxLines.map((tl, i) => (
                    <div key={i} className="flex justify-between items-center group/row">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest group-hover/row:text-foreground transition-colors">{tl.label_en} ({tl.rate}%)</span>
                      <span className="text-sm font-black">{formatPrice(tl.amount)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between items-center group/row">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest group-hover/row:text-foreground transition-colors">{t("cart.tax")}</span>
                    <span className="text-sm font-black">{formatPrice(tax)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center group/row">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest group-hover/row:text-foreground transition-colors">{t("cart.shipping")}</span>
                  <span className={`text-sm font-black ${shipping === 0 ? "text-success" : ""}`}>
                    {shipping === 0 ? "PROMO FREE" : formatPrice(shipping)}
                  </span>
                </div>
                
                <div className="my-8 border-t-4 border-double border-border" />
                
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-accent block mb-1">Total Procurement Cost</span>
                    <p className="text-3xl font-display font-black uppercase tracking-tighter text-foreground leading-none">{formatPrice(total)}</p>
                  </div>
                </div>

                {/* Helpful icons */}
                <div className="mt-10 grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center gap-3 p-4 bg-muted/20 rounded-2xl text-center border border-border/40 group/sub">
                        <MapPin className="h-4 w-4 text-muted-foreground group-hover/sub:text-accent transition-colors" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Logistics Tracking</span>
                    </div>
                    <div className="flex flex-col items-center gap-3 p-4 bg-muted/20 rounded-2xl text-center border border-border/40 group/sub">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground group-hover/sub:text-accent transition-colors" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Assigned Support</span>
                    </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
