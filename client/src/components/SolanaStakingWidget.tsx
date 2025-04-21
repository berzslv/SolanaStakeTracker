import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatAmount } from '@/utils/helpers';
import { PROGRAM_ID, TOKEN_MINT_ADDRESS } from '@/utils/constants';

// APY is typically fixed for staking programs
const ESTIMATED_APY = 5.5; // 5.5% annual yield

const SolanaStakingWidget: React.FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { toast } = useToast();
  
  const [stakedBalance, setStakedBalance] = useState<number>(0);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [txPending, setTxPending] = useState<boolean>(false);
  
  // Get token balance and staked balance
  useEffect(() => {
    const fetchBalances = async () => {
      if (!publicKey) return;
      
      setIsLoading(true);
      try {
        // In a production environment, this would make a real call to fetch token balances
        // For this demo, we're using mock data
        
        // Fetch token balance
        // Ideally, we would use TokenAccountsFilter and getParsedTokenAccountsByOwner here
        // But for demo purposes, we're using a small static value
        setTokenBalance(1000);
        
        // Fetch staked balance
        // Ideally, we would query the staking program account with the user's public key
        setStakedBalance(500);
      } catch (error) {
        console.error('Error fetching balances:', error);
        toast({
          title: 'Error fetching balances',
          description: 'Failed to load your token balances',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBalances();
  }, [publicKey, connection, toast]);
  
  // Calculate estimated rewards
  const calculateRewards = (amount: number): number => {
    // Simple calculation: amount * APY / 12 for monthly reward
    return (amount * ESTIMATED_APY) / 100 / 12;
  };
  
  // Handle staking tokens
  const handleStake = async () => {
    if (!publicKey || !sendTransaction) return;
    
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
    
    setTxPending(true);
    try {
      // In a real implementation, we would create a transaction to call the staking program
      // For this example, we'll create a placeholder transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: publicKey, // Sending to self as placeholder
          lamports: 0, // Sending 0 lamports as this is just a placeholder
        })
      );
      
      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      // Update balances (in a real implementation, we'd refetch from the blockchain)
      setTokenBalance(prev => prev - stakeAmountNum);
      setStakedBalance(prev => prev + stakeAmountNum);
      
      toast({
        title: 'Staking successful',
        description: `You have staked ${stakeAmountNum} HATM tokens`,
      });
      
      // Reset input
      setStakeAmount('');
    } catch (error) {
      console.error('Error staking tokens:', error);
      toast({
        title: 'Staking failed',
        description: 'There was an error processing your staking request',
        variant: 'destructive',
      });
    } finally {
      setTxPending(false);
    }
  };
  
  // Handle unstaking tokens
  const handleUnstake = async () => {
    if (!publicKey || !sendTransaction) return;
    
    const unstakeAmountNum = parseFloat(unstakeAmount);
    if (isNaN(unstakeAmountNum) || unstakeAmountNum <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount to unstake',
        variant: 'destructive',
      });
      return;
    }
    
    if (unstakeAmountNum > stakedBalance) {
      toast({
        title: 'Insufficient staked balance',
        description: 'You do not have enough staked tokens to unstake',
        variant: 'destructive',
      });
      return;
    }
    
    setTxPending(true);
    try {
      // In a real implementation, we would create a transaction to call the staking program
      // For this example, we'll create a placeholder transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: publicKey, // Sending to self as placeholder
          lamports: 0, // Sending 0 lamports as this is just a placeholder
        })
      );
      
      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      // Update balances (in a real implementation, we'd refetch from the blockchain)
      setTokenBalance(prev => prev + unstakeAmountNum);
      setStakedBalance(prev => prev - unstakeAmountNum);
      
      toast({
        title: 'Unstaking successful',
        description: `You have unstaked ${unstakeAmountNum} HATM tokens`,
      });
      
      // Reset input
      setUnstakeAmount('');
    } catch (error) {
      console.error('Error unstaking tokens:', error);
      toast({
        title: 'Unstaking failed',
        description: 'There was an error processing your unstaking request',
        variant: 'destructive',
      });
    } finally {
      setTxPending(false);
    }
  };
  
  // Handle max buttons
  const handleMaxStake = () => setStakeAmount(tokenBalance.toString());
  const handleMaxUnstake = () => setUnstakeAmount(stakedBalance.toString());
  
  return (
    <div className="space-y-8">
      {/* Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your HATM Balances</CardTitle>
          <CardDescription>View and manage your HATM token balances</CardDescription>
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
                  `${formatAmount(stakedBalance)} HATM`
                )}
              </div>
            </div>
          </div>
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
                  disabled={isLoading || txPending}
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
                  disabled={isLoading || txPending || !publicKey}
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
            disabled={isLoading || txPending || !publicKey || !stakeAmount || parseFloat(stakeAmount) <= 0}
            className="w-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600"
          >
            {txPending ? (
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
                disabled={isLoading || txPending}
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
                disabled={isLoading || txPending || !publicKey}
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
            disabled={isLoading || txPending || !publicKey || !unstakeAmount || parseFloat(unstakeAmount) <= 0}
            variant="outline"
            className="w-full border-pink-500 text-pink-500 hover:bg-pink-500/10"
          >
            {txPending ? (
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
          This is a demonstration of HATM staking functionality. In a production environment, these
          transactions would interact with a real staking program on the Solana blockchain.
        </p>
      </div>
    </div>
  );
};

export default SolanaStakingWidget;