import { Skeleton } from "@/components/ui/skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col bg-card rounded-2xl overflow-hidden border border-border/60">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="p-5 sm:p-6 flex flex-col flex-1">
        <Skeleton className="h-3 w-16 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-3/4 mb-auto" />
        <div className="mt-5 flex items-end justify-between">
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-10 w-full mt-5 rounded-lg lg:hidden" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 xl:gap-8 auto-rows-fr">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
