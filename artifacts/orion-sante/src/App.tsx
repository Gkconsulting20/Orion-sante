import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { frFR } from "@clerk/localizations";
import { Link, Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Shell } from "@/components/shell";
import { PrintProvider } from "@/components/print";
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients";
import PatientDetail from "@/pages/patient-detail";
import Consultations from "@/pages/consultations";
import RendezVous from "@/pages/rendez-vous";
import Facturation from "@/pages/facturation";
import Caisse from "@/pages/caisse";
import Rapports from "@/pages/rapports";
import Parametres from "@/pages/parametres";
import Journal from "@/pages/journal";
import Utilisateurs from "@/pages/utilisateurs";
import Commercialisation from "@/pages/commercialisation";

const clerkPubKey = import.meta.env.VITE_CLERK_USE_CONFIGURED_KEY === "true"
  ? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  : publishableKeyFromHost(
      window.location.hostname,
      import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    );

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo-mark.png`,
  },
  variables: {
    colorPrimary: "hsl(226 49% 24%)",
    colorForeground: "hsl(226 40% 16%)",
    colorMutedForeground: "hsl(226 12% 40%)",
    colorDanger: "hsl(4 68% 47%)",
    colorBackground: "hsl(42 45% 99%)",
    colorInput: "hsl(42 45% 99%)",
    colorInputForeground: "hsl(226 40% 16%)",
    colorNeutral: "hsl(226 40% 16%)",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    borderRadius: "0.7rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[hsl(42_45%_99%)] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[hsl(36_22%_88%)] shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-['Bricolage_Grotesque'] text-[hsl(226_40%_16%)] text-xl",
    headerSubtitle: "text-[hsl(226_12%_40%)]",
    socialButtonsBlockButtonText: "text-[hsl(226_40%_16%)] font-medium",
    formFieldLabel: "text-[hsl(226_40%_20%)] font-medium",
    footerActionLink: "text-[hsl(28_80%_36%)] font-semibold hover:underline",
    footerActionText: "text-[hsl(226_12%_40%)]",
    dividerText: "text-[hsl(226_12%_45%)]",
    identityPreviewEditButton: "text-[hsl(28_80%_36%)]",
    formFieldSuccessText: "text-[hsl(172_58%_28%)]",
    alertText: "text-[hsl(226_40%_16%)]",
    logoBox: "justify-center",
    logoImage: "h-11 w-11 rounded-xl bg-white object-contain",
    socialButtonsBlockButton: "border-[hsl(36_18%_82%)] bg-[hsl(42_45%_99%)] hover:bg-[hsl(38_30%_93%)]",
    formButtonPrimary: "bg-[hsl(226_49%_24%)] text-[hsl(40_45%_97%)] font-semibold",
    formFieldInput: "border-[hsl(36_18%_82%)] bg-[hsl(42_45%_99%)] text-[hsl(226_40%_16%)]",
    footerAction: "justify-center",
    dividerLine: "bg-[hsl(36_20%_86%)]",
    alert: "border-[hsl(4_68%_80%)] bg-[hsl(4_68%_97%)]",
    otpCodeFieldInput: "border-[hsl(36_18%_82%)] text-[hsl(226_40%_16%)]",
    formFieldRow: "gap-3",
    main: "gap-5",
  },
};

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground star-field p-10">
        <Link href="/" className="flex items-center gap-3">
          <img src={`${basePath}/logo-mark.png`} alt="ComptaOrion" className="size-10 rounded-xl bg-white object-contain" />
          <span className="font-display font-semibold text-lg">Orion Santé</span>
        </Link>
        <div>
          <h1 className="text-4xl font-semibold leading-tight max-w-md">Le soin et la facture, sur le même fil.</h1>
          <p className="text-sidebar-foreground/65 mt-3 max-w-md">Chaque compte ouvre sa propre clinique privée, vide et séparée de la démonstration. Dossiers, consultations, factures, reçus et caisse, en FCFA.</p>
        </div>
        <div className="text-xs text-sidebar-foreground/45">ComptaOrion · Lomé</div>
      </div>
      <div className="flex flex-col items-center justify-center bg-background px-4 py-10">
        {children}
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mt-6" data-testid="link-back-demo">Retour à la démonstration</Link>
      </div>
    </div>
  );
}

function SignInPage() {
  return (
    <AuthLayout>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthLayout>
  );
}

function SignUpPage() {
  return (
    <AuthLayout>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </AuthLayout>
  );
}

function ClinicDataProviders() {
  const [client] = useState(() => new QueryClient());
  useEffect(() => () => client.clear(), [client]);
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <PrintProvider>
          <AppRoutes />
        </PrintProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AuthScopedClinicData() {
  const { userId, isLoaded } = useAuth();
  if (!isLoaded) return <div role="status" className="p-6 text-muted-foreground">Chargement…</div>;
  // clear() alone leaves active query observers displaying their previous
  // results. Remount consumers, forms and printable documents for each identity.
  return <ClinicDataProviders key={userId ?? "anonymous-demo"} />;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppRoutes() {
  const [loc] = useLocation();
  if (loc.startsWith("/sign-in") || loc.startsWith("/sign-up")) {
    return (
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
      </Switch>
    );
  }
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/patients" component={Patients} />
          <Route path="/patients/:id" component={PatientDetail} />
          <Route path="/consultations" component={Consultations} />
          <Route path="/rendez-vous" component={RendezVous} />
          <Route path="/facturation" component={Facturation} />
          <Route path="/caisse" component={Caisse} />
          <Route path="/rapports" component={Rapports} />
          <Route path="/parametres" component={Parametres} />
          <Route path="/journal" component={Journal} />
          <Route path="/utilisateurs" component={Utilisateurs} />
          <Route path="/commercialisation" component={Commercialisation} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        ...frFR,
        signIn: {
          ...frFR.signIn,
          start: {
            ...frFR.signIn?.start,
            title: "Connexion à Orion Santé",
            subtitle: "Accédez à votre clinique privée",
          },
        },
        signUp: {
          ...frFR.signUp,
          start: {
            ...frFR.signUp?.start,
            title: "Créer votre clinique",
            subtitle: "Un espace privé, séparé de la démonstration",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <AuthScopedClinicData />
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
