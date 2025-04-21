import { useTransactionStatus } from "@/contexts/TransactionContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { SOLSCAN_URL } from "@/utils/constants";

export default function TransactionStatus() {
  const { transaction } = useTransactionStatus();
  
  if (!transaction || !transaction.message) {
    return null;
  }
  
  let icon = null;
  let className = "";
  let title = "Transaction Processing";
  
  if (transaction.status === 'success') {
    icon = <CheckCircle className="h-5 w-5" />;
    className = "border-green-500 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400";
    title = "Transaction Successful";
  } else if (transaction.status === 'error') {
    icon = <AlertCircle className="h-5 w-5" />;
    className = "border-red-500 text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400";
    title = "Transaction Failed";
  } else {
    icon = <Loader2 className="h-5 w-5 animate-spin" />;
    className = "border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400";
  }
  
  return (
    <Alert className={className}>
      <div className="flex items-start">
        <div className="mr-2 mt-0.5">
          {icon}
        </div>
        <div>
          <AlertTitle className="mb-1">{title}</AlertTitle>
          <AlertDescription className="text-sm">
            {transaction.message}
            
            {transaction.signature && (
              <div className="mt-2">
                <a 
                  href={`${SOLSCAN_URL}/tx/${transaction.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline text-xs"
                >
                  View on Solscan
                </a>
              </div>
            )}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}