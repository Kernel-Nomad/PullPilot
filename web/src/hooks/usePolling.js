import { useCallback, useEffect, useRef } from "react";

export function usePolling() {
  const pollingRef = useRef(null);
  const callbackRef = useRef(null);

  const startPolling = useCallback((callback, intervalMs = 1000) => {
    callbackRef.current = callback;
    if (pollingRef.current) {
      return;
    }
    pollingRef.current = setInterval(() => {
      if (typeof callbackRef.current === "function") {
        callbackRef.current();
      }
    }, intervalMs);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    callbackRef.current = null;
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  return { startPolling, stopPolling };
}
