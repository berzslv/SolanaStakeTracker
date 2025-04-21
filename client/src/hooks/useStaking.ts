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
import { PROGRAM_ID, TOKEN_MINT_ADDRESS, VERIFIED_VAULT_ADDRESS, DECIMALS } from "@/utils/constants";
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
  // Using DECIMALS from constants (9 for HATM token)
  return new anchor.BN(amount * 10 ** DECIMALS);
};

// Convert BN to number with proper decimal handling
const fromBN = (amount: typeof anchor.BN): number => {
  return amount.toNumber() / 10 ** DECIMALS;
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
            
            // First check if the account exists on-chain
            const accountInfo = await connection.getAccountInfo(userInfoPDA);
            console.log("User info account exists:", !!accountInfo);
            
            if (!accountInfo) {
              console.log("User hasn't staked yet, account doesn't exist:", userInfoPDA.toString());
              setStakedAmount(0);
              return;
            }
            
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
              console.log("User info data:", {
                // @ts-ignore
                owner: userInfo.owner?.toString(),
                // @ts-ignore
                stakedAmount: userInfo.stakedAmount?.toString(),
                // @ts-ignore
                rewards: userInfo.rewards?.toString()
              });
              
              // @ts-ignore - Handle potential type issues with Anchor
              if (userInfo.stakedAmount) {
                // @ts-ignore
                setStakedAmount(fromBN(userInfo.stakedAmount));
              } else {
                console.log("Staked amount is missing or invalid");
                setStakedAmount(0);
              }
              
              // In the future we could display referral info and rewards too
              // @ts-ignore
              console.log("User referral count:", userInfo.referralCount?.toNumber());
              // @ts-ignore
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
      
      // Get necessary PDAs and accounts
      const [globalStatePDA] = await findVaultPDA(); // This is the GlobalState PDA with "global_state" seed
      const [userInfoPDA] = await findUserInfoPDA(publicKey); // UserInfo PDA with "user_info" seed
      
      // CRITICAL: Get the vault token account with proper lookup logic
      const vaultTokenAccount = await findTokenVaultAccount(connection);
      
      // Get user's token account (ATA)
      const userTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT_ADDRESS, publicKey);
      
      console.log("Staking with accounts:", {
        owner: publicKey.toString(),
        globalState: globalStatePDA.toString(),
        userInfo: userInfoPDA.toString(),
        userTokenAccount: userTokenAccount.toString(),
        vault: vaultTokenAccount.toString(),
        amount: amount.toString(),
        amountWithDecimals: toBN(amount).toString()
      });
      
      // Try a completely different approach - use token transfer instruction from SPL token
      // This is more compatible with how some programs expect token transfers
      const { 
        createTransferInstruction, 
        getAccount: getTokenAccount
      } = await import('@solana/spl-token');
      
      // First, get info about user's token account to verify balance
      try {
        const tokenAccountInfo = await getTokenAccount(connection, userTokenAccount);
        console.log("User token account info:", {
          mint: tokenAccountInfo.mint.toString(),
          owner: tokenAccountInfo.owner.toString(),
          amount: tokenAccountInfo.amount.toString()
        });
        
        // Validate that user has enough tokens
        const userTokenBalance = Number(tokenAccountInfo.amount);
        const amountLamports = toBN(amount).toNumber();
        
        if (userTokenBalance < amountLamports) {
          toast({
            title: "Insufficient token balance",
            description: `You need ${amount} HATM tokens but only have ${userTokenBalance / (10 ** DECIMALS)} available.`,
            variant: "destructive"
          });
          return;
        }
      } catch (tokenErr) {
        console.error("Error checking token account:", tokenErr);
        toast({
          title: "Token account error",
          description: "Could not verify your token balance. Please try again.",
          variant: "destructive"
        });
        return;
      }
      
      // Use two separate transactions:
      
      // 1. First transaction - Transfer tokens directly to the vault
      const transferTx = new Transaction();
      
      const transferInstruction = createTransferInstruction(
        userTokenAccount,            // source
        vaultTokenAccount,           // destination
        publicKey,                   // owner
        toBN(amount).toNumber()      // amount in lamports
      );
      
      transferTx.add(transferInstruction);
      transferTx.feePayer = publicKey;
      
      // Get a fresh blockhash
      const { blockhash: transferBlockhash, lastValidBlockHeight: transferLastValid } = 
        await connection.getLatestBlockhash();
      transferTx.recentBlockhash = transferBlockhash;
      
      // Send the first transaction (token transfer)
      console.log("Sending token transfer transaction");
      let transferSignature;
      try {
        transferSignature = await sendTransaction(transferTx, connection, {
          skipPreflight: true
        });
        
        console.log("Token transfer sent with signature:", transferSignature);
        
        // Wait for confirmation
        await connection.confirmTransaction({
          signature: transferSignature,
          blockhash: transferBlockhash,
          lastValidBlockHeight: transferLastValid
        });
        
        console.log("Token transfer confirmed, proceeding with stake transaction");
      } catch (transferError) {
        console.error("Error in token transfer transaction:", transferError);
        toast({
          title: "Token transfer failed",
          description: "Could not transfer tokens to the staking vault. Please try again.",
          variant: "destructive"
        });
        throw transferError;
      }
      
      // After transferring the tokens, update the UI to show transfer success
      toast({
        title: "Token transfer successful",
        description: `Step 1/2: Transferred ${amount} HATM tokens to staking vault`
      });
      
      // 2. Second transaction - Call stake function
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer for transfer to settle
      
      try {
        console.log("Preparing stake transaction");
        
        // Log all accounts in detail to ensure everything is correct
        console.log("Stake transaction accounts:", {
          owner: publicKey.toString(),
          globalState: globalStatePDA.toString(),
          userInfo: userInfoPDA.toString(),
          userTokenAccount: userTokenAccount.toString(),
          vault: vaultTokenAccount.toString(),
          amount: toBN(amount).toString(),
          programId: PROGRAM_ID
        });
        
        // Build the stake transaction with detailed logging
        const stakeTx = await program.methods
          .stake(toBN(amount))
          .accounts({
            owner: publicKey,
            globalState: globalStatePDA,
            userInfo: userInfoPDA,
            userTokenAccount: userTokenAccount,
            vault: vaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .transaction();
        
        stakeTx.feePayer = publicKey;
        
        // Get a fresh blockhash for the stake transaction
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        stakeTx.recentBlockhash = blockhash;
        
        // Send the stake transaction with careful error handling
        console.log("Sending stake transaction");
        
        // Use a more user-friendly approach to let them know what's happening
        toast({
          title: "Please confirm staking transaction",
          description: "Step 2/2: Please approve the staking transaction in your wallet."
        });
        
        const signature = await sendTransaction(stakeTx, connection, {
          skipPreflight: true
        });
        
        console.log("Stake transaction sent with signature:", signature);
        
        // Explicit notification about successful transaction send
        toast({
          title: "Stake transaction sent",
          description: "Waiting for confirmation..."
        });
      
      } catch (stakeError) {
        console.error("Error when trying to send stake transaction:", stakeError);
        
        // Special handling for stake error
        if (stakeError?.message?.includes('0x177a')) {
          toast({
            title: "Staking program error",
            description: "The program encountered an error processing the stake. The tokens may still be in the vault.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Stake transaction failed",
            description: "We transferred your tokens to the vault but couldn't complete the staking process. Please contact support.",
            variant: "destructive"
          });
        }
        
        throw stakeError;
      }
      
      // After the stake transaction attempt, we may or may not have a signature
      // For now, we just consider the transfer successful if we reach this point
      
      // Skip the second part if we never got to send the stake transaction
      toast({
        title: "Tokens transferred to vault",
        description: "You've transferred tokens to the staking vault. Check your balances soon to see your staked amount update."
      });
      
      // Update the balances to reflect any changes
      await refreshBalances();
      
      // Return the token transfer signature - at least that was successful
      return transferSignature;
    } catch (error: any) {
      console.error("Stake error:", error);
      
      if (error?.name === 'WalletSendTransactionError') {
        // User rejected the transaction in their wallet
        toast({
          title: "Transaction rejected",
          description: "You declined the transaction in your wallet.",
          variant: "destructive"
        });
      } else {
        // Other errors
        toast({
          title: "Staking failed",
          description: error?.message || "There was an error staking your tokens. Please try again.",
          variant: "destructive"
        });
      }
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper function to check if userInfo account exists and verify staking status
  const verifyUserStakeAccount = async (): Promise<boolean> => {
    if (!publicKey) return false;
    
    const program = getProgram();
    if (!program) return false;
    
    try {
      // Get the PDA for this user
      const [userInfoPDA] = await findUserInfoPDA(publicKey);
      
      // Log the account we're checking
      console.log("Checking user info account:", userInfoPDA.toString());
      
      // Check if the account exists on-chain
      const accountInfo = await connection.getAccountInfo(userInfoPDA);
      console.log("Account info exists:", !!accountInfo);
      
      if (!accountInfo) {
        console.log("User info account does not exist on chain");
        return false;
      }
      
      try {
        // Try to deserialize the account
        const userInfo = await program.account.userInfo.fetch(userInfoPDA);
        // @ts-ignore - UserInfo structure fields
        console.log("User info data:", {
          // @ts-ignore
          owner: userInfo.owner?.toString(),
          // @ts-ignore
          stakedAmount: userInfo.stakedAmount?.toString(),
          // @ts-ignore
          rewards: userInfo.rewards?.toString()
        });
        
        // @ts-ignore - Check if stakedAmount > 0
        if (userInfo.stakedAmount && userInfo.stakedAmount.toNumber() > 0) {
          return true;
        } else {
          console.log("User has no staked tokens according to contract");
          return false;
        }
      } catch (err) {
        console.error("Error deserializing user info account:", err);
        return false;
      }
    } catch (err) {
      console.error("Error checking user stake account:", err);
      return false;
    }
  };
  
  // Unstake tokens
  const unstake = async (amount: number) => {
    if (!publicKey) return;
    
    const program = getProgram();
    if (!program) return;
    
    try {
      setIsProcessing(true);
      
      // First, explicitly verify that the user's stake account exists and has tokens
      console.log("Verifying user stake account before unstaking...");
      const hasStakeAccount = await verifyUserStakeAccount();
      
      if (!hasStakeAccount) {
        toast({
          title: "Cannot unstake tokens",
          description: "You don't have any staked tokens or your staking account hasn't been initialized. Please stake some tokens first.",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }
      
      // IMPORTANT: Check if the user has enough staked tokens
      // This prevents the "InsufficientStake" error (0x1770)
      if (amount > stakedAmount) {
        toast({
          title: "Insufficient staked balance",
          description: `You only have ${stakedAmount} HATM tokens staked. Cannot unstake ${amount} tokens.`,
          variant: "destructive"
        });
        setIsProcessing(false);
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
      
      // For unstaking, we don't need an approval since tokens are coming back to us
      
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