import { useContext } from "react";
import { WalletContext, WalletModalContext } from "@/components/WalletProvider";
import { Button } from "@/components/ui/button";

export default function WalletModal() {
  const { visible, setVisible } = useContext(WalletModalContext);
  const { connect } = useContext(WalletContext);

  if (!visible) return null;

  const handleConnect = async () => {
    try {
      await connect();
      setVisible(false);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  const handleClose = () => {
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Connect Wallet</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="py-4">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Connect with your Phantom wallet to start staking tokens.
          </p>
          
          <Button 
            onClick={handleConnect}
            className="w-full flex items-center justify-center space-x-2 bg-[#AB9FF2] hover:bg-[#9D8CE4] text-white"
          >
            <svg className="h-6 w-6" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="128" height="128" rx="64" fill="#AB9FF2"/>
              <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 22.8057 56.9951 22.8057C34.6943 22.8057 16.2411 40.3836 15.0589 62.8931C13.8156 86.5629 32.642 106.109 56.032 106.109H60.6839C83.4444 106.109 109.533 87.9497 113.26 65.8662C113.772 62.8243 111.388 60.6491 108.249 60.6491C105.258 60.6491 106.62 64.9142 106.62 64.9142" fill="white"/>
              <path d="M90.9191 64.9142H99.1419C99.1419 41.7651 80.1728 22.8057 56.9949 22.8057V39.0294C71.1367 39.0294 90.9191 46.6241 90.9191 64.9142Z" fill="#472F00" fillOpacity="0.15"/>
              <path d="M56.9954 39.0291V22.8057C33.8174 22.8057 14.8486 41.765 14.8486 64.9141H31.0677C31.0677 53.6405 39.9588 39.0291 56.9954 39.0291Z" fill="#191A1C" fillOpacity="0.1"/>
            </svg>
            <span>Connect with Phantom</span>
          </Button>
        </div>
        
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          <p>By connecting your wallet, you agree to the Terms of Service and Privacy Policy.</p>
        </div>
      </div>
    </div>
  );
}