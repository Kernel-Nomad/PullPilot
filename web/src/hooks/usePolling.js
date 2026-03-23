import { useCallback, useEffect, useRef } from "react";

export function usePolling() {
  const pollingRef = useRef(null);

  const startPolling = useCallback((callback, intervalMs = 1000) => {
    if (pollingRef.current) {
      return;
    }
    pollingRef.current = setInterval(callback, intervalMs);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  return { startPolling, stopPolling };
}
