import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import { TransactionProvider } from "./contexts/TransactionContext";
import { WalletProvider } from "./components/WalletProvider";
import WalletModal from "./components/WalletModal";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <TransactionProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <WalletModal />
          </TooltipProvider>
        </TransactionProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App;
