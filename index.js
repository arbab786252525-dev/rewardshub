const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

// Initialize Firebase Admin directly with credential object (No external JSON file needed)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "am-smm-panel-1146b",
      clientEmail: "firebase-adminsdk-fbsvc@am-smm-panel-1146b.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDZmBnuU0ckUG+G\nDGTUmeO9eGFCUCGfcObwah2QGevGVzHk74wfDadPH2HQX/QRnTX9ouEz+zX/5tF4\nbaxrET7BIIOhO1ZrNScPKGEqoE9K4JTDvsNtvYEjz6kIw4iyW5BUWw0jgsAqEeNu\nqqBramqqcTCse7ea50vmmoRrnY58oM9fEIKzNdvD9OZB60PHlobBzki4wybecRXb\nkmmzgmZkHRtnv3yOJDiPkGhQYLZHmoVKMz2xdqtodI/t6QPJOJ5iQHJ35rC4c+LDi\nib+g3/cUEWReJtXX1uXoUTeavyh682QntglpQ1s/O0qeBqmCaSr83whE3Zi+IJ5V\nf1xoQSQFAgMBAAECggEAApmFncpS7EUlv/U/8yZPiUD58H/ilvQTXkX2SnV00q7S\nAsk15F0WZaSbV5D96oP1VC1xAVz7/S21zPmKeNEA7e/EgtWhp7A/4jd6SbcWm29p\nd5k83n/IHjRp8Zfcdz0O0WMxGf6C6z3BeN4DAqWH1rd5fGYSAIDI8F1iPaLpQ+Xm\nS+/gSXNcsU85Rxa48oSnQrUMPRiKoFr0xgTXuznMfSAozvv1zfhDaFnWPTexnQAM\n0gvLvF+5/QIudsPzeMEofmy9jd2LV3+AuSPHGCKfpENP/J/rKtUEhEUCvFVMYed+\nXQ7CeFhTxNHcBF/XgMX/ZGvzpyBQAUU/qBxCuCu7gQKBgQD/xa5YPakTlqWhlJlk\6DjIcZZt0wEWl4ID0xzDfck18k3c1cHu0NdEhERrp8XeoepW0q6BcOtYp9wRE69Q\n44EiX6MiIg4oeevh9+/AIFKeFADCdt/c0jWc0wGTKKr9uaIpdvrFIgMhKbS4G+zq\/lGC2tEKvuXery6fDRkZz7BvZQKBgQDZybcZWd/HoWdFOo+m4sQmfePY44qSw096\nVmYMwXSbqygXNfryC5BVM53iSoBG0mSmsHISbhFzfGsSTj0zVN2idrESXfXnN4j5\n3QhuCfZe7CLcHuOmDw0QbWofl6qn6OsiUOVFOZXZliM7ymbxpUcCj3g5VEhwoalw\Sg+stn8oIQKBgCBJgw2ukvZfEP+Js6dyTSC4fgXVGhERBR+YecwPx+Ogd8XF0hpk\nkJgcnkp8vlSxWdSl+dNrPrpNTlF1i68JWRbOvdgkNmdTpLw8wS4epm9AFSx3NyE4\nA/6NAGjkPFmVImxbkaJq/bwk+KQ5Gjo76mw7VSInIPtwX9FCJQYGGr6lAoGBAMAs\nWzG2eV0pEfwnaXzEGnswmK3YUn2gc/AqbtAQoHmANNcOXcnY5FoaOtXkEX7sxb3E\clPK5gE2pzA284/o8c0a2LKxUHvfKDH6lSasCcbGrRf49b2hCFEXiw4ngYG6aEkW\ngshrwMuHzL1Eo0PVKGyc9mP3+BfSvrWD1IL9YgShAoGBAPWkqO2Scjr0BAgjJUOJ\CHcn+2QyocpsdILSfaaFelTw8fdvSdfXvhBsG9jaLjrbQzuIunbI06NkFMBLRSVt\naRH0Warw4jxc8mxPIXtoChkjUXzmUprvcXy+sL/jf1J5NKkWn08x1tqz4M0a5T68\n9DXFLd57mN/hEhhrrrRnjRdw====\n-----\n".replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());

const SECRET_KEY = "arbab_rewards_secure_key_99";

// Postback Endpoint
app.get('/postback', async (req, res) => {
  const { userid, reward, key } = req.query;

  if (key !== SECRET_KEY) {
    return res.status(403).json({ error: "Unauthorized: Invalid secret postback key" });
  }

  const rewardAmount = parseFloat(reward);
  if (!userid || isNaN(rewardAmount)) {
    return res.status(400).json({ error: "Invalid parameters: 'userid' and numeric 'reward' are required" });
  }

  try {
    const userRef = db.collection('users').doc(userid);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("User not found in Firestore database");
      }

      const userData = userDoc.data();
      const currentBalance = userData.availableBalance || 0;
      const currentTotal = userData.totalEarnings || 0;

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

    return res.status(200).send("SUCCESS: Balance credited and logged successfully.");
  } catch (err) {
    console.error("Postback Processing Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.status(200).send('Rewards Hub Backend Server is Running Live & Secure!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rewards Hub Server listening on port ${PORT}`);
});
                      
