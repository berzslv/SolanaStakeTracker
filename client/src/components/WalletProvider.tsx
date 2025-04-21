import { FC, ReactNode, useMemo, createContext, useState, useEffect } from "react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { Connection, clusterApiUrl } from "@solana/web3.js";

// Create context to provide wallet functionality
export const WalletContext = createContext<{
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
  disconnect: () => void;
  connect: () => Promise<void>;
  signTransaction: any;
}>({
  publicKey: null,
  connected: false,
  connecting: false,
  disconnect: () => {},
  connect: async () => {},
  signTransaction: null
});

// Create context to provide connection
export const ConnectionContext = createContext<{
  connection: Connection;
}>({
  connection: new Connection(clusterApiUrl('devnet'))
});

// Create context for wallet modal
export const WalletModalContext = createContext<{
  visible: boolean;
  setVisible: (visible: boolean) => void;
}>({
  visible: false,
  setVisible: () => {}
});

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: FC<WalletProviderProps> = ({ children }) => {
  // Set the network to devnet
  const endpoint = clusterApiUrl('devnet');
  const connection = useMemo(() => new Connection(endpoint), [endpoint]);
  
  // Initialize phantom adapter
  const [adapter] = useState(() => new PhantomWalletAdapter());
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  // Setup event listeners for adapter
  useEffect(() => {
    adapter.on('connect', () => {
      if (adapter.publicKey) {
        setPublicKey(adapter.publicKey.toString());
        setConnected(true);
      }
      setConnecting(false);
    });

    adapter.on('disconnect', () => {
      setPublicKey(null);
      setConnected(false);
    });

    adapter.on('error', (error) => {
      console.error('Wallet error:', error);
      setConnecting(false);
    });

    return () => {
      adapter.removeAllListeners();
    };
  }, [adapter]);

  // Connect function
  const connect = async () => {
    setConnecting(true);
    try {
      await adapter.connect();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setConnecting(false);
    }
  };

  // Disconnect function
  const disconnect = () => {
    try {
      adapter.disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  return (
    <ConnectionContext.Provider value={{ connection }}>
      <WalletContext.Provider
        value={{
          publicKey,
          connected,
          connecting,
          disconnect,
          connect,
          signTransaction: adapter.signTransaction?.bind(adapter)
        }}
      >
        <WalletModalContext.Provider
          value={{
            visible,
            setVisible
          }}
        >
          {children}
        </WalletModalContext.Provider>
      </WalletContext.Provider>
    </ConnectionContext.Provider>
  );
};
