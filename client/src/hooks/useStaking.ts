import { useState, useCallback, useEffect, useContext } from 'react';
import { WalletContext, ConnectionContext } from '@/components/WalletProvider';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { TOKEN_MINT_ADDRESS } from '@/utils/constants';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTransactionStatus } from '@/contexts/TransactionContext';
import * as anchor from '@project-serum/anchor';
import { 
  getStakingProgram, 
  findStakingVault, 
  findVaultAuthority,
  findUserStakeInfoAccount,
  findTokenVaultAccount,
  getUserStakeInfo,
  toTokenAmount
} from '@/utils/anchor';

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

  // Fetch staked amount from the blockchain
  const fetchStakedAmount = useCallback(async () => {
    if (!publicKey || !signTransaction) return 0;
    
    try {
      const wallet = {
        publicKey: new PublicKey(publicKey),
        signTransaction
      };
      
      const userStakeInfo = await getUserStakeInfo(connection, wallet);
      return userStakeInfo.amountStaked;
    } catch (error) {
      console.error('Error fetching staked amount:', error);
      return 0;
    }
  }, [publicKey, signTransaction, connection]);

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

  // Register user account if needed
  const ensureUserRegistered = useCallback(async () => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const wallet = {
        publicKey: new PublicKey(publicKey),
        signTransaction
      };
      
      const program = getStakingProgram(connection, wallet);
      const userInfoAccount = findUserStakeInfoAccount(wallet.publicKey);
      
      // Check if the user account already exists
      try {
        await program.account.userStakeInfo.fetch(userInfoAccount);
        // If it exists, return
        return;
      } catch (error) {
        // If it doesn't exist, we need to create it
        console.log('User account does not exist, creating...');
        
        const vault = await findStakingVault();
        
        // Register user
        const tx = await program.methods
          .registerUser()
          .accounts({
            user: wallet.publicKey,
            userInfo: userInfoAccount,
            vault,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY
          })
          .rpc();
          
        console.log('User registered:', tx);
      }
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  }, [publicKey, signTransaction, connection]);

  // Stake tokens - real blockchain transaction
  const stake = useCallback(async (amount: number) => {
    if (!publicKey || !connected || !signTransaction) {
      throw new Error('Wallet not connected');
    }
    
    setIsProcessing(true);
    setTransactionStatus({
      status: null,
      message: 'Preparing stake transaction...',
      signature: null
    });
    
    try {
      const wallet = {
        publicKey: new PublicKey(publicKey),
        signTransaction
      };
      
      // Ensure user is registered
      await ensureUserRegistered();
      
      // Update status
      setTransactionStatus({
        status: null,
        message: 'Building transaction...',
        signature: null
      });
      
      const program = getStakingProgram(connection, wallet);
      const userInfoAccount = findUserStakeInfoAccount(wallet.publicKey);
      const vault = await findStakingVault();
      const tokenVault = await findTokenVaultAccount();
      
      // Get or create the user's token account
      const tokenMint = new PublicKey(TOKEN_MINT_ADDRESS);
      const userTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        wallet.publicKey
      );
      
      // Check if token account exists
      const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
      if (!tokenAccountInfo) {
        // Create token account first
        const createAtaIx = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userTokenAccount,
          wallet.publicKey,
          tokenMint
        );
        
        // Send and confirm transaction
        const tx = await program.methods
          .stake(toTokenAmount(amount))
          .accounts({
            user: wallet.publicKey,
            userInfo: userInfoAccount,
            vault,
            userTokenAccount,
            vaultTokenAccount: tokenVault,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId
          })
          .preInstructions([createAtaIx])
          .rpc();
          
        console.log('Stake transaction:', tx);
        
        // Update status
        setTransactionStatus({
          status: 'success',
          message: 'Tokens staked successfully!',
          signature: tx
        });
        
        // Show success toast
        toast({
          title: 'Tokens staked successfully!',
          description: `Staked ${amount} HATM tokens`
        });
        
        // Log transaction to backend
        await apiRequest('POST', '/api/transaction/log', {
          walletAddress: publicKey,
          amount: amount.toString(),
          transactionType: 'stake',
          transactionSignature: tx,
          timestamp: new Date().toISOString()
        });
        
        // Refresh balances
        await refreshBalances();
        
        return tx;
      } else {
        // Token account exists, stake directly
        const tx = await program.methods
          .stake(toTokenAmount(amount))
          .accounts({
            user: wallet.publicKey,
            userInfo: userInfoAccount,
            vault,
            userTokenAccount,
            vaultTokenAccount: tokenVault,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId
          })
          .rpc();
          
        console.log('Stake transaction:', tx);
        
        // Update status
        setTransactionStatus({
          status: 'success',
          message: 'Tokens staked successfully!',
          signature: tx
        });
        
        // Show success toast
        toast({
          title: 'Tokens staked successfully!',
          description: `Staked ${amount} HATM tokens`
        });
        
        // Log transaction to backend
        await apiRequest('POST', '/api/transaction/log', {
          walletAddress: publicKey,
          amount: amount.toString(),
          transactionType: 'stake',
          transactionSignature: tx,
          timestamp: new Date().toISOString()
        });
        
        // Refresh balances
        await refreshBalances();
        
        return tx;
      }
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
  }, [
    publicKey, 
    connected, 
    signTransaction, 
    connection, 
    ensureUserRegistered, 
    refreshBalances, 
    setTransactionStatus, 
    toast
  ]);

  // Unstake tokens - real blockchain transaction
  const unstake = useCallback(async (amount: number) => {
    if (!publicKey || !connected || !signTransaction) {
      throw new Error('Wallet not connected');
    }
    
    setIsProcessing(true);
    setTransactionStatus({
      status: null,
      message: 'Preparing unstake transaction...',
      signature: null
    });
    
    try {
      const wallet = {
        publicKey: new PublicKey(publicKey),
        signTransaction
      };
      
      // Update status
      setTransactionStatus({
        status: null,
        message: 'Building transaction...',
        signature: null
      });
      
      const program = getStakingProgram(connection, wallet);
      const userInfoAccount = findUserStakeInfoAccount(wallet.publicKey);
      const vault = await findStakingVault();
      const vaultAuthority = await findVaultAuthority();
      const tokenVault = await findTokenVaultAccount();
      
      // Get or create the user's token account
      const tokenMint = new PublicKey(TOKEN_MINT_ADDRESS);
      const userTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        wallet.publicKey
      );
      
      // Check if token account exists
      const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
      if (!tokenAccountInfo) {
        // Cannot unstake if token account doesn't exist
        throw new Error('Token account does not exist. Please create it first.');
      }
      
      // Send unstake transaction
      const tx = await program.methods
        .unstake(toTokenAmount(amount))
        .accounts({
          user: wallet.publicKey,
          userInfo: userInfoAccount,
          vault,
          vaultAuthority,
          vaultTokenAccount: tokenVault,
          userTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId
        })
        .rpc();
        
      console.log('Unstake transaction:', tx);
      
      // Update status
      setTransactionStatus({
        status: 'success',
        message: 'Tokens unstaked successfully!',
        signature: tx
      });
      
      // Show success toast
      toast({
        title: 'Tokens unstaked successfully!',
        description: `Unstaked ${amount} HATM tokens`
      });
      
      // Log transaction to backend
      await apiRequest('POST', '/api/transaction/log', {
        walletAddress: publicKey,
        amount: amount.toString(),
        transactionType: 'unstake',
        transactionSignature: tx,
        timestamp: new Date().toISOString()
      });
      
      // Refresh balances
      await refreshBalances();
      
      return tx;
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
  }, [
    publicKey, 
    connected, 
    signTransaction, 
    connection, 
    refreshBalances, 
    setTransactionStatus, 
    toast
  ]);

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