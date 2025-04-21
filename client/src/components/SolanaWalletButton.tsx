import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { formatAddress } from '@/utils/helpers';

const SolanaWalletButton: React.FC = () => {
  const { publicKey, connected, disconnect } = useWallet();

  if (!connected || !publicKey) {
    return (
      <WalletMultiButton className="bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg" />
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{formatAddress(publicKey.toString())}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => disconnect()}
          className="border-pink-500 text-pink-500 hover:bg-pink-500/10"
        >
          Disconnect
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">Solana Devnet</div>
    </div>
  );
};

export default SolanaWalletButton;