import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWorkspace,
  useGetDashboard,
  useGetPlatformMe,
  getGetWorkspaceQueryKey,
  getGetDashboardQueryKey,
  getGetPlatformMeQueryKey,
  getGetPlatformDashboardQueryKey,
  getGetPlatformClientsQueryKey,
  getGetPlatformSalespeopleQueryKey,
  getGetPlatformPlansQueryKey,
  getGetPlatformSubscriptionsQueryKey,
  getGetPlatformSalesQueryKey,
} from "@workspace/api-client-react";

export { useGetPlatformMe as usePlatformMe };

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
