import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Show, useClerk, useUser } from "@clerk/react";
import { LayoutDashboard, Users, Stethoscope, CalendarDays, Receipt, Wallet, BarChart3, Settings, LogIn, LogOut, FlaskConical, Briefcase } from "lucide-react";
import { useWorkspace, usePlatformMe } from "@/hooks/use-clinic";
import { cn } from "@/lib/utils";
import { fDateLong } from "@/lib/fmt";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const NAV = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/consultations", label: "Consultations", icon: Stethoscope },
  { href: "/rendez-vous", label: "Rendez-vous", icon: CalendarDays },
  { href: "/facturation", label: "Facturation", icon: Receipt },
  { href: "/caisse", label: "Caisse", icon: Wallet },
  { href: "/rapports", label: "Rapports", icon: BarChart3 },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

function Mark({ className }: { className?: string }) {
  return <img src={`${basePath}/logo-mark.png`} alt="ComptaOrion" className={cn("size-9 shrink-0 rounded-xl bg-white object-contain", className)} />;
}

function UserBlock() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Compte";
  return (
    <div className="flex items-center gap-2.5">
      <div className="size-8 rounded-full bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center text-xs font-semibold shrink-0">
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm truncate" data-testid="text-user-name">{name}</div>
        <div className="text-[11px] text-sidebar-foreground/55">Clinique privée</div>
      </div>
      <button onClick={() => signOut({ redirectUrl: basePath || "/" })} className="size-8 grid place-items-center rounded-lg hover:bg-sidebar-accent transition" title="Se déconnecter" data-testid="button-sign-out">
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { data: ws } = useWorkspace();
  const { data: platformMe } = usePlatformMe({
    query: { staleTime: 5 * 60_000, retry: 1 },
  });
  const isPlatformAdmin = platformMe?.isPlatformAdmin ?? false;
  const active = (href: string) => (href === "/" ? loc === "/" : loc.startsWith(href));
  const open = ws?.cashSession.isOpen;

  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[248px_1fr]">
      <aside className="hidden md:flex flex-col bg-sidebar text-sidebar-foreground star-field sticky top-0 h-[100dvh]">
        <div className="px-5 pt-6 pb-5 flex items-center gap-3">
          <Mark />
          <div>
            <div className="font-display font-semibold text-[17px] leading-none">Orion Santé</div>
            <div className="text-[11px] text-sidebar-foreground/55 mt-1">ComptaOrion</div>
          </div>
        </div>
        <div className="mx-4 mb-4 rounded-xl bg-sidebar-accent/60 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Clinique</div>
          <div className="text-sm font-medium truncate" data-testid="text-clinic-name">{ws?.settings.clinicName ?? "…"}</div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-sidebar-foreground/65">
            <span className={cn("size-1.5 rounded-full", open ? "bg-[hsl(172_58%_50%)] pulse-dot" : "bg-sidebar-foreground/30")} />
            {open ? "Caisse ouverte" : "Caisse fermée"}
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} data-testid={`link-nav-${href.slice(1) || "home"}`}
              className={cn("relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active(href) ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50")}>
              {active(href) && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-sidebar-primary" />}
              <Icon className="size-[17px]" /> {label}
            </Link>
          ))}
          {isPlatformAdmin && (
            <>
              <div className="pt-4 pb-1 px-3 text-[10px] uppercase tracking-wider text-sidebar-foreground/50">ORIONEXA</div>
              <Link href="/commercialisation" data-testid="link-nav-commercialisation"
                className={cn("relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active("/commercialisation") ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50")}>
                {active("/commercialisation") && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-sidebar-primary" />}
                <Briefcase className="size-[17px]" /> Commercialisation
              </Link>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <Show when="signed-in"><UserBlock /></Show>
          <Show when="signed-out">
            <Link href="/sign-in" className="flex items-center justify-center gap-2 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground py-2.5 text-sm font-medium hover:brightness-105 transition" data-testid="link-sign-in-sidebar">
              <LogIn className="size-4" /> Se connecter
            </Link>
            <p className="text-[11px] text-sidebar-foreground/50 mt-2 text-center">Chaque compte dispose de sa propre clinique privée.</p>
          </Show>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 bg-sidebar text-sidebar-foreground">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <Mark className="size-8" />
            <div className="font-display font-semibold flex-1">Orion Santé</div>
            <Show when="signed-out"><Link href="/sign-in" className="text-xs rounded-lg bg-sidebar-primary text-sidebar-primary-foreground px-3 py-1.5 font-medium">Se connecter</Link></Show>
            <Show when="signed-in"><MobileSignOut /></Show>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2.5">
            {NAV.map(({ href, label }) => (
              <Link key={href} href={href} className={cn("whitespace-nowrap text-xs px-3 py-1.5 rounded-full", active(href) ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-sidebar-accent/60")}>{label}</Link>
            ))}
            {isPlatformAdmin && (
              <Link href="/commercialisation" className={cn("whitespace-nowrap text-xs px-3 py-1.5 rounded-full", active("/commercialisation") ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-sidebar-accent/60")}>Commercialisation</Link>
            )}
          </nav>
        </header>

        {ws?.isDemo && (
          <div className="bg-saffron/95 text-[hsl(226_49%_14%)]" data-testid="banner-demo">
            <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <span className="inline-flex items-center gap-2 font-semibold"><FlaskConical className="size-4" /> Démonstration</span>
              <span className="font-medium">Données fictives — ne pas saisir de données réelles.</span>
              <span className="opacity-75 text-xs hidden lg:inline">Espace de démonstration isolé pour ce navigateur.</span>
              <Link href="/sign-in" className="ml-auto text-xs font-semibold underline underline-offset-4 decoration-2" data-testid="link-banner-sign-in">Se connecter pour ma clinique</Link>
            </div>
          </div>
        )}

        <div className="hidden md:flex items-center justify-between max-w-[1320px] w-full mx-auto px-8 pt-5 text-xs text-muted-foreground">
          <span className="capitalize">{fDateLong(new Date().toISOString())} · Lomé</span>
          <span>{ws?.isDemo ? "Espace de démonstration" : ws ? "Espace privé" : ""}</span>
        </div>
        <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 md:px-8 py-6 md:py-5">{children}</main>
      </div>
    </div>
  );
}

function MobileSignOut() {
  const { signOut } = useClerk();
  return (
    <button onClick={() => signOut({ redirectUrl: basePath || "/" })} className="size-8 grid place-items-center rounded-lg bg-sidebar-accent" aria-label="Se déconnecter">
      <LogOut className="size-4" />
    </button>
  );
}
