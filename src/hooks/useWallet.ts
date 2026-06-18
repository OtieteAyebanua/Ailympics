import { useCallback, useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { signMessage } from 'wagmi/actions';
import { wagmiConfig } from '../lib/wagmi';
import { ACTIVE_CHAIN_ID } from '../lib/chain';
import { signInWithWallet, signOut, restoreSession } from '../lib/auth';

export function useWallet(showToast: (msg: string) => void) {
  const { address, isConnected, chain, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const prevConnected = useRef(false);
  useEffect(() => {
    if (isConnected && !prevConnected.current) {
      showToastRef.current('Wallet connected');
      if (chain?.id !== ACTIVE_CHAIN_ID) switchChain({ chainId: ACTIVE_CHAIN_ID });

      if (address) {
        if (restoreSession()) return;
        setTimeout(() => {
          signInWithWallet(address, (msg) =>
            signMessage(wagmiConfig, { account: address as `0x${string}`, message: msg }),
          ).catch((err: Error) => {
            const reason = err?.message ?? String(err);
            console.error('[Ailympics] Auth error:', reason);
            if (reason.toLowerCase().includes('reject') || reason.toLowerCase().includes('cancel') || reason.toLowerCase().includes('denied')) return;
            showToastRef.current(`Sign-in failed: ${reason}`);
          });
        }, 300);
      }
    } else if (!isConnected && prevConnected.current) {
      showToastRef.current('Wallet disconnected');
      signOut();
    }
    prevConnected.current = isConnected;
  }, [isConnected, chain?.id, switchChain, address]);

  const toggleConnect = useCallback(() => {
    if (isConnected) {
      disconnect({ connector });
      return;
    }

    // Prefer an installed injected wallet (MetaMask, Coinbase extension, etc.).
    // EIP-6963 discovery only surfaces injected connectors for wallets that are
    // actually installed, so any of those is a safe, region-independent choice.
    // Fall back to the Coinbase connector, then to whatever is first.
    const targetConnector =
      connectors.find(c => c.type === 'injected' && c.id !== 'coinbaseWalletSDK') ??
      connectors.find(c => c.id === 'coinbaseWalletSDK') ??
      connectors[0];

    if (!targetConnector) {
      showToastRef.current('No wallet detected.');
      return;
    }

    console.log('[Ailympics] All connectors:', connectors.map(c => ({ id: c.id, name: c.name, type: c.type })));
    console.log('[Ailympics] Connecting with:', targetConnector.id, targetConnector.name);

    connect(
      { connector: targetConnector },
      {
        onSuccess() {
          console.log('[Ailympics] Wallet connected successfully');
        },
        onError(err) {
          console.error('[Ailympics] Connection error:', err);
          const msg = err.message ?? '';
          if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('cancel')) {
            return; // user cancelled — don't show error
          }
          showToastRef.current('Connection failed — is a wallet installed?');
        },
      },
    );
  }, [isConnected, connector, connect, disconnect, connectors]);

  const needWallet = useCallback((): boolean => {
    if (!isConnected) {
      showToastRef.current('Connect a wallet first');
      return false;
    }
    return true;
  }, [isConnected]);

  const shortAddr = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : '';

  const networkName = chain?.name ?? '';
  const onCelo = chain?.id === ACTIVE_CHAIN_ID;

  return {
    connected: isConnected,
    walletAddr: shortAddr,
    address,
    networkName,
    onCelo,
    toggleConnect,
    needWallet,
  };
}
