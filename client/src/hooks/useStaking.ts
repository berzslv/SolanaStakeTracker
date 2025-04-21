import { useState, useCallback, useEffect, useContext } from 'react';
import { WalletContext, ConnectionContext } from '@/components/WalletProvider';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { TOKEN_MINT_ADDRESS } from '@/utils/constants';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTransactionStatus } from '@/contexts/TransactionContext';
import { sleep } from '@/utils/helpers';

// Decimal precision for token amounts
const DECIMALS = 9;

export function useStaking() {
  const { publicKey, connected, signTransaction } = useContext(WalletContext);
  const { connection } = useContext(ConnectionContext);
  const { toast } = useToast();
  const { setTransactionStatus } = useTransactionStatus();
  
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [stakedAmount, setStakedAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Fetch token balance from the wallet
  const fetchTokenBalance = useCallback(async () => {
    if (!publicKey) return 0;
    
    try {
      const pubKey = new PublicKey(publicKey);
      const tokenMint = new PublicKey(TOKEN_MINT_ADDRESS);
      
      try {
        // Get the associated token account for this wallet
        const tokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          pubKey
        );
      
        try {
          // Get the token balance from the account
          const balance = await connection.getTokenAccountBalance(tokenAccount);
          return Number(balance.value.uiAmount || 0);
        } catch (error) {
          console.error('Error getting token balance:', error);
          return 0;
        }
      } catch (error) {
        console.error('Error getting token account address:', error);
        return 0;
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return 0;
    }
  }, [publicKey, connection]);

  // Fetch staked amount 
  const fetchStakedAmount = useCallback(async () => {
    if (!publicKey) return 0;
    
    try {
      // In a real implementation, we would fetch the user's staked amount from the blockchain
      // For this demo, we'll return a static value
      return 50;
    } catch (error) {
      console.error('Error fetching staked amount:', error);
      return 0;
    }
  }, [publicKey]);

  // Refresh balances
  const refreshBalances = useCallback(async () => {
    if (!publicKey) return;
    
    setIsLoading(true);
    try {
      const [tokenBal, stakedBal] = await Promise.all([
        fetchTokenBalance(),
        fetchStakedAmount()
      ]);
      
      setTokenBalance(tokenBal);
      setStakedAmount(stakedBal);
    } catch (error) {
      console.error('Error refreshing balances:', error);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, fetchTokenBalance, fetchStakedAmount]);

  // Stake tokens
  const stake = useCallback(async (amount: number) => {
    if (!publicKey || !connected) {
      throw new Error('Wallet not connected');
    }
    
    setIsProcessing(true);
    setTransactionStatus({
      status: null,
      message: 'Preparing stake transaction...',
      signature: null
    });
    
    try {
      // Simulate transaction delay
      await sleep(2000);
      
      // Update UI with success
      const mockSignature = `stake_${Date.now().toString(36)}`;
      
      setTransactionStatus({
        status: 'success',
        message: 'Tokens staked successfully!',
        signature: mockSignature
      });
      
      // Show success toast
      toast({
        title: 'Tokens staked successfully!',
        description: `Staked ${amount} HATM tokens`
      });
      
      // Update balances
      setTokenBalance(prev => prev - amount);
      setStakedAmount(prev => prev + amount);
      
      // Log transaction to backend
      await apiRequest('POST', '/api/transaction/log', {
        walletAddress: publicKey,
        amount: amount.toString(),
        transactionType: 'stake',
        transactionSignature: mockSignature,
        timestamp: new Date().toISOString()
      });
      
      return mockSignature;
    } catch (error: any) {
      console.error('Error staking tokens:', error);
      
      // Update UI with error
      setTransactionStatus({
        status: 'error',
        message: `Error: ${error.message || 'Unknown error'}`,
        signature: null
      });
      
      // Show error toast
      toast({
        title: 'Staking failed',
        description: error.message || 'Failed to stake tokens',
        variant: 'destructive'
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [publicKey, connected, setTransactionStatus, toast]);

  // Unstake tokens
  const unstake = useCallback(async (amount: number) => {
    if (!publicKey || !connected) {
      throw new Error('Wallet not connected');
    }
    
    setIsProcessing(true);
    setTransactionStatus({
      status: null,
      message: 'Preparing unstake transaction...',
      signature: null
    });
    
    try {
      // Simulate transaction delay
      await sleep(2000);
      
      // Update UI with success
      const mockSignature = `unstake_${Date.now().toString(36)}`;
      
      setTransactionStatus({
        status: 'success',
        message: 'Tokens unstaked successfully!',
        signature: mockSignature
      });
      
      // Show success toast
      toast({
        title: 'Tokens unstaked successfully!',
        description: `Unstaked ${amount} HATM tokens`
      });
      
      // Update balances
      setTokenBalance(prev => prev + amount);
      setStakedAmount(prev => prev - amount);
      
      // Log transaction to backend
      await apiRequest('POST', '/api/transaction/log', {
        walletAddress: publicKey,
        amount: amount.toString(),
        transactionType: 'unstake',
        transactionSignature: mockSignature,
        timestamp: new Date().toISOString()
      });
      
      return mockSignature;
    } catch (error: any) {
      console.error('Error unstaking tokens:', error);
      
      // Update UI with error
      setTransactionStatus({
        status: 'error',
        message: `Error: ${error.message || 'Unknown error'}`,
        signature: null
      });
      
      // Show error toast
      toast({
        title: 'Unstaking failed',
        description: error.message || 'Failed to unstake tokens',
        variant: 'destructive'
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [publicKey, connected, setTransactionStatus, toast]);

  // Initial load of balances when wallet connects
  useEffect(() => {
    if (publicKey && connected) {
      refreshBalances();
    }
  }, [publicKey, connected, refreshBalances]);

  return {
    tokenBalance,
    stakedAmount,
    isLoading,
    isProcessing,
    refreshBalances,
    stake,
    unstake
  };
}
