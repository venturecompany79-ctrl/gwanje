import { useCallback, useEffect, useState } from "react";

export function useAsyncData<T>(
  loader: () => Promise<T>,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      await Promise.resolve();
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      try {
        setData(await loader());
      } catch (err) {
        setError(err instanceof Error ? err.message : "불러오지 못했습니다.");
      } finally {
        setLoading(false);
        setRefreshing(false);
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
