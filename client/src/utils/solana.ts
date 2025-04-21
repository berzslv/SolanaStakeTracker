import { Connection, PublicKey, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY, SendTransactionError } from '@solana/web3.js';
import { Program, web3, BN } from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { IDL, ReferralStaking } from './idl';
import { PROGRAM_ID, TOKEN_MINT_ADDRESS } from './constants';

type SignTransaction = (transaction: Transaction) => Promise<Transaction>;

export async function getStakingAccounts(walletPublicKey: PublicKey, connection: Connection) {
  const program = new Program<ReferralStaking>(
    IDL,
    PROGRAM_ID,
    { connection }
  );

  // Derive global state PDA
  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from('global_state')],
    program.programId
  );

  // Derive user info PDA
  const [userInfo] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_info'), walletPublicKey.toBuffer()],
    program.programId
  );

  // Derive vault PDA
  const tokenMint = new PublicKey(TOKEN_MINT_ADDRESS);
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), tokenMint.toBuffer()],
    program.programId
  );

  return {
    globalState,
    userInfo,
    vault
  };
}

export async function getOrCreateUserInfo(
  walletPublicKey: PublicKey,
  connection: Connection,
  signTransaction: SignTransaction
) {
  const { userInfo, globalState } = await getStakingAccounts(walletPublicKey, connection);
  
  // Check if user info account exists
  const userInfoAccount = await connection.getAccountInfo(userInfo);
  
  if (!userInfoAccount) {
    // User info account doesn't exist, create it
    const program = new Program<ReferralStaking>(
      IDL,
      PROGRAM_ID,
      { connection }
    );
    
    // Create register user transaction
    const transaction = new Transaction();
    transaction.add(
      program.instruction.registerUser(
        null, // No referrer for now
        {
          accounts: {
            owner: walletPublicKey,
            userInfo,
            globalState,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY
          }
        }
      )
    );
    
    // Sign and send transaction
    const signedTx = await signTransaction(transaction);
    const txid = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    await connection.confirmTransaction(txid, 'confirmed');
  }
  
  return { userInfo, globalState };
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
