import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { useGetAuditLog } from "@workspace/api-client-react";
import { Empty, ErrorState, PageHeader, PageSkeleton, Tabs } from "@/components/kit";
import { fDateTime } from "@/lib/fmt";

const ACTION_LABELS: Record<string, string> = {
  "patient.create": "Dossier créé",
  "patient.update": "Dossier modifié",
  "patient.delete": "Dossier supprimé",
  "patient.export": "Export des données",
  "visit.create": "Consultation créée",
  "visit.update": "Consultation modifiée",
  "invoice.create": "Facture créée",
  "payment.create": "Règlement enregistré",
  "expense.create": "Dépense enregistrée",
  "settings.update": "Paramètres modifiés",
  "cash.open": "Caisse ouverte",
  "cash.close": "Caisse clôturée",
  "member.add": "Membre ajouté",
  "member.role": "Rôle modifié",
  "member.remove": "Membre retiré",
};

const ENTITY_LABELS: Record<string, string> = {
  patient: "Patient",
  visit: "Consultation",
  invoice: "Facture",
  payment: "Paiement",
  expense: "Dépense",
  settings: "Paramètres",
  cash: "Caisse",
  member: "Membre",
};

export default function Journal() {
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, error, refetch } = useGetAuditLog(
    { action: action === "all" ? undefined : action, entity: entity === "all" ? undefined : entity, from: from || undefined, to: to || undefined },
    { query: { staleTime: 15_000, retry: 1 } },
  );

  const entries = useMemo(() => data ?? [], [data]);
  const visible = showAll ? entries : entries.slice(0, 50);

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div>
      <PageHeader eyebrow="Protection des données" title="Journal d'activité" sub="Qui a fait quoi, et quand. Le journal ne contient que des métadonnées : jamais de données médicales, jamais de diagnostic." />

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <Tabs
          value={entity}
          onChange={(v) => { setEntity(v); setShowAll(false); }}
          items={[
            { value: "all", label: "Toutes" },
            ...Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
        <input type="date" className="field h-9 w-auto" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Du" data-testid="input-from" />
        <span className="text-sm text-muted-foreground">au</span>
        <input type="date" className="field h-9 w-auto" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Au" data-testid="input-to" />
        <select className="field h-9 w-auto" value={action} onChange={(e) => { setAction(e.target.value); setShowAll(false); }} aria-label="Action" data-testid="select-action">
          <option value="all">Toutes les actions</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="panel overflow-hidden rise">
        {entries.length === 0 ? (
          <Empty icon={<ScrollText className="size-5" />} title="Aucune entrée" text="Aucune action enregistrée pour ces filtres." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b bg-secondary/50">
                    <th className="label-s px-4 py-2.5">Date</th>
                    <th className="label-s px-4 py-2.5">Action</th>
                    <th className="label-s px-4 py-2.5 hidden md:table-cell">Objet</th>
                    <th className="label-s px-4 py-2.5 hidden md:table-cell">Acteur</th>
                    <th className="label-s px-4 py-2.5">Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr key={e.id} className="border-b last:border-0" data-testid={`row-audit-${e.id}`}>
                      <td className="px-4 py-3 whitespace-nowrap num text-xs">{fDateTime(e.createdAt)}</td>
                      <td className="px-4 py-3 font-medium">{ACTION_LABELS[e.action] ?? e.action}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{ENTITY_LABELS[e.entity] ?? e.entity} · <span className="num">{e.recordId}</span></td>
                      <td className="px-4 py-3 hidden md:table-cell">{e.actorLabel}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t text-sm text-muted-foreground flex justify-between items-center">
              <span>{visible.length} sur {entries.length} entrée(s) — les 50 dernières par défaut.</span>
              {entries.length > 50 && !showAll && (
                <button className="font-medium text-foreground underline underline-offset-4" onClick={() => setShowAll(true)} data-testid="button-show-all">Tout afficher</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
