import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, Search } from "lucide-react";
import type { UserEntry } from "@/utils/mockData";

type SortKey = "date" | "country" | "city" | "ip" | "browser" | "device" | "pageViews";

export default function UserStatsTable({ users }: { users: UserEntry[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const perPage = 12;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.ip.includes(q) ||
        u.country.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q) ||
        u.browser.toLowerCase().includes(q) ||
        u.referrer.toLowerCase().includes(q)
    );
  }, [users, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortKey === "pageViews") cmp = a.pageViews - b.pageViews;
      else cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.ceil(sorted.length / perPage);
  const paged = sorted.slice(page * perPage, (page + 1) * perPage);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortAsc ? <ChevronUp className="inline h-3.5 w-3.5" /> : <ChevronDown className="inline h-3.5 w-3.5" />
    ) : null;

  const thClass =
    "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-[#48698e] transition-colors";

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  return (
    <div className="rounded-xl border border-[#48698e]/20 bg-white overflow-hidden">
      {/* Search */}
      <div className="p-4 border-b border-[#48698e]/10 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#48698e]/50" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#48698e]/20 text-sm bg-[#f7f9fb] text-[#1f354d] placeholder:text-[#48698e]/40 outline-none focus:ring-2 focus:ring-[#48698e]/30 transition"
            placeholder="Search by IP, country, city, browser…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <span className="text-xs text-[#48698e]/60 whitespace-nowrap">{filtered.length} entries</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1f354d]/[0.04] text-[#1f354d]/70">
              <th className={thClass} onClick={() => toggleSort("date")}>Date <SortIcon col="date" /></th>
              <th className={thClass} onClick={() => toggleSort("ip")}>IP Address <SortIcon col="ip" /></th>
              <th className={thClass} onClick={() => toggleSort("country")}>Country <SortIcon col="country" /></th>
              <th className={thClass} onClick={() => toggleSort("city")}>City <SortIcon col="city" /></th>
              <th className={thClass} onClick={() => toggleSort("browser")}>Browser <SortIcon col="browser" /></th>
              <th className={thClass} onClick={() => toggleSort("device")}>Device <SortIcon col="device" /></th>
              <th className={thClass} onClick={() => toggleSort("pageViews")}>Views <SortIcon col="pageViews" /></th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider">Duration</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider">Source</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((u) => (
              <tr key={u.id} className="border-t border-[#48698e]/8 hover:bg-[#48698e]/[0.03] transition-colors">
                <td className="px-3 py-2.5 text-[#1f354d]/80 whitespace-nowrap">{formatDate(u.date)}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-[#48698e]">{u.ip}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="mr-1.5">{u.flag}</span>
                  <span className="text-[#1f354d]">{u.country}</span>
                </td>
                <td className="px-3 py-2.5 text-[#1f354d]/70">{u.city}</td>
                <td className="px-3 py-2.5 text-[#1f354d]/70">{u.browser}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    u.device === "Desktop" ? "bg-[#1f354d]/8 text-[#1f354d]" :
                    u.device === "Mobile" ? "bg-[#48698e]/10 text-[#48698e]" :
                    "bg-[#48698e]/5 text-[#48698e]/80"
                  }`}>
                    {u.device}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center font-medium text-[#1f354d]">{u.pageViews}</td>
                <td className="px-3 py-2.5 text-[#48698e]/70 text-xs">{formatDuration(u.sessionDuration)}</td>
                <td className="px-3 py-2.5 text-[#48698e]/70 text-xs">{u.referrer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-[#48698e]/10 flex items-center justify-between">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#1f354d] bg-[#48698e]/8 hover:bg-[#48698e]/15 disabled:opacity-30 transition"
          >
            Previous
          </button>
          <span className="text-xs text-[#48698e]/60">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#1f354d] bg-[#48698e]/8 hover:bg-[#48698e]/15 disabled:opacity-30 transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
