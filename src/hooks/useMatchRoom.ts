import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createSimMatch,
  runSimulation,
  fetchMatchEvents,
  getSimMatch,
  type DbSimMatch,
  type DbMatchEvent,
} from '../lib/matchRoom';
import type { SimMatchStatus, MatchTrigger } from '../models/models';

export type MatchRoomStatus = 'idle' | SimMatchStatus;

export interface UseMatchRoomReturn {
  match:       DbSimMatch | null;
  events:      DbMatchEvent[];
  status:      MatchRoomStatus;
  homeScore:   number;
  awayScore:   number;
  starting:    boolean;
  error:       string | null;
  startMatch:     (awayWallet?: string | null, trigger?: MatchTrigger) => Promise<void>;
  connectToMatch: (matchId: string) => Promise<void>;
  reset:          () => void;
}

export function useMatchRoom(initialMatchId?: string): UseMatchRoomReturn {
  const [match,     setMatch]     = useState<DbSimMatch | null>(null);
  const [events,    setEvents]    = useState<DbMatchEvent[]>([]);
  const [status,    setStatus]    = useState<MatchRoomStatus>('idle');
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [starting,  setStarting]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // ── Load a finished match from DB (replay) ────────────────────────────────

  const connectToMatch = useCallback(async (matchId: string) => {
    setEvents([]);
    setError(null);

    const existing = await getSimMatch(matchId);
    if (existing) {
      setMatch(existing);
      setStatus(existing.status);
      setHomeScore(existing.home_score);
      setAwayScore(existing.away_score);
    }

    const stored = await fetchMatchEvents(matchId);
    setEvents(stored);
  }, []);

  // ── Start a new match ─────────────────────────────────────────────────────

  const startMatch = useCallback(async (
    awayWallet: string | null = null,
    trigger: MatchTrigger = 'on_demand',
  ) => {
    setStarting(true);
    setError(null);
    setEvents([]);
    setHomeScore(0);
    setAwayScore(0);
    setStatus('pending');

    const newMatch = await createSimMatch(awayWallet, trigger);
    if (!newMatch) {
      setError('Could not create match — are you signed in?');
      setStarting(false);
      setStatus('idle');
      return;
    }

    setMatch(newMatch);
    setStatus('live');
    setStarting(false);

    // Await the full simulation — all events come back in one response
    const result = await runSimulation(newMatch.id);

    if (!result.ok) {
      setError(result.error ?? 'Simulation failed');
      setStatus('idle');
      return;
    }

    const evs = result.events ?? [];
    const ft  = evs.find(e => e.event_type === 'full_time');
    const p   = ft?.payload as Record<string, number> | undefined;

    setEvents(evs);
    setHomeScore(p?.home_score ?? 0);
    setAwayScore(p?.away_score ?? 0);
    setStatus('finished');
  }, []);

  // ── Auto-connect to initialMatchId (replay) ───────────────────────────────

  useEffect(() => {
    if (initialMatchId) connectToMatch(initialMatchId);
    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMatchId]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMatch(null);
    setEvents([]);
    setStatus('idle');
    setHomeScore(0);
    setAwayScore(0);
    setError(null);
  }, []);

  return {
    match, events, status,
    homeScore, awayScore,
    starting, error,
    startMatch, connectToMatch, reset,
  };
}
