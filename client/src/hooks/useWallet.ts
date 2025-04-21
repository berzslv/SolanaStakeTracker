import { useContext, useEffect } from 'react';
import { WalletContext } from '@/components/WalletProvider';
import { apiRequest } from '@/lib/queryClient';

export function useWallet() {
  const { 
    publicKey, 
    connecting, 
    connected,
    disconnect: disconnectWallet
  } = useContext(WalletContext);

  // When a wallet is connected, record this on the backend
  useEffect(() => {
    if (publicKey && connected) {
      // Log wallet connection to server
      const logConnection = async () => {
        try {
          await apiRequest('POST', '/api/wallet/connect', {
            walletAddress: publicKey
          });
        } catch (error) {
          console.error('Failed to log wallet connection:', error);
        }
      };
      
      logConnection();
    }
  }, [publicKey, connected]);

  return {
    isConnected: connected,
    isConnecting: connecting,
    walletAddress: publicKey,
    disconnect: disconnectWallet
  };
}
