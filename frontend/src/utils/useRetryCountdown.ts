import { useCallback, useEffect, useState } from 'react';

/**
 * Counts down the seconds a rate limit asked us to wait (HTTP 429 Retry-After
 * or the client-side guard). `secondsLeft` is 0 when the action is allowed again.
 */
export function useRetryCountdown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= now) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until, now]);

  const start = useCallback((seconds: number | undefined | null) => {
    if (!seconds || seconds <= 0) return;
    const current = Date.now();
    setNow(current);
    setUntil(current + seconds * 1000);
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000));
  return { secondsLeft, isWaiting: secondsLeft > 0, start };
}
