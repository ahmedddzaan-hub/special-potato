
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

const REWARD_TOOLS = [
  "qr",
  "image-resizer",
  "json-formatter",
  "color-palette",
  "username-generator",
  "password-generator",
  "text-case-converter",
  "word-counter",
  "pfp-maker"
];

const PREMIUM_PRODUCTS = {
  "pfp-maker-pro": 150,
  "qr-maker-pro": 100,
  "background-remover": 200,
  "pdf-pro": 180,
  "ai-logo-maker": 250
};

// Award coins once per tool per UTC day.
exports.claimToolReward = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please sign in.");
  }

  const toolId = request.data?.toolId;

  if (!REWARD_TOOLS.includes(toolId)) {
    throw new HttpsError("invalid-argument", "Invalid tool.");
  }

  const uid = request.auth.uid;
  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  const claimId = `${uid}_${date}_${toolId}`;
  const claimRef = db.collection("rewardClaims").doc(claimId);
  const userRef = db.collection("users").doc(uid);

  const reward = Math.random() < 0.05 ? 15 : 12;

  return db.runTransaction(async (transaction) => {
    const claim = await transaction.get(claimRef);

    if (claim.exists) {
      throw new HttpsError(
        "already-exists",
        "You already earned coins from this tool today."
      );
    }

    const user = await transaction.get(userRef);
    const currentCoins = user.exists ? (user.data().coins || 0) : 0;

    transaction.set(userRef, {
      coins: currentCoins + reward
    }, { merge: true });

    transaction.create(claimRef, {
      toolId,
      reward,
      createdAt: Timestamp.now()
    });

    return {
      success: true,
      reward,
      totalCoins: currentCoins + reward
    };
  });
});

// Purchase premium for five days.
exports.purchasePremium = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please sign in.");
  }

  const productId = request.data?.productId;
  const price = PREMIUM_PRODUCTS[productId];

  if (!price) {
    throw new HttpsError("invalid-argument", "Invalid product.");
  }

  const uid = request.auth.uid;
  const userRef = db.collection("users").doc(uid);

  return db.runTransaction(async (transaction) => {
    const user = await transaction.get(userRef);
    const data = user.exists ? user.data() : {};
    const coins = data.coins || 0;

    if (coins < price) {
      throw new HttpsError(
        "failed-precondition",
        "Not enough coins."
      );
    }

    const now = Date.now();
    const currentExpiry = data.premium?.[productId]?.toMillis?.() || 0;
    const startTime = Math.max(now, currentExpiry);
    const expiresAt = Timestamp.fromMillis(
      startTime + 5 * 24 * 60 * 60 * 1000
    );

    transaction.set(userRef, {
      coins: coins - price,
      premium: {
        ...(data.premium || {}),
        [productId]: expiresAt
      }
    }, { merge: true });

    return {
      success: true,
      remainingCoins: coins - price,
      expiresAt: expiresAt.toMillis()
    };
  });
});
                                 
