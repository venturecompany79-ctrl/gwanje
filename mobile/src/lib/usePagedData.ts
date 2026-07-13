import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PageResult } from "@/lib/queries";

export type PageLoader<T> = (offset: number) => Promise<PageResult<T>>;

interface PagedState<T> {
  loader: PageLoader<T>;
  items: T[];
  hasMore: boolean;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
}

function initialState<T>(loader: PageLoader<T>): PagedState<T> {
  return {
    loader,
    items: [],
    hasMore: false,
    loading: true,
    refreshing: false,
    loadingMore: false,
    error: null,
  };
}

/**
 * offset 기반 페이지 로더를 관리한다. 호출자는 필터/검색어가 바뀔 때 loader를
 * `useCallback`으로 새로 만들면 되고, 훅은 이전 목록을 즉시 숨긴 뒤 첫 페이지부터 다시 읽는다.
 */
export function usePagedData<T>(loader: PageLoader<T>) {
  const [state, setState] = useState<PagedState<T>>(() => initialState(loader));
  const stateRef = useRef(state);
  const requestIdRef = useRef(0);
  const activeLoaderRef = useRef<PageLoader<T> | null>(loader);

  useLayoutEffect(() => {
    activeLoaderRef.current = loader;
    requestIdRef.current += 1;
    return () => {
      if (activeLoaderRef.current === loader) {
        activeLoaderRef.current = null;
        requestIdRef.current += 1;
      }
    };
  }, [loader]);

  const visibleState = state.loader === loader ? state : initialState(loader);
  useLayoutEffect(() => {
    stateRef.current = visibleState;
  }, [visibleState]);

  const loadFirstPage = useCallback(
    async (mode: "initial" | "refresh") => {
      if (activeLoaderRef.current !== loader) return;
      const requestId = ++requestIdRef.current;
      setState((current) => ({
        ...(current.loader === loader ? current : initialState(loader)),
        loader,
        items: mode === "initial" ? [] : current.loader === loader ? current.items : [],
        hasMore: mode === "initial" ? false : current.loader === loader && current.hasMore,
        loading: mode === "initial",
        refreshing: mode === "refresh",
        loadingMore: false,
        error: null,
      }));

      try {
        const page = await loader(0);
        if (
          requestId !== requestIdRef.current ||
          activeLoaderRef.current !== loader
        ) {
          return;
        }
        setState({
          loader,
          items: page.items,
          hasMore: page.hasMore,
          loading: false,
          refreshing: false,
          loadingMore: false,
          error: null,
        });
      } catch (err) {
        if (
          requestId !== requestIdRef.current ||
          activeLoaderRef.current !== loader
        ) {
          return;
        }
        setState((current) => ({
          ...(current.loader === loader ? current : initialState(loader)),
          loader,
          loading: false,
          refreshing: false,
          loadingMore: false,
          error: err instanceof Error ? err.message : "불러오지 못했습니다.",
        }));
      }
    },
    [loader],
  );

  useEffect(() => {
    void loadFirstPage("initial");
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadFirstPage]);

  const refresh = useCallback(() => loadFirstPage("refresh"), [loadFirstPage]);
  const reset = useCallback(() => loadFirstPage("initial"), [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (activeLoaderRef.current !== loader) return;
    const current = stateRef.current;
    if (
      current.loader !== loader ||
      current.loading ||
      current.refreshing ||
      current.loadingMore ||
      !current.hasMore
    ) {
      return;
    }

    const requestId = ++requestIdRef.current;
    const offset = current.items.length;
    setState((latest) =>
      latest.loader === loader
        ? { ...latest, loadingMore: true, error: null }
        : initialState(loader),
    );

    try {
      const page = await loader(offset);
      if (
        requestId !== requestIdRef.current ||
        activeLoaderRef.current !== loader
      ) {
        return;
      }
      setState((latest) => {
        if (latest.loader !== loader) return initialState(loader);
        return {
          ...latest,
          items: [...latest.items, ...page.items],
          hasMore: page.hasMore,
          loadingMore: false,
          error: null,
        };
      });
    } catch (err) {
      if (
        requestId !== requestIdRef.current ||
        activeLoaderRef.current !== loader
      ) {
        return;
      }
      setState((latest) => ({
        ...(latest.loader === loader ? latest : initialState(loader)),
        hasMore: false,
        loadingMore: false,
        error: err instanceof Error ? err.message : "더 불러오지 못했습니다.",
      }));
    }
  }, [loader]);

  return {
    items: visibleState.items,
    hasMore: visibleState.hasMore,
    loading: visibleState.loading,
    refreshing: visibleState.refreshing,
    loadingMore: visibleState.loadingMore,
    error: visibleState.error,
    refresh,
    loadMore,
    reset,
  };
}
