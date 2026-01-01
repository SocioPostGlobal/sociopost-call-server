const express = require("express");
const admin = require("firebase-admin");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// 🔐 Decode base64 service account
const serviceAccount = JSON.parse(
  Buffer.from(process.env.SERVICE_ACCOUNT_KEY, "base64").toString("utf8")
);

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

// 🌐 Render port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Call server running on port ${PORT}`);
});
