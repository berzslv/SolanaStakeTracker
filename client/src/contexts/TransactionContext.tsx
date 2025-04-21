import { createContext, useState, useContext, ReactNode } from 'react';

interface Transaction {
  status: 'success' | 'error' | null;
  message: string | null;
  signature: string | null;
}

interface TransactionContextType {
  transaction: Transaction | null;
  setTransactionStatus: (transaction: Transaction) => void;
  clearTransactionStatus: () => void;
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  const setTransactionStatus = (transaction: Transaction) => {
    setTransaction(transaction);
  };

  const clearTransactionStatus = () => {
    setTransaction(null);
  };

  return (
    <TransactionContext.Provider value={{ transaction, setTransactionStatus, clearTransactionStatus }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactionStatus() {
  const context = useContext(TransactionContext);
  if (context === undefined) {
    throw new Error('useTransactionStatus must be used within a TransactionProvider');
  }
  return context;
}
