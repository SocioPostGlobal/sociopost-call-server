const express = require("express");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

// 🔐 Decode base64 service account
const serviceAccount = JSON.parse(
  Buffer.from(process.env.SERVICE_ACCOUNT_KEY, "base64").toString("utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// 📞 Send incoming call FCM
app.post("/send-call", async (req, res) => {
  const { fcmToken, callId, callerName, callType } = req.body;

  if (!fcmToken) {
    return res.status(400).json({ error: "FCM token missing" });
  }

  const message = {
    token: fcmToken,
    android: { priority: "high" },
    data: {
      type: "INCOMING_CALL",
      call_id: callId ?? "test-call",
      caller_name: callerName ?? "Unknown",
      call_type: callType ?? "audio",
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ CALL FCM SENT:", response);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ FCM ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🌐 Render port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Call server running on port ${PORT}`);
});
