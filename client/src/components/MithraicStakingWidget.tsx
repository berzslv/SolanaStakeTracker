import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Coins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatAmount } from '@/utils/helpers';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMithraicStaking } from '@/hooks/useMithraicStaking';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MithraicStakingWidget: React.FC = () => {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const { 
    tokenBalance,
    stakedAmount,
    rewardAmount,
    stakeApy,
    isLoading,
    isProcessing,
    stakePool,
    refreshBalances,
    stake,
    unstake,
    claimRewards
  } = useMithraicStaking();
  
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  
  // Calculate estimated rewards
  const calculateRewards = (amount: number): number => {
    return (amount * stakeApy) / 100 / 12; // Monthly reward
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
    if (!publicKey || stakedAmount <= 0) return;
    
    try {
      await unstake(stakedAmount);
      setUnstakeAmount('');
    } catch (error) {
      console.error('Error unstaking tokens:', error);
    }
  };
  
  // Handle claiming rewards
  const handleClaimRewards = async () => {
    if (!publicKey || rewardAmount <= 0) return;
    
    try {
      await claimRewards();
    } catch (error) {
      console.error('Error claiming rewards:', error);
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
  
  return (
    <div className="space-y-8">
      {/* Balance Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Your HATM Balances</CardTitle>
            <CardDescription>View and manage your HATM token balances</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {stakePool && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Pool Active
              </Badge>
            )}
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Rewards Earned</div>
              <div className="flex justify-between items-center">
                <div className="text-2xl font-bold">
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    `${formatAmount(rewardAmount)} HATM`
                  )}
                </div>
                {rewardAmount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClaimRewards}
                    disabled={isProcessing || rewardAmount <= 0}
                    className="flex items-center gap-1"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Coins className="h-3 w-3" />
                        Claim
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          {!stakePool && !isLoading && (
            <Alert className="mt-4">
              <AlertDescription>
                No active staking pool found. Please try again later or contact support.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {/* Staking Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Stake and Earn</CardTitle>
          <CardDescription>Stake your HATM tokens to earn rewards at {stakeApy}% APY</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="stake" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stake">Stake</TabsTrigger>
              <TabsTrigger value="unstake">Unstake</TabsTrigger>
            </TabsList>
            
            <TabsContent value="stake" className="space-y-4 mt-4">
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
                    disabled={isLoading || isProcessing || !publicKey || !stakePool || tokenBalance === 0}
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
                    Based on current APY of {stakeApy}%
                  </div>
                </div>
              )}
              
              <Button
                onClick={handleStake}
                disabled={
                  isLoading || 
                  isProcessing || 
                  !publicKey || 
                  !stakePool || 
                  !stakeAmount || 
                  parseFloat(stakeAmount) <= 0 ||
                  parseFloat(stakeAmount) > tokenBalance
                }
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
            </TabsContent>
            
            <TabsContent value="unstake" className="space-y-4 mt-4">
              {stakedAmount > 0 ? (
                <>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">
                      You have {formatAmount(stakedAmount)} HATM tokens staked.
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleUnstake}
                    disabled={isLoading || isProcessing || !publicKey || !stakePool || stakedAmount <= 0}
                    variant="outline"
                    className="w-full border-pink-500 text-pink-500 hover:bg-pink-500/10"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Unstaking...
                      </>
                    ) : (
                      'Unstake All Tokens'
                    )}
                  </Button>
                </>
              ) : (
                <div className="bg-muted p-4 rounded-lg text-center text-muted-foreground">
                  You don't have any staked tokens to unstake.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Disclaimer */}
      <div className="text-xs text-muted-foreground text-center">
        <p>
          HATM token staking is powered by Solana. All staking operations interact with 
          a real staking program on the Solana blockchain.
        </p>
      </div>
    </div>
  );
};

export default MithraicStakingWidget;