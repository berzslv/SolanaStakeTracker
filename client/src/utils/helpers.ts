import { PublicKey } from '@solana/web3.js';
import { SOLSCAN_URL } from './constants';

export function formatAddress(address: string): string {
  if (!address) return '';
  const start = address.slice(0, 4);
  const end = address.slice(-4);
  return `${start}...${end}`;
}

export function formatAmount(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function buildSolscanUrl(signature: string): string {
  return `${SOLSCAN_URL}/tx/${signature}`;
}

export function getYear(): number {
  return new Date().getFullYear();
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
}
