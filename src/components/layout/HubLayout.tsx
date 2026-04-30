import { Link, useRouterState, Outlet } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  LineChart,
  PlayCircle,
  BookOpenCheck,
  BarChart3,
  Wrench,
  Settings,
  Sparkles,
  Bell,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/brand/Logo";
import RequireAuth from "@/components/auth/RequireAuth";
import SystemStatusIndicator from "@/components/layout/SystemStatusIndicator";

// ─────────────────────────────────────────────────────────────
// Sidebar nav definition. Uses existing routes; Replay/Insights/
// Settings are new placeholder routes added in this redesign.
// ─────────────────────────────────────────────────────────────
type NavItem = {
  label: string;
  to: string;
  Icon: typeof LineChart;
  // Match prefix instead of exact path so nested routes light up the parent
  matchPrefix?: boolean;
};

const NAV_PRIMARY: NavItem[] = [
  { label: "Dashboard", to: "/hub", Icon: LayoutDashboard },
  { label: "Analyzer", to: "/hub/chart", Icon: LineChart, matchPrefix: true },
  { label: "Replay", to: "/hub/replay", Icon: PlayCircle, matchPrefix: true },
  { label: "Journal", to: "/hub/journal", Icon: BookOpenCheck, matchPrefix: true },
  { label: "Insights", to: "/hub/insights", Icon: BarChart3, matchPrefix: true },
  { label: "Strategy", to: "/hub/strategy", Icon: Wrench, matchPrefix: true },
];

const NAV_SECONDARY: NavItem[] = [
  { label: "Mentor", to: "/hub/mentor", Icon: Sparkles, matchPrefix: true },
  { label: "Settings", to: "/hub/settings", Icon: Settings, matchPrefix: true },
];

const ASSETS = ["EUR/USD", "GBP/USD", "BTC/USD", "ETH/USD", "XAU/USD", "US100"];
const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"];

// ─────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────
function SidebarItem({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={item.to}
      preload="intent"
      onClick={onNavigate}
      className={[
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5",
        "text-[13.5px] font-medium tracking-tight transition-colors",
        active
          ? "bg-white/[0.06] text-text-primary"
          : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]",
      ].join(" ")}
      aria-current={active ? "page" : undefined}
    >
      {/* Active rail */}
      {active ? (
        <motion.span
          layoutId="hub-sidebar-rail"
          className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-gold"
          transition={{ type: "spring", stiffness: 360, damping: 32 }}
        />
      ) : null}
      <item.Icon
        className={[
          "h-[17px] w-[17px] shrink-0 transition-colors",
          active ? "text-gold" : "text-text-secondary/80 group-hover:text-text-primary",
        ].join(" ")}
        strokeWidth={1.9}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function Sidebar({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = (item: NavItem) =>
    item.matchPrefix
      ? pathname === item.to || pathname.startsWith(item.to + "/")
      : pathname === item.to;

  return (
    <aside className="flex h-full w-full flex-col bg-[#0E0F11]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-5">
        <Logo size="sm" variant="icon" className="h-7 w-7" />
        <span className="font-display text-[16px] font-semibold tracking-tight text-text-primary">
          SenecaEdge
        </span>
      </div>

      <div className="px-3">
        <div className="h-px w-full bg-white/[0.05]" />
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary/60">
          Workspace
        </p>
        <ul className="space-y-0.5">
          {NAV_PRIMARY.map((item) => (
            <li key={item.to}>
              <SidebarItem
                item={item}
                active={isActive(item)}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>

        <p className="mt-6 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary/60">
          Intelligence
        </p>
        <ul className="space-y-0.5">
          {NAV_SECONDARY.map((item) => (
            <li key={item.to}>
              <SidebarItem
                item={item}
                active={isActive(item)}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer — dynamic system status */}
      <div className="px-5 py-4">
        <SystemStatusIndicator />
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Top bar — placeholder selectors only (no wiring).
// ─────────────────────────────────────────────────────────────
function PlaceholderSelect({
  label,
  options,
  value,
  setValue,
  width = "w-[120px]",
}: {
  label: string;
  options: string[];
  value: string;
  setValue: (v: string) => void;
  width?: string;
}) {
  return (
    <label
      className={`group relative flex h-9 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 ${width} cursor-pointer transition-colors hover:border-white/10 hover:bg-white/[0.04]`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
        {label}
      </span>
      <span className="ml-auto flex items-center gap-1 text-[12.5px] font-medium text-text-primary">
        {value}
        <ChevronDown className="h-3.5 w-3.5 text-text-secondary/70" strokeWidth={2} />
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#16181D] text-text-primary">
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  // Local UI-only state — selectors are pure placeholders, no engine wiring.
  const [asset, setAsset] = useState("EUR/USD");
  const [timeframe, setTimeframe] = useState("15m");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.05] bg-[#0E0F11]/85 px-4 backdrop-blur-xl md:px-6">
      {/* Mobile menu */}
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-white/[0.04] hover:text-text-primary md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" strokeWidth={1.9} />
      </button>

      <div className="hidden items-center gap-2 md:flex">
        <PlaceholderSelect
          label="Asset"
          options={ASSETS}
          value={asset}
          setValue={setAsset}
          width="w-[148px]"
        />
        <PlaceholderSelect
          label="TF"
          options={TIMEFRAMES}
          value={timeframe}
          setValue={setTimeframe}
          width="w-[104px]"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-white/[0.04] hover:text-text-primary"
          aria-label="Notifications"
        >
          <Bell className="h-[17px] w-[17px]" strokeWidth={1.9} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-gold" />
        </button>

        <div className="ml-1 flex h-9 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] pl-1 pr-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gold-gradient text-[11.5px] font-semibold text-[#0B0B0D]">
            S
          </div>
          <span className="hidden text-[12.5px] font-medium text-text-primary md:inline">
            Trader
          </span>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// Layout shell
// ─────────────────────────────────────────────────────────────
export default function HubLayout({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <RequireAuth>
      <div className="min-h-[100svh] w-full bg-[#0B0B0D] text-text-primary">
        {/* Desktop sidebar */}
        <aside
          className="fixed inset-y-0 left-0 z-40 hidden w-[240px] border-r border-white/[0.05] md:block"
          aria-label="Primary"
        >
          <Sidebar pathname={pathname} />
        </aside>

        {/* Mobile sidebar drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                key="drawer"
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", stiffness: 360, damping: 36 }}
                className="fixed inset-y-0 left-0 z-50 w-[260px] border-r border-white/[0.05] md:hidden"
              >
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="absolute right-2 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-white/[0.04] hover:text-text-primary"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" strokeWidth={1.9} />
                </button>
                <Sidebar
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main column */}
        <div className="flex min-h-[100svh] flex-col md:pl-[240px]">
          <TopBar onOpenMobileNav={() => setMobileOpen(true)} />
          <main className="relative flex-1">
            {/* Subtle ambient wash, very faint */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                background:
                  "radial-gradient(60% 40% at 80% 0%, rgba(198,161,91,0.06), transparent 70%), radial-gradient(50% 40% at 0% 100%, rgba(198,161,91,0.04), transparent 70%)",
              }}
            />
            <div className="relative">{children ?? <Outlet />}</div>
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}

// Reusable premium page container — pages can opt into this for the new
// max-width/spacing rhythm without touching their internal logic.
export function HubPageContainer({
  eyebrow,
  title,
  subtitle,
  children,
  wide = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`mx-auto w-full ${wide ? "max-w-[1320px]" : "max-w-[1180px]"} px-5 py-8 md:px-8 md:py-10`}>
      <header className="mb-8">
        {eyebrow ? (
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-gold/80">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 font-display text-[28px] font-semibold leading-[1.1] tracking-tight text-text-primary md:text-[32px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-text-secondary">
            {subtitle}
          </p>
        ) : null}
      </header>
      {children}
    </div>
  );
}
