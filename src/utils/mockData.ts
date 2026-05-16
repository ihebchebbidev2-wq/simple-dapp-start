const countries = [
  { name: "United States", code: "US", flag: "🇺🇸" },
  { name: "France", code: "FR", flag: "🇫🇷" },
  { name: "Germany", code: "DE", flag: "🇩🇪" },
  { name: "United Kingdom", code: "GB", flag: "🇬🇧" },
  { name: "Canada", code: "CA", flag: "🇨🇦" },
  { name: "Brazil", code: "BR", flag: "🇧🇷" },
  { name: "Japan", code: "JP", flag: "🇯🇵" },
  { name: "Australia", code: "AU", flag: "🇦🇺" },
  { name: "India", code: "IN", flag: "🇮🇳" },
  { name: "Spain", code: "ES", flag: "🇪🇸" },
  { name: "Italy", code: "IT", flag: "🇮🇹" },
  { name: "Netherlands", code: "NL", flag: "🇳🇱" },
  { name: "South Korea", code: "KR", flag: "🇰🇷" },
  { name: "Mexico", code: "MX", flag: "🇲🇽" },
  { name: "Sweden", code: "SE", flag: "🇸🇪" },
];

const cities: Record<string, string[]> = {
  US: ["New York", "Los Angeles", "Chicago", "Houston", "Miami", "San Francisco"],
  FR: ["Paris", "Lyon", "Marseille", "Toulouse", "Nice"],
  DE: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne"],
  GB: ["London", "Manchester", "Birmingham", "Leeds", "Glasgow"],
  CA: ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa"],
  BR: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador"],
  JP: ["Tokyo", "Osaka", "Yokohama", "Nagoya", "Kyoto"],
  AU: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
  IN: ["Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata"],
  ES: ["Madrid", "Barcelona", "Valencia", "Seville", "Bilbao"],
  IT: ["Rome", "Milan", "Naples", "Turin", "Florence"],
  NL: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"],
  KR: ["Seoul", "Busan", "Incheon", "Daegu"],
  MX: ["Mexico City", "Guadalajara", "Monterrey", "Cancún"],
  SE: ["Stockholm", "Gothenburg", "Malmö", "Uppsala"],
};

const browsers = ["Chrome", "Safari", "Firefox", "Edge", "Opera"];
const devices = ["Desktop", "Mobile", "Tablet"];
const referrers = ["Google", "Direct", "Facebook", "Twitter", "LinkedIn", "Instagram", "Reddit", "Email Campaign"];

function randomIP(): string {
  return `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

function randomDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
  return d.toISOString();
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface UserEntry {
  id: number;
  ip: string;
  country: string;
  countryCode: string;
  flag: string;
  city: string;
  date: string;
  browser: string;
  device: string;
  referrer: string;
  pageViews: number;
  sessionDuration: number; // seconds
}

export function generateMockUsers(count: number): UserEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const c = pick(countries);
    const citiesList = cities[c.code] || ["Unknown"];
    return {
      id: i + 1,
      ip: randomIP(),
      country: c.name,
      countryCode: c.code,
      flag: c.flag,
      city: pick(citiesList),
      date: randomDate(30),
      browser: pick(browsers),
      device: pick(devices),
      referrer: pick(referrers),
      pageViews: Math.floor(Math.random() * 20) + 1,
      sessionDuration: Math.floor(Math.random() * 1800) + 10,
    };
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export interface CountryStats {
  country: string;
  code: string;
  flag: string;
  visitors: number;
  percentage: number;
}

export function getCountryStats(users: UserEntry[]): CountryStats[] {
  const map = new Map<string, { country: string; code: string; flag: string; count: number }>();
  for (const u of users) {
    const existing = map.get(u.countryCode);
    if (existing) existing.count++;
    else map.set(u.countryCode, { country: u.country, code: u.countryCode, flag: u.flag, count: 1 });
  }
  return Array.from(map.values())
    .map((v) => ({ ...v, visitors: v.count, percentage: Math.round((v.count / users.length) * 100) }))
    .sort((a, b) => b.visitors - a.visitors);
}

export interface DailyVisit {
  date: string;
  visitors: number;
  pageViews: number;
}

export function getDailyVisits(users: UserEntry[]): DailyVisit[] {
  const map = new Map<string, { visitors: number; pageViews: number }>();
  for (const u of users) {
    const d = u.date.slice(0, 10);
    const existing = map.get(d);
    if (existing) {
      existing.visitors++;
      existing.pageViews += u.pageViews;
    } else {
      map.set(d, { visitors: 1, pageViews: u.pageViews });
    }
  }
  return Array.from(map.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
