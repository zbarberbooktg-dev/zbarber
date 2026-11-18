import { useQueries } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { getListBarbersQueryKey, getListBarbersQueryOptions, useListBarbers } from "./generated/api";
import type { ListBarbersParams } from "./generated/api.schemas";

const PAGE_SIZE = 100;

/**
 * Compose the generated paginated queries. The public catalog is supported by
 * both deployed API generations; map-points/newest are not supported everywhere.
 * Home and map share these query keys and never treat a partial page as complete.
 */
export function useApprovedSalonCatalog(params: Pick<ListBarbersParams, "categoryId"> = {}) {
  const common = { status: "approved" as const, limit: PAGE_SIZE, categoryId: params.categoryId };
  const options = (page: number) => ({ queryKey: getListBarbersQueryKey({ ...common, page }), staleTime: 30000, refetchOnMount: "always" as const });
  const first = useListBarbers({ ...common, page: 1 }, { query: options(1) });
  const malformed = (page: typeof first.data) => page !== undefined && (page == null || !Array.isArray(page.data) || !Number.isSafeInteger(page.total) || page.total < 0 || !Number.isSafeInteger(page.limit) || page.limit <= 0);
  const pageSize = first.data?.limit || PAGE_SIZE;
  const total = malformed(first.data) ? 0 : first.data?.total ?? 0;
  const rest = useQueries({
    queries: Array.from({ length: Math.max(0, Math.ceil(total / pageSize) - 1) }, (_, i) =>
      getListBarbersQueryOptions({ ...common, page: i + 2 }, { query: options(i + 2) }),
    ),
  });
  const isLoading = first.isPending || rest.some((q) => q.isPending);
  const requestError = first.isError || malformed(first.data) || rest.some((q) => q.isError || malformed(q.data));
  const data = useMemo(() => {
    const pages = [first.data, ...rest.map((q) => q.data)];
    const unique = new Map(pages.flatMap((p) => Array.isArray(p?.data) ? p.data : []).filter((b) => b.status === "approved").map((b) => [b.id, b]));
    return [...unique.values()];
  }, [first.data, rest]);
  const isIncomplete = !isLoading && !requestError && data.length < total;
  const refreshRef = useRef(() => Promise.all([first.refetch(), ...rest.map((q) => q.refetch())]));
  refreshRef.current = () => Promise.all([first.refetch(), ...rest.map((q) => q.refetch())]);
  const refetch = useCallback(() => refreshRef.current(), []);
  return {
    data,
    isLoading,
    isFetching: first.isFetching || rest.some((q) => q.isFetching),
    isError: requestError || isIncomplete,
    refetch,
  };
}
