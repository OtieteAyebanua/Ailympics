import { useCallback, useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { celo } from 'wagmi/chains';

export function useWallet(showToast: (msg: string) => void) {
  const { address, isConnected, chain, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

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
    const connector =
      connectors.find(c => c.type === 'injected') ?? connectors[0];
    if (connector) {
      connect(
        { connector },
        {
          onError(err) {
            const msg = err.message ?? '';
            if (!msg.toLowerCase().includes('reject') && !msg.toLowerCase().includes('cancel')) {
              showToastRef.current('Connection failed — is a wallet installed?');
            }
          },
        },
      );
    } else {
      showToastRef.current('No wallet detected. Install MetaMask or Valora.');
    }
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
