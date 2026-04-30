import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { LogOut, User, Bell, Palette, Database, ChevronRight } from "lucide-react";
import { HubPageContainer } from "@/components/layout/HubLayout";
import RequireAuth from "@/components/auth/RequireAuth";
import { signOut } from "@/lib/auth";

export const Route = createFileRoute("/hub/settings")({
  head: () => ({
    meta: [{ title: "Settings — SenecaEdge" }],
  }),
  component: () => (
    <RequireAuth>
      <SettingsPage />
    </RequireAuth>
  ),
});

function SettingsPage() {
  return (
    <HubPageContainer
      eyebrow="Account"
      title="Settings"
      subtitle="Manage your profile, notifications, and workspace preferences."
    >
      <div className="space-y-3">
        <Row Icon={User} title="Profile" subtitle="Display name, avatar" />
        <Row Icon={Bell} title="Notifications" subtitle="Trade alerts, mentor pings" />
        <Row Icon={Palette} title="Appearance" subtitle="Theme, density" />
        <Row Icon={Database} title="Data" subtitle="Export journal, clear cache" />
      </div>

      <div className="mt-10">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
          Session
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-[#16181D] px-5 py-4 text-left transition-colors hover:border-rose-300/20 hover:bg-rose-500/[0.04]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
              <LogOut className="h-[17px] w-[17px] text-rose-300" strokeWidth={1.9} />
            </div>
            <div>
              <p className="text-[14px] font-semibold tracking-tight text-text-primary">
                Sign out
              </p>
              <p className="mt-0.5 text-[12px] text-text-secondary">
                Ends this browser session.
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-text-secondary" strokeWidth={1.9} />
        </button>
      </div>
    </HubPageContainer>
  );
}

function Row({
  Icon,
  title,
  subtitle,
}: {
  Icon: typeof User;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-[#16181D] px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <Icon className="h-[17px] w-[17px] text-gold" strokeWidth={1.9} />
        </div>
        <div>
          <p className="text-[14px] font-semibold tracking-tight text-text-primary">
            {title}
          </p>
          <p className="mt-0.5 text-[12px] text-text-secondary">{subtitle}</p>
        </div>
      </div>
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
        Coming soon
      </span>
    </div>
  );
}
