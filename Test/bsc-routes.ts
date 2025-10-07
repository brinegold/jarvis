import { Express } from "express";
import BSCService from "./bsc-service";
import { storage } from "./storage";
import { db } from "./db";
import { transactions, users } from "@shared/schema";
import { sendDepositNotification, sendWithdrawalNotification } from "./auth";

const BSC_CONFIG = {
  rpcUrl: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
  contractAddress: process.env.PAYMENT_CONTRACT_ADDRESS || "",
  usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS || "0x7C5FCE4f6aF59eCd7a557Fa9a7812Eaf0A4E42cb",
  adminFeeWallet: process.env.ADMIN_FEE_WALLET || "",
  globalAdminWallet: process.env.GLOBAL_ADMIN_WALLET || "",
  privateKey: process.env.BSC_PRIVATE_KEY || ""
};

export function registerBSCRoutes(app: Express) {
  const bscService = new BSCService(BSC_CONFIG);

  // Get user's unique BSC wallet address
  app.get("/api/bsc/wallet", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).send("User not found");

      // Generate or retrieve user's BSC wallet
      let walletAddress = user.bscWalletAddress;
      
      if (!walletAddress) {
        const wallet = bscService.generateUserWallet(user.id);
        walletAddress = wallet.address;
        
        // Store wallet address (not private key for security)
        await storage.updateUser(req.user!.id, {
          bscWalletAddress: walletAddress
        });
      }

      res.json({
        address: walletAddress,
        walletAddress,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${walletAddress}`,
        network: "BSC (Binance Smart Chain)",
        tokenContract: BSC_CONFIG.usdtContractAddress
      });
    } catch (error) {
      console.error("Error getting BSC wallet:", error);
      res.status(500).json({ error: "Failed to get wallet address" });
    }
  });

  // Process deposit with transaction hash verification
  app.post("/api/bsc/deposit", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const { txHash } = req.body; // Remove amount from destructuring - we'll get it from blockchain
      const user = await storage.getUser(req.user!.id);
      
      if (!user) return res.status(404).send("User not found");
      if (!user.bscWalletAddress) return res.status(400).json({ error: "No BSC wallet found" });

      // Verify transaction hash and extract actual transfer amount
      const txDetails = await bscService.verifyTransaction(txHash);
      
      // Debug transaction details
      console.log("Transaction details:", {
        txHash,
        from: txDetails.from,
        to: txDetails.to,
        actualRecipient: txDetails.actualRecipient,
        usdtTransferAmount: txDetails.usdtTransferAmount,
        userBscWallet: user.bscWalletAddress
      });

      // Validate that this is a USDT transfer to the user's wallet
      if (txDetails.to.toLowerCase() === BSC_CONFIG.usdtContractAddress.toLowerCase()) {
        // This is a USDT token transfer - verify the recipient matches user's wallet
        if (!txDetails.actualRecipient || txDetails.actualRecipient.toLowerCase() !== user.bscWalletAddress.toLowerCase()) {
          return res.status(400).json({ 
            error: `USDT transfer not sent to your wallet. Expected: ${user.bscWalletAddress}, Got: ${txDetails.actualRecipient || 'unknown'}` 
          });
        }
        
        // Verify that USDT was actually transferred
        if (!txDetails.usdtTransferAmount || parseFloat(txDetails.usdtTransferAmount) <= 0) {
          return res.status(400).json({ 
            error: "No USDT transfer found in this transaction" 
          });
        }
      } else if (user.bscWalletAddress && txDetails.to.toLowerCase() !== user.bscWalletAddress.toLowerCase()) {
        return res.status(400).json({ 
          error: `Transaction not sent to your wallet. Expected: ${user.bscWalletAddress}, Got: ${txDetails.to}` 
        });
      }

      // Check if transaction already processed
      const existingTx = await storage.getTransactionByHash(txHash);
      if (existingTx) {
        return res.status(400).json({ error: "Transaction already processed" });
      }

      // Use the actual transfer amount from blockchain, not user input
      const depositAmount = parseFloat(txDetails.usdtTransferAmount);
      
      // Note: Minimum amount validation is now handled in BSC service during transaction verification
      // This prevents processing transactions below $5 USDT before expensive blockchain operations
      
      // Calculate amounts (2% fee, 98% to user)
      const adminFee = depositAmount * 0.02;
      const userAmount = depositAmount * 0.98;

      console.log("Processing deposit:", {
        originalAmount: depositAmount,
        adminFee,
        userAmount,
        userId: user.id
      });

      // For now, we'll skip the automatic transfer and just record the deposit
      // The admin can manually collect tokens later or we can implement a batch collection system
      console.log("Deposit verified and recorded. Tokens remain in user wallet for now.");
      
      // Optional: Try to collect tokens, but don't fail if it doesn't work
      let transferHashes = null;
      let userWallet = null;
      try {
        // Check if user wallet has sufficient balance and BNB for gas
        userWallet = bscService.generateUserWallet(user.id);
        const usdtBalance = await bscService.getUSDTBalance(userWallet.address);
        console.log(`User wallet ${userWallet.address} USDT balance: ${usdtBalance}`);
        
        // Optional: Try to collect tokens from user wallet to admin wallets
        try {
          const result = await bscService.collectDepositTokensFromUser(
            user.id, 
            depositAmount.toString(), 
            adminFee.toString()
          );
          console.log('Token collection successful:', result);
        } catch (collectionError) {
          console.log('Token collection failed (optional):', collectionError.message);
          // Continue without failing - deposit is still valid
        }

        // Send deposit notification email
        try {
          await sendDepositNotification(user, depositAmount.toString(), txHash);
        } catch (emailError) {
          console.error('Failed to send deposit notification email:', emailError);
          // Don't fail the deposit if email fails
        }

        console.log('Token collection successful for deposit');
      } catch (transferError) {
        console.warn("Could not automatically collect tokens from user wallet:", transferError instanceof Error ? transferError.message : String(transferError));
        // Continue with deposit processing even if collection fails
      }

      // Handle multi-tier referral commissions for BSC deposits BEFORE creating deposit transaction
      console.log(`Checking referral commissions for user ${user.id}...`);
      const referrals = await storage.getReferralsByReferredId(user.id);
      console.log(`Found ${referrals.length} referral relationships for user ${user.id}:`, referrals);
      
      if (referrals.length > 0) {
        console.log(`Processing referral commissions for user ${user.id} on all deposits...`);
        // Commission rates for each tier
        const tierCommissionRates = {
          "1": 0.10, // 10% for Tier 1
          "2": 0.05, // 5% for Tier 2
          "3": 0.03, // 3% for Tier 3
          "4": 0.02, // 2% for Tier 4
        };

        // Process commissions for all tiers
        for (const referral of referrals) {
          const referrer = await storage.getUser(referral.referrerId);
          if (referrer) {
            let commissionRate = tierCommissionRates[referral.level] || 0;
            const commissionAmount = userAmount * commissionRate;

            if (commissionAmount > 0) {
              // Update referrer's assets with commission
              await storage.updateUser(referrer.id, {
                commissionAssets: (
                  parseFloat(referrer.commissionAssets.toString()) +
                  commissionAmount
                ).toString(),
                commissionToday: (
                  parseFloat(referrer.commissionToday.toString()) +
                  commissionAmount
                ).toString(),
                withdrawableAmount: (
                  parseFloat(referrer.withdrawableAmount.toString()) +
                  commissionAmount
                ).toString(),
              });

              // Update referral commission record
              const currentCommission = parseFloat(
                referral.commission || "0",
              );
              await storage.updateReferral(referral.id, {
                commission: (currentCommission + commissionAmount).toString(),
              });

              // Create commission transaction
              await storage.createTransaction({
                userId: referrer.id,
                type: "Commission",
                amount: commissionAmount.toString(),
                status: "Completed",
                reason: `Tier ${referral.level} referral commission from BSC deposit by ${user.username || user.email}`,
                txHash: null,
              });

              console.log(`Paid ${commissionAmount.toFixed(2)} USDT commission to referrer ${referrer.id} (Tier ${referral.level})`);
            }
          }
        }
      } else {
        console.log(`No referral relationships found for user ${user.id} - no commission to pay`);
      }

      // Create deposit transaction record AFTER commission processing
      await storage.createTransaction({
        userId: user.id,
        type: "Deposit",
        amount: userAmount.toString(),
        status: "Completed",
        txHash: txHash, // Use original transaction hash
        fromAddress: txDetails.from,
        toAddress: txDetails.to,
        blockNumber: txDetails.blockNumber,
        confirmationStatus: "confirmed",
        reason: `BSC testnet deposit - TX: ${txHash}`
      });

      // Create admin fee transaction record (only if tokens were actually transferred)
      if (transferHashes && userWallet) {
        await storage.createTransaction({
          userId: user.id,
          type: "Admin Fee",
          amount: adminFee.toString(),
          status: "Completed",
          txHash: transferHashes.adminFeeTxHash,
          fromAddress: userWallet.address,
          toAddress: BSC_CONFIG.adminFeeWallet,
          blockNumber: txDetails.blockNumber,
          confirmationStatus: "confirmed",
          reason: `Admin fee for deposit - Original TX: ${txHash}`
        });
      }

      // Return remaining BNB to global admin wallet after deposit processing
      if (userWallet) {
        try {
          console.log(`Checking remaining BNB balance for user ${user.id} wallet ${userWallet.address}...`);
          const remainingBnbBalance = await bscService.getBNBBalance(userWallet.address);
          console.log(`User ${user.id} remaining BNB balance: ${remainingBnbBalance}`);
          
          if (remainingBnbBalance > 0.0001) { // Only transfer if more than 0.0001 BNB (to cover gas)
            console.log(`Returning ${remainingBnbBalance} BNB from user ${user.id} wallet to global admin wallet...`);
            const bnbReturnResult = await bscService.collectAllBNBFromUser(user.id);
            
            if (bnbReturnResult) {
              console.log(`Successfully returned ${bnbReturnResult.amount} BNB to global admin wallet. TX: ${bnbReturnResult.txHash}`);
            } else {
              console.log(`No BNB to return from user ${user.id} wallet`);
            }
          } else {
            console.log(`User ${user.id} BNB balance too low (${remainingBnbBalance}) - not returning to admin`);
          }
        } catch (bnbReturnError) {
          console.warn(`Failed to return BNB from user ${user.id} wallet:`, bnbReturnError.message);
          // Don't fail the deposit if BNB return fails
        }
      }

      // Update user balance
      const currentTotalAssets = parseFloat(user.totalAssets.toString());
      const currentRechargeAmount = parseFloat(user.rechargeAmount.toString());
      
      await storage.updateUser(user.id, {
        totalAssets: (currentTotalAssets + userAmount).toString(),
        rechargeAmount: (currentRechargeAmount + userAmount).toString()
      });

      console.log("Deposit completed successfully:", {
        newTotalAssets: currentTotalAssets + userAmount,
        newRechargeAmount: currentRechargeAmount + userAmount
      });

      // Send deposit notification email
      try {
        await sendDepositNotification(user, userAmount.toString(), txHash);
      } catch (emailError) {
        console.error('Failed to send deposit notification email:', emailError);
        // Don't fail the deposit if email fails
      }

      res.json({
        success: true,
        message: "Deposit processed successfully",
        amount: userAmount,
        fee: adminFee,
        txHash: txHash
      });

    } catch (error) {
      console.error("Error processing BSC deposit:", error);
      res.status(500).json({ error: "Failed to process deposit" });
    }
  });

  // Create withdrawal request (requires admin approval)
  app.post("/api/bsc/withdraw", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const { amount, walletAddress } = req.body;
      
      console.log("Withdrawal request received:", {
        amount,
        walletAddress,
        requestBody: req.body
      });
      
      if (!walletAddress) {
        return res.status(400).json({ error: "Wallet address is required" });
      }
      
      const user = await storage.getUser(req.user!.id);
      
      if (!user) return res.status(404).send("User not found");

      const withdrawAmount = parseFloat(amount);
      const userBalance = parseFloat(user.withdrawableAmount.toString());

      // Verify user has sufficient balance
      if (withdrawAmount > userBalance) {
        return res.status(400).json({ error: "Insufficient balance" });
      }


      // Calculate amounts: 5% withdrawal fee + $1 gas fee deducted from requested amount
      const gasFee = 1.0; // Fixed $1 gas fee (deducted from requested amount)
      const withdrawalFee = withdrawAmount * 0.05;
      const netAmount = withdrawAmount - withdrawalFee - gasFee; // Deduct both fees from requested amount

      console.log("Creating withdrawal request:", {
        requestedAmount: withdrawAmount,
        withdrawalFee,
        gasFee,
        netAmount,
        userId: user.id,
        toAddress: walletAddress
      });

      // Create pending withdrawal transaction record
      const withdrawalTransaction = await storage.createTransaction({
        userId: user.id,
        type: "Withdrawal",
        amount: netAmount.toString(),
        status: "Pending",
        txHash: null,
        address: walletAddress,
        reason: `BSC withdrawal request to ${walletAddress} - Awaiting admin approval`
      });
      
      console.log("Created withdrawal transaction:", {
        id: withdrawalTransaction.id,
        address: withdrawalTransaction.address,
        amount: withdrawalTransaction.amount
      });

      // Create withdrawal fee transaction record (also pending)
      await storage.createTransaction({
        userId: user.id,
        type: "Withdrawal Fee",
        amount: withdrawalFee.toString(),
        status: "Pending",
        txHash: null,
        address: BSC_CONFIG.adminFeeWallet,
        reason: `5% withdrawal fee - Awaiting admin approval`
      });

      // Create gas fee transaction record (also pending)
      await storage.createTransaction({
        userId: user.id,
        type: "Gas Fee",
        amount: gasFee.toString(),
        status: "Pending",
        txHash: null,
        address: "Network",
        reason: `BSC network gas fee - Awaiting admin approval`
      });

      console.log("Withdrawal request created successfully - awaiting admin approval");

      res.json({
        success: true,
        message: "Withdrawal request submitted successfully. Please wait for admin approval.",
        requestedAmount: withdrawAmount,
        netAmount,
        withdrawalFee,
        gasFee,
        status: "pending"
      });

    } catch (error) {
      console.error("Error creating withdrawal request:", error);
      res.status(500).json({ error: "Failed to create withdrawal request" });
    }
  });

  // Get transaction status
  app.get("/api/bsc/transaction/:txHash", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const { txHash } = req.params;
      const txDetails = await bscService.verifyTransaction(txHash);
      
      res.json({
        hash: txHash,
        confirmed: txDetails.confirmed,
        blockNumber: txDetails.blockNumber,
        from: txDetails.from,
        to: txDetails.to,
        value: txDetails.value
      });
    } catch (error) {
      console.error("Error getting transaction status:", error);
      res.status(500).json({ error: "Failed to get transaction status" });
    }
  });

  // Monitor deposits endpoint (for admin use)
  app.post("/api/bsc/monitor-deposits", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    // This would be restricted to admin users
    try {
      const users = await storage.getAllUsers();
      const userAddresses = users
        .filter(user => user.bscWalletAddress)
        .map(user => user.bscWalletAddress!.toLowerCase());

      await bscService.monitorDeposits(userAddresses, async (tx) => {
        console.log("New deposit detected:", tx);
        // Handle automatic deposit processing here
      });

      res.json({ success: true, message: "Deposit monitoring started" });
    } catch (error) {
      console.error("Error starting deposit monitoring:", error);
      res.status(500).json({ error: "Failed to start monitoring" });
    }
  });

  // Collect USDT from user wallets (Admin only)
  app.post("/api/bsc/collect-usdt", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    try {
      const { userIds } = req.body;
      
      if (userIds && Array.isArray(userIds)) {
        // Collect from specific users
        const results = await bscService.batchCollectUSDT(userIds);
        res.json({ 
          success: true, 
          message: `Collection completed for ${userIds.length} users`,
          results 
        });
      } else {
        // Collect from all users with BSC wallets
        const users = await storage.getAllUsers();
        const allUserIds = users
          .filter(user => user.bscWalletAddress)
          .map(user => user.id);
        
        const results = await bscService.batchCollectUSDT(allUserIds);
        res.json({ 
          success: true, 
          message: `Collection completed for ${allUserIds.length} users`,
          results 
        });
      }
    } catch (error) {
      console.error("Error collecting USDT:", error);
      res.status(500).json({ error: "Failed to collect USDT" });
    }
  });

  // Collect USDT from single user wallet
  app.post("/api/bsc/collect-usdt/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    try {
      const userId = parseInt(req.params.userId);
      const result = await bscService.collectAllUSDTFromUser(userId);
      
      if (result) {
        res.json({ 
          success: true, 
          message: `Collected ${result.amount} USDT from user ${userId}`,
          txHash: result.txHash,
          amount: result.amount
        });
      } else {
        res.json({ 
          success: false, 
          message: `No USDT found in user ${userId} wallet`
        });
      }
    } catch (error) {
      console.error("Error collecting USDT from user:", error);
      res.status(500).json({ error: "Failed to collect USDT" });
    }
  });

  // Collect BNB from user wallets (Admin only)
  app.post("/api/bsc/collect-bnb", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    try {
      const { userIds } = req.body;
      
      if (userIds && Array.isArray(userIds)) {
        // Collect from specific users
        const results = await bscService.batchCollectBNB(userIds);
        res.json({ 
          success: true, 
          message: `BNB collection completed for ${userIds.length} users`,
          results 
        });
      } else {
        // Collect from all users with BSC wallets
        const users = await storage.getAllUsers();
        const allUserIds = users
          .filter(user => user.bscWalletAddress)
          .map(user => user.id);
        
        const results = await bscService.batchCollectBNB(allUserIds);
        res.json({ 
          success: true, 
          message: `BNB collection completed for ${allUserIds.length} users`,
          results 
        });
      }
    } catch (error) {
      console.error("Error collecting BNB:", error);
      res.status(500).json({ error: "Failed to collect BNB" });
    }
  });

  // Collect BNB from single user wallet
  app.post("/api/bsc/collect-bnb/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    try {
      const userId = parseInt(req.params.userId);
      const result = await bscService.collectAllBNBFromUser(userId);
      
      if (result) {
        res.json({ 
          success: true, 
          message: `Collected ${result.amount} BNB from user ${userId}`,
          txHash: result.txHash,
          amount: result.amount
        });
      } else {
        res.json({ 
          success: false, 
          message: `No collectible BNB found in user ${userId} wallet`
        });
      }
    } catch (error) {
      console.error("Error collecting BNB from user:", error);
      res.status(500).json({ error: "Failed to collect BNB" });
    }
  });
}
