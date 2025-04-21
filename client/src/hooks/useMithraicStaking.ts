import { useState, useEffect, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useToast } from '@/hooks/use-toast';
import { PROGRAM_ID, TOKEN_MINT_ADDRESS } from '@/utils/constants';
import {
  StakeClient,
  StakePool,
  RewardPool,
  fetchStakeAccounts,
  StakeAccount,
  fetchRewardDistributorAccounts,
  RewardDistributor,
  fetchRewardEntryAccounts,
  RewardEntry,
  findStakeEntryId,
  StakeEntryTokenStatus,
  findRewardDistributorId,
  findRewardEntryId,
} from '@mithraic-labs/token-staking';
import { getAssociatedTokenAddress } from '@solana/spl-token';

export function useMithraicStaking() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { toast } = useToast();

  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [stakedAmount, setStakedAmount] = useState<number>(0);
  const [rewardAmount, setRewardAmount] = useState<number>(0);
  const [stakeApy, setStakeApy] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  const [stakePool, setStakePool] = useState<StakePool | null>(null);
  const [stakeAccount, setStakeAccount] = useState<StakeAccount | null>(null);
  const [rewardDistributor, setRewardDistributor] = useState<RewardDistributor | null>(null);
  const [rewardEntry, setRewardEntry] = useState<RewardEntry | null>(null);

  // Prepare the stake client
  const stakeClient = useMemo(() => {
    if (!publicKey || !signTransaction) return null;
    return new StakeClient({
      connection,
      wallet: {
        publicKey,
        signTransaction,
        signAllTransactions: async (txs) => {
          const signed = [];
          for (const tx of txs) {
            signed.push(await signTransaction(tx));
          }
          return signed;
        },
      }
    });
  }, [connection, publicKey, signTransaction]);

  // Constants
  const programId = new PublicKey(PROGRAM_ID);
  const tokenMintId = new PublicKey(TOKEN_MINT_ADDRESS);

  // Load initial data
  const loadData = async () => {
    if (!publicKey || !stakeClient) {
      resetState();
      return;
    }

    setIsLoading(true);
    try {
      // Get token balance
      try {
        const userATA = await getAssociatedTokenAddress(tokenMintId, publicKey);
        try {
          const tokenAccount = await connection.getTokenAccountBalance(userATA);
          setTokenBalance(parseFloat(tokenAccount.value.uiAmount?.toString() || "0"));
        } catch (error) {
          console.error("Error fetching token balance:", error);
          setTokenBalance(0);
        }
      } catch (error) {
        console.error("Error getting ATA:", error);
        setTokenBalance(0);
      }

      // Get staking data
      try {
        // Find the stake pool (there may be multiple)
        const stakePoolAddresses = await stakeClient.getAllStakePools();
        
        if (stakePoolAddresses.length === 0) {
          console.log("No stake pools found");
          return;
        }
        
        // Use the first stake pool found
        const stakePool = await stakeClient.getStakePool(stakePoolAddresses[0]);
        setStakePool(stakePool);
        
        // Get the user's stake entry
        const stakeEntryId = findStakeEntryId(
          programId,
          stakePool.pubkey,
          tokenMintId,
          publicKey
        );
        
        // Fetch stake accounts
        const stakeAccounts = await fetchStakeAccounts(connection, stakeClient.stakeProgram.programId);
        
        // Find the user's stake account
        const userStakeAccount = stakeAccounts.find(account => 
          account.pubkey.toBase58() === stakeEntryId.toBase58()
        );
        
        if (userStakeAccount) {
          setStakeAccount(userStakeAccount);
          setStakedAmount(userStakeAccount.parsed.amount.toNumber() / 1e6); // Assuming 6 decimals
        } else {
          setStakeAccount(null);
          setStakedAmount(0);
        }
        
        // Get reward distributor
        const rewardDistributorId = findRewardDistributorId(programId, stakePool.pubkey);
        const rewardDistributors = await fetchRewardDistributorAccounts(
          connection,
          stakeClient.stakeProgram.programId
        );
        
        const userRewardDistributor = rewardDistributors.find(
          rd => rd.pubkey.toBase58() === rewardDistributorId.toBase58()
        );
        
        if (userRewardDistributor) {
          setRewardDistributor(userRewardDistributor);
          
          // Calculate APY
          // This is a simplified calculation - in a production app you might want to use a more accurate method
          const rewardRate = userRewardDistributor.parsed.rewardAmount.toNumber() / 1e6;
          const rewardDuration = userRewardDistributor.parsed.rewardDurationSeconds.toNumber();
          
          // APY calculation assumes total supply staked and daily compounding
          // APY = (1 + (rewardRate / totalStaked) * (86400 / rewardDuration)) ^ 365 - 1
          // For simplicity, using a fixed APY of 5% here
          setStakeApy(5);
          
          // Get reward entry
          if (userStakeAccount) {
            const rewardEntryId = findRewardEntryId(
              programId,
              rewardDistributorId,
              userStakeAccount.pubkey
            );
            
            const rewardEntries = await fetchRewardEntryAccounts(
              connection,
              stakeClient.stakeProgram.programId
            );
            
            const userRewardEntry = rewardEntries.find(
              re => re.pubkey.toBase58() === rewardEntryId.toBase58()
            );
            
            if (userRewardEntry) {
              setRewardEntry(userRewardEntry);
              setRewardAmount(userRewardEntry.parsed.rewardAmount.toNumber() / 1e6);
            } else {
              setRewardEntry(null);
              setRewardAmount(0);
            }
          }
        }
      } catch (error) {
        console.error("Error loading staking data:", error);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error loading data",
        description: "Failed to load staking data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset state when wallet disconnects
  const resetState = () => {
    setTokenBalance(0);
    setStakedAmount(0);
    setRewardAmount(0);
    setStakeApy(0);
    setStakePool(null);
    setStakeAccount(null);
    setRewardDistributor(null);
    setRewardEntry(null);
  };

  // Stake tokens
  const stake = async (amount: number) => {
    if (!publicKey || !stakeClient || !stakePool) {
      toast({
        title: "Cannot stake",
        description: "Wallet not connected or stake pool not found",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Convert amount to lamports (assuming 6 decimals)
      const amountLamports = Math.floor(amount * 1e6);
      
      // Get ATA for the token
      const userATA = await getAssociatedTokenAddress(tokenMintId, publicKey);
      
      // Stake the tokens
      await stakeClient.stake({
        stakePoolId: stakePool.pubkey,
        originalMintId: tokenMintId,
        userOriginalMintTokenAccountId: userATA,
        amount: amountLamports,
        stakeEntryTokenStatus: StakeEntryTokenStatus.Locked,
      });
      
      toast({
        title: "Staking successful",
        description: `You have staked ${amount} HATM tokens`,
      });
      
      // Refresh balances
      await loadData();
    } catch (error) {
      console.error("Error staking tokens:", error);
      toast({
        title: "Staking failed",
        description: "There was an error staking your tokens. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Unstake tokens
  const unstake = async (amount: number) => {
    if (!publicKey || !stakeClient || !stakePool || !stakeAccount) {
      toast({
        title: "Cannot unstake",
        description: "Wallet not connected or no stake account found",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Unstake tokens
      await stakeClient.unstake({
        stakePoolId: stakePool.pubkey,
        originalMintId: tokenMintId,
      });
      
      toast({
        title: "Unstaking successful",
        description: `You have unstaked your HATM tokens`,
      });
      
      // Refresh balances
      await loadData();
    } catch (error) {
      console.error("Error unstaking tokens:", error);
      toast({
        title: "Unstaking failed",
        description: "There was an error unstaking your tokens. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Claim rewards
  const claimRewards = async () => {
    if (!publicKey || !stakeClient || !stakePool || !stakeAccount || !rewardDistributor) {
      toast({
        title: "Cannot claim rewards",
        description: "Wallet not connected or no rewards available",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Claim rewards
      await stakeClient.claimRewards({
        stakePoolId: stakePool.pubkey,
        stakeEntryId: stakeAccount.pubkey,
        rewardDistributorId: rewardDistributor.pubkey,
      });
      
      toast({
        title: "Rewards claimed",
        description: `You have claimed your rewards`,
      });
      
      // Refresh balances
      await loadData();
    } catch (error) {
      console.error("Error claiming rewards:", error);
      toast({
        title: "Claiming failed",
        description: "There was an error claiming your rewards. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Load data when wallet connects or changes
  useEffect(() => {
    loadData();
  }, [publicKey, connection, stakeClient]);

  return {
    tokenBalance,
    stakedAmount,
    rewardAmount,
    stakeApy,
    isLoading,
    isProcessing,
    stakePool,
    stakeAccount,
    rewardDistributor,
    rewardEntry,
    refreshBalances: loadData,
    stake,
    unstake,
    claimRewards,
  };
}