import { useCallback, useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { signMessage } from 'wagmi/actions';
import { celo } from 'wagmi/chains';
import { wagmiConfig } from '../lib/wagmi';
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
      if (chain?.id !== celo.id) switchChain({ chainId: celo.id });

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

    // Use Coinbase Wallet (Smart Wallet) which provides a built-in modal
    // covering both Coinbase Wallet and installed injected wallets
    let targetConnector = connectors.find(c => c.id === 'coinbaseWalletSDK');
    
    if (!targetConnector) {
      targetConnector = connectors[0]; // fallback
    }

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
  const onCelo = chain?.id === celo.id;

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
