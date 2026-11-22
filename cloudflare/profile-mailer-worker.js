// Cloudflare Worker: Hako profile-change email notifications
// Configure Worker secrets/vars:
//   HAKO_APPS_SCRIPT_URL = deployed Google Apps Script /exec URL
//   HAKO_SECRET = same secret stored in Apps Script Script Properties as HAKO_SECRET
//   FIREBASE_PROJECT_ID = hakomatonline261 (plain text variable)

const ALLOWED_ORIGIN = "https://alimiranerr-arch.github.io";
const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

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

  const publicKey = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
  if (!valid) throw new Error("Oturum imzası geçersiz.");

  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== projectId ||
      claims.iss !== "https://securetoken.google.com/" + projectId ||
      !claims.sub || claims.sub.length > 128 ||
      !claims.exp || claims.exp <= now ||
      !claims.iat || claims.iat > now + 300 ||
      !claims.auth_time || claims.auth_time > now + 300) {
    throw new Error("Oturum doğrulanamadı.");
  }
  if (claims.email_verified !== true || typeof claims.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) {
    throw new Error("Bildirim için doğrulanmış e-posta gerekli.");
  }
  return claims;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (origin !== ALLOWED_ORIGIN) return json({ ok: false, error: "Origin reddedildi." }, 403, origin);
    if (new URL(request.url).pathname !== "/profile-change-notice") {
      return json({ ok: false, error: "Bulunamadı." }, 404, origin);
    }
    if (request.method !== "POST") return json({ ok: false, error: "Yalnızca POST desteklenir." }, 405, origin);
    if (!env.HAKO_APPS_SCRIPT_URL || !env.HAKO_SECRET || !env.FIREBASE_PROJECT_ID) {
      return json({ ok: false, error: "Worker ayarları eksik." }, 500, origin);
    }

    try {
      const auth = request.headers.get("Authorization") || "";
      const match = auth.match(/^Bearer\s+(.+)$/i);
      if (!match) return json({ ok: false, error: "Oturum gerekli." }, 401, origin);
      const claims = await verifyFirebaseToken(match[1], env.FIREBASE_PROJECT_ID);

      const body = await request.json();
      const allowedFields = new Set(["Ad", "Soyad", "Okul", "Takma ad", "Sınıf"]);
      const changedFields = Array.isArray(body.changedFields)
        ? [...new Set(body.changedFields.filter(x => typeof x === "string" && allowedFields.has(x)))].slice(0, 5)
        : [];
      if (!changedFields.length) return json({ ok: false, error: "Değişiklik bilgisi eksik." }, 400, origin);

      const upstream = await fetch(env.HAKO_APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: env.HAKO_SECRET,
          to: claims.email,
          emailVerified: claims.email_verified === true,
          changedFields
        })
      });
      const result = await upstream.json().catch(() => null);
      if (!upstream.ok || !result?.ok) {
        return json({ ok: false, error: result?.error || "E-posta gönderilemedi." }, 502, origin);
      }
      return json({ ok: true }, 200, origin);
    } catch (error) {
      return json({ ok: false, error: String(error.message || error).slice(0, 180) }, 400, origin);
    }
  }
};
