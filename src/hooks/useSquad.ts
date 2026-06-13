import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { type OwnedPlayer } from '../models/models';
import { getUserSquad, getSquadInfo, releasePlayer } from '../lib/squad';
import { clonePlayer } from '../lib/marketplace';
import { getTrainingPoints } from '../lib/training';

export interface SquadState {
  players:        OwnedPlayer[];
  count:          number;
  limit:          number;
  trainingPoints: number;
  loading:        boolean;
  // actions
  clone:          (playerId: number) => Promise<string | null>;
  release:        (userPlayerId: string) => Promise<string | null>;
  refreshPoints:  () => Promise<void>;
  refresh:        () => Promise<void>;
}

export function useSquad(): SquadState {
  const { isConnected } = useAccount();

  const [players,        setPlayers]        = useState<OwnedPlayer[]>([]);
  const [count,          setCount]          = useState(0);
  const [limit,          setLimit]          = useState(25);
  const [trainingPoints, setTrainingPoints] = useState(0);
  const [loading,        setLoading]        = useState(false);

  const load = useCallback(async () => {
    if (!isConnected) {
      setPlayers([]);
      setCount(0);
      setTrainingPoints(0);
      return;
    }
    setLoading(true);
    try {
      const [squad, info, pts] = await Promise.all([
        getUserSquad(),
        getSquadInfo(),
        getTrainingPoints(),
      ]);
      setPlayers(squad);
      setCount(info?.count ?? squad.length);
      setLimit(info?.limit ?? 25);
      setTrainingPoints(pts);
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  // Load whenever wallet connects / disconnects
  useEffect(() => { load(); }, [load]);

  const clone = useCallback(async (playerId: number): Promise<string | null> => {
    const err = await clonePlayer(playerId);
    if (!err) await load();
    return err;
  }, [load]);

  const release = useCallback(async (userPlayerId: string): Promise<string | null> => {
    const err = await releasePlayer(userPlayerId);
    if (!err) await load();
    return err;
  }, [load]);

  const refreshPoints = useCallback(async () => {
    const pts = await getTrainingPoints();
    setTrainingPoints(pts);
  }, []);

  return {
    players,
    count,
    limit,
    trainingPoints,
    loading,
    clone,
    release,
    refreshPoints,
    refresh: load,
  };
}
