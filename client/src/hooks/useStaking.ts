import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  PublicKey, 
  SystemProgram, 
  Transaction,
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
  createTransferInstruction
} from '@solana/spl-token';
import { BN } from '@project-serum/anchor';
import * as anchor from '@project-serum/anchor';
import { useToast } from '@/hooks/use-toast';
import { 
  PROGRAM_ID,
  TOKEN_MINT_ADDRESS, 
  VERIFIED_VAULT_ADDRESS,
  DECIMALS
} from '@/utils/constants';
import { 
  getStakingProgram,
  findTokenVaultAccount,
  getUserStakeInfo,
} from '@/utils/anchor';

// Helper function to convert normal number to BN with proper decimals
const toBN = (amount: number): BN => {
  return new BN(amount * Math.pow(10, DECIMALS));
};

// Custom hook for staking functionality
export function useStaking() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { toast } = useToast();
  
  // State
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [stakedAmount, setStakedAmount] = useState<number>(0);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // Get Anchor program
  const getProgram = useCallback(() => {
    if (!publicKey) return null;
    return getStakingProgram(connection, {
      publicKey,
      signTransaction: async () => { throw new Error('Not implemented'); },
    });
  }, [connection, publicKey]);
  
  // Find PDAs for various accounts
  const findUserInfoPDA = useCallback(async (owner: PublicKey): Promise<[PublicKey, number]> => {
    return PublicKey.findProgramAddress(
      [Buffer.from("user_info"), owner.toBuffer()],
      new PublicKey(PROGRAM_ID)
    );
  }, []);
  
  const findVaultPDA = useCallback(async (): Promise<[PublicKey, number]> => {
    return PublicKey.findProgramAddress(
      [Buffer.from("global_state")],
      new PublicKey(PROGRAM_ID)
    );
  }, []);
  
  // Check if user is registered with the staking program
  const checkUserRegistration = useCallback(async (): Promise<boolean> => {
    if (!publicKey) return false;
    
    try {
      // Find PDA for user info
      const [userInfoPDA] = await findUserInfoPDA(publicKey);
      
      // Check if the account exists on chain
      const accountInfo = await connection.getAccountInfo(userInfoPDA);
      
      return !!accountInfo; // Account exists if we got data back
    } catch (error) {
      console.error('Error checking user registration:', error);
      return false;
    }
  }, [connection, findUserInfoPDA, publicKey]);
  
  // Register the user with the staking program
  const registerUser = useCallback(async (): Promise<string | null> => {
    if (!publicKey) return null;
    
    const program = getProgram();
    if (!program) return null;
    
    try {
      // Find the user info PDA
      const [userInfoPDA] = await findUserInfoPDA(publicKey);
      
      console.log("Registering user with PDA:", userInfoPDA.toString());
      
      // Create register instruction with no referrer
      const tx = await program.methods
        .registerUser(null)
        .accounts({
          owner: publicKey,
          userInfo: userInfoPDA,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      
      // Update transaction with recent blockhash and fee payer
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      
      // Send the transaction
      const signature = await sendTransaction(tx, connection);
      
      // Wait for confirmation
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });
      
      console.log("User registration complete:", signature);
      
      return signature;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  }, [connection, findUserInfoPDA, getProgram, publicKey, sendTransaction]);
  
  // Refresh token balance and staked amount
  const refreshBalances = useCallback(async () => {
    if (!publicKey) {
      setTokenBalance(0);
      setStakedAmount(0);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Get token account for the user
      const userTokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINT_ADDRESS,
        publicKey
      );
      
      // Get token balance from the user's token account
      try {
        const tokenAccountInfo = await connection.getTokenAccountBalance(userTokenAccount);
        const balance = Number(tokenAccountInfo.value.amount) / Math.pow(10, DECIMALS);
        console.log("User token balance:", balance);
        setTokenBalance(balance);
      } catch (tokenError) {
        console.error("Error getting token balance:", tokenError);
        // If this fails, the user might not have a token account
        setTokenBalance(0);
      }
      
      // Get staked amount from the contract
      try {
        const userInfo = await getUserStakeInfo(connection, { 
          publicKey, 
          signTransaction: async () => { throw new Error('Not implemented'); } 
        });
        
        console.log("User staking info:", userInfo);
        setStakedAmount(userInfo.amountStaked || 0);
      } catch (stakeError) {
        console.error("Error getting staked amount:", stakeError);
        setStakedAmount(0);
      }
    } catch (error) {
      console.error("Error refreshing balances:", error);
    } finally {
      setIsLoading(false);
    }
  }, [connection, publicKey]);
  
  // Direct token transfer implementation (no Anchor program interactions)
  const stake = async (amount: number): Promise<string | null> => {
    if (!publicKey) return null;
    
    try {
      setIsProcessing(true);
      
      // Skip user registration for direct token transfer
      // Get user token account
      const userTokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINT_ADDRESS,
        publicKey
      );
      
      // Use vault token account
      const vaultTokenAccount = VERIFIED_VAULT_ADDRESS;
      
      console.log("Direct token transfer:", {
        from: userTokenAccount.toString(),
        to: vaultTokenAccount.toString(),
        amount: amount
      });
      
      // Check balance
      try {
        const tokenAccountInfo = await connection.getTokenAccountBalance(userTokenAccount);
        const balance = Number(tokenAccountInfo.value.amount);
        const amountInLamports = amount * Math.pow(10, DECIMALS);
        
        console.log("Token balance check:", {
          userBalance: balance / Math.pow(10, DECIMALS),
          requiredAmount: amount,
          userBalanceLamports: balance,
          requiredAmountLamports: amountInLamports
        });
        
        if (balance < amountInLamports) {
          toast({
            title: "Insufficient balance",
            description: `You need ${amount} HATM tokens but only have ${balance / Math.pow(10, DECIMALS)}`,
            variant: "destructive"
          });
          return null;
        }
      } catch (error) {
        console.error("Error checking token balance:", error);
        toast({
          title: "Balance check failed",
          description: "Could not verify your token balance. Please try again.",
          variant: "destructive"
        });
        return null;
      }
      
      try {
        // Create direct token transfer transaction
        const transferTx = new Transaction();
        
        // Calculate exact amount with decimals
        const tokenAmount = Math.floor(amount * Math.pow(10, DECIMALS));
        
        // Create transfer instruction
        const transferIx = createTransferInstruction(
          userTokenAccount,             // source
          vaultTokenAccount,            // destination
          publicKey,                    // owner
          tokenAmount                   // amount
        );
        
        transferTx.add(transferIx);
        transferTx.feePayer = publicKey;
        
        // Get a fresh blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        transferTx.recentBlockhash = blockhash;
        
        // Show toast for user
        toast({
          title: "Approve transaction",
          description: "Please approve the token transfer transaction in your wallet."
        });
        
        // Send transaction
        console.log("Sending direct token transfer...");
        const signature = await sendTransaction(transferTx, connection);
        
        console.log("Transaction sent:", signature);
        
        // Wait for confirmation
        toast({
          title: "Transaction sent",
          description: "Waiting for confirmation..."
        });
        
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
        
        if (confirmation.value.err) {
          console.error("Transaction error:", confirmation.value.err);
          toast({
            title: "Transaction failed",
            description: "The token transfer failed. Please try again.",
            variant: "destructive"
          });
          return null;
        }
        
        toast({
          title: "Transfer successful",
          description: `Successfully transferred ${amount} HATM tokens to the vault!`
        });
        
        // Update balances
        await refreshBalances();
        return signature;
      } catch (error: any) {
        console.error("Transfer error:", error);
        
        if (error?.name === 'WalletSendTransactionError') {
          toast({
            title: "Transaction rejected",
            description: "You declined the transaction in your wallet.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Transfer failed",
            description: error?.message || "Error sending transaction. Please try again.",
            variant: "destructive"
          });
        }
        
        return null;
      }
    } catch (error) {
      console.error("Overall staking error:", error);
      toast({
        title: "Transaction failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Unstake tokens (fallback to direct SPL transfer if needed)
  const unstake = async (amount: number): Promise<string | null> => {
    if (!publicKey) return null;
    
    try {
      setIsProcessing(true);
      
      // For direct token transfer, we can't check stake amounts reliably
      // so we just check wallet balance first
      if (amount > stakedAmount) {
        toast({
          title: "Unstaking not possible",
          description: `You can't unstake ${amount} tokens as your current staked amount is ${stakedAmount}.`,
          variant: "destructive"
        });
        return null;
      }
      
      // First, try using Anchor program (this will likely fail)
      try {
        const program = getProgram();
        if (!program) throw new Error("Cannot initialize program");
        
        const [globalStatePDA] = await findVaultPDA();
        const [userInfoPDA] = await findUserInfoPDA(publicKey);
        
        const userTokenAccount = await getAssociatedTokenAddress(
          TOKEN_MINT_ADDRESS,
          publicKey
        );
        
        const vaultTokenAccount = VERIFIED_VAULT_ADDRESS;
        
        // Create unstake instruction
        const unstakeIx = await program.methods
          .unstake(toBN(amount))
          .accounts({
            owner: publicKey,
            globalState: globalStatePDA,
            userInfo: userInfoPDA,
            userTokenAccount: userTokenAccount,
            vault: vaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        
        const transaction = new Transaction();
        transaction.add(unstakeIx);
        transaction.feePayer = publicKey;
        
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        
        toast({
          title: "Confirm transaction",
          description: "Please approve the transaction to unstake your tokens."
        });
        
        const signature = await sendTransaction(transaction, connection);
        
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        });
        
        if (confirmation.value.err) {
          throw new Error("Transaction failed: " + confirmation.value.err);
        }
        
        toast({
          title: "Unstaking successful",
          description: `Successfully unstaked ${amount} HATM tokens!`
        });
        
        await refreshBalances();
        return signature;
      } catch (anchorError) {
        console.error("Anchor unstake error:", anchorError);
        
        toast({
          title: "Unstaking through program failed",
          description: "Please contact support to assist with unstaking tokens.",
          variant: "destructive"
        });
        
        return null;
      }
    } catch (error: any) {
      console.error("Unstaking error:", error);
      
      toast({
        title: "Unstaking failed",
        description: error?.message || "Error unstaking tokens. Please try again.",
        variant: "destructive"
      });
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Keep track of last update time to prevent excessive API calls
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  
  // Initial fetch when wallet connects
  useEffect(() => {
    if (publicKey) {
      // Check if sufficient time has passed since last update (minimum 10 seconds)
      const now = Date.now();
      if (now - lastUpdateTime < 10000) {
        console.log("Skipping redundant update - too soon since last update");
        return;
      }
      
      // Check if user is registered first
      const checkStakingStatus = async () => {
        try {
          const isUserRegistered = await checkUserRegistration();
          console.log("User registration check:", isUserRegistered);
          setIsRegistered(isUserRegistered);
          
          // Always refresh balances
          await refreshBalances();
          setLastUpdateTime(now);
        } catch (error) {
          console.error("Error in initial wallet data fetch:", error);
        }
      };
      
      checkStakingStatus();
    } else {
      setTokenBalance(0);
      setStakedAmount(0);
      setIsRegistered(false);
    }
  }, [checkUserRegistration, lastUpdateTime, publicKey, refreshBalances]);
  
  return {
    tokenBalance,
    stakedAmount,
    isRegistered,
    isLoading,
    isProcessing,
    refreshBalances,
    registerUser,
    stake,
    unstake,
    checkUserRegistration
  };
}
