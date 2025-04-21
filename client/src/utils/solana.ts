import { Connection, PublicKey, Transaction, SendTransactionError } from '@solana/web3.js';
import { TOKEN_MINT_ADDRESS } from './constants';

type SignTransaction = (transaction: Transaction) => Promise<Transaction>;

// Helper function that mocks getting staking accounts
export async function getStakingAccounts(walletPublicKey: PublicKey, connection: Connection) {
  // In a real implementation, we would derive these PDAs correctly
  // For the current implementation, we'll use mock addresses
  const globalState = new PublicKey("11111111111111111111111111111111");
  const userInfo = new PublicKey("11111111111111111111111111111111");
  const vault = new PublicKey("11111111111111111111111111111111");

  return {
    globalState,
    userInfo,
    vault
  };
}

export async function transferTransaction(
  transaction: Transaction,
  connection: Connection,
  signTransaction: SignTransaction
): Promise<string> {
  try {
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = transaction.feePayer || new PublicKey(transaction.signatures[0].publicKey);
    
    const signedTransaction = await signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
  } catch (error) {
    if (error instanceof SendTransactionError) {
      throw new Error(`Transaction error: ${error.message}`);
    }
    throw error;
  }
}
