import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWorkspace,
  useGetDashboard,
  useGetPlatformMe,
  useGetPlatformTrialStatus,
  useStartPlatformTrial,
  getGetWorkspaceQueryKey,
  getGetDashboardQueryKey,
  getGetPlatformMeQueryKey,
  getGetPlatformTrialStatusQueryKey,
  getGetPlatformDashboardQueryKey,
  getGetPlatformClientsQueryKey,
  getGetPlatformSalespeopleQueryKey,
  getGetPlatformPlansQueryKey,
  getGetPlatformSubscriptionsQueryKey,
  getGetPlatformSalesQueryKey,
} from "@workspace/api-client-react";

export { useGetPlatformMe as usePlatformMe };
export { useStartPlatformTrial as useStartTrial };

const MAX_POLLS = 20;

export function useWorkspace() {
  return useGetWorkspace({
    query: {
      queryKey: getGetWorkspaceQueryKey(),
      staleTime: 15_000,
      retry: 1,
      refetchInterval: (q) => (q.state.dataUpdateCount < MAX_POLLS ? 60_000 : false),
    },
  });
}

export function useDashboard() {
  return useGetDashboard({
    query: {
      queryKey: getGetDashboardQueryKey(),
      staleTime: 15_000,
      retry: 1,
      refetchInterval: (q) => (q.state.dataUpdateCount < MAX_POLLS ? 60_000 : false),
    },
  });
}

/**
 * État de l'essai gratuit de la clinique connectée. À n'appeler que pour un
 * utilisateur connecté (`enabled: !!userId`) : en mode démo (anonyme),
 * l'API renvoie 401 et rien ne s'affiche.
 */
export function useTrialStatus(enabled: boolean) {
  return useGetPlatformTrialStatus({
    query: {
      queryKey: getGetPlatformTrialStatusQueryKey(),
      staleTime: 15_000,
      retry: 1,
      enabled,
    },
  });
}

/** Invalide l'état de l'essai (après son démarrage). */
export function useRefreshTrial() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: getGetPlatformTrialStatusQueryKey() });
}

export function useRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }),
      qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
    ]);
}

/** Invalide toutes les requêtes de l'espace Commercialisation. */
export function useRefreshPlatform() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: getGetPlatformMeQueryKey() }),
      qc.invalidateQueries({ queryKey: getGetPlatformDashboardQueryKey() }),
      qc.invalidateQueries({ queryKey: getGetPlatformClientsQueryKey() }),
      qc.invalidateQueries({ queryKey: getGetPlatformSalespeopleQueryKey() }),
      qc.invalidateQueries({ queryKey: getGetPlatformPlansQueryKey() }),
      qc.invalidateQueries({ queryKey: getGetPlatformSubscriptionsQueryKey() }),
      qc.invalidateQueries({ queryKey: getGetPlatformSalesQueryKey() }),
    ]);
}
