require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const { createClient } = require("@supabase/supabase-js");
const { AccessToken } = require("livekit-server-sdk");

const app = express();
app.use(express.json());

// 🔐 Load service account JSON from FIREBASE_SERVICE_ACCOUNT env (single-line JSON)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Supabase client (optional)
let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn("⚠️ Supabase not configured, DB features (userId lookup) disabled");
}

// 📞 Send incoming call FCM to all devices of a user
app.post("/send-call", async (req, res) => {
  const { userId, callId, callerName, callType } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  if (!supabase) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  try {
    // 1) Fetch all FCM tokens for this user & app
    const { data: tokens, error } = await supabase
      .from("fcm_tokens")
      .select("token")
      .eq("user_id", userId)
      .eq("app_name", "sociopost_call");

    if (error) {
      console.error("❌ Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!tokens || tokens.length === 0) {
      return res.status(404).json({ error: "No FCM tokens found" });
    }

    // 2) Send FCM to each token
    let sentCount = 0;
    for (const t of tokens) {
      if (!t.token) continue;
      await admin.messaging().send({
        token: t.token,
        android: { priority: "high" },
        data: {
          type: "INCOMING_CALL",
          call_id: callId ?? "test-call",
          caller_name: callerName ?? "Unknown",
          call_type: callType ?? "audio",
        },
      });
      sentCount++;
    }

    console.log(`✅ CALL FCM SENT to ${sentCount} device(s) for user ${userId}`);
    return res.json({ success: true, sent: sentCount });
  } catch (err) {
    console.error("❌ FCM ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 🎟️ Generate LiveKit token (production-safe; no logging of secrets)
app.post("/livekit/token", async (req, res) => {
  try {
    const { userId, roomName, role } = req.body;

    if (!userId || !roomName) {
      return res.status(400).json({ error: "userId and roomName required" });
    }

    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      return res.status(500).json({ error: "LiveKit env not configured" });
    }

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity: userId }
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: role !== "listener",
      canSubscribe: true,
      canPublishData: role !== "listener",
    });

    return res.json({
      token: at.toJwt(),
    });
  } catch (err) {
    console.error("❌ LiveKit token error:", err);
    return res.status(500).json({ error: "token_generation_failed" });
  }
});

// 🌐 Render port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Call server running on port ${PORT}`);
});
