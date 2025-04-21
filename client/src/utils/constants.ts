import { PublicKey } from '@solana/web3.js';

// Program ID from the Solana contract
export const PROGRAM_ID = new PublicKey("EnGhdovdYhHk4nsHEJr6gmV5cYfrx53ky19RD56eRRGm");

// Token mint address for the HATM token
export const TOKEN_MINT_ADDRESS = new PublicKey("6f6GFixp6dh2UeMzDZpgR84rWgHu8oQVPWfrUUV94aj4");

// Mint authority address
export const MINT_AUTHORITY_ADDRESS = new PublicKey("3pWAxBon28VsfzwnbMzVDn4SunYe371g3toDenP4VU64");

// Mint authority token account
export const MINT_AUTHORITY_TOKEN_ACCOUNT = new PublicKey("3kSMBi1a6HaHGwxHTebnAReCfmE6ziJKbU8y9vW12QUt");

// Solscan base URL
export const SOLSCAN_URL = "https://solscan.io";

// Verified vault address - from successful staking transaction
export const VERIFIED_VAULT_ADDRESS = new PublicKey("C9kigNZXbULbg1JiU9Fp5gn8Z5LDL3XNj9hSGpXFZbJY");

// Token decimals (likely 9 for HATM token based on your code)
export const DECIMALS = 9;
