import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertStakingTransactionSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  app.post('/api/wallet/connect', async (req, res) => {
    try {
      const { walletAddress } = req.body;
      
      if (!walletAddress) {
        return res.status(400).json({ message: 'Wallet address is required' });
      }
      
      // Log the wallet connection
      console.log(`Wallet connected: ${walletAddress}`);
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error connecting wallet:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/transaction/log', async (req, res) => {
    try {
      const validatedData = insertStakingTransactionSchema.parse(req.body);
      
      // Just log the transaction for now
      console.log(`Transaction logged:`, validatedData);
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error logging transaction:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
