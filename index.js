const express = require("express");
const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(express.json());

/**
 * SEND INCOMING CALL FCM
 */
app.post("/send-call", async (req, res) => {
  const { fcmToken, callId, callerName, callType } = req.body;

  const message = {
    token: fcmToken,
    android: {
      priority: "high",
    },
    data: {
      type: "INCOMING_CALL",
      call_id: callId,
      caller_name: callerName,
      call_type: callType, // audio | video
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ CALL FCM SENT:", response);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ FCM ERROR:", error);
    res.status(500).json({ success: false });
  }
});

app.listen(3000, () => {
  console.log("🚀 Call server running on port 3000");
});
