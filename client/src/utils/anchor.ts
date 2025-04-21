import * as anchor from '@project-serum/anchor';
import { 
  PublicKey, 
  Connection, 
  TransactionInstruction, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY 
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from 'bn.js';
import { PROGRAM_ID, TOKEN_MINT_ADDRESS } from './constants';

// IDL for the staking program
export const StakingIDL = {
  "version": "0.1.0",
  "name": "simple_staking",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        { "name": "authority", "isMut": true, "isSigner": true },
        { "name": "vault", "isMut": true, "isSigner": false },
        { "name": "vaultAuthority", "isMut": false, "isSigner": false },
        { "name": "tokenMint", "isMut": false, "isSigner": false },
        { "name": "tokenVault", "isMut": false, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false },
        { "name": "rent", "isMut": false, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "registerUser",
      "accounts": [
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "userInfo", "isMut": true, "isSigner": false },
        { "name": "vault", "isMut": false, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false },
        { "name": "rent", "isMut": false, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "stake",
      "accounts": [
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "userInfo", "isMut": true, "isSigner": false },
        { "name": "vault", "isMut": false, "isSigner": false },
        { "name": "userTokenAccount", "isMut": true, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "unstake",
      "accounts": [
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "userInfo", "isMut": true, "isSigner": false },
        { "name": "vault", "isMut": false, "isSigner": false },
        { "name": "vaultAuthority", "isMut": false, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "userTokenAccount", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    }
  ],
  "accounts": [
    {
      "name": "StakingVault",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "publicKey" },
          { "name": "tokenMint", "type": "publicKey" },
          { "name": "tokenVault", "type": "publicKey" },
          { "name": "bump", "type": "u8" },
          { "name": "vaultBump", "type": "u8" }
        ]
      }
    },
    {
      "name": "UserStakeInfo",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "owner", "type": "publicKey" },
          { "name": "amountStaked", "type": "u64" },
          { "name": "rewardsEarned", "type": "u64" },
          { "name": "lastStakeTimestamp", "type": "i64" },
          { "name": "lastClaimTimestamp", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ],
  "errors": [
    { "code": 6000, "name": "InsufficientStake", "msg": "Insufficient staked tokens" }
  ]
};

// DECIMAL precision for token amounts
const DECIMALS = 9;

// Find the staking vault PDA
export const findStakingVault = async () => {
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    new PublicKey(PROGRAM_ID)
  );
  return vaultPDA;
};

// Find the vault authority PDA
export const findVaultAuthority = async () => {
  const [vaultAuthorityPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault')],
    new PublicKey(PROGRAM_ID)
  );
  return vaultAuthorityPDA;
};

// Find the user's stake info account
export const findUserStakeInfoAccount = (walletPublicKey: PublicKey) => {
  const [userInfoPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('user'), walletPublicKey.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
  return userInfoPDA;
};

// Find the token vault account - this is the program's token account
export const findTokenVaultAccount = async () => {
  const tokenMint = new PublicKey(TOKEN_MINT_ADDRESS);
  
  // The vault token account is derived from the program ID and token mint
  const [tokenVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_token_account'), tokenMint.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
  return tokenVaultPDA;
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

// Get user stake info
export const getUserStakeInfo = async (
  connection: Connection,
  wallet: { publicKey: PublicKey; signTransaction: any }
) => {
  try {
    const program = getStakingProgram(connection, wallet);
    const userInfoAccount = findUserStakeInfoAccount(wallet.publicKey);
    
    const userInfo = await program.account.userStakeInfo.fetch(userInfoAccount);
    
    return {
      owner: userInfo.owner.toString(),
      amountStaked: fromTokenAmount(userInfo.amountStaked),
      rewardsEarned: fromTokenAmount(userInfo.rewardsEarned),
      lastStakeTimestamp: userInfo.lastStakeTimestamp.toNumber(),
      lastClaimTimestamp: userInfo.lastClaimTimestamp.toNumber(),
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
      bump: 0
    };
  }
};