import * as anchor from '@project-serum/anchor';
import { 
  PublicKey, 
  Connection, 
  TransactionInstruction, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY 
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { BN } from 'bn.js';
import { PROGRAM_ID, TOKEN_MINT_ADDRESS, VERIFIED_VAULT_ADDRESS, DECIMALS } from './constants';

// IDL for the referral staking program (from official IDL)
export const StakingIDL = {"version":"0.1.0","name":"referral_staking","instructions":[{"name":"initialize","accounts":[{"name":"authority","isMut":true,"isSigner":true},{"name":"tokenMint","isMut":false,"isSigner":false},{"name":"vault","isMut":true,"isSigner":true},{"name":"globalState","isMut":true,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false},{"name":"tokenProgram","isMut":false,"isSigner":false},{"name":"rent","isMut":false,"isSigner":false}],"args":[{"name":"rewardRate","type":"u64"},{"name":"unlockDuration","type":"i64"},{"name":"earlyUnstakePenalty","type":"u64"},{"name":"minStakeAmount","type":"u64"},{"name":"referralRewardRate","type":"u64"}]},{"name":"registerUser","accounts":[{"name":"owner","isMut":true,"isSigner":true},{"name":"userInfo","isMut":true,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false},{"name":"rent","isMut":false,"isSigner":false}],"args":[{"name":"referrer","type":{"option":"publicKey"}}]},{"name":"stake","accounts":[{"name":"owner","isMut":true,"isSigner":true},{"name":"globalState","isMut":true,"isSigner":false},{"name":"userInfo","isMut":true,"isSigner":false},{"name":"userTokenAccount","isMut":true,"isSigner":false},{"name":"vault","isMut":true,"isSigner":false},{"name":"tokenProgram","isMut":false,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"amount","type":"u64"}]},{"name":"unstake","accounts":[{"name":"owner","isMut":true,"isSigner":true},{"name":"globalState","isMut":true,"isSigner":false},{"name":"userInfo","isMut":true,"isSigner":false},{"name":"userTokenAccount","isMut":true,"isSigner":false},{"name":"vault","isMut":true,"isSigner":false},{"name":"tokenProgram","isMut":false,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"amount","type":"u64"}]},{"name":"claimRewards","accounts":[{"name":"owner","isMut":true,"isSigner":true},{"name":"globalState","isMut":true,"isSigner":false},{"name":"userInfo","isMut":true,"isSigner":false},{"name":"userTokenAccount","isMut":true,"isSigner":false},{"name":"vault","isMut":true,"isSigner":false},{"name":"tokenProgram","isMut":false,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[]},{"name":"compoundRewards","accounts":[{"name":"owner","isMut":true,"isSigner":true},{"name":"globalState","isMut":true,"isSigner":false},{"name":"userInfo","isMut":true,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[]},{"name":"addToRewardPool","accounts":[{"name":"authority","isMut":true,"isSigner":true},{"name":"globalState","isMut":true,"isSigner":false},{"name":"userTokenAccount","isMut":true,"isSigner":false},{"name":"vault","isMut":true,"isSigner":false},{"name":"tokenProgram","isMut":false,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"amount","type":"u64"}]},{"name":"updateParameters","accounts":[{"name":"authority","isMut":false,"isSigner":true},{"name":"globalState","isMut":true,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"rewardRate","type":{"option":"u64"}},{"name":"unlockDuration","type":{"option":"i64"}},{"name":"earlyUnstakePenalty","type":{"option":"u64"}},{"name":"minStakeAmount","type":{"option":"u64"}},{"name":"referralRewardRate","type":{"option":"u64"}}]}],"accounts":[{"name":"UserInfo","type":{"kind":"struct","fields":[{"name":"owner","type":"publicKey"},{"name":"stakedAmount","type":"u64"},{"name":"rewards","type":"u64"},{"name":"lastStakeTime","type":"i64"},{"name":"lastClaimTime","type":"i64"},{"name":"referrer","type":{"option":"publicKey"}},{"name":"referralCount","type":"u64"},{"name":"totalReferralRewards","type":"u64"}]}},{"name":"GlobalState","type":{"kind":"struct","fields":[{"name":"authority","type":"publicKey"},{"name":"tokenMint","type":"publicKey"},{"name":"vault","type":"publicKey"},{"name":"rewardRate","type":"u64"},{"name":"unlockDuration","type":"i64"},{"name":"earlyUnstakePenalty","type":"u64"},{"name":"minStakeAmount","type":"u64"},{"name":"referralRewardRate","type":"u64"},{"name":"totalStaked","type":"u64"},{"name":"stakersCount","type":"u64"},{"name":"rewardPool","type":"u64"},{"name":"lastUpdateTime","type":"i64"},{"name":"bump","type":"u8"}]}}],"errors":[{"code":6000,"name":"Unauthorized","msg":"Unauthorized operation"},{"code":6001,"name":"InvalidOwner","msg":"Invalid owner"},{"code":6002,"name":"InvalidMint","msg":"Invalid mint"},{"code":6003,"name":"InvalidVault","msg":"Invalid vault"},{"code":6004,"name":"InvalidMintAuthority","msg":"Invalid mint authority"},{"code":6005,"name":"AmountTooSmall","msg":"Amount too small"},{"code":6006,"name":"InsufficientStakedAmount","msg":"Insufficient staked amount"},{"code":6007,"name":"NoRewardsToClaim","msg":"No rewards to claim"},{"code":6008,"name":"InsufficientRewardPool","msg":"Insufficient reward pool"},{"code":6009,"name":"PenaltyTooHigh","msg":"Early unstake penalty too high (max 50%)"},{"code":6010,"name":"ReferralRateTooHigh","msg":"Referral reward rate too high (max 20%)"}]};

// Find the staking vault PDA (global state)
export const findStakingVault = async () => {
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('global_state')],
    new PublicKey(PROGRAM_ID)
  );
  console.log("Generated vault PDA (global_state):", vaultPDA.toString());
  return vaultPDA;
};

// Find the vault authority PDA
export const findVaultAuthority = async () => {
  const [vaultAuthorityPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('global_state')],
    new PublicKey(PROGRAM_ID)
  );
  console.log("Generated vault authority PDA:", vaultAuthorityPDA.toString());
  return vaultAuthorityPDA;
};

// Find the user's stake info account
export const findUserStakeInfoAccount = (walletPublicKey: PublicKey) => {
  const [userInfoPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_info'), walletPublicKey.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
  console.log("Generated user info PDA for:", walletPublicKey.toString(), "=", userInfoPDA.toString());
  return userInfoPDA;
};

// Get global state from the program
export const getGlobalState = async (connection: Connection): Promise<{ vault: PublicKey } | null> => {
  try {
    // Create a public key for the program
    const programId = new PublicKey(PROGRAM_ID);
    
    // Find the GlobalState PDA
    const [globalStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_state')],
      programId
    );
    
    // Fetch the GlobalState account data
    const accountInfo = await connection.getAccountInfo(globalStatePDA);
    if (!accountInfo) {
      console.error("GlobalState account not found");
      return null;
    }
    
    // Create a provider to deserialize the account data
    const provider = new anchor.AnchorProvider(
      connection,
      // We don't need a real wallet here since we're just reading data
      { publicKey: PublicKey.default } as any,
      { preflightCommitment: 'processed' }
    );
    
    // Create program instance
    const program = new anchor.Program(
      StakingIDL as any,
      programId,
      provider
    );
    
    // Parse the GlobalState account
    const globalState = await program.account.globalState.fetch(globalStatePDA);
    
    // @ts-ignore - handle potential typing issues with Anchor
    console.log("GlobalState loaded:", {
      // @ts-ignore
      authority: globalState.authority?.toString(),
      // @ts-ignore
      tokenMint: globalState.tokenMint?.toString(),
      // @ts-ignore
      vault: globalState.vault?.toString(),
      // @ts-ignore
      rewardRate: globalState.rewardRate?.toString(),
      // @ts-ignore
      totalStaked: globalState.totalStaked?.toString(),
    });
    
    return {
      // @ts-ignore
      vault: globalState.vault
    };
  } catch (error) {
    console.error("Error getting global state:", error);
    return null;
  }
};

// Find the token vault account for the referral staking program
// Updated with more robust determination of the vault token account
export const findTokenVaultAccount = async (connection: Connection) => {
  try {
    // First, get the GlobalState PDA 
    const [globalStatePDA] = await PublicKey.findProgramAddress(
      [Buffer.from("global_state")],
      new PublicKey(PROGRAM_ID)
    );
    
    console.log("Looking up GlobalState PDA:", globalStatePDA.toString());
    
    // Try to get the actual account data from the blockchain
    const accountInfo = await connection.getAccountInfo(globalStatePDA);
    
    if (accountInfo) {
      // GlobalState exists on chain, we can try to deserialize it
      try {
        // Create a temporary read-only provider since we might not have a connected wallet
        const readOnlyProvider = new anchor.AnchorProvider(
          connection,
          // Use a dummy wallet that can't sign
          {
            publicKey: new PublicKey(PROGRAM_ID),
            signTransaction: () => Promise.reject("Read-only provider cannot sign"),
            signAllTransactions: () => Promise.reject("Read-only provider cannot sign"),
          } as any,
          { preflightCommitment: 'processed' }
        );
        
        // Set as default provider for this operation
        anchor.setProvider(readOnlyProvider);
        
        const program = new anchor.Program(StakingIDL as any, PROGRAM_ID, readOnlyProvider);
        const globalState = await program.account.globalState.fetch(globalStatePDA);
        // @ts-ignore - TypeScript cannot validate the fields properly with the IDL format we have
        if (globalState.vault) {
          // @ts-ignore
          console.log("Found vault address from GlobalState:", globalState.vault.toString());
          // @ts-ignore
          return globalState.vault;
        }
      } catch (e) {
        console.warn("Could not parse GlobalState account:", e);
      }
    }
    
    // As a fallback, use the verified vault address from constants
    console.log("Using verified vault address from constants:", VERIFIED_VAULT_ADDRESS.toString());
    return VERIFIED_VAULT_ADDRESS;
  } catch (error) {
    console.error("Error determining vault address:", error);
    // In case of any errors, use the verified address from constants
    return VERIFIED_VAULT_ADDRESS;
  }
};

// Create an Anchor provider from a wallet
export const createAnchorProvider = (
  connection: Connection,
  wallet: { publicKey: PublicKey; signTransaction: any }
) => {
  const provider = new anchor.AnchorProvider(
    connection,
    wallet as any,
    {
      preflightCommitment: 'processed',
    }
  );
  return provider;
};

// Get Anchor program instance
export const getStakingProgram = (
  connection: Connection,
  wallet: { publicKey: PublicKey; signTransaction: any }
) => {
  const provider = createAnchorProvider(connection, wallet);
  const program = new anchor.Program(
    StakingIDL as any,
    new PublicKey(PROGRAM_ID),
    provider
  );
  return program;
};

// Convert amount with proper decimal precision
export const toTokenAmount = (amount: number): BN => {
  return new BN(amount * Math.pow(10, DECIMALS));
};

// Parse token amount from raw amount
export const fromTokenAmount = (amount: BN): number => {
  return amount.toNumber() / Math.pow(10, DECIMALS);
};

// Get user stake info - updated for referral staking contract
export const getUserStakeInfo = async (
  connection: Connection,
  wallet: { publicKey: PublicKey; signTransaction: any }
) => {
  try {
    const program = getStakingProgram(connection, wallet);
    const userInfoAccount = findUserStakeInfoAccount(wallet.publicKey);
    
    // The contract uses UserInfo rather than UserStakeInfo
    const userInfo = await program.account.userInfo.fetch(userInfoAccount);
    
    // Map from the contract's UserInfo to our frontend model
    return {
      owner: userInfo.owner.toString(),
      amountStaked: fromTokenAmount(userInfo.stakedAmount), // note stakedAmount not amountStaked
      rewardsEarned: fromTokenAmount(userInfo.rewards), // note rewards not rewardsEarned
      lastStakeTimestamp: userInfo.lastStakeTime.toNumber(), // note lastStakeTime not lastStakeTimestamp
      lastClaimTimestamp: userInfo.lastClaimTime.toNumber(), // note lastClaimTime not lastClaimTimestamp
      referrer: userInfo.referrer ? userInfo.referrer.toString() : null,
      referralCount: userInfo.referralCount.toNumber(),
      totalReferralRewards: fromTokenAmount(userInfo.totalReferralRewards),
      bump: userInfo.bump
    };
  } catch (error) {
    console.error('Error fetching user stake info:', error);
    // User account may not exist yet, which is normal
    return {
      owner: wallet.publicKey.toString(),
      amountStaked: 0,
      rewardsEarned: 0,
      lastStakeTimestamp: 0,
      lastClaimTimestamp: 0,
      referrer: null,
      referralCount: 0,
      totalReferralRewards: 0,
      bump: 0
    };
  }
};