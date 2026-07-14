import { useEffect, useRef } from 'react';
import { DATA_REFRESH_EVENT } from '../api/axios';

export const DEFAULT_REFRESH_INTERVAL_MS = 8000;

/**
 * Keeps the current screen synchronized without reloading the browser page.
 * The latest callback is used so filters and other screen state stay current.
 */
export const useAutoRefresh = (refresh, options = {}) => {
  const {
    enabled = true,
    intervalMs = DEFAULT_REFRESH_INTERVAL_MS,
    refreshOnMutation = true
  } = options;
  const refreshRef = useRef(refresh);
  const runningRef = useRef(false);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return undefined;

    const runRefresh = async () => {
      if (runningRef.current || document.visibilityState === 'hidden') return;
      runningRef.current = true;
      try {
        await refreshRef.current?.();
      } catch {
        // A temporary background failure must not replace usable on-screen data.
      } finally {
        runningRef.current = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') runRefresh();
    };
    const onMutation = () => runRefresh();
    const timer = window.setInterval(runRefresh, intervalMs);

    window.addEventListener('focus', runRefresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (refreshOnMutation) window.addEventListener(DATA_REFRESH_EVENT, onMutation);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', runRefresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (refreshOnMutation) window.removeEventListener(DATA_REFRESH_EVENT, onMutation);
    };
  }, [enabled, intervalMs, refreshOnMutation]);
};
