import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { UserEntry } from "@/utils/mockData";
import { getCountryStats, getDailyVisits } from "@/utils/mockData";

const COLORS = ["#1f354d", "#48698e", "#6b8db5", "#8fb1d4", "#b4d0ea", "#d4e4f2", "#3a5a7c", "#2c4a6a"];

export default function AnalyticsCharts({ users }: { users: UserEntry[] }) {
  const countryStats = useMemo(() => getCountryStats(users).slice(0, 8), [users]);
  const dailyVisits = useMemo(() => getDailyVisits(users), [users]);

  const browserStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of users) map.set(u.browser, (map.get(u.browser) || 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [users]);

  const deviceStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of users) map.set(u.device, (map.get(u.device) || 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [users]);

  const referrerStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of users) map.set(u.referrer, (map.get(u.referrer) || 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [users]);

  const card = "rounded-xl border border-[#48698e]/15 bg-white p-5";
  const cardTitle = "text-sm font-semibold text-[#1f354d] mb-4";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Daily visitors area chart */}
      <div className={`${card} lg:col-span-2`}>
        <h3 className={cardTitle}>Daily Visitors & Page Views</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={dailyVisits}>
            <defs>
              <linearGradient id="gradVisitors" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1f354d" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#1f354d" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradPageViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#48698e" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#48698e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#48698e20" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#48698e" }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: "#48698e" }} />
            <Tooltip
              contentStyle={{ background: "#fff", border: "1px solid #48698e30", borderRadius: 8, fontSize: 12, color: "#1f354d" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="visitors" stroke="#1f354d" fill="url(#gradVisitors)" strokeWidth={2} name="Visitors" />
            <Area type="monotone" dataKey="pageViews" stroke="#48698e" fill="url(#gradPageViews)" strokeWidth={2} name="Page Views" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Country bar chart */}
      <div className={card}>
        <h3 className={cardTitle}>Top Countries</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={countryStats} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#48698e15" />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#48698e" }} />
            <YAxis
              type="category" dataKey="country" width={100}
              tick={{ fontSize: 11, fill: "#1f354d" }}
            />
            <Tooltip
              contentStyle={{ background: "#fff", border: "1px solid #48698e30", borderRadius: 8, fontSize: 12, color: "#1f354d" }}
            />
            <Bar dataKey="visitors" radius={[0, 4, 4, 0]}>
              {countryStats.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Browser pie */}
      <div className={card}>
        <h3 className={cardTitle}>Browser Distribution</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={browserStats} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
              {browserStats.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #48698e30", borderRadius: 8, fontSize: 12, color: "#1f354d" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Device pie */}
      <div className={card}>
        <h3 className={cardTitle}>Device Breakdown</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={deviceStats} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
              {deviceStats.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #48698e30", borderRadius: 8, fontSize: 12, color: "#1f354d" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Referrer bar */}
      <div className={card}>
        <h3 className={cardTitle}>Traffic Sources</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={referrerStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#48698e15" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#48698e" }} />
            <YAxis tick={{ fontSize: 11, fill: "#48698e" }} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #48698e30", borderRadius: 8, fontSize: 12, color: "#1f354d" }} />
            <Bar dataKey="value" name="Visitors" radius={[4, 4, 0, 0]}>
              {referrerStats.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
