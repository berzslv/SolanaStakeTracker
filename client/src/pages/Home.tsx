import { useState, useEffect, useContext } from "react";
import { useToast } from "@/hooks/use-toast";
import { WalletContext } from "@/components/WalletProvider";
import { TOKEN_MINT_ADDRESS, SOLSCAN_URL } from "@/utils/constants";
import { formatAddress, getYear } from "@/utils/helpers";
import { Button } from "@/components/ui/button";

// Simplified Home page that doesn't rely on complex components
export default function Home() {
  const { connected, publicKey, connect, disconnect, connecting } = useContext(WalletContext);
  const { toast } = useToast();
  
  // Simplified state for balances
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [stakedBalance, setStakedBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [stakeAmount, setStakeAmount] = useState<string>("");
  const [unstakeAmount, setUnstakeAmount] = useState<string>("");
  
  // Simulate loading token balances (without using Buffer-dependent code)
  useEffect(() => {
    if (connected && publicKey) {
      setIsLoading(true);
      
      // Simulate API call with timeout
      const timer = setTimeout(() => {
        // Demo values
        setTokenBalance(100);
        setStakedBalance(50);
        setIsLoading(false);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [connected, publicKey]);
  
  // Handle stake action
  const handleStake = () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to stake",
        variant: "destructive"
      });
      return;
    }
    
    const amount = parseFloat(stakeAmount);
    
    if (amount > tokenBalance) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough tokens to stake this amount",
        variant: "destructive"
      });
      return;
    }
    
    // Update balances (simulated for demo)
    setTokenBalance(prev => prev - amount);
    setStakedBalance(prev => prev + amount);
    setStakeAmount("");
    
    toast({
      title: "Tokens staked successfully",
      description: `You have staked ${amount} HATM tokens`,
    });
  };
  
  // Handle unstake action
  const handleUnstake = () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to unstake",
        variant: "destructive"
      });
      return;
    }
    
    const amount = parseFloat(unstakeAmount);
    
    if (amount > stakedBalance) {
      toast({
        title: "Insufficient staked balance",
        description: "You don't have enough staked tokens to unstake this amount",
        variant: "destructive"
      });
      return;
    }
    
    // Update balances (simulated for demo)
    setTokenBalance(prev => prev + amount);
    setStakedBalance(prev => prev - amount);
    setUnstakeAmount("");
    
    toast({
      title: "Tokens unstaked successfully",
      description: `You have unstaked ${amount} HATM tokens`,
    });
  };

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
          
          {/* Inline wallet connect button instead of separate component */}
          {!connected ? (
            <Button 
              onClick={connect} 
              disabled={connecting}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {publicKey ? formatAddress(publicKey) : ''}
              </span>
              <Button
                variant="outline" 
                size="sm"
                onClick={disconnect}
              >
                Disconnect
              </Button>
            </div>
          )}
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
            <Button 
              onClick={connect} 
              disabled={connecting}
              className="bg-primary text-white hover:bg-primary/90"
              size="lg"
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Balance Display */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Your Balance</h2>
              
              {isLoading ? (
                <div className="flex justify-center items-center h-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Wallet Balance</div>
                    <div className="text-2xl font-bold mt-1">{tokenBalance.toLocaleString()} HATM</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Staked Balance</div>
                    <div className="text-2xl font-bold mt-1">{stakedBalance.toLocaleString()} HATM</div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Staking Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Staking Actions</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stake Section */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                  <h3 className="font-medium mb-2">Stake Tokens</h3>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm text-gray-500 dark:text-gray-400">Amount</label>
                      <button 
                        className="text-xs text-primary hover:underline" 
                        onClick={() => setStakeAmount(tokenBalance.toString())}
                      >
                        Max
                      </button>
                    </div>
                    <div className="flex">
                      <input
                        type="number"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        placeholder="0"
                        className="w-full rounded-l-md border border-gray-300 dark:border-gray-600 px-3 py-2 dark:bg-gray-800"
                      />
                      <div className="bg-gray-200 dark:bg-gray-600 px-3 py-2 rounded-r-md flex items-center">
                        HATM
                      </div>
                    </div>
                  </div>
                  <Button 
                    onClick={handleStake}
                    className="w-full" 
                    disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || parseFloat(stakeAmount) > tokenBalance}
                  >
                    Stake Tokens
                  </Button>
                </div>
                
                {/* Unstake Section */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                  <h3 className="font-medium mb-2">Unstake Tokens</h3>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm text-gray-500 dark:text-gray-400">Amount</label>
                      <button 
                        className="text-xs text-primary hover:underline" 
                        onClick={() => setUnstakeAmount(stakedBalance.toString())}
                      >
                        Max
                      </button>
                    </div>
                    <div className="flex">
                      <input
                        type="number"
                        value={unstakeAmount}
                        onChange={(e) => setUnstakeAmount(e.target.value)}
                        placeholder="0"
                        className="w-full rounded-l-md border border-gray-300 dark:border-gray-600 px-3 py-2 dark:bg-gray-800"
                      />
                      <div className="bg-gray-200 dark:bg-gray-600 px-3 py-2 rounded-r-md flex items-center">
                        HATM
                      </div>
                    </div>
                  </div>
                  <Button 
                    onClick={handleUnstake}
                    className="w-full" 
                    disabled={!unstakeAmount || parseFloat(unstakeAmount) <= 0 || parseFloat(unstakeAmount) > stakedBalance}
                    variant="outline"
                  >
                    Unstake Tokens
                  </Button>
                </div>
              </div>
            </div>
          </div>
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
