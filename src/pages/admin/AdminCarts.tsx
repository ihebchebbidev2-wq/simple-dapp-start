import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, Search, Briefcase, Eye, Ban, CheckCircle, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { api } from "@/lib/api";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Helper components
const Badge = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "destructive" | "outline" }) => {
  const variants = {
    default: "bg-accent/10 text-accent",
    success: "bg-emerald-500/10 text-emerald-500",
    warning: "bg-amber-500/10 text-amber-500",
    destructive: "bg-red-500/10 text-red-500",
    outline: "border border-border text-foreground"
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${variants[variant]}`}>{children}</span>;
};

export default function AdminCarts() {
  const { t, lang } = useLanguage();
  const { formatPrice } = useCurrency();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedCart, setSelectedCart] = useState<any | null>(null);
  
  const { data, isLoading } = useQuery({
    queryKey: ['admin_carts', page, statusFilter],
    queryFn: () => api.getAbandonedCarts(page, 50, statusFilter),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string | number, status: 'abandoned' | 'recovered' | 'completed' }) => 
        api.updateCartStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['admin_carts'] });
      const prev = queryClient.getQueryData(['admin_carts', page, statusFilter]);
      queryClient.setQueryData(['admin_carts', page, statusFilter], (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((c: any) => c.id === id ? { ...c, status } : c) };
      });
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_carts'] });
      showSuccessToast("Carts", "Cart status updated successfully.");
      setSelectedCart(null);
    },
    onError: (e: unknown, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['admin_carts', page, statusFilter], context.prev);
      showErrorToast("Carts", e instanceof Error ? e.message : "Failed to update cart status.");
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="success">Completed</Badge>;
      case 'recovered': return <Badge variant="warning">Recovered</Badge>;
      case 'abandoned':
      default: return <Badge variant="destructive">Abandoned</Badge>;
    }
  };

  const carts = data?.data || [];
  const pagination = (data?.pagination as any) || { total: 0, pages: 1 };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-black uppercase tracking-tight">Abandoned Carts</h1>
          <p className="text-sm text-muted-foreground mt-1">Track and recover lost checkout sessions.</p>
        </div>
        <button className="flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent hover:text-white transition-all">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>
      
      {/* Filters */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by email..." 
              className="w-full bg-background border border-border/50 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-border/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-accent transition-colors sm:w-48 appearance-none"
          >
            <option value="">All Statuses</option>
            <option value="abandoned">Abandoned</option>
            <option value="recovered">Recovered</option>
            <option value="completed">Completed</option>
          </select>
      </div>
      
      {/* Carts Table */}
      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border/50">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Customer</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Items</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Value</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Status</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <div className="flex justify-center items-center gap-3">
                      <div className="h-4 w-4 rounded-full border-2 border-accent border-r-transparent animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-widest">Loading Records...</span>
                    </div>
                  </td>
                </tr>
              ) : carts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <p className="text-sm">No checkout sessions found.</p>
                  </td>
                </tr>
              ) : (
                carts.map((cart: any) => (
                  <tr key={cart.id} className="border-b border-border/10 hover:bg-muted/10 transition-colors">
                    <td className="p-4">
                      <div className="text-sm font-medium">
                        {format(new Date(cart.created_at), 'MMM dd, yyyy', { locale: lang === 'fr' ? fr : undefined })}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(cart.created_at), 'HH:mm')}
                      </div>
                    </td>
                    <td className="p-4 font-medium text-sm">
                      <a href={`mailto:${cart.email}`} className="hover:text-accent transition-colors">{cart.email}</a>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {cart.cart_data?.items?.length || 0} items
                    </td>
                    <td className="p-4 font-black text-right">
                      {formatPrice(cart.cart_data?.total || 0)}
                    </td>
                    <td className="p-4 text-center">
                      {getStatusBadge(cart.status)}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setSelectedCart(cart)}
                        className="inline-flex items-center justify-center p-2 rounded-lg bg-muted/50 hover:bg-accent/10 hover:text-accent transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder */}
        {pagination.pages > 1 && (
            <div className="p-4 border-t border-border/50 flex justify-between items-center bg-muted/10">
                <button 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                    Prev
                </button>
                <div className="text-xs font-bold uppercase tracking-widest">
                    Page <span className="text-accent">{page}</span> of {pagination.pages}
                </div>
                <button 
                    disabled={page >= pagination.pages}
                    onClick={() => setPage(p => p + 1)}
                    className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                    Next
                </button>
            </div>
        )}
      </div>

      {/* Cart Details Dialog */}
      <Dialog open={!!selectedCart} onOpenChange={(open) => !open && setSelectedCart(null)}>
        <DialogContent className="max-w-2xl bg-card border-border p-0 overflow-hidden">
            {selectedCart && (
                <>
                    <div className="p-6 border-b border-border/50 bg-muted/20">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <DialogTitle className="text-xl font-display font-black uppercase tracking-tight">Checkout Session Details</DialogTitle>
                                <DialogDescription className="mt-1">ID: #{selectedCart.id} • {format(new Date(selectedCart.created_at), 'PPp')}</DialogDescription>
                            </div>
                            {getStatusBadge(selectedCart.status)}
                        </div>
                        <div className="flex items-center gap-3 text-sm font-medium bg-background p-3 rounded-xl border border-border/50">
                            <Briefcase className="h-4 w-4 text-accent" />
                            <a href={`mailto:${selectedCart.email}`} className="hover:underline">{selectedCart.email}</a>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Cart Contents</h4>
                        <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-2">
                            {selectedCart.cart_data?.items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-muted/20 border border-border/30">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-background border border-border/50 flex items-center justify-center text-xs font-black">
                                            {item.quantity}x
                                        </div>
                                        <span className="text-sm font-medium">{item.product_name || item.product?.name || 'Unknown Product'}</span>
                                    </div>
                                    <span className="text-sm font-bold text-muted-foreground">
                                        {formatPrice(item.subtotal || item.product?.price * item.quantity || 0)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        
                        <div className="p-4 bg-muted/30 rounded-xl space-y-2 border border-border/50 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span className="font-medium">{formatPrice(selectedCart.cart_data?.subtotal || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tax</span>
                                <span className="font-medium">{formatPrice(selectedCart.cart_data?.tax || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Shipping</span>
                                <span className="font-medium">{formatPrice(selectedCart.cart_data?.shipping || 0)}</span>
                            </div>
                            <div className="pt-2 mt-2 border-t border-border/50 flex justify-between">
                                <span className="text-xs font-black uppercase tracking-widest text-accent">Total</span>
                                <span className="text-lg font-black">{formatPrice(selectedCart.cart_data?.total || 0)}</span>
                            </div>
                        </div>

                        {selectedCart.status === 'abandoned' && (
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => updateStatusMutation.mutate({ id: selectedCart.id, status: 'recovered' })}
                                    className="flex-1 bg-accent text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-accent/90 transition-colors flex justify-center items-center gap-2"
                                >
                                    <CheckCircle className="h-4 w-4" /> Mark as Recovered
                                </button>
                                <button 
                                    onClick={() => updateStatusMutation.mutate({ id: selectedCart.id, status: 'completed' })}
                                    className="flex-1 bg-muted text-foreground border border-border py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-muted/80 transition-colors flex justify-center items-center gap-2"
                                >
                                    <Ban className="h-4 w-4" /> Mark Completed manually
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
