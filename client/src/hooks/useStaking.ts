import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  Connection
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress 
} from "@solana/spl-token";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { PROGRAM_ID, TOKEN_MINT_ADDRESS } from "@/utils/constants";
import { IDL } from "@/utils/idl";
import * as anchor from '@project-serum/anchor';
import { Program } from "@project-serum/anchor";
import { 
  findTokenVaultAccount, 
  getUserStakeInfo,
  findStakingVault,
  findUserStakeInfoAccount
} from "@/utils/anchor";

// Convert number to BN with proper decimal handling
const toBN = (amount: number): typeof anchor.BN => {
  // Assuming 6 decimals for the token
  return new anchor.BN(amount * 10 ** 6);
};

// Convert BN to number with proper decimal handling
const fromBN = (amount: typeof anchor.BN): number => {
  return amount.toNumber() / 10 ** 6;
};

export function useStaking() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const { toast } = useToast();

  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [stakedAmount, setStakedAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);

  const TOKEN_MINT = new PublicKey(TOKEN_MINT_ADDRESS);
  const PROGRAM_ID_PUBKEY = new PublicKey(PROGRAM_ID);

  // Get PDAs for the staking program
  const findVaultPDA = async (): Promise<[PublicKey, number]> => {
    console.log("Finding global_state PDA...");
    return await PublicKey.findProgramAddress(
      [Buffer.from("global_state")],
      PROGRAM_ID_PUBKEY
    );
  };

  const findVaultAuthorityPDA = async (): Promise<[PublicKey, number]> => {
    // Based on the contract code, the vault authority is the same as the global state
    console.log("Finding vault authority PDA (global_state)...");
    return await PublicKey.findProgramAddress(
      [Buffer.from("global_state")],
      PROGRAM_ID_PUBKEY
    );
  };

  const findUserInfoPDA = async (owner: PublicKey): Promise<[PublicKey, number]> => {
    console.log("Finding user_info PDA for:", owner.toString());
    return await PublicKey.findProgramAddress(
      [Buffer.from("user_info"), owner.toBuffer()],
      PROGRAM_ID_PUBKEY
    );
  };

  const findTokenVaultPDA = async (): Promise<PublicKey> => {
    const [vaultAuthority] = await findVaultAuthorityPDA();
    return await getAssociatedTokenAddress(
      TOKEN_MINT,
      vaultAuthority,
      true // allowOwnerOffCurve - PDA can own token account
    );
  };

  // Create an Anchor provider and program
  const getProvider = () => {
    if (!publicKey || !signTransaction) return null;
    
    // Create a wallet compatible with Anchor
    const wallet = {
      publicKey,
      signTransaction,
      // Implement signAllTransactions by mapping signTransaction over all txs
      signAllTransactions: async (txs: Transaction[]) => {
        return Promise.all(txs.map(tx => signTransaction(tx)));
      }
    };
    
    return new anchor.AnchorProvider(
      connection,
      wallet,
      { preflightCommitment: "confirmed" }
    );
  };

  const getProgram = () => {
    const provider = getProvider();
    if (!provider) return null;
    
    return new Program(IDL, PROGRAM_ID_PUBKEY, provider);
  };

  // Check if user has a staking account
  const checkUserRegistration = async () => {
    if (!publicKey) return false;
    
    try {
      const [userInfoPDA] = await findUserInfoPDA(publicKey);
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
      
      try {
        const accountInfo = await connection.getAccountInfo(userInfoPDA);
        const isRegistered = accountInfo !== null;
        
        // Improved logging that doesn't look like an error
        if (!isRegistered) {
          console.log("User not yet registered with staking program:", userInfoPDA.toString());
        } else {
          console.log("User is registered with staking program:", userInfoPDA.toString());
        }
        
        return isRegistered;
      } catch (err: any) {
        // If this is a rate limit error, we should log it differently
        if (err?.message?.includes('429')) {
          console.warn("Rate limit hit while checking registration status, assuming not registered");
        } else {
          console.warn("Non-critical error while checking registration:", err?.message);
        }
        return false;
      }
    } catch (error) {
      console.error("Error checking user registration:", error);
      return false;
    }
  };

  // Register user with the staking program
  const registerUser = async (): Promise<string | undefined> => {
    if (!publicKey) return undefined;
    
    console.log("Starting registration process...");
    console.log("Public Key:", publicKey.toString());
    
    const program = getProgram();
    if (!program) {
      console.error("Failed to create Anchor program");
      return undefined;
    }
    
    console.log("Program ID:", program.programId.toString());
    
    // First, check if the user is already registered to avoid redundant registration
    try {
      const isAlreadyRegistered = await checkUserRegistration();
      if (isAlreadyRegistered) {
        console.log("User is already registered, no need to register again");
        toast({
          title: "Already registered",
          description: "You're already registered with the staking program"
        });
        setIsRegistered(true);
        return "already-registered";
      }
    } catch (checkError) {
      console.error("Error checking registration status:", checkError);
      // Continue with registration attempt even if check failed
    }
    
    try {
      setIsProcessing(true);
      
      const [vaultPDA] = await findVaultPDA();
      console.log("Vault PDA:", vaultPDA.toString());
      
      const [userInfoPDA] = await findUserInfoPDA(publicKey);
      console.log("User Info PDA:", userInfoPDA.toString());
      
      console.log("Building transaction...");
      
      // Create instruction to register user with detailed logging
      // Fixed to match the referral_staking contract
      const tx = await program.methods
        .registerUser(null) // Referral staking contract requires referrer as nullable argument
        .accounts({
          owner: publicKey, // Changed from user to owner in the contract
          userInfo: userInfoPDA,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY
        })
        .transaction();
      
      // Get a fresh blockhash for the transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      
      console.log("Transaction built, sending with params:", {
        accounts: {
          user: publicKey.toString(),
          userInfo: userInfoPDA.toString(),
          vault: vaultPDA.toString(),
        }
      });
      
      // Send transaction with special error handling for Phantom wallet
      let retries = 3;
      let signature = null;
      
      const handleTransaction = async () => {
        try {
          const sigResult = await sendTransaction(tx, connection, {
            skipPreflight: true  // Skip preflight to avoid some common issues
          });
          console.log("Registration transaction sent with signature:", sigResult);
          return sigResult;
        } catch (err: any) {
          console.error("Send transaction attempt failed:", err);
          
          // Handle different error types
          if (err.name === 'WalletSendTransactionError') {
            toast({
              title: "Wallet Transaction Error",
              description: "Please try again with your Phantom wallet. Make sure to approve the transaction in your wallet extension.",
              variant: "destructive"
            });
          }
          
          throw err;
        }
      };
      
      while (retries > 0 && !signature) {
        try {
          signature = await handleTransaction();
          break; // Exit the loop if successful
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s between retries
        }
      }
      
      // Wait for confirmation
      console.log("Waiting for registration confirmation...");
      if (signature) {
        try {
          const confirmation = await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
          });
          
          console.log("Registration transaction confirmed:", confirmation);
          
          // Verify the registration was successful
          await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s for chain state to update
          const verifyRegistration = await checkUserRegistration();
          
          if (verifyRegistration) {
            toast({
              title: "Registration successful",
              description: "You're now registered with the staking program"
            });
            
            setIsRegistered(true);
          } else {
            console.warn("Registration transaction succeeded but account doesn't appear to be registered yet, it may take some time to propagate");
            toast({
              title: "Registration pending",
              description: "Your registration was submitted. Please wait a moment and try refreshing."
            });
          }
        } catch (confirmErr) {
          console.error("Error confirming registration transaction:", confirmErr);
          toast({
            title: "Registration status unknown",
            description: "We couldn't confirm if your registration was successful. Please check your wallet and try refreshing.",
            variant: "destructive"
          });
        }
      }
      
      return signature || undefined;
    } catch (error) {
      console.error("Registration error:", error);
      
      // More detailed error logging
      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        
        // Get any specific Anchor error info
        if ('error' in error && error.error) {
          console.error("Anchor error info:", error.error);
        }
        
        // Show more useful error message to user
        toast({
          title: "Registration failed",
          description: `Error: ${error.message.slice(0, 100)}${error.message.length > 100 ? '...' : ''}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Registration failed",
          description: "There was an unexpected error registering with the staking program",
          variant: "destructive"
        });
      }
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Tracking for refresh operations to prevent concurrent calls
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Fetch token balance and staked amount with debounce
  const refreshBalances = async () => {
    if (!publicKey || isRefreshing) return;
    
    setIsRefreshing(true);
    setIsLoading(true);
    
    const delayBetweenRequests = 300; // ms between RPC calls
    
    try {
      // Get token balance from the associated token account
      console.log("Looking for token with mint:", TOKEN_MINT_ADDRESS.toString());
      const userATA = await getAssociatedTokenAddress(TOKEN_MINT_ADDRESS, publicKey);
      console.log("User ATA:", userATA.toString());
      
      try {
        // Wait before making RPC call to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
        
        const tokenAccount = await connection.getTokenAccountBalance(userATA)
          .catch(async (err: any) => {
            if (err?.message && typeof err.message === 'string' && err.message.includes('429')) {
              console.log("Server responded with 429. Retrying after 500ms delay...");
              await new Promise(resolve => setTimeout(resolve, 500));
              return await connection.getTokenAccountBalance(userATA);
            }
            throw err;
          });
        
        console.log("Token account info:", tokenAccount);
        setTokenBalance(parseFloat(tokenAccount.value.uiAmount?.toString() || "0"));
      } catch (error) {
        console.error("Error fetching token balance:", error);
        setTokenBalance(0);
      }
      
      // We're not checking registration status here anymore, handled in useEffect
      
      // Get staked amount if registered
      if (isRegistered) {
        try {
          const program = getProgram();
          if (!program) return;
          
          const [userInfoPDA] = await findUserInfoPDA(publicKey);
          
          try {
            // Wait before making another RPC call
            await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
            
            // Get UserInfo account with retry logic - updated for referral_staking contract
            const fetchUserInfo = async (retry = true) => {
              try {
                // Changed from userStakeInfo to userInfo (correct account type)
                return await program.account.userInfo.fetch(userInfoPDA);
              } catch (err: any) {
                if (retry && err?.message && typeof err.message === 'string' && err.message.includes('429')) {
                  console.log("Server responded with 429 on userInfo fetch. Retrying after 500ms...");
                  await new Promise(resolve => setTimeout(resolve, 500));
                  return fetchUserInfo(false);
                }
                
                // Handle the "Account does not exist" error specifically
                // This is normal for users who haven't staked yet
                if (err?.message && typeof err.message === 'string' && 
                    (err.message.includes('Account does not exist') || 
                     err.message.includes('has no data'))) {
                  console.log("User hasn't staked yet, account doesn't exist:", userInfoPDA.toString());
                  return null; // Return null instead of throwing
                }
                
                throw err;
              }
            };
            
            const userInfo = await fetchUserInfo();
            
            if (userInfo) {
              // Access the correct field name - stakedAmount not amountStaked
              // @ts-ignore - Handle potential type issues with Anchor
              setStakedAmount(fromBN(userInfo.stakedAmount));
              
              // In the future we could display referral info and rewards too
              console.log("User referral count:", userInfo.referralCount?.toNumber());
              console.log("User rewards:", fromBN(userInfo.rewards));
            } else {
              // This is a normal case for non-stakers, not an error
              setStakedAmount(0);
            }
          } catch (error) {
            console.error("Error fetching user stake info account:", error);
            setStakedAmount(0);
          }
        } catch (error) {
          console.error("Error fetching staked amount:", error);
          setStakedAmount(0);
        }
      } else {
        setStakedAmount(0);
      }
    } catch (error) {
      console.error("Error refreshing balances:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Stake tokens
  const stake = async (amount: number) => {
    if (!publicKey) return;
    
    const program = getProgram();
    if (!program) return;
    
    try {
      setIsProcessing(true);
      
      // IMPORTANT: Check if user is registered - use the more reliable API
      let isUserRegistered = await checkUserRegistration();
      console.log("Initial user registration check:", isUserRegistered);
      
      // If not registered, we need to register the user first in a SEPARATE transaction
      if (!isUserRegistered) {
        console.log("User not registered, starting registration...");
        try {
          // Run the registration in a separate transaction and wait for confirmation
          const regSignature = await registerUser();
          console.log("Registration transaction sent:", regSignature);
          
          if (regSignature) {
            // Wait to make sure registration is processed
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check again to confirm registration worked
            isUserRegistered = await checkUserRegistration();
            console.log("Registration check after registration attempt:", isUserRegistered);
            
            if (!isUserRegistered) {
              toast({
                title: "Registration failed",
                description: "Unable to register with the staking program. Please try again.",
                variant: "destructive"
              });
              return;
            } else {
              toast({
                title: "Registration successful",
                description: "You're now registered with the staking program."
              });
            }
          }
        } catch (regError) {
          console.error("Registration error:", regError);
          toast({
            title: "Registration failed",
            description: "Unable to register with the staking program. Please try again.",
            variant: "destructive"
          });
          return;
        }
      }
      
      // Only proceed with staking if user is now registered
      if (!isUserRegistered) {
        toast({
          title: "Staking failed",
          description: "You must be registered to stake. Please try registering manually.",
          variant: "destructive"
        });
        return;
      }
      
      console.log("User is registered, proceeding with staking...");
      
      // Get necessary PDAs - updated for referral staking contract
      const [globalStatePDA] = await findVaultPDA(); // This is the GlobalState PDA with "global_state" seed
      const [userInfoPDA] = await findUserInfoPDA(publicKey); // UserInfo PDA with "user_info" seed
      
      // Use the improved findTokenVaultAccount which now tries to fetch the vault from GlobalState
      // If it can't fetch it, it falls back to our hardcoded value
      const vaultTokenAccount = await findTokenVaultAccount(connection);
      
      console.log("Debug - Stake accounts:", {
        globalStatePDA: globalStatePDA.toString(),
        userInfoPDA: userInfoPDA.toString(),
        vault: vaultTokenAccount.toString()
      });
      
      // Get user's token account
      const userTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT_ADDRESS, publicKey);
      
      console.log("Staking with accounts:", {
        owner: publicKey.toString(),
        globalState: globalStatePDA.toString(),
        userInfo: userInfoPDA.toString(),
        userTokenAccount: userTokenAccount.toString(),
        vault: vaultTokenAccount.toString()
      });
      
      // Create stake instruction
      const tx = await program.methods
        .stake(toBN(amount))
        .accounts({
          owner: publicKey, // Changed from user to owner
          globalState: globalStatePDA, // Added globalState
          userInfo: userInfoPDA,
          userTokenAccount: userTokenAccount,
          vault: vaultTokenAccount, // The token vault (ATA of global state)
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      
      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      
      // Send transaction with better error handling
      let signature = null;
      
      try {
        // Use improved transaction handling with skipPreflight
        signature = await sendTransaction(tx, connection, {
          skipPreflight: true // Skip preflight to avoid some common issues in the Replit environment
        });
        
        console.log("Staking transaction sent:", signature);
        
        // Wait for confirmation with proper format
        if (signature) {
          await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
          });
          
          console.log("Staking transaction confirmed");
        }
        
        toast({
          title: "Staking successful",
          description: `You've staked ${amount} HATM tokens`
        });
        
        // Update the last update time to prevent excessive refreshes
        setLastUpdateTime(Date.now());
        
        // Refresh balances
        await refreshBalances();
        
        return signature;
      } catch (txErr: any) {
        console.error("Transaction error:", txErr);
        
        // Special handling for WalletSendTransactionError
        if (txErr?.name === 'WalletSendTransactionError') {
          toast({
            title: "Wallet Error",
            description: "Please check your wallet connection and try again. Make sure to approve the transaction in your wallet extension.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Staking failed",
            description: txErr?.message || "There was an error staking your tokens",
            variant: "destructive"
          });
        }
        
        throw txErr;
      }
    } catch (error: any) {
      console.error("Stake error:", error);
      if (!error?.name?.includes('WalletSendTransactionError')) {
        toast({
          title: "Staking failed",
          description: error?.message || "There was an error staking your tokens",
          variant: "destructive"
        });
      }
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Unstake tokens
  const unstake = async (amount: number) => {
    if (!publicKey) return;
    
    const program = getProgram();
    if (!program) return;
    
    try {
      setIsProcessing(true);
      
      // IMPORTANT: First, check if the user has enough staked tokens
      // This prevents the "InsufficientStake" error (0x1770)
      if (amount > stakedAmount) {
        toast({
          title: "Insufficient staked balance",
          description: `You only have ${stakedAmount} HATM tokens staked. Cannot unstake ${amount} tokens.`,
          variant: "destructive"
        });
        return;
      }
      
      // Get necessary PDAs - updated for referral staking contract
      const [globalStatePDA] = await findVaultPDA(); // This is the "global_state" PDA
      const [userInfoPDA] = await findUserInfoPDA(publicKey); // UserInfo PDA
      
      // Use the improved findTokenVaultAccount which now tries to fetch the vault from GlobalState
      const vaultTokenAccount = await findTokenVaultAccount(connection);
      
      // Get user's token account
      const userTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT_ADDRESS, publicKey);
      
      console.log("Unstaking with accounts:", {
        owner: publicKey.toString(),
        globalState: globalStatePDA.toString(),
        userInfo: userInfoPDA.toString(),
        vault: vaultTokenAccount.toString(),
        userTokenAccount: userTokenAccount.toString()
      });
      
      // Create unstake instruction
      const tx = await program.methods
        .unstake(toBN(amount))
        .accounts({
          owner: publicKey, // Changed from user to owner
          globalState: globalStatePDA, // Changed to globalState
          userInfo: userInfoPDA,
          vault: vaultTokenAccount, // Changed from vaultTokenAccount
          userTokenAccount: userTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      
      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      
      // Send transaction with better error handling
      let signature = null;
      
      try {
        // Use improved transaction handling with skipPreflight
        signature = await sendTransaction(tx, connection, {
          skipPreflight: true // Skip preflight to avoid some common issues in the Replit environment
        });
        
        // Wait for confirmation with proper format
        if (signature) {
          await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
          });
        }
        
        toast({
          title: "Unstaking successful",
          description: `You've unstaked ${amount} HATM tokens`
        });
        
        // Update the last update time to prevent excessive refreshes
        setLastUpdateTime(Date.now());
        
        // Refresh balances
        await refreshBalances();
        
        return signature;
      } catch (txErr: any) {
        console.error("Transaction error:", txErr);
        
        // Special handling for WalletSendTransactionError
        if (txErr?.name === 'WalletSendTransactionError') {
          toast({
            title: "Wallet Error",
            description: "Please check your wallet connection and try again. Make sure to approve the transaction in your wallet extension.",
            variant: "destructive"
          });
        } 
        // Handle InsufficientStake error specifically (Custom program error: 0x1770)
        else if (txErr?.message?.includes('0x1770') || txErr?.message?.includes('InsufficientStake')) {
          toast({
            title: "Insufficient Staked Balance",
            description: "You don't have enough tokens staked to unstake this amount. Please refresh your balance and try again with a smaller amount.",
            variant: "destructive"
          });
        }
        else {
          toast({
            title: "Unstaking failed",
            description: txErr?.message || "There was an error unstaking your tokens",
            variant: "destructive"
          });
        }
        
        throw txErr;
      }
    } catch (error: any) {
      console.error("Unstake error:", error);
      if (!error?.name?.includes('WalletSendTransactionError')) {
        // Handle InsufficientStake error specifically (Custom program error: 0x1770)
        if (error?.message?.includes('0x1770') || error?.message?.includes('InsufficientStake')) {
          toast({
            title: "Insufficient Staked Balance",
            description: "You don't have enough tokens staked to unstake this amount. Please refresh your balance and try again with a smaller amount.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Unstaking failed",
            description: error?.message || "There was an error unstaking your tokens",
            variant: "destructive"
          });
        }
      }
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Keep track of last update time to prevent excessive API calls
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  
  // Initial fetch when wallet connects - only once, no automatic refreshes
  useEffect(() => {
    if (publicKey) {
      // Check if sufficient time has passed since last update (minimum 10 seconds)
      const now = Date.now();
      if (now - lastUpdateTime < 10000) {
        console.log("Skipping redundant update - too soon since last update");
        return;
      }
      
      // Check if user is registered first
      const checkRegistration = async () => {
        try {
          const isUserRegistered = await checkUserRegistration();
          console.log("User registration check:", isUserRegistered);
          setIsRegistered(isUserRegistered);
          
          // Only refresh balances if registered or it's been at least 30 seconds since last update
          if (isUserRegistered || (now - lastUpdateTime > 30000)) {
            refreshBalances();
          }
          
          setLastUpdateTime(now);
        } catch (error) {
          console.error("Error in initial wallet data fetch:", error);
        }
      };
      
      checkRegistration();
    } else {
      setTokenBalance(0);
      setStakedAmount(0);
      setIsRegistered(false);
    }
  }, [publicKey]);

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