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
      const accountInfo = await connection.getAccountInfo(userInfoPDA);
      
      return accountInfo !== null;
    } catch (error) {
      console.error("Error checking user registration:", error);
      return false;
    }
  };

  // Register user with the staking program
  const registerUser = async () => {
    if (!publicKey) return;
    
    console.log("Starting registration process...");
    console.log("Public Key:", publicKey.toString());
    
    const program = getProgram();
    if (!program) {
      console.error("Failed to create Anchor program");
      return;
    }
    console.log("Program ID:", program.programId.toString());
    
    try {
      setIsProcessing(true);
      
      const [vaultPDA] = await findVaultPDA();
      console.log("Vault PDA:", vaultPDA.toString());
      
      const [userInfoPDA] = await findUserInfoPDA(publicKey);
      console.log("User Info PDA:", userInfoPDA.toString());
      
      console.log("Building transaction...");
      
      // Create instruction to register user with detailed logging
      const tx = await program.methods
        .registerUser() // No arguments according to IDL
        .accounts({
          user: publicKey, // According to the contract expected params
          userInfo: userInfoPDA,
          vault: vaultPDA, // According to the contract expected params
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY
        })
        .transaction();
      
      // Add a bit more lamports for the fee
      tx.feePayer = publicKey;
      
      // Get the recent blockhash for transaction freshness
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      
      console.log("Transaction built, sending with params:", {
        accounts: {
          user: publicKey.toString(),
          userInfo: userInfoPDA.toString(),
          vault: vaultPDA.toString(),
        }
      });
      
      // Send transaction with retries
      let retries = 3;
      let signature = null;
      
      while (retries > 0 && !signature) {
        try {
          signature = await sendTransaction(tx, connection);
          console.log("Transaction sent with signature:", signature);
          break; // Exit the loop if successful
        } catch (err) {
          console.error("Send transaction attempt failed:", err);
          retries--;
          if (retries === 0) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
        }
      }
      
      // Wait for confirmation
      console.log("Waiting for confirmation...");
      if (signature) {
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash: tx.recentBlockhash!, // Non-null assertion for TypeScript
          lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
        });
        console.log("Transaction confirmed:", confirmation);
      }
      
      toast({
        title: "Registration successful",
        description: "You're now registered with the staking program"
      });
      
      setIsRegistered(true);
      return signature;
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
          description: `Error: ${error.message.slice(0, 100)}...`,
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
            
            // Get UserStakeInfo account with retry logic
            const fetchUserStakeInfo = async (retry = true) => {
              try {
                return await program.account.userStakeInfo.fetch(userInfoPDA);
              } catch (err: any) {
                if (retry && err?.message && typeof err.message === 'string' && err.message.includes('429')) {
                  console.log("Server responded with 429 on userStakeInfo fetch. Retrying after 500ms...");
                  await new Promise(resolve => setTimeout(resolve, 500));
                  return fetchUserStakeInfo(false);
                }
                throw err;
              }
            };
            
            const userStakeInfo = await fetchUserStakeInfo();
            
            // @ts-ignore - Handle potential type issues with Anchor
            setStakedAmount(fromBN(userStakeInfo.amountStaked));
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
      
      // Check if user is registered
      const isUserRegistered = await checkUserRegistration();
      
      // Register if not already registered
      if (!isUserRegistered) {
        await registerUser();
      }
      
      // Get necessary PDAs
      const [vaultPDA] = await findVaultPDA();
      const [userInfoPDA] = await findUserInfoPDA(publicKey);
      const tokenVaultAccount = await findTokenVaultPDA();
      
      // Get user's token account
      const userTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT_ADDRESS, publicKey);
      
      // Create stake instruction
      const tx = await program.methods
        .stake(toBN(amount))
        .accounts({
          user: publicKey,
          userInfo: userInfoPDA,
          vault: vaultPDA,
          userTokenAccount: userTokenAccount,
          vaultTokenAccount: tokenVaultAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      
      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      
      // Send transaction
      const signature = await sendTransaction(tx, connection);
      
      // Wait for confirmation with proper format
      if (signature) {
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        });
      }
      
      toast({
        title: "Staking successful",
        description: `You've staked ${amount} HATM tokens`
      });
      
      // Refresh balances
      await refreshBalances();
      
      return signature;
    } catch (error) {
      console.error("Stake error:", error);
      toast({
        title: "Staking failed",
        description: "There was an error staking your tokens",
        variant: "destructive"
      });
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
      
      // Get necessary PDAs
      const [vaultPDA] = await findVaultPDA();
      const [vaultAuthorityPDA] = await findVaultAuthorityPDA();
      const [userInfoPDA] = await findUserInfoPDA(publicKey);
      const tokenVaultAccount = await findTokenVaultPDA();
      
      // Get user's token account
      const userTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT_ADDRESS, publicKey);
      
      // Create unstake instruction
      const tx = await program.methods
        .unstake(toBN(amount))
        .accounts({
          user: publicKey,
          userInfo: userInfoPDA,
          vault: vaultPDA,
          vaultAuthority: vaultAuthorityPDA,
          vaultTokenAccount: tokenVaultAccount,
          userTokenAccount: userTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      
      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      
      // Send transaction
      const signature = await sendTransaction(tx, connection);
      
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
      
      // Refresh balances
      await refreshBalances();
      
      return signature;
    } catch (error) {
      console.error("Unstake error:", error);
      toast({
        title: "Unstaking failed",
        description: "There was an error unstaking your tokens",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Initial fetch when wallet connects
  useEffect(() => {
    if (publicKey) {
      // Check if user is registered first
      const checkRegistration = async () => {
        const isUserRegistered = await checkUserRegistration();
        console.log("User registration check:", isUserRegistered);
        setIsRegistered(isUserRegistered);
        refreshBalances();
      };
      
      checkRegistration();
    } else {
      setTokenBalance(0);
      setStakedAmount(0);
      setIsRegistered(false);
    }
  }, [publicKey, connection]);

  return {
    tokenBalance,
    stakedAmount,
    isRegistered,
    isLoading,
    isProcessing,
    refreshBalances,
    registerUser,
    stake,
    unstake
  };
}