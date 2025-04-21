import React from "react";
import { TOKEN_MINT_ADDRESS, SOLSCAN_URL } from "@/utils/constants";
import { formatAddress, getYear } from "@/utils/helpers";
import SolanaWalletButton from "@/components/SolanaWalletButton";
import SolanaStakingWidget from "@/components/SolanaStakingWidget";
import { useWallet } from "@solana/wallet-adapter-react";

export default function Home() {
  const { publicKey, connected } = useWallet();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 17L12 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 7.01001L12 7.00001" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xl font-semibold text-gray-800 dark:text-white">HATM Token Staking</span>
          </div>
          
          {/* Wallet connection */}
          <SolanaWalletButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8">
        {!connected ? (
          <div className="flex flex-col items-center justify-center h-96">
            <img src="https://solana.com/src/img/branding/solanaLogoMark.svg" alt="Solana Logo" className="w-24 h-24 mb-6" />
            <h2 className="text-2xl font-bold text-center mb-4">Connect your wallet to start staking</h2>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-8 max-w-md">
              Stake your HATM tokens to earn rewards. Connect your Phantom wallet to view your balance and stake tokens.
            </p>
            <SolanaWalletButton />
          </div>
        ) : (
          <SolanaStakingWidget />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 shadow-sm mt-auto">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 md:mb-0">
              &copy; {getYear()} HATM Token Staking. All rights reserved.
            </div>
            <div className="flex space-x-4">
              <a href={`${SOLSCAN_URL}/token/${TOKEN_MINT_ADDRESS}`} 
                 target="_blank" 
                 className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary hover:dark:text-primary transition duration-150 ease-in-out flex items-center">
                <span>View Token</span>
                <svg className="ml-1 h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V14M14 4H20M20 4V10M20 4L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}