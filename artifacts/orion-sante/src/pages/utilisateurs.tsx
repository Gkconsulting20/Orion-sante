import { useState, type FormEvent } from "react";
import { Plus, Trash2, Users, Loader2 } from "lucide-react";
import { useCreateMember, useDeleteMember, useUpdateMember, type ClinicRole } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRefresh, useWorkspace } from "@/hooks/use-clinic";
import { Empty, ErrorState, Field, PageHeader, PageSkeleton } from "@/components/kit";
import { errMsg } from "@/lib/fmt";
import { ROLE_LABELS, roleOf } from "@/lib/roles";

const ROLES: ClinicRole[] = ["owner", "doctor", "secretary", "accountant"];

export default function Utilisateurs() {
  const { data: ws, isLoading, error, refetch } = useWorkspace();
  const create = useCreateMember();
  const update = useUpdateMember();
  const remove = useDeleteMember();
  const refresh = useRefresh();
  const { toast } = useToast();
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ClinicRole>("secretary");
  const [err, setErr] = useState("");

  if (isLoading) return <PageSkeleton />;
  if (error || !ws) return <ErrorState error={error} onRetry={() => refetch()} />;

  const myRole = roleOf(ws);
  const isOwner = myRole === "owner";
  const members = ws.members ?? [];
  const maxUsers = ws.plan?.maxUsers;
  const ownerId = members.find((m) => m.role === "owner")?.userId;

  async function addMember(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!userId.trim()) return setErr("L'identifiant Clerk de l'utilisateur est obligatoire.");
    try {
      await create.mutateAsync({ data: { userId: userId.trim(), name: name.trim(), email: email.trim(), role } });
      await refresh();
      setUserId(""); setName(""); setEmail(""); setRole("secretary");
      toast({ title: "Membre ajouté" });
    } catch (err) {
      setErr(errMsg(err));
    }
  }

  async function changeRole(memberUserId: string, newRole: ClinicRole) {
    setErr("");
    try {
      await update.mutateAsync({ userId: memberUserId, data: { role: newRole } });
      await refresh();
      toast({ title: "Rôle mis à jour" });
    } catch (err) {
      setErr(errMsg(err));
    }
  }

  async function deleteMember(memberUserId: string) {
    if (!window.confirm("Retirer ce membre de la clinique ? Il n'aura plus accès aux dossiers.")) return;
    setErr("");
    try {
      await remove.mutateAsync({ userId: memberUserId });
      await refresh();
      toast({ title: "Membre retiré" });
    } catch (err) {
      setErr(errMsg(err));
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Protection des données" title="Utilisateurs et accès" sub="Qui peut faire quoi dans cette clinique. Seul le propriétaire peut ajouter un membre ou changer un rôle."
        actions={maxUsers ? <span className="text-sm text-muted-foreground">Plan « {ws.plan?.name} » : {members.length} / {maxUsers} utilisateurs</span> : undefined} />
      {err && <div className="mb-3 text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2" data-testid="text-members-error">{err}</div>}
      {!isOwner && <div className="mb-3 text-sm rounded-lg bg-secondary px-3 py-2 text-muted-foreground">Vous êtes {ROLE_LABELS[myRole]} : la gestion des membres est réservée au propriétaire.</div>}

      <div className="panel overflow-hidden rise mb-3">
        {members.length === 0 ? (
          <Empty icon={<Users className="size-5" />} title="Aucun membre" text="Le propriétaire de la clinique apparaîtra ici." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-secondary/50">
                  <th className="label-s px-4 py-2.5">Membre</th>
                  <th className="label-s px-4 py-2.5 hidden md:table-cell">Identifiant</th>
                  <th className="label-s px-4 py-2.5">Rôle</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId} className="border-b last:border-0" data-testid={`row-member-${m.userId}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{m.email || "—"}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell num text-xs text-muted-foreground">{m.userId}</td>
                    <td className="px-4 py-3">
                      {isOwner && m.userId !== ownerId ? (
                        <select className="field h-9 w-auto" value={m.role} disabled={update.isPending}
                          onChange={(e) => changeRole(m.userId, e.target.value as ClinicRole)} data-testid={`select-role-${m.userId}`}>
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      ) : (
                        <span>{ROLE_LABELS[m.role] ?? m.role}{m.userId === ownerId ? " · propriétaire de la clinique" : ""}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isOwner && m.userId !== ownerId && (
                        <button className="size-8 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteMember(m.userId)} aria-label="Retirer" disabled={remove.isPending} data-testid={`button-remove-member-${m.userId}`}>
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isOwner && (
        <section className="panel p-5 rise">
          <h3 className="font-semibold mb-1">Ajouter un membre</h3>
          <p className="text-sm text-muted-foreground mb-4">
            L'identifiant Clerk de la personne se trouve dans le tableau de bord Clerk → Users → son utilisateur → ID (commençant par <span className="num">user_</span>).
            Une fois ajouté, elle accède à cette clinique avec son propre compte. Aucune invitation par courriel n'est envoyée.
          </p>
          <form onSubmit={addMember} className="grid sm:grid-cols-2 gap-3">
            <Field label="Identifiant Clerk (user_…)" hint="Obligatoire"><input className="field" value={userId} maxLength={200} placeholder="user_…" onChange={(e) => setUserId(e.target.value)} data-testid="input-member-userid" /></Field>
            <Field label="Nom"><input className="field" value={name} maxLength={150} placeholder="Dr Afi Mensah" onChange={(e) => setName(e.target.value)} data-testid="input-member-name" /></Field>
            <Field label="E-mail"><input className="field" type="email" value={email} maxLength={150} onChange={(e) => setEmail(e.target.value)} data-testid="input-member-email" /></Field>
            <Field label="Rôle">
              <select className="field" value={role} onChange={(e) => setRole(e.target.value as ClinicRole)} data-testid="select-member-role">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={create.isPending} data-testid="button-add-member">
                {create.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Plus className="size-4 mr-1.5" />} Ajouter le membre
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
