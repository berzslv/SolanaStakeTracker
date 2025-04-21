import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatAmount } from '@/utils/helpers';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStaking } from '@/hooks/useStaking';

// APY is typically fixed for staking programs
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
    // Simple calculation: amount * APY / 12 for monthly reward
    return (amount * ESTIMATED_APY) / 100 / 12;
  };
  
  // Handle registration
  const handleRegister = async () => {
    if (!publicKey) return;
    
    try {
      await registerUser();
      await refreshBalances();
    } catch (error) {
      console.error('Registration error:', error);
    }
  };
  
  // Handle staking tokens
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
  const handleMaxStake = () => setStakeAmount(tokenBalance.toString());
  const handleMaxUnstake = () => setUnstakeAmount(stakedAmount.toString());
  
  return (
    <div className="space-y-8">
      {/* Balance Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Your HATM Balances</CardTitle>
            <CardDescription>View and manage your HATM token balances</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleRefresh}
            disabled={isLoading || isProcessing}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Available Balance</div>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  `${formatAmount(tokenBalance)} HATM`
                )}
              </div>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Staked Balance</div>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  `${formatAmount(stakedAmount)} HATM`
                )}
              </div>
            </div>
          </div>
          
          {!isRegistered && !isLoading && (
            <Alert className="mt-4">
              <AlertDescription>
                You need to register with the staking program first.
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRegister}
                  disabled={isProcessing}
                  className="ml-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    'Register Now'
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {/* Staking Card */}
      <Card>
        <CardHeader>
          <CardTitle>Stake HATM Tokens</CardTitle>
          <CardDescription>Stake your HATM tokens to earn rewards</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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
                  disabled={isLoading || isProcessing || !publicKey || !isRegistered}
                  className="pr-16"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-muted-foreground">HATM</span>
                </div>
              </div>
            </div>
            
            {stakeAmount && !isNaN(parseFloat(stakeAmount)) && parseFloat(stakeAmount) > 0 && (
              <div className="bg-muted p-3 rounded-lg space-y-1">
                <div className="text-sm font-medium">Estimated Monthly Rewards</div>
                <div className="text-xl font-bold text-primary">
                  {formatAmount(calculateRewards(parseFloat(stakeAmount)))} HATM
                </div>
                <div className="text-xs text-muted-foreground">
                  Based on an estimated APY of {ESTIMATED_APY}%
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleStake}
            disabled={isLoading || isProcessing || !publicKey || !isRegistered || !stakeAmount || parseFloat(stakeAmount) <= 0}
            className="w-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600"
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
        </CardFooter>
      </Card>
      
      {/* Unstaking Card */}
      <Card>
        <CardHeader>
          <CardTitle>Unstake HATM Tokens</CardTitle>
          <CardDescription>Withdraw your staked HATM tokens</CardDescription>
        </CardHeader>
        <CardContent>
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
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleUnstake}
            disabled={isLoading || isProcessing || !publicKey || !isRegistered || !unstakeAmount || parseFloat(unstakeAmount) <= 0}
            variant="outline"
            className="w-full border-pink-500 text-pink-500 hover:bg-pink-500/10"
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
        </CardFooter>
      </Card>
      
      {/* Disclaimer */}
      <div className="text-xs text-muted-foreground text-center">
        <p>
          HATM token staking is powered by Solana. All staking operations interact with 
          a real staking program on the Solana devnet.
        </p>
      </div>
    </div>
  );
};

export default SolanaStakingWidget;