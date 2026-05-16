import React, { useState, useMemo, useCallback } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Columns3, Download, Trash2, CheckSquare, Square } from "lucide-react";
import { AdminEmptyState } from "./AdminEmptyState";

// ── Column definition ──
export interface DataColumn<T> {
  key: string;
  header: string;
  /** Render cell content */
  render: (row: T) => React.ReactNode;
  /** Sort accessor — return string/number for comparison */
  sortValue?: (row: T) => string | number;
  /** Right-align this column */
  align?: "left" | "right" | "center";
  /** Hide on mobile */
  hideMobile?: boolean;
  /** Min width */
  minWidth?: string;
  /** Can toggle visibility */
  toggleable?: boolean;
}

interface AdminDataTableProps<T> {
  data: T[];
  columns: DataColumn<T>[];
  /** Unique key per row */
  rowKey: (row: T) => string;
  /** Enable row selection checkboxes */
  selectable?: boolean;
  /** Currently selected IDs (controlled) */
  selectedIds?: Set<string>;
  /** Selection change callback */
  onSelectionChange?: (ids: Set<string>) => void;
  /** Bulk actions when items are selected */
  bulkActions?: React.ReactNode;
  /** Row click */
  onRowClick?: (row: T) => void;
  /** Custom row class */
  rowClassName?: (row: T) => string;
  /** Pagination */
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  /** Empty state config */
  emptyState?: {
    resource?: string;
    title?: string;
    description?: string;
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
  };
  /** Loading state */
  isLoading?: boolean;
  /** Export handler */
  onExport?: () => void;
  /** Table label for accessibility */
  label?: string;
}

export function AdminDataTable<T>({
  data,
  columns,
  rowKey,
  selectable = false,
  selectedIds,
  onSelectionChange,
  bulkActions,
  onRowClick,
  rowClassName,
  pagination,
  emptyState,
  isLoading,
  onExport,
  label = "Data",
}: AdminDataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return data;
    const accessor = col.sortValue;
    return [...data].sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [data, sortKey, sortDir, columns]);

  const visibleColumns = columns.filter((c) => !hiddenCols.has(c.key));

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (selectedIds?.size === data.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map(rowKey)));
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange(next);
  };

  const toggleColumn = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const hasSelection = selectedIds && selectedIds.size > 0;

  return (
    <div className="space-y-3">
      {/* Floating bulk action bar */}
      {hasSelection && (
        <div className="sticky top-14 z-20 dashboard-card flex flex-wrap items-center gap-3 bg-accent/5 border-accent/30 py-3 animate-in slide-in-from-top-2 duration-200">
          <span className="text-sm font-semibold tabular-nums">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-border" />
          {bulkActions}
          <button
            onClick={() => onSelectionChange?.(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 justify-end">
        {/* Column picker */}
        <div className="relative">
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="admin-btn--ghost text-xs px-2 py-1.5 gap-1"
            title="Toggle columns"
          >
            <Columns3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Columns</span>
          </button>
          {showColumnPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowColumnPicker(false)} />
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl p-2 min-w-[180px] z-50 animate-in fade-in slide-in-from-top-2">
                {columns
                  .filter((c) => c.toggleable !== false)
                  .map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-secondary rounded-lg"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenCols.has(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded-sm accent-accent"
                      />
                      {col.header}
                    </label>
                  ))}
              </div>
            </>
          )}
        </div>
        {onExport && (
          <button onClick={onExport} className="admin-btn--ghost text-xs px-2 py-1.5 gap-1">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-sm" aria-label={label}>
          <thead>
            <tr className="table-header">
              {selectable && (
                <th className="text-left px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds?.size === data.length && data.length > 0}
                    onChange={toggleAll}
                    className="rounded-sm border-border accent-accent"
                  />
                </th>
              )}
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${col.hideMobile ? "hidden md:table-cell" : ""} ${col.sortValue ? "cursor-pointer select-none" : ""}`}
                  style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                  onClick={col.sortValue ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortValue && (
                      sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3 text-accent" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-accent" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedData.map((row) => {
              const id = rowKey(row);
              const isSelected = selectedIds?.has(id);
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`hover:bg-muted/30 transition-colors ${onRowClick ? "cursor-pointer" : ""} ${isSelected ? "bg-accent/5" : ""} ${rowClassName?.(row) || ""}`}
                >
                  {selectable && (
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected || false}
                        onChange={() => toggleOne(id)}
                        className="rounded-sm border-border accent-accent"
                      />
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-3 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${col.hideMobile ? "hidden md:table-cell" : ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {data.length === 0 && !isLoading && emptyState && (
        <AdminEmptyState {...emptyState} />
      )}
      {data.length === 0 && !isLoading && !emptyState && (
        <AdminEmptyState resource="items" />
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border text-sm text-muted-foreground">
          <span className="text-xs font-medium">
            Showing {data.length} of {pagination.total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
              className="admin-btn--secondary text-xs px-2.5 py-1 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => pagination.onPageChange(pageNum)}
                  className={`min-w-[28px] h-7 rounded-lg text-xs font-semibold transition-colors ${
                    pageNum === pagination.page
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-secondary"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => pagination.onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
              disabled={pagination.page === pagination.totalPages}
              className="admin-btn--secondary text-xs px-2.5 py-1 disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
