import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, Package, ShoppingBag, Users as UsersIcon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import { api, Customer, Order, Product, unwrapApiList } from "@/lib/api";

export function AdminGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (open && customers.length === 0 && !loading) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const [custRes, ordRes, prodRes] = await Promise.allSettled([
            api.getCustomers(1, 100),
            api.getOrders(1, 100),
            api.getProducts(1, 100),
          ]);
          
          if (custRes.status === 'fulfilled') {
            setCustomers(unwrapApiList(custRes.value as any, []));
          }
          if (ordRes.status === 'fulfilled') {
            setOrders(unwrapApiList(ordRes.value as any, []));
          }
          if (prodRes.status === 'fulfilled') {
            setProducts(unwrapApiList(prodRes.value as any, []));
          }
        } catch (error) {
          console.error("Global search data fetch error:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [open, customers.length, loading]);

  const onSelect = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-secondary/50 hover:bg-secondary rounded-md transition-colors border border-border w-full max-w-xs sm:w-64 focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <Search className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left hidden sm:inline-block">Search...</span>
        <span className="flex-1 text-left sm:hidden">Search</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <DialogTitle className="sr-only">Global Search</DialogTitle>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList className="max-h-[60vh]">
          {loading ? (
             <div className="py-6 text-center text-sm flex flex-col items-center justify-center text-muted-foreground gap-2">
               <Loader2 className="h-4 w-4 animate-spin" />
               Loading data...
             </div>
          ) : (
             <CommandEmpty>No results found.</CommandEmpty>
          )}

          {!loading && customers.length > 0 && (
            <CommandGroup heading="Customers">
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.full_name + " " + customer.email}
                  onSelect={() => onSelect(`/admin/customers/${customer.id}`)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <UsersIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{customer.full_name}</span>
                    <span className="text-xs text-muted-foreground truncate">{customer.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!loading && customers.length > 0 && <CommandSeparator />}

          {!loading && orders.length > 0 && (
            <CommandGroup heading="Orders">
              {orders.map((order) => (
                <CommandItem
                  key={order.id}
                  value={order.order_number + " " + (order.customer_email || "")}
                  onSelect={() => onSelect(`/admin/orders/${order.id}`)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <ShoppingBag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{order.order_number}</span>
                    <span className="text-xs text-muted-foreground truncate">{order.status} - ${Number(order.total_amount).toFixed(2)}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!loading && orders.length > 0 && <CommandSeparator />}

          {!loading && products.length > 0 && (
            <CommandGroup heading="Products">
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name + " " + product.sku}
                  onSelect={() => onSelect(`/admin/products/${product.id}`)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate max-w-[250px]">{product.name}</span>
                    <span className="text-xs text-muted-foreground truncate">SKU: {product.sku}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
