import { useContext } from "react";
import { WalletModalContext, WalletContext } from "@/components/WalletProvider";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { formatAddress } from "@/utils/helpers";
import { useToast } from "@/hooks/use-toast";

interface WalletConnectProps {
  showFullButton?: boolean;
}

export default function WalletConnect({ showFullButton = false }: WalletConnectProps) {
  const { setVisible } = useContext(WalletModalContext);
  const { connect } = useContext(WalletContext);
  const { isConnected, walletAddress, disconnect } = useWallet();
  const { toast } = useToast();

  const handleConnect = () => {
    // Try to directly connect with Phantom
    connect().catch((error) => {
      console.error("Connection error:", error);
      // If direct connection fails, show modal
      setVisible(true);
    });
  };

  const handleDisconnect = () => {
    disconnect();
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
    });
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
        variant: "default",
      });
    }
  };

  return (
    <>
      {isConnected ? (
        <div className="flex items-center space-x-2">
          {/* Desktop wallet info */}
          <div className="hidden md:flex items-center space-x-2">
            <div className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded truncate max-w-xs">
              {formatAddress(walletAddress || "")}
            </div>
            <button
              onClick={copyAddress}
              className="text-primary hover:text-primary/80"
              title="Copy address"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5H6C4.89543 5 4 5.89543 4 7V19C4 20.1046 4.89543 21 6 21H16C17.1046 21 18 20.1046 18 19V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18 13V9C18 7.89543 17.1046 7 16 7H10C8.89543 7 8 7.89543 8 9V13C8 14.1046 8.89543 15 10 15H16C17.1046 15 18 14.1046 18 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <Button variant="destructive" size="sm" onClick={handleDisconnect} className="text-xs flex items-center">
              <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Disconnect
            </Button>
          </div>
          {/* Mobile wallet button */}
          <div className="md:hidden flex items-center">
            <Button variant="outline" size="sm" onClick={copyAddress} className="mr-2">
              {formatAddress(walletAddress || "")}
            </Button>
            <Button variant="destructive" size="icon" onClick={handleDisconnect}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
          </div>
        </div>
      ) : (
        showFullButton ? (
          <Button onClick={handleConnect} className="bg-primary hover:bg-primary/90 text-white flex items-center space-x-2">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 7H5C3.89543 7 3 7.89543 3 9V15C3 16.1046 3.89543 17 5 17H19C20.1046 17 21 16.1046 21 15V9C21 7.89543 20.1046 7 19 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 11C16 11.5523 15.5523 12 15 12C14.4477 12 14 11.5523 14 11C14 10.4477 14.4477 10 15 10C15.5523 10 16 10.4477 16 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Connect Phantom Wallet</span>
          </Button>
        ) : (
          <>
            <Button onClick={handleConnect} className="hidden md:flex bg-primary hover:bg-primary/90 text-white items-center space-x-2">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 7H5C3.89543 7 3 7.89543 3 9V15C3 16.1046 3.89543 17 5 17H19C20.1046 17 21 16.1046 21 15V9C21 7.89543 20.1046 7 19 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 11C16 11.5523 15.5523 12 15 12C14.4477 12 14 11.5523 14 11C14 10.4477 14.4477 10 15 10C15.5523 10 16 10.4477 16 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Connect Wallet</span>
            </Button>
            <Button onClick={handleConnect} className="md:hidden bg-primary hover:bg-primary/90 text-white p-2" size="icon">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 7H5C3.89543 7 3 7.89543 3 9V15C3 16.1046 3.89543 17 5 17H19C20.1046 17 21 16.1046 21 15V9C21 7.89543 20.1046 7 19 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 11C16 11.5523 15.5523 12 15 12C14.4477 12 14 11.5523 14 11C14 10.4477 14.4477 10 15 10C15.5523 10 16 10.4477 16 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
          </>
        )
      )}
    </>
  );
}
