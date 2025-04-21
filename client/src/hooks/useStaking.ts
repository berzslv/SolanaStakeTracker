import { useState, useCallback, useEffect, useContext } from 'react';
import { WalletContext, ConnectionContext } from '@/components/WalletProvider';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { TOKEN_MINT_ADDRESS, PROGRAM_ID } from '@/utils/constants';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTransactionStatus } from '@/contexts/TransactionContext';
import * as anchor from '@project-serum/anchor';
import { BN } from 'bn.js';
import { IDL } from '@/utils/idl';

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

  // Fetch token balance from wallet
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

  // Find PDAs
  const findUserInfoAccount = useCallback(() => {
    if (!publicKey) return null;
    
    const [userInfoPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('user'), new PublicKey(publicKey).toBuffer()],
      new PublicKey(PROGRAM_ID)
    );
    return userInfoPDA;
  }, [publicKey]);
  
  const findGlobalStateAccount = useCallback(() => {
    const [globalStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('global')],
      new PublicKey(PROGRAM_ID)
    );
    return globalStatePDA;
  }, []);
  
  const findVaultAccount = useCallback(() => {
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault')],
      new PublicKey(PROGRAM_ID)
    );
    return vaultPDA;
  }, []);
  
  const findVaultTokenAccount = useCallback(() => {
    const tokenMint = new PublicKey(TOKEN_MINT_ADDRESS);
    // In this program, the vault is also the token account
    return findVaultAccount();
  }, [findVaultAccount]);

  // Get Anchor program
  const getProgram = useCallback(() => {
    if (!publicKey || !signTransaction) return null;
    
    const wallet = {
      publicKey: new PublicKey(publicKey),
      signTransaction
    };

    const provider = new anchor.AnchorProvider(
      connection,
      wallet as any,
      { preflightCommitment: 'processed' }
    );

    const program = new anchor.Program(
      IDL,
      new PublicKey(PROGRAM_ID),
      provider
    );
    
    return program;
  }, [publicKey, signTransaction, connection]);

  // Fetch staked amount from the blockchain
  const fetchStakedAmount = useCallback(async () => {
    if (!publicKey) return 0;
    
    try {
      const program = getProgram();
      if (!program) return 0;
      
      const userInfoAccount = findUserInfoAccount();
      if (!userInfoAccount) return 0;
      
      try {
        // Try to fetch user info - use lowercase for account name to match IDL
        console.log('Fetching user info account:', userInfoAccount.toString());
        const userInfo = await program.account.userInfo.fetch(userInfoAccount);
        console.log('User info account data:', userInfo);
        
        // Access the stakedAmount field - make sure this matches your IDL exactly
        // Cast to any to work around TypeScript limitations with Anchor accounts
        const info = userInfo as any;
        if (info.stakedAmount) {
          return Number(info.stakedAmount.toString()) / Math.pow(10, DECIMALS);
        } else {
          console.log('No staked amount found in user account');
          return 0;
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
        // Account likely doesn't exist yet, which is normal for new users
        return 0;
      }
    } catch (error) {
      console.error('Error fetching staked amount:', error);
      return 0;
    }
  }, [publicKey, getProgram, findUserInfoAccount]);

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
    if (!publicKey) return;
    
    try {
      const program = getProgram();
      if (!program) return;
      
      const userInfoAccount = findUserInfoAccount();
      const globalState = findGlobalStateAccount();
      
      if (!userInfoAccount || !globalState) {
        throw new Error('Failed to derive program accounts');
      }
      
      // Check if the user account already exists
      try {
        await program.account.userInfo.fetch(userInfoAccount);
        // If it exists, return
        console.log('User already registered');
        return;
      } catch (error) {
        // If it doesn't exist, we need to create it
        console.log('User account does not exist, creating...');
        
        // Register user with no referrer (null)
        const tx = await program.methods
          .registerUser(null)
          .accounts({
            owner: new PublicKey(publicKey),
            userInfo: userInfoAccount,
            globalState,
            systemProgram: new PublicKey("11111111111111111111111111111111"),
            rent: anchor.web3.SYSVAR_RENT_PUBKEY
          })
          .rpc();
          
        console.log('User registered:', tx);
      }
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  }, [publicKey, getProgram, findUserInfoAccount, findGlobalStateAccount]);

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
      // Ensure user is registered
      await ensureUserRegistered();
      
      // Update status
      setTransactionStatus({
        status: null,
        message: 'Building transaction...',
        signature: null
      });
      
      const program = getProgram();
      if (!program) throw new Error('Failed to get program');
      
      const userInfoAccount = findUserInfoAccount();
      const globalState = findGlobalStateAccount();
      const vault = findVaultAccount();
      
      if (!userInfoAccount || !globalState || !vault) {
        throw new Error('Failed to derive program accounts');
      }
      
      // Get the user's token account
      const tokenMint = new PublicKey(TOKEN_MINT_ADDRESS);
      const userTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        new PublicKey(publicKey)
      );
      
      // Convert amount to lamports
      const bnAmount = new BN(amount * Math.pow(10, DECIMALS));
      
      // Send transaction
      setTransactionStatus({
        status: null,
        message: 'Please approve the transaction in your wallet...',
        signature: null
      });
      
      // This matches the IDL structure exactly
      const tx = await program.methods
        .stake(bnAmount)
        .accounts({
          owner: new PublicKey(publicKey),
          globalState,
          userInfo: userInfoAccount,
          vault,
          userTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID
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
    getProgram, 
    findUserInfoAccount, 
    findGlobalStateAccount,
    findVaultAccount, 
    ensureUserRegistered, 
    refreshBalances, 
    setTransactionStatus, 
    toast
  ]);

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
      // Update status
      setTransactionStatus({
        status: null,
        message: 'Building transaction...',
        signature: null
      });
      
      const program = getProgram();
      if (!program) throw new Error('Failed to get program');
      
      const userInfoAccount = findUserInfoAccount();
      const globalState = findGlobalStateAccount();
      const vault = findVaultAccount();
      
      if (!userInfoAccount || !globalState || !vault) {
        throw new Error('Failed to derive program accounts');
      }
      
      // Get the user's token account
      const tokenMint = new PublicKey(TOKEN_MINT_ADDRESS);
      const userTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        new PublicKey(publicKey)
      );
      
      // Convert amount to lamports
      const bnAmount = new BN(amount * Math.pow(10, DECIMALS));
      
      // Send transaction
      setTransactionStatus({
        status: null,
        message: 'Please approve the transaction in your wallet...',
        signature: null
      });
      
      // This matches the IDL structure exactly
      const tx = await program.methods
        .unstake(bnAmount)
        .accounts({
          owner: new PublicKey(publicKey),
          globalState,
          userInfo: userInfoAccount,
          vault,
          userTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID
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
    getProgram, 
    findUserInfoAccount,
    findGlobalStateAccount,
    findVaultAccount,
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