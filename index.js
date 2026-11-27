
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "am-smm-panel-1146b",
      clientEmail: "firebase-adminsdk-fbsvc@am-smm-panel-1146b.iam.gserviceaccount.com",
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

// Postback Endpoint
app.get('/postback', async (req, res) => {
  const { userid, reward, key } = req.query;

  if (!process.env.POSTBACK_SECRET || key !== process.env.POSTBACK_SECRET) {
    return res.status(403).json({
      error: "Unauthorized: Invalid postback key"
    });
  }

  const rewardAmount = Number(reward);

  if (
    !userid ||
    typeof userid !== 'string' ||
    !Number.isFinite(rewardAmount) ||
    rewardAmount <= 0 ||
    rewardAmount > 10000
  ) {
    return res.status(400).json({
      error: "Invalid parameters"
    });
  }

  try {
    const userRef = db.collection('users').doc(userid);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const userData = userDoc.data();
      const currentBalance = Number(userData.availableBalance || 0);
      const currentTotal = Number(userData.totalEarnings || 0);

      if (
        !Number.isFinite(currentBalance) ||
        !Number.isFinite(currentTotal)
      ) {
        throw new Error("Invalid balance data");
      }

      transaction.update(userRef, {
        availableBalance: currentBalance + rewardAmount,
        totalEarnings: currentTotal + rewardAmount,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      const txRef = db.collection('transactions').doc();

      transaction.set(txRef, {
        userId: userid,
        type: "external_postback",
        amount: rewardAmount,
        description: "Earned via external postback offer/task",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return res.status(200).send(
      "SUCCESS: Balance credited and logged successfully."
    );

  } catch (err) {
    console.error("Postback Processing Error:", err.message);

    return res.status(500).json({
      error: "Postback processing failed"
    });
  }
});

// Root Endpoint
app.get('/', (req, res) => {
  res.status(200).send(
    'Rewards Hub Backend Server is Running Live & Secure!'
  );
});

module.exports = app;
    
