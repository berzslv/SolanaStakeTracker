import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useWallet } from "@/hooks/useWallet";
import { useStaking } from "@/hooks/useStaking";
import { TOKEN_MINT_ADDRESS } from "@/utils/constants";
import { formatAmount } from "@/utils/helpers";

export default function BalanceDisplay() {
  const { walletAddress } = useWallet();
  const { tokenBalance, stakedAmount, refreshBalances, isLoading } = useStaking();

  useEffect(() => {
    if (walletAddress) {
      refreshBalances();
    }
  }, [walletAddress, refreshBalances]);

  const totalAmount = tokenBalance + stakedAmount;
  const stakingPercentage = totalAmount > 0 ? Math.floor((stakedAmount / totalAmount) * 100) : 0;

  return (
    <div className="mb-8">
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="mb-4 md:mb-0">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
              <svg className="h-5 w-5 mr-2 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 8V12L14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Wallet Connected
            </h2>
            <div className="mt-2 flex items-center">
              <div className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded truncate max-w-xs">
                {walletAddress}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Wallet Balance</h3>
                <div className="mt-1 flex items-baseline">
                  <span className="text-3xl font-semibold text-gray-900 dark:text-white">
                    {isLoading ? "..." : formatAmount(tokenBalance)}
                  </span>
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">HATM</span>
                </div>
              </div>
              <div className="bg-primary/10 p-2 rounded-full">
                <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 7H5C3.89543 7 3 7.89543 3 9V15C3 16.1046 3.89543 17 5 17H19C20.1046 17 21 16.1046 21 15V9C21 7.89543 20.1046 7 19 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 11C16 11.5523 15.5523 12 15 12C14.4477 12 14 11.5523 14 11C14 10.4477 14.4477 10 15 10C15.5523 10 16 10.4477 16 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Token: HATM (Hacked ATM)
            </p>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 truncate">
              Mint: {TOKEN_MINT_ADDRESS}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Staked Balance</h3>
                <div className="mt-1 flex items-baseline">
                  <span className="text-3xl font-semibold text-gray-900 dark:text-white">
                    {isLoading ? "..." : formatAmount(stakedAmount)}
                  </span>
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">HATM</span>
                </div>
              </div>
              <div className="bg-secondary/10 p-2 rounded-full">
                <svg className="h-6 w-6 text-secondary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className="relative pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold inline-block text-primary">
                      Staking Status
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold inline-block text-primary">
                      {stakingPercentage}%
                    </span>
                  </div>
                </div>
                <Progress value={stakingPercentage} className="h-2 mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
