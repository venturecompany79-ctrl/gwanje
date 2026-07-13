import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type AsyncLoader<T> = () => Promise<T>;

interface DataSnapshot<T> {
  loader: AsyncLoader<T>;
  value: T;
}

interface ActivitySnapshot<T> {
  loader: AsyncLoader<T>;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

export function useAsyncData<T>(loader: AsyncLoader<T>) {
  const [snapshot, setSnapshot] = useState<DataSnapshot<T> | null>(null);
  const [activity, setActivity] = useState<ActivitySnapshot<T>>(() => ({
    loader,
    loading: true,
    refreshing: false,
    error: null,
  }));
  const dataRef = useRef<DataSnapshot<T> | null>(null);
  const requestIdRef = useRef(0);
  const activeLoaderRef = useRef<AsyncLoader<T> | null>(loader);

  // loader가 커밋되는 즉시 이전 loader의 요청/refresh를 무효화한다. 이전 화면에서
  // 시작한 mutation이 늦게 끝나더라도 새 화면의 요청을 취소할 수 없다.
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

  // loader가 바뀐 첫 렌더부터 이전 결과를 숨긴다. effect가 실행되기 전의 한 프레임에도
  // 새 날짜/ID와 이전 데이터가 함께 노출되지 않으므로 항목을 잘못 조작할 수 없다.
  const data = snapshot?.loader === loader ? snapshot.value : null;
  const currentActivity =
    activity.loader === loader
      ? activity
      : { loader, loading: true, refreshing: false, error: null };

  const load = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      if (activeLoaderRef.current !== loader) return;
      const requestId = ++requestIdRef.current;
      await Promise.resolve();
      if (
        requestId !== requestIdRef.current ||
        activeLoaderRef.current !== loader
      ) {
        return;
      }

      setActivity({
        loader,
        loading: mode === "initial",
        refreshing: mode === "refresh",
        error: null,
      });
      try {
        const nextData = await loader();
        if (
          requestId !== requestIdRef.current ||
          activeLoaderRef.current !== loader
        ) {
          return;
        }
        const nextSnapshot = { loader, value: nextData };
        dataRef.current = nextSnapshot;
        setSnapshot(nextSnapshot);
      } catch (err) {
        if (
          requestId !== requestIdRef.current ||
          activeLoaderRef.current !== loader
        ) {
          return;
        }
        const hasCurrentData = dataRef.current?.loader === loader;
        setActivity({
          loader,
          loading: false,
          refreshing: false,
          error:
            mode === "initial" || !hasCurrentData
              ? err instanceof Error
                ? err.message
                : "불러오지 못했습니다."
              : null,
        });
        return;
      }

      if (
        requestId === requestIdRef.current &&
        activeLoaderRef.current === loader
      ) {
        setActivity({ loader, loading: false, refreshing: false, error: null });
      }
    },
    [loader],
  );

  useEffect(() => {
    void load("initial");
    return () => {
      requestIdRef.current += 1;
    };
  }, [load]);

  const refresh = useCallback(() => load("refresh"), [load]);

  return {
    data,
    loading: currentActivity.loading,
    refreshing: currentActivity.refreshing,
    error: currentActivity.error,
    refresh,
  };
}
