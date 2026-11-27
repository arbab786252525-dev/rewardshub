const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

// Simple and clean initialization using default environment credentials
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: "am-smm-panel-1146b"
  });
}

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());

// Secret Postback Key
const SECRET_KEY = "arbab_rewards_secure_key_99";

// 1. Postback Endpoint (Handles external task rewards & balance updates)
app.get('/postback', async (req, res) => {
  const { userid, reward, key } = req.query;

  // Security Verification
  if (key !== SECRET_KEY) {
    return res.status(403).json({ error: "Unauthorized: Invalid secret postback key" });
  }

  const rewardAmount = parseFloat(reward);
  if (!userid || isNaN(rewardAmount)) {
    return res.status(400).json({ error: "Invalid parameters: 'userid' and numeric 'reward' are required" });
  }

  try {
    const userRef = db.collection('users').doc(userid);

    // Run transaction to safely update balance and record ledger entry
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("User not found in Firestore database");
      }

      const userData = userDoc.data();
      const currentBalance = userData.availableBalance || 0;
      const currentTotal = userData.totalEarnings || 0;

      // Update balances
      transaction.update(userRef, {
        availableBalance: currentBalance + rewardAmount,
        totalEarnings: currentTotal + rewardAmount,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      // Record transaction in wallet ledger
      const txRef = db.collection('transactions').doc();
      transaction.set(txRef, {
        userId: userid,
        type: "external_postback",
        amount: rewardAmount,
        description: "Earned via external postback offer/task",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return res.status(200).send("SUCCESS: Balance credited and logged successfully.");
  } catch (err) {
    console.error("Postback Processing Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 2. Health Check Route
app.get('/', (req, res) => {
  res.status(200).send('Rewards Hub Backend Server is Running Live & Secure!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rewards Hub Server listening on port ${PORT}`);
});
      
