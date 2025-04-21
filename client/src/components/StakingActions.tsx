import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useStaking } from "@/hooks/useStaking";
import { useToast } from "@/hooks/use-toast";
import { useTransactionStatus } from "@/contexts/TransactionContext";

export default function StakingActions() {
  const [stakeAmount, setStakeAmount] = useState<string>("");
  const [unstakeAmount, setUnstakeAmount] = useState<string>("");
  const { tokenBalance, stakedAmount, stake, unstake, isProcessing } = useStaking();
  const { toast } = useToast();
  const { setTransactionStatus } = useTransactionStatus();

  const handleStakeMaxClick = () => {
    setStakeAmount(tokenBalance.toString());
  };

  const handleUnstakeMaxClick = () => {
    setUnstakeAmount(stakedAmount.toString());
  };

  const handleStakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to stake",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(stakeAmount) > tokenBalance) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough tokens to stake this amount",
        variant: "destructive",
      });
      return;
    }

    try {
      const signature = await stake(parseFloat(stakeAmount));
      if (signature) {
        setStakeAmount("");
        setTransactionStatus({
          status: "success", 
          message: `Successfully staked ${parseFloat(stakeAmount).toFixed(2)} HATM tokens`,
          signature
        });
      }
    } catch (error: any) {
      setTransactionStatus({
        status: "error",
        message: error.message || "Failed to stake tokens",
        signature: null
      });
    }
  };

  const handleUnstakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to unstake",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(unstakeAmount) > stakedAmount) {
      toast({
        title: "Insufficient staked amount",
        description: "You don't have enough staked tokens to unstake this amount",
        variant: "destructive",
      });
      return;
    }

    try {
      const signature = await unstake(parseFloat(unstakeAmount));
      if (signature) {
        setUnstakeAmount("");
        setTransactionStatus({
          status: "success", 
          message: `Successfully unstaked ${parseFloat(unstakeAmount).toFixed(2)} HATM tokens`,
          signature
        });
      }
    } catch (error: any) {
      setTransactionStatus({
        status: "error",
        message: error.message || "Failed to unstake tokens",
        signature: null
      });
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Stake Form */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Stake Tokens</h3>
          <form onSubmit={handleStakeSubmit}>
            <div className="mb-4">
              <label htmlFor="stake-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount to Stake
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <Input
                  id="stake-amount"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  className="pr-16"
                  disabled={isProcessing}
                />
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleStakeMaxClick}
                    className="text-xs bg-primary/10 hover:bg-primary/20 text-primary font-medium rounded px-2 py-1 mr-2 h-auto"
                    disabled={isProcessing}
                  >
                    MAX
                  </Button>
                  <span className="text-gray-500 dark:text-gray-400 mr-3">HATM</span>
                </div>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Stake Tokens"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Unstake Form */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Unstake Tokens</h3>
          <form onSubmit={handleUnstakeSubmit}>
            <div className="mb-4">
              <label htmlFor="unstake-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount to Unstake
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <Input
                  id="unstake-amount"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  className="pr-16"
                  disabled={isProcessing}
                />
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleUnstakeMaxClick}
                    className="text-xs bg-primary/10 hover:bg-primary/20 text-primary font-medium rounded px-2 py-1 mr-2 h-auto"
                    disabled={isProcessing}
                  >
                    MAX
                  </Button>
                  <span className="text-gray-500 dark:text-gray-400 mr-3">HATM</span>
                </div>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Unstake Tokens"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
