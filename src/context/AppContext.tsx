import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
  type ReactNode,
} from 'react';
import { useSquad, type SquadState } from '../hooks/useSquad';
import { getCloneablePlayers, getNFTPlayers } from '../lib/marketplace';
import { getListings, nftConfigured, type OnchainListing } from '../lib/nft';
import { type DbPlayer } from '../models/models';

/**
 * How often shared data is re-fetched in the background so the UI stays fresh
 * without the user reloading the app. Also re-fetched whenever the tab regains
 * focus and after any mutation (clone / release / train / play / save).
 */
const POLL_INTERVAL_MS = 30_000;

export interface AppContextValue {
  /** The current user's squad — players, counts, training points + mutations. */
  squad: SquadState;

  // ── Marketplace catalog (public) ──
  cloneables:     DbPlayer[];
  nfts:           DbPlayer[];
  catalogLoading: boolean;
  refreshCatalog: () => Promise<void>;

  // ── Live on-chain marketplace listings, keyed by token_id ──
  listings:        Map<string, OnchainListing>;
  refreshListings: () => Promise<void>;

  /** Re-fetch everything at once. */
  refreshAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  children,
  showToast,
}: {
  children: ReactNode;
  showToast?: (msg: string) => void;
}) {
  const squad = useSquad();

  const [cloneables,     setCloneables]     = useState<DbPlayer[]>([]);
  const [nfts,           setNfts]           = useState<DbPlayer[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [listings, setListings] = useState<Map<string, OnchainListing>>(new Map());

  // Keep the latest showToast without re-creating fetchers / re-arming the poll.
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  // Latest NFT catalog, so refreshListings stays a stable callback.
  const nftsRef = useRef<DbPlayer[]>([]);
  useEffect(() => { nftsRef.current = nfts; }, [nfts]);

  const refreshCatalog = useCallback(async () => {
    try {
      const [c, n] = await Promise.all([getCloneablePlayers(), getNFTPlayers()]);
      setCloneables(c);
      setNfts(n);
    } catch (err) {
      showToastRef.current?.(err instanceof Error ? err.message : 'Failed to load marketplace');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const refreshListings = useCallback(async () => {
    if (!nftConfigured()) return;
    const tokenIds = nftsRef.current
      .filter((p) => p.token_id)
      .map((p) => BigInt(p.token_id!));
    if (tokenIds.length === 0) { setListings(new Map()); return; }
    try {
      setListings(await getListings(tokenIds));
    } catch (err) {
      console.error('[AppContext] refreshListings:', err);
    }
  }, []);

  const squadRefresh = squad.refresh;
  const refreshAll = useCallback(async () => {
    await Promise.all([
      squadRefresh(),
      refreshCatalog(),
      refreshListings(),
    ]);
  }, [squadRefresh, refreshCatalog, refreshListings]);

  // ── Initial load + react to wallet connect/disconnect ──
  // Catalog is public.
  useEffect(() => { refreshCatalog(); }, [refreshCatalog]);

  // Listings depend on the NFT catalog — refresh once it (re)loads.
  useEffect(() => { refreshListings(); }, [refreshListings, nfts]);

  // ── Background polling + refresh on tab refocus ──
  const refreshAllRef = useRef(refreshAll);
  useEffect(() => { refreshAllRef.current = refreshAll; }, [refreshAll]);

  useEffect(() => {
    const id = setInterval(() => { void refreshAllRef.current(); }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshAllRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const value: AppContextValue = {
    squad,
    cloneables, nfts, catalogLoading, refreshCatalog,
    listings, refreshListings,
    refreshAll,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
}
