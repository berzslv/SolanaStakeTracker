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

  // Find PDAs - completely rewritten based on the smart contract's logic
  
  // Find user stake info account
  const findUserInfoAccount = useCallback(() => {
    if (!publicKey) return null;
    
    // The exact seed used in the contract: "user_info", user public key
    const [userInfoPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_info'), new PublicKey(publicKey).toBuffer()],
      new PublicKey(PROGRAM_ID)
    );
    console.log('User stake info PDA:', userInfoPDA.toString());
    return userInfoPDA;
  }, [publicKey]);
  
  // Find staking vault account
  const findVaultAccount = useCallback(() => {
    // Based on contract: the main "vault" PDA (also called "StakingVault")
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('staking_vault')],
      new PublicKey(PROGRAM_ID)
    );
    console.log('Vault PDA:', vaultPDA.toString());
    return vaultPDA;
  }, []);
  
  // This corresponds to "vaultAuthority" in the IDL
  const findVaultAuthorityAccount = useCallback(() => {
    // Based on contract: the vault authority that can sign on behalf of the vault
    const [vaultAuthorityPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault_authority')],
      new PublicKey(PROGRAM_ID)
    );
    console.log('Vault Authority PDA:', vaultAuthorityPDA.toString());
    return vaultAuthorityPDA;
  }, []);
  
  // Find vault token account (the actual token account owned by the vault)
  const findVaultTokenAccount = useCallback(() => {
    // Get token vault address - this is different from the vault itself
    // The token mint and the vault authority combine to find the token account
    const tokenMint = new PublicKey(TOKEN_MINT_ADDRESS);
    const [tokenVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('token_vault')],
      new PublicKey(PROGRAM_ID)
    );
    console.log('Token vault PDA:', tokenVaultPDA.toString());
    return tokenVaultPDA;
  }, []);

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
        // Try to fetch user info - use the correct account name from the IDL
        console.log('Fetching user info account:', userInfoAccount.toString());
        const userInfo = await program.account.userStakeInfo.fetch(userInfoAccount);
        console.log('User info account data:', userInfo);
        
        // Access the field according to the IDL (amountStaked instead of stakedAmount)
        // Cast to any to work around TypeScript limitations with Anchor accounts
        const info = userInfo as any;
        if (info.amountStaked) {
          return Number(info.amountStaked.toString()) / Math.pow(10, DECIMALS);
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
      const vaultAccount = findVaultAccount();
      
      if (!userInfoAccount || !vaultAccount) {
        throw new Error('Failed to derive program accounts');
      }
      
      // Check if the user account already exists
      try {
        // Should match the account name in the IDL (userStakeInfo)
        await program.account.userStakeInfo.fetch(userInfoAccount);
        // If it exists, return
        console.log('User already registered');
        return;
      } catch (error) {
        // If it doesn't exist, we need to create it
        console.log('User account does not exist, creating...');
        
        // Register user based on IDL
        console.log('Registering user with accounts:', {
          user: new PublicKey(publicKey),
          userInfo: userInfoAccount,
          vault: vaultAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY
        });
        
        const tx = await program.methods
          .registerUser()
          .accounts({
            user: new PublicKey(publicKey),
            userInfo: userInfoAccount,
            vault: vaultAccount,
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
  }, [publicKey, getProgram, findUserInfoAccount, findVaultAccount]);

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
      const vaultAccount = findVaultAccount();
      
      if (!userInfoAccount || !vaultAccount) {
        throw new Error('Failed to derive program accounts');
      }
      
      // Get the user's token account
      const tokenMint = new PublicKey(TOKEN_MINT_ADDRESS);
      const userTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        new PublicKey(publicKey)
      );
      
      // Get the vault token account (tokenVault in IDL)
      // In this case we need to use findVaultTokenAccount
      const vaultTokenAccount = findVaultTokenAccount();
      
      if (!vaultTokenAccount) {
        throw new Error('Failed to derive vault token account');
      }
      
      // Convert amount to lamports
      const bnAmount = new BN(amount * Math.pow(10, DECIMALS));
      
      // Send transaction
      setTransactionStatus({
        status: null,
        message: 'Please approve the transaction in your wallet...',
        signature: null
      });
      
      // Debug log accounts we'll use
      console.log('Stake accounts:', {
        user: new PublicKey(publicKey),
        userInfo: userInfoAccount,
        vault: vaultAccount,
        userTokenAccount,
        vaultTokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId
      });
      
      // This matches the IDL structure exactly
      const tx = await program.methods
        .stake(bnAmount)
        .accounts({
          user: new PublicKey(publicKey),
          userInfo: userInfoAccount,
          vault: vaultAccount,
          userTokenAccount: userTokenAccount,
          vaultTokenAccount: vaultTokenAccount,
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
    findVaultAccount,
    findVaultTokenAccount,
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
      const vaultAccount = findVaultAccount();
      const vaultAuthorityAccount = findVaultAuthorityAccount();
      
      if (!userInfoAccount || !vaultAccount || !vaultAuthorityAccount) {
        throw new Error('Failed to derive program accounts');
      }
      
      // Get the user's token account
      const tokenMint = new PublicKey(TOKEN_MINT_ADDRESS);
      const userTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        new PublicKey(publicKey)
      );
      
      // Get the vault token account
      const vaultTokenAccount = findVaultTokenAccount();
      if (!vaultTokenAccount) {
        throw new Error('Failed to derive vault token account');
      }
      
      // Convert amount to lamports
      const bnAmount = new BN(amount * Math.pow(10, DECIMALS));
      
      // Send transaction
      setTransactionStatus({
        status: null,
        message: 'Please approve the transaction in your wallet...',
        signature: null
      });
      
      // Debug log accounts we'll use
      console.log('Unstake accounts:', {
        user: new PublicKey(publicKey),
        userInfo: userInfoAccount,
        vault: vaultAccount,
        vaultAuthority: vaultAuthorityAccount,
        vaultTokenAccount,
        userTokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId
      });
      
      // This matches the IDL structure exactly
      const tx = await program.methods
        .unstake(bnAmount)
        .accounts({
          user: new PublicKey(publicKey),
          userInfo: userInfoAccount,
          vault: vaultAccount,
          vaultAuthority: vaultAuthorityAccount,
          vaultTokenAccount,
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
    getProgram, 
    findUserInfoAccount,
    findVaultAccount,
    findVaultAuthorityAccount,
    findVaultTokenAccount,
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