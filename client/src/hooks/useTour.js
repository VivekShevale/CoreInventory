// src/hooks/useTour.js
// ---------------------
// Reads has_seen_tour from the auth context / user object and
// decides whether to show the tour overlay.
//
// Usage:
//   const { showTour, completeTour } = useTour();
//   if (showTour) return <TourOverlay onFinish={completeTour} />;

import { useState, useEffect, useCallback } from 'react';
import api from '../configs/api';


export function useTour(user) {
  // Initialise from the user object that comes back from /api/auth/login
  // user.has_seen_tour === false  →  show the tour
  // localStorage acts as a fast fallback so we don't flash the tour on reload
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Server is the source of truth; localStorage just prevents a flash
    const localDone = localStorage.getItem(`tour_done_${user.id}`) === 'true';
    if (!user.has_seen_tour && !localDone) {
      setShowTour(true);
    }
  }, [user]);

  const completeTour = useCallback(async () => {
    setShowTour(false);

    // Optimistic local flag so it never shows again this session
    if (user?.id) {
      localStorage.setItem(`tour_done_${user.id}`, 'true');
    }

    // Persist to server (fire-and-forget — UX isn't blocked on this)
    try {
      await api.post('/api/tour/complete');
    } catch (err) {
      console.warn('Could not persist tour completion:', err);
      // Non-critical — localStorage fallback still works
    }
  }, [user]);

  return { showTour, completeTour };
}