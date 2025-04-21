import { useState, useCallback, useEffect, useContext } from 'react';
import { WalletContext, ConnectionContext } from '@/components/WalletProvider';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_MINT_ADDRESS } from '@/utils/constants';
import { apiRequest } from '@/lib/queryClient';
import { sleep } from '@/utils/helpers';

export function useStaking() {
  const { publicKey, connected, signTransaction } = useContext(WalletContext);
  const { connection } = useContext(ConnectionContext);
  
  const [tokenBalance, setTokenBalance] = useState<number>(1000);
  const [stakedAmount, setStakedAmount] = useState<number>(250);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fetchTokenBalance = useCallback(async () => {
    if (!publicKey) return 0;
    
    try {
      // For demo purposes return a fixed amount
      // In a real implementation, we would query the token account
      return 1000;
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return 0;
    }
  }, [publicKey]);

  const fetchStakedAmount = useCallback(async () => {
    if (!publicKey) return 0;
    
    try {
      // For demo purposes, return a simulated amount
      return 250;
    } catch (error) {
      console.error('Error fetching staked amount:', error);
      return 0;
    }
  }, [publicKey]);

  const refreshBalances = useCallback(async () => {
    if (!publicKey) return;
    
    setIsLoading(true);
    try {
      // Simulate API delay
      await sleep(1000);
      
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

  const stake = useCallback(async (amount: number) => {
    if (!publicKey || !connected) throw new Error('Wallet not connected');
    
    setIsProcessing(true);
    try {
      // Simulate transaction delay
      await sleep(2000);
      
      // Update balances
      setTokenBalance(prev => prev - amount);
      setStakedAmount(prev => prev + amount);
      
      // Generate a transaction signature
      const signature = `stake_${Date.now().toString(36)}`;
      
      // Log transaction to backend
      await apiRequest('POST', '/api/transaction/log', {
        walletAddress: publicKey,
        amount: amount.toString(),
        transactionType: 'stake',
        transactionSignature: signature,
        timestamp: new Date().toISOString()
      });
      
      return signature;
    } catch (error) {
      console.error('Error staking tokens:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [publicKey, connected]);

  const unstake = useCallback(async (amount: number) => {
    if (!publicKey || !connected) throw new Error('Wallet not connected');
    
    setIsProcessing(true);
    try {
      // Simulate transaction delay
      await sleep(2000);
      
      // Update balances
      setTokenBalance(prev => prev + amount);
      setStakedAmount(prev => prev - amount);
      
      // Generate a transaction signature
      const signature = `unstake_${Date.now().toString(36)}`;
      
      // Log transaction to backend
      await apiRequest('POST', '/api/transaction/log', {
        walletAddress: publicKey,
        amount: amount.toString(),
        transactionType: 'unstake',
        transactionSignature: signature,
        timestamp: new Date().toISOString()
      });
      
      return signature;
    } catch (error) {
      console.error('Error unstaking tokens:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [publicKey, connected]);

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
