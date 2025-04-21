import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatAmount } from '@/utils/helpers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStaking } from '@/hooks/useStaking';
import { FaStackExchange } from 'react-icons/fa';
import { BiMoney } from 'react-icons/bi';
import { MdToken } from 'react-icons/md';
import { SiHiveBlockchain } from 'react-icons/si';
import { AiOutlineInfoCircle } from 'react-icons/ai';
import TransactionStatus from './TransactionStatus';
import WalletConnect from './WalletConnect';

// APY is fixed for staking programs
const ESTIMATED_APY = 5.5; // 5.5% annual yield

const SolanaStakingWidget: React.FC = () => {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const { 
    tokenBalance,
    stakedAmount,
    isLoading,
    isProcessing,
    isRegistered,
    refreshBalances,
    registerUser,
    stake,
    unstake
  } = useStaking();
  
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  
  // Calculate estimated rewards
  const calculateRewards = (amount: number): number => {
    // Simple calculation: amount * APY / 365 for daily reward estimate
    return (amount * ESTIMATED_APY) / 100 / 365;
  };
  
  // Calculate estimated APY
  const calculateYearlyRewards = (amount: number): number => {
    // Yearly reward
    return (amount * ESTIMATED_APY) / 100;
  };
  
  // Auto-register when staking if not registered
  const handleStake = async () => {
    if (!publicKey) return;
    
    const stakeAmountNum = parseFloat(stakeAmount);
    if (isNaN(stakeAmountNum) || stakeAmountNum <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount to stake',
        variant: 'destructive',
      });
      return;
    }
    
    if (stakeAmountNum > tokenBalance) {
      toast({
        title: 'Insufficient balance',
        description: 'You do not have enough tokens to stake',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // If not registered, stake function will handle registration automatically
      await stake(stakeAmountNum);
      setStakeAmount('');
    } catch (error) {
      console.error('Error staking tokens:', error);
    }
  };
  
  // Handle unstaking tokens
  const handleUnstake = async () => {
    if (!publicKey) return;
    
    const unstakeAmountNum = parseFloat(unstakeAmount);
    if (isNaN(unstakeAmountNum) || unstakeAmountNum <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount to unstake',
        variant: 'destructive',
      });
      return;
    }
    
    if (unstakeAmountNum > stakedAmount) {
      toast({
        title: 'Insufficient staked balance',
        description: 'You do not have enough staked tokens to unstake',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      await unstake(unstakeAmountNum);
      setUnstakeAmount('');
    } catch (error) {
      console.error('Error unstaking tokens:', error);
    }
  };
  
  // Handle manual refresh
  const handleRefresh = async () => {
    await refreshBalances();
    toast({
      title: 'Balances refreshed',
      description: 'Your token balances have been updated'
    });
  };
  
  // Handle max buttons
  const handleMaxStake = () => {
    const formattedAmount = tokenBalance > 0 ? tokenBalance.toString() : "0";
    setStakeAmount(formattedAmount);
  };
  
  const handleMaxUnstake = () => {
    const formattedAmount = stakedAmount > 0 ? stakedAmount.toString() : "0";
    setUnstakeAmount(formattedAmount);
  };
  
  // Auto-refresh balances when component loads and periodically
  useEffect(() => {
    if (publicKey) {
      refreshBalances();
      
      // Set up interval for periodic refresh
      const interval = setInterval(() => {
        refreshBalances();
      }, 30000); // Refresh every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [publicKey, refreshBalances]);
  
  return (
    <div className="w-full mx-auto">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">HATM Token Staking</h1>
          <p className="text-muted-foreground">Stake your HATM tokens to earn rewards on Solana</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleRefresh}
            disabled={isLoading || isProcessing}
            className="rounded-full"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <WalletConnect showFullButton={true} />
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Balance Card */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-primary/5 pb-2">
            <CardTitle className="text-md flex items-center">
              <MdToken className="mr-2" />
              Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Available:</span>
                <span className="font-medium">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                  ) : (
                    `${formatAmount(tokenBalance)} HATM`
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Staked:</span>
                <span className="font-medium">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                  ) : (
                    `${formatAmount(stakedAmount)} HATM`
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-medium">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                  ) : (
                    `${formatAmount(tokenBalance + stakedAmount)} HATM`
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Rewards Card */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-primary/5 pb-2">
            <CardTitle className="text-md flex items-center">
              <BiMoney className="mr-2" />
              Rewards
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">APY:</span>
                <span className="font-medium">{ESTIMATED_APY}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Daily Earnings:</span>
                <span className="font-medium">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                  ) : (
                    `${formatAmount(calculateRewards(stakedAmount))} HATM`
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Yearly Earnings:</span>
                <span className="font-medium">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                  ) : (
                    `${formatAmount(calculateYearlyRewards(stakedAmount))} HATM`
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Protocol Stats Card */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-primary/5 pb-2">
            <CardTitle className="text-md flex items-center">
              <SiHiveBlockchain className="mr-2" />
              Protocol Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Staked:</span>
                <span className="font-medium">Loading...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stakers:</span>
                <span className="font-medium">Loading...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network:</span>
                <span className="font-medium">Solana Devnet</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Staking Interface */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle>Staking Interface</CardTitle>
          <CardDescription>Stake or unstake your HATM tokens</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="stake" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="stake">Stake</TabsTrigger>
              <TabsTrigger value="unstake">Unstake</TabsTrigger>
            </TabsList>
            
            {/* Stake Tab */}
            <TabsContent value="stake" className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="stakeAmount" className="text-sm font-medium">
                    Amount to Stake
                  </label>
                  <button
                    onClick={handleMaxStake}
                    className="text-xs text-primary hover:underline"
                    disabled={isLoading || isProcessing || tokenBalance === 0}
                  >
                    MAX
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="stakeAmount"
                    type="number"
                    placeholder="0.00"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    disabled={isLoading || isProcessing || !publicKey}
                    className="pr-16"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span className="text-muted-foreground">HATM</span>
                  </div>
                </div>
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Available: {formatAmount(tokenBalance)} HATM</span>
                  <span>Fee: 0%</span>
                </div>
              </div>
              
              {stakeAmount && !isNaN(parseFloat(stakeAmount)) && parseFloat(stakeAmount) > 0 && (
                <div className="bg-muted p-3 rounded-lg space-y-1">
                  <div className="text-sm font-medium">Estimated Rewards</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Daily</div>
                      <div className="text-sm font-bold">
                        {formatAmount(calculateRewards(parseFloat(stakeAmount)))} HATM
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Yearly ({ESTIMATED_APY}% APY)</div>
                      <div className="text-sm font-bold">
                        {formatAmount(calculateYearlyRewards(parseFloat(stakeAmount)))} HATM
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <Button
                onClick={handleStake}
                disabled={isLoading || isProcessing || !publicKey || !stakeAmount || parseFloat(stakeAmount) <= 0}
                className="w-full bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Staking...
                  </>
                ) : (
                  'Stake HATM'
                )}
              </Button>
              
              <div className="flex items-center space-x-2 text-sm text-muted-foreground p-2 border border-muted rounded-md">
                <AiOutlineInfoCircle className="h-4 w-4 flex-shrink-0" />
                <span>Your first stake will automatically register you with the program.</span>
              </div>
            </TabsContent>
            
            {/* Unstake Tab */}
            <TabsContent value="unstake" className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="unstakeAmount" className="text-sm font-medium">
                    Amount to Unstake
                  </label>
                  <button
                    onClick={handleMaxUnstake}
                    className="text-xs text-primary hover:underline"
                    disabled={isLoading || isProcessing || stakedAmount === 0}
                  >
                    MAX
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="unstakeAmount"
                    type="number"
                    placeholder="0.00"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    disabled={isLoading || isProcessing || !publicKey || !isRegistered || stakedAmount === 0}
                    className="pr-16"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span className="text-muted-foreground">HATM</span>
                  </div>
                </div>
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Staked: {formatAmount(stakedAmount)} HATM</span>
                  <span>Fee: 0%</span>
                </div>
              </div>
              
              <Button
                onClick={handleUnstake}
                disabled={isLoading || isProcessing || !publicKey || !isRegistered || !unstakeAmount || parseFloat(unstakeAmount) <= 0}
                variant="outline"
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Unstaking...
                  </>
                ) : (
                  'Unstake HATM'
                )}
              </Button>
              
              <div className="flex items-center space-x-2 text-sm text-muted-foreground p-2 border border-muted rounded-md">
                <AiOutlineInfoCircle className="h-4 w-4 flex-shrink-0" />
                <span>Unstaking is available anytime with no lockup period.</span>
              </div>
            </TabsContent>
          </Tabs>
          
          <TransactionStatus />
        </CardContent>
      </Card>
      
      {/* Info Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-md flex items-center">
            <FaStackExchange className="mr-2" />
            About HATM Staking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <p>
              HATM token staking allows you to earn rewards on your tokens. The staking program is deployed on the Solana devnet.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-2">Staking Benefits</h3>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>Earn {ESTIMATED_APY}% APY on your HATM tokens</li>
                  <li>No minimum staking amount</li>
                  <li>No lock-up period</li>
                  <li>Automatic registration</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">How It Works</h3>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>Connect your Solana wallet</li>
                  <li>Enter the amount you want to stake</li>
                  <li>Approve the transaction</li>
                  <li>Earn rewards based on your staked amount</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SolanaStakingWidget;