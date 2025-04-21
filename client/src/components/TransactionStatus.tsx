import { useTransactionStatus } from "@/contexts/TransactionContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { SOLSCAN_URL } from "@/utils/constants";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function TransactionStatus() {
  const { transaction, clearTransactionStatus } = useTransactionStatus();
  const [showDismiss, setShowDismiss] = useState(false);
  
  // Auto-hide successful transactions after 15 seconds
  useEffect(() => {
    if (transaction?.status === 'success') {
      const timer = setTimeout(() => {
        setShowDismiss(true);
      }, 5000);
      
      const hideTimer = setTimeout(() => {
        clearTransactionStatus();
      }, 15000);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(hideTimer);
      };
    }
  }, [transaction, clearTransactionStatus]);
  
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
    <div className="mt-4">
      <Alert className={className}>
        <div className="flex items-start">
          <div className="mr-2 mt-0.5 flex-shrink-0">
            {icon}
          </div>
          <div className="flex-grow">
            <AlertTitle className="mb-1">{title}</AlertTitle>
            <AlertDescription className="text-sm">
              {transaction.message}
              
              {transaction.signature && (
                <div className="mt-2 flex items-center space-x-4">
                  <a 
                    href={`${SOLSCAN_URL}/tx/${transaction.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-xs hover:underline font-medium"
                  >
                    View on Solscan <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                  
                  {showDismiss && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearTransactionStatus}
                      className="text-xs h-6 px-2"
                    >
                      Dismiss
                    </Button>
                  )}
                </div>
              )}
            </AlertDescription>
          </div>
          
          {transaction.status === 'error' && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearTransactionStatus}
              className="h-6 ml-2 px-2"
            >
              ×
            </Button>
          )}
        </div>
      </Alert>
    </div>
  );
}