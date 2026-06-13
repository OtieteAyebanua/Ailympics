import { useCallback, useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { celo } from 'wagmi/chains';

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
      if (chain?.id !== celo.id) {
        switchChain({ chainId: celo.id });
      }
    } else if (!isConnected && prevConnected.current) {
      showToastRef.current('Wallet disconnected');
    }
    prevConnected.current = isConnected;
  }, [isConnected, chain?.id, switchChain]);

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
