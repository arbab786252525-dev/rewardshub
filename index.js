const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

// Initialize Firebase Admin (Make sure your service account JSON or default credentials are set up)
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());

// 1. Postback Endpoint (For external traffic/offers sync)
app.get('/postback', async (req, res) => {
  const { userid, reward, key } = req.query;

  // Security Key Check
  if (key !== "YOUR_SECRET_POSTBACK_KEY") {
    return res.status(403).json({ error: "Unauthorized: Invalid secret key" });
  }

  const rewardAmount = parseFloat(reward);
  if (!userid || isNaN(rewardAmount)) {
    return res.status(400).json({ error: "Invalid parameters (userid or reward missing)" });
  }

  try {
    const userRef = db.collection('users').doc(userid);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("User not found in database");
      }

      const userData = userDoc.data();
      const currentBalance = userData.availableBalance || 0;
      const currentTotal = userData.totalEarnings || 0;

      // Update user balance
      transaction.update(userRef, {
        availableBalance: currentBalance + rewardAmount,
        totalEarnings: currentTotal + rewardAmount
      });

      // Record transaction in wallet ledger
      const txRef = db.collection('transactions').doc();
      transaction.set(txRef, {
        userId: userid,
        type: "external_postback",
        amount: rewardAmount,
        description: "Earned from external partner postback",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return res.status(200).send("OK: Balance credited successfully");
  } catch (err) {
    console.error("Postback Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Root Health Check Route
app.get('/', (req, res) => {
  res.send('Rewards Hub Backend Server is Running Live!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
