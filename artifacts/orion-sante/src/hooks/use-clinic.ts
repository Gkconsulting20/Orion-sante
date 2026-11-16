import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWorkspace,
  useGetDashboard,
  getGetWorkspaceQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";

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
