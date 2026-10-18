import { Bug, ChartColumn, ChevronLeft, Clock, Coins, Crosshair, Factory, FileText, Flag, Globe, House, Landmark, Map, Menu, Newspaper, Package, Scale, Search, Shield, Swords, Trophy, User, Users, Wrench, X, TrendingUp, Briefcase, type LucideIcon } from "lucide-react";

const ICONS = {
  home: House, flag: Flag, shield: Shield, map: Map, unit: Swords, battle: Crosshair, war: Swords, chart: ChartColumn, box: Package,
  briefcase: Briefcase, trophy: Trophy, clock: Clock, news: Newspaper, contract: FileText, tool: Wrench, bug: Bug, search: Search,
  menu: Menu, close: X, chevron: ChevronLeft, coins: Coins, user: User, users: Users, landmark: Landmark, factory: Factory,
  trend: TrendingUp, globe: Globe, scale: Scale,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Thin wrapper over lucide-react so icon names stay a closed, typed set. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const Cmp = ICONS[name];
  return <Cmp className="icon" size={size} strokeWidth={1.8} aria-hidden="true" focusable="false" />;
}
