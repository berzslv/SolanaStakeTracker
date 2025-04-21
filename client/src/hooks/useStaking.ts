import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  PublicKey, 
  SystemProgram, 
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
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
  
  // Simplified token transfer only approach - avoiding all the complicated Anchor program interactions
  const stake = async (amount: number) => {
    if (!publicKey) return null;
    
    try {
      setIsProcessing(true);
      
      // First, get the user token account and vault token account
      const userTokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINT_ADDRESS,
        publicKey
      );
      
      // Use verified vault address
      const vaultTokenAccount = VERIFIED_VAULT_ADDRESS;
      
      console.log("Direct token transfer:", {
        from: userTokenAccount.toString(),
        to: vaultTokenAccount.toString(),
        amount
      });
      
      // Check token balance first
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
      } catch (balanceError) {
        console.error("Error checking token balance:", balanceError);
        toast({
          title: "Balance check failed",
          description: "Could not verify your token balance. Please try again.",
          variant: "destructive"
        });
        return null;
      }
      
      // Import SPL Token functions
      const { createTransferInstruction } = await import('@solana/spl-token');
      
      // Create transaction
      const transaction = new Transaction();
      
      // Create a basic SPL token transfer instruction
      const transferInstruction = createTransferInstruction(
        userTokenAccount,                            // from
        vaultTokenAccount,                           // to
        publicKey,                                   // authority (wallet)
        amount * Math.pow(10, DECIMALS)              // amount with decimals
      );
      
      // Add the instruction to the transaction
      transaction.add(transferInstruction);
      
      // Set fee payer
      transaction.feePayer = publicKey;
      
      // Get a recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      // Show message to user
      toast({
        title: "Approve Transaction",
        description: "Please approve the transaction to transfer tokens to the staking vault."
      });
      
      // Sign and send transaction
      try {
        console.log("Sending transaction...");
        const signature = await sendTransaction(transaction, connection);
        console.log("Transaction sent:", signature);
        
        // Wait for confirmation
        toast({
          title: "Transaction sent",
          description: "Waiting for network confirmation..."
        });
        
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        });
        
        console.log("Confirmation received:", confirmation);
        
        if (confirmation.value.err) {
          console.error("Transaction error:", confirmation.value.err);
          toast({
            title: "Transaction failed",
            description: "Your token transfer failed to complete. Please try again.",
            variant: "destructive"
          });
          return null;
        }
        
        toast({
          title: "Tokens staked",
          description: `Successfully transferred ${amount} HATM tokens to the staking vault!`
        });
        
        // Update balances
        await refreshBalances();
        
        return signature;
      } catch (error: any) {
        console.error("Transaction error:", error);
        
        if (error?.name === 'WalletSendTransactionError') {
          toast({
            title: "Transaction rejected",
            description: "You declined the transaction in your wallet.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Token transfer failed",
            description: error?.message || "Error sending transaction. Please try again.",
            variant: "destructive"
          });
        }
        
        return null;
      }
    } catch (error) {
      console.error("Error staking tokens:", error);
      toast({
        title: "Staking failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Unstake tokens
  const unstake = async (amount: number) => {
    if (!publicKey) return null;
    
    const program = getProgram();
    if (!program) return null;
    
    try {
      setIsProcessing(true);
      
      // Make sure user is registered and has staked tokens
      const isUserRegistered = await checkUserRegistration();
      if (!isUserRegistered) {
        toast({
          title: "Not registered",
          description: "You need to stake tokens first before unstaking.",
          variant: "destructive"
        });
        return null;
      }
      
      // Check if the user has enough staked tokens
      if (amount > stakedAmount) {
        toast({
          title: "Insufficient staked balance",
          description: `You only have ${stakedAmount} HATM tokens staked. Cannot unstake ${amount} tokens.`,
          variant: "destructive"
        });
        return null;
      }
      
      // Get necessary accounts
      const [globalStatePDA] = await findVaultPDA();
      const [userInfoPDA] = await findUserInfoPDA(publicKey);
      
      // Get token accounts
      const userTokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINT_ADDRESS,
        publicKey
      );
      
      // Use verified vault address
      const vaultTokenAccount = VERIFIED_VAULT_ADDRESS;
      
      console.log("Unstaking accounts:", {
        owner: publicKey.toString(),
        globalState: globalStatePDA.toString(),
        userInfo: userInfoPDA.toString(),
        userTokenAccount: userTokenAccount.toString(),
        vault: vaultTokenAccount.toString(),
        amount
      });
      
      try {
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
        
        // Build the transaction
        const transaction = new Transaction();
        transaction.add(unstakeIx);
        transaction.feePayer = publicKey;
        
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        
        // Sign and send the transaction
        toast({
          title: "Confirm transaction",
          description: "Please approve the transaction in your wallet to unstake tokens."
        });
        
        console.log("Sending unstake transaction...");
        const signature = await sendTransaction(transaction, connection);
        
        console.log("Transaction sent:", signature);
        
        // Wait for confirmation
        toast({
          title: "Transaction sent",
          description: "Waiting for blockchain confirmation..."
        });
        
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        });
        
        console.log("Transaction confirmed:", confirmation);
        
        if (confirmation.value.err) {
          console.error("Transaction error:", confirmation.value.err);
          toast({
            title: "Transaction error",
            description: "The transaction was confirmed but had errors. Please check your balance.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Unstaking successful",
            description: `You've unstaked ${amount} HATM tokens!`
          });
        }
        
        // Refresh data
        await refreshBalances();
        return signature;
        
      } catch (error: any) {
        console.error("Unstaking error:", error);
        
        // Special handling for different error types
        if (error?.name === 'WalletSendTransactionError') {
          toast({
            title: "Transaction rejected",
            description: "You declined the transaction in your wallet.",
            variant: "destructive"
          });
        } else if (error?.message?.includes('0x1770') || error?.message?.includes('InsufficientStake')) {
          toast({
            title: "Insufficient Staked Balance",
            description: "You don't have enough tokens staked to unstake this amount.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Unstaking failed",
            description: error?.message || "There was an error unstaking your tokens. Please try again.",
            variant: "destructive"
          });
        }
        
        throw error;
      }
      
    } catch (error) {
      console.error("Overall unstaking error:", error);
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