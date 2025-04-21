import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useTransactionStatus } from "@/contexts/TransactionContext";
import { buildSolscanUrl } from "@/utils/helpers";

export default function TransactionStatus() {
  const { transaction } = useTransactionStatus();

  if (!transaction || !transaction.status) {
    return null;
  }

  return (
    <div className="mt-8">
      {transaction.status === "success" && (
        <Alert className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <CheckCircle className="h-5 w-5 text-green-400" />
          <AlertTitle className="text-green-800 dark:text-green-300">Transaction Successful</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-400">
            <p>{transaction.message}</p>
            {transaction.signature && (
              <div className="mt-2">
                <a
                  href={buildSolscanUrl(transaction.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 flex items-center w-fit"
                >
                  <span>View on Explorer</span>
                  <ExternalLink className="ml-1 h-4 w-4" />
                </a>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {transaction.status === "error" && (
        <Alert className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <AlertTitle className="text-red-800 dark:text-red-300">Transaction Failed</AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-400">
            <p>{transaction.message}</p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
