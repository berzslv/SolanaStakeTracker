import React, { FC, ReactNode, useEffect, useMemo, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { useToast } from '@/hooks/use-toast';

// Import the wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export const SolanaWalletProvider: FC<SolanaWalletProviderProps> = ({ children }) => {
  // Use toast for notifications
  const { toast } = useToast();
  const [walletChecked, setWalletChecked] = useState(false);
  
  // Use Solana Devnet - use a more reliable custom RPC endpoint
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => "https://api.devnet.solana.com", []);
  
  // Initialize wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
    ],
    []
  );

  // Check if we're in Replit's preview window and if wallet is available
  useEffect(() => {
    if (walletChecked) return;
    
    const checkWalletAvailability = () => {
      const isInIframe = window.top !== window.self;
      const hasPhantomWallet = typeof window !== 'undefined' && 'solana' in window;
      
      // Only show the message once
      if (isInIframe && !hasPhantomWallet) {
        console.warn('Wallet not available in Replit preview - use "Open in new tab"');
        toast({
          title: "Wallet connection issues?",
          description: "Please use 'Open in new tab' for full wallet functionality.",
          variant: "default"
        });
      }
      
      setWalletChecked(true);
    };
    
    // Check after a short delay to ensure DOM is fully loaded
    setTimeout(checkWalletAvailability, 2000);
  }, [toast, walletChecked]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default SolanaWalletProvider;