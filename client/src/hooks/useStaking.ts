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
  const findGlobalStatePDA = async (): Promise<[PublicKey, number]> => {
    return await PublicKey.findProgramAddress(
      [Buffer.from("global_state")],
      PROGRAM_ID_PUBKEY
    );
  };

  const findUserInfoPDA = async (owner: PublicKey): Promise<[PublicKey, number]> => {
    return await PublicKey.findProgramAddress(
      [Buffer.from("user_info"), owner.toBuffer()],
      PROGRAM_ID_PUBKEY
    );
  };

  const findVaultPDA = async (): Promise<[PublicKey, number]> => {
    const [globalState] = await findGlobalStatePDA();
    return await PublicKey.findProgramAddress(
      [Buffer.from("vault"), globalState.toBuffer()],
      PROGRAM_ID_PUBKEY
    );
  };

  // Create an Anchor provider and program
  const getProvider = () => {
    if (!publicKey || !signTransaction) return null;
    
    // @ts-ignore - Wallet adapter types don't exactly match Anchor's expected types
    const wallet = {
      publicKey,
      signTransaction,
      signAllTransactions: undefined
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
  const registerUser = async (referrer: PublicKey | null = null) => {
    if (!publicKey) return;
    
    const program = getProgram();
    if (!program) return;
    
    try {
      setIsProcessing(true);
      
      const [globalStatePDA] = await findGlobalStatePDA();
      const [userInfoPDA] = await findUserInfoPDA(publicKey);
      
      // Create instruction to register user
      const tx = await program.methods
        .registerUser(referrer ? new anchor.web3.PublicKey(referrer) : null)
        .accounts({
          owner: publicKey,
          userInfo: userInfoPDA,
          globalState: globalStatePDA,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY
        })
        .transaction();
      
      // Send transaction
      const signature = await sendTransaction(tx, connection);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");
      
      toast({
        title: "Registration successful",
        description: "You're now registered with the staking program"
      });
      
      setIsRegistered(true);
      return signature;
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Registration failed",
        description: "There was an error registering with the staking program",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Fetch token balance and staked amount
  const refreshBalances = async () => {
    if (!publicKey) return;
    
    setIsLoading(true);
    try {
      // Get token balance
      const userATA = await getAssociatedTokenAddress(TOKEN_MINT, publicKey);
      
      try {
        const tokenAccount = await connection.getTokenAccountBalance(userATA);
        setTokenBalance(parseFloat(tokenAccount.value.uiAmount?.toString() || "0"));
      } catch (error) {
        console.error("Error fetching token balance:", error);
        setTokenBalance(0);
      }
      
      // Check if user is registered
      const isUserRegistered = await checkUserRegistration();
      setIsRegistered(isUserRegistered);
      
      // Get staked amount if registered
      if (isUserRegistered) {
        try {
          const program = getProgram();
          if (!program) return;
          
          const [userInfoPDA] = await findUserInfoPDA(publicKey);
          const userInfo = await program.account.userInfo.fetch(userInfoPDA);
          
          // @ts-ignore - Handle potential type issues with Anchor
          setStakedAmount(fromBN(userInfo.stakedAmount));
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
      const [globalStatePDA] = await findGlobalStatePDA();
      const [userInfoPDA] = await findUserInfoPDA(publicKey);
      const [vaultPDA] = await findVaultPDA();
      
      // Get user's token account
      const userTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, publicKey);
      
      // Create stake instruction
      const tx = await program.methods
        .stake(toBN(amount))
        .accounts({
          owner: publicKey,
          globalState: globalStatePDA,
          userInfo: userInfoPDA,
          vault: vaultPDA,
          userTokenAccount: userTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID
        })
        .transaction();
      
      // Send transaction
      const signature = await sendTransaction(tx, connection);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");
      
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
      const [globalStatePDA] = await findGlobalStatePDA();
      const [userInfoPDA] = await findUserInfoPDA(publicKey);
      const [vaultPDA] = await findVaultPDA();
      
      // Get user's token account
      const userTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, publicKey);
      
      // Create unstake instruction
      const tx = await program.methods
        .unstake(toBN(amount))
        .accounts({
          owner: publicKey,
          globalState: globalStatePDA,
          userInfo: userInfoPDA,
          vault: vaultPDA,
          userTokenAccount: userTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID
        })
        .transaction();
      
      // Send transaction
      const signature = await sendTransaction(tx, connection);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");
      
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
      refreshBalances();
    } else {
      setTokenBalance(0);
      setStakedAmount(0);
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