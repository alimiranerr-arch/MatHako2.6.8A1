// Cloudflare Worker: Hako profile notifications + secure player market
// Required vars/secrets:
// HAKO_APPS_SCRIPT_URL, HAKO_SECRET, FIREBASE_PROJECT_ID
// FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (Cloud service-account JSON values)

const ALLOWED_ORIGIN = "https://alimiranerr-arch.github.io";
const FIREBASE_CERTS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/";
let cachedGoogleToken = "";
let cachedGoogleTokenExpiry = 0;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Vary": "Origin"
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) }
  });
}
function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
function base64UrlBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlText(value) {
  return base64UrlBytes(new TextEncoder().encode(value));
}
async function verifyFirebaseToken(token, projectId) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Geçersiz oturum belirteci.");
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  if (header.alg !== "RS256" || !header.kid) throw new Error("Geçersiz imza algoritması.");
  const certResponse = await fetch(FIREBASE_CERTS_URL, { cf: { cacheTtl: 3600 } });
  if (!certResponse.ok) throw new Error("Firebase imza anahtarları alınamadı.");
  const certs = await certResponse.json();
  const jwk = certs.keys?.find(key => key.kid === header.kid);
  if (!jwk) throw new Error("Firebase imza anahtarı bulunamadı.");
  const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, decodeBase64Url(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!valid) throw new Error("Oturum imzası geçersiz.");
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== projectId || claims.iss !== "https://securetoken.google.com/" + projectId ||
      !claims.sub || claims.sub.length > 128 || !claims.exp || claims.exp <= now ||
      !claims.iat || claims.iat > now + 300 || !claims.auth_time || claims.auth_time > now + 300) {
    throw new Error("Oturum doğrulanamadı.");
  }
  if (claims.email_verified !== true || typeof claims.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) {
    throw new Error("İşlem için doğrulanmış e-posta gerekli.");
  }
  return claims;
}

async function getGoogleAccessToken(env) {
  if (cachedGoogleToken && cachedGoogleTokenExpiry > Date.now() + 60000) return cachedGoogleToken;
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) throw new Error("Firestore hizmet hesabı Secret ayarları eksik.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlText(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + "." + claims;
  const pem = String(env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  const derText = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(derText), ch => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = unsigned + "." + base64UrlBytes(new Uint8Array(signature));
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error("Google hizmet hesabı yetkilendirilemedi: " + String(data.error_description || data.error || response.status).slice(0, 140));
  cachedGoogleToken = data.access_token;
  cachedGoogleTokenExpiry = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  return cachedGoogleToken;
}
function fsValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fsValue) } };
  if (value && typeof value === "object") {
    const fields = {};
    for (const [key, val] of Object.entries(value)) if (val !== undefined) fields[key] = fsValue(val);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}
function fromFsValue(value) {
  if (!value) return null;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return Date.parse(value.timestampValue);
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(fromFsValue);
  if ("mapValue" in value) return fromFsFields(value.mapValue.fields || {});
  return null;
}
function fromFsFields(fields) {
  const result = {};
  for (const [key, value] of Object.entries(fields || {})) result[key] = fromFsValue(value);
  return result;
}
function toFsFields(data) {
  const fields = {};
  for (const [key, value] of Object.entries(data || {})) if (value !== undefined) fields[key] = fsValue(value);
  return fields;
}
function documentName(projectId, collection, id) {
  return "projects/" + projectId + "/databases/(default)/documents/" + collection + "/" + id;
}
async function firestoreRequest(env, endpoint, body) {
  const token = await getGoogleAccessToken(env);
  const response = await fetch(FIRESTORE_BASE + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents:" + endpoint, {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Firestore işlemi başarısız: " + String(data.error?.message || response.status).slice(0, 180));
  return data;
}
async function beginMarketTransaction(env, paths) {
  const started = await firestoreRequest(env, "beginTransaction", { options: { readWrite: {} } });
  const transaction = started.transaction;
  if (!transaction) throw new Error("Firestore işlemi başlatılamadı.");
  const result = await firestoreRequest(env, "batchGet", { documents: paths, transaction });
  const docs = new Map();
  for (const entry of Array.isArray(result) ? result : []) {
    if (entry.found) docs.set(entry.found.name, {
      data: fromFsFields(entry.found.fields || {}),
      updateTime: entry.found.updateTime
    });
    else if (entry.missing) docs.set(entry.missing, null);
  }
  return { transaction, docs };
}
function updateWrite(name, data, updateTime) {
  return { update: { name, fields: toFsFields(data) }, currentDocument: { updateTime } };
}
async function commitMarketTransaction(env, transaction, writes) {
  await firestoreRequest(env, "commit", { transaction, writes });
}
function requiredUser(doc, message) {
  if (!doc) throw new Error(message || "Kullanıcı profili bulunamadı.");
  if (doc.data.banned) throw new Error("Hesabın yönetici tarafından kalıcı olarak yasaklandı.");
  return doc.data;
}
async function handleMarket(request, env, claims, action) {
  const body = await request.json();
  const uid = claims.sub;
  const projectId = env.FIREBASE_PROJECT_ID;
  if (action === "create") {
    const itemId = String(body.itemId || "");
    const price = Number(body.price);
    if (!itemId || itemId.length > 160 || !Number.isSafeInteger(price) || price < 1 || price > 1000000) throw new Error("Ürün ve 1-1.000.000 arası altın fiyatı gerekli.");
    const userPath = documentName(projectId, "users", uid);
    const listingId = crypto.randomUUID().replace(/-/g, "");
    const listingPath = documentName(projectId, "playerMarketListings", listingId);
    const tx = await beginMarketTransaction(env, [userPath]);
    const userDoc = tx.docs.get(userPath);
    const user = requiredUser(userDoc);
    const inventory = Array.isArray(user.inventory) ? user.inventory : [];
    const index = inventory.findIndex(item => item.itemId === itemId && !item.listed);
    if (index < 0) throw new Error("Satışa çıkarılabilir ürün envanterinde bulunamadı veya zaten listede.");
    const item = inventory[index];
    const type = String(item.type || "");
    if (!["card", "title", "membership", "miniPass"].includes(type)) throw new Error("Yalnızca kart, unvan ve üyelik satılabilir.");
    if (["membership", "miniPass"].includes(type) && Number(user.membershipUntil) <= Date.now()) throw new Error("Süresi dolmuş üyelik satılamaz.");
    const nextInventory = inventory.slice();
    nextInventory[index] = { ...item, listed: true };
    const listing = {
      sellerUid: uid,
      sellerName: String(user.displayName || claims.name || "Oyuncu").slice(0, 80),
      itemId,
      name: String(item.name || "Oyuncu ürünü").slice(0, 80),
      type,
      emoji: String(item.emoji || "🎁").slice(0, 8),
      gifUrl: String(item.gifUrl || "").slice(0, 1000),
      price,
      active: true,
      createdAt: Date.now()
    };
    await commitMarketTransaction(env, tx.transaction, [
      updateWrite(userPath, { ...user, inventory: nextInventory }, userDoc.updateTime),
      { update: { name: listingPath, fields: toFsFields(listing) }, currentDocument: { exists: false } }
    ]);
    return { ok: true, listingId };
  }
  const listingId = String(body.listingId || "");
  if (!listingId || listingId.length > 160 || listingId.includes("/")) throw new Error("İlan kimliği geçersiz.");
  const listingPath = documentName(projectId, "playerMarketListings", listingId);
  if (action === "cancel") {
    const tx = await beginMarketTransaction(env, [listingPath]);
    const listingDoc = tx.docs.get(listingPath);
    if (!listingDoc || listingDoc.data.active !== true || listingDoc.data.sellerUid !== uid) throw new Error("Aktif ilan bulunamadı.");
    const listing = listingDoc.data;
    const userPath = documentName(projectId, "users", uid);
    const tx2 = await beginMarketTransaction(env, [listingPath, userPath]);
    const freshListingDoc = tx2.docs.get(listingPath);
    if (!freshListingDoc || freshListingDoc.data.active !== true || freshListingDoc.data.sellerUid !== uid) throw new Error("İlan bu sırada değişti. Yenileyip tekrar dene.");
    const freshListing = freshListingDoc.data;
    const userDoc = tx2.docs.get(userPath);
    const user = requiredUser(userDoc);
    const inventory = Array.isArray(user.inventory) ? user.inventory : [];
    const index = inventory.findIndex(item => item.itemId === freshListing.itemId && item.listed);
    if (index >= 0) {
      const next = inventory.slice();
      next[index] = { ...next[index], listed: false };
      user.inventory = next;
    }
    await commitMarketTransaction(env, tx2.transaction, [
      updateWrite(userPath, user, userDoc.updateTime),
      updateWrite(listingPath, { ...freshListing, active: false, cancelledAt: Date.now() }, freshListingDoc.updateTime)
    ]);
    return { ok: true };
  }
  if (action === "buy") {
    const tx = await beginMarketTransaction(env, [listingPath]);
    const listingDoc = tx.docs.get(listingPath);
    if (!listingDoc || listingDoc.data.active !== true) throw new Error("Bu ilan artık satışta değil.");
    const listing = listingDoc.data;
    const sellerUid = String(listing.sellerUid || "");
    if (!sellerUid || sellerUid === uid) throw new Error("Kendi ilanını satın alamazsın.");
    const buyerPath = documentName(projectId, "users", uid);
    const sellerPath = documentName(projectId, "users", sellerUid);
    const tx2 = await beginMarketTransaction(env, [listingPath, buyerPath, sellerPath]);
    const freshListingDoc = tx2.docs.get(listingPath);
    if (!freshListingDoc || freshListingDoc.data.active !== true || freshListingDoc.data.sellerUid !== sellerUid) throw new Error("İlan bu sırada değişti veya artık satışta değil.");
    const freshListing = freshListingDoc.data;
    const buyerDoc = tx2.docs.get(buyerPath);
    const sellerDoc = tx2.docs.get(sellerPath);
    const buyer = requiredUser(buyerDoc, "Alıcı hesabı bulunamadı.");
    const seller = requiredUser(sellerDoc, "Satıcı hesabı bulunamadı.");
    const price = Number(freshListing.price);
    if (!Number.isSafeInteger(price) || price < 1 || price > 1000000) throw new Error("İlan fiyatı geçersiz.");
    if ((Number(buyer.coins) || 0) < price) throw new Error("Yeterli altının yok.");
    const sellerInventory = Array.isArray(seller.inventory) ? seller.inventory : [];
    const index = sellerInventory.findIndex(item => item.itemId === freshListing.itemId && item.listed);
    if (index < 0) throw new Error("Satılan ürün artık satıcının envanterinde değil.");
    const item = { ...sellerInventory[index], listed: false };
    const nextSellerInventory = sellerInventory.slice();
    nextSellerInventory.splice(index, 1);
    const nextBuyerInventory = [...(Array.isArray(buyer.inventory) ? buyer.inventory : []), { ...item, listed: false, ownedAt: Date.now(), paidPrice: price }];
    const sellerPatch = { ...seller, coins: (Number(seller.coins) || 0) + price, inventory: nextSellerInventory };
    const buyerPatch = { ...buyer, coins: (Number(buyer.coins) || 0) - price, inventory: nextBuyerInventory };
    if (["membership", "miniPass"].includes(freshListing.type)) {
      const until = Number(seller.membershipUntil) || 0;
      if (until <= Date.now() || Number(buyer.membershipUntil) > Date.now()) throw new Error("Üyeliğin süresi dolmuş veya alıcının zaten aktif üyeliği var.");
      const remaining = until - Date.now();
      sellerPatch.membership = "Mini Pass";
      sellerPatch.membershipType = "miniPass";
      sellerPatch.membershipUntil = 0;
      buyerPatch.membership = item.name;
      buyerPatch.membershipType = freshListing.type;
      buyerPatch.membershipUntil = Date.now() + remaining;
    }
    if (freshListing.type === "title") {
      if (String(seller.title || "") === String(item.name || "")) sellerPatch.title = "";
      buyerPatch.title = String(item.name || "");
    }
    await commitMarketTransaction(env, tx2.transaction, [
      updateWrite(sellerPath, sellerPatch, sellerDoc.updateTime),
      updateWrite(buyerPath, buyerPatch, buyerDoc.updateTime),
      updateWrite(listingPath, { ...freshListing, active: false, soldAt: Date.now(), buyerUid: uid }, freshListingDoc.updateTime)
    ]);
    return { ok: true, name: freshListing.name, price };
  }
  throw new Error("Bilinmeyen pazar işlemi.");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (origin !== ALLOWED_ORIGIN) return json({ ok: false, error: "Origin reddedildi." }, 403, origin);
    if (request.method !== "POST") return json({ ok: false, error: "Yalnızca POST desteklenir." }, 405, origin);
    const path = new URL(request.url).pathname;
    const isProfileNotice = path === "/profile-change-notice";
    const marketMatch = path.match(/^\/market\/(create|cancel|buy)$/);
    if (!isProfileNotice && !marketMatch) return json({ ok: false, error: "Bulunamadı." }, 404, origin);
    if (!env.FIREBASE_PROJECT_ID) return json({ ok: false, error: "Firebase proje ayarı eksik." }, 500, origin);
    if (isProfileNotice && (!env.HAKO_APPS_SCRIPT_URL || !env.HAKO_SECRET)) return json({ ok: false, error: "E-posta Worker ayarları eksik." }, 500, origin);
    if (marketMatch && (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY)) return json({ ok: false, error: "Firestore hizmet hesabı Secret ayarları eksik." }, 500, origin);
    try {
      const auth = request.headers.get("Authorization") || "";
      const match = auth.match(/^Bearer\s+(.+)$/i);
      if (!match) return json({ ok: false, error: "Oturum gerekli." }, 401, origin);
      const claims = await verifyFirebaseToken(match[1], env.FIREBASE_PROJECT_ID);
      if (isProfileNotice) {
        const body = await request.json();
        const allowedFields = new Set(["Ad", "Soyad", "Okul", "Takma ad", "Sınıf"]);
        const changedFields = Array.isArray(body.changedFields)
          ? [...new Set(body.changedFields.filter(x => typeof x === "string" && allowedFields.has(x)))].slice(0, 5)
          : [];
        if (!changedFields.length) return json({ ok: false, error: "Değişiklik bilgisi eksik." }, 400, origin);
        const upstream = await fetch(env.HAKO_APPS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: env.HAKO_SECRET, to: claims.email, emailVerified: claims.email_verified === true, changedFields })
        });
        const result = await upstream.json().catch(() => null);
        if (!upstream.ok || !result?.ok) return json({ ok: false, error: result?.error || "E-posta gönderilemedi." }, 502, origin);
        return json({ ok: true }, 200, origin);
      }
      const result = await handleMarket(request, env, claims, marketMatch[1]);
      return json(result, 200, origin);
    } catch (error) {
      return json({ ok: false, error: String(error.message || error).slice(0, 220) }, 400, origin);
    }
  }
};