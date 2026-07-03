import { useCallback, useEffect, useRef, useState } from "react";

export function useAsyncData<T>(
  loader: () => Promise<T>,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<T | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      const requestId = ++requestIdRef.current;
      await Promise.resolve();
      if (requestId !== requestIdRef.current) return;
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      try {
        const nextData = await loader();
        if (requestId !== requestIdRef.current) return;
        dataRef.current = nextData;
        setData(nextData);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        if (mode === "initial" || dataRef.current === null) {
          setError(err instanceof Error ? err.message : "불러오지 못했습니다.");
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [loader],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  return {
    data,
    loading,
    refreshing,
    error,
    refresh: () => load("refresh"),
  };
}
