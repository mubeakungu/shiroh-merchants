// Safaricom Daraja: M-Pesa Express (STK push). Keys live in Vercel environment variables only.
const env = k => process.env[k] || "";
const BASE = () => env("MPESA_ENV") === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

function configured() {
  return ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_SHORTCODE", "MPESA_PASSKEY", "CALLBACK_SECRET"].every(k => env(k));
}

function normalizePhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  const m = d.match(/^(?:254|0)?([17]\d{8})$/);
  return m ? "254" + m[1] : null;
}

// Daraja wants Kenyan time, YYYYMMDDHHmmss
function timestamp() {
  const t = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
  return t.slice(0, 19).replace(/\D/g, "");
}

async function token() {
  const auth = Buffer.from(`${env("MPESA_CONSUMER_KEY")}:${env("MPESA_CONSUMER_SECRET")}`).toString("base64");
  const r = await fetch(`${BASE()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  if (!r.ok) throw new Error(`M-Pesa sign-in failed (${r.status}). Check the consumer key and secret.`);
  return (await r.json()).access_token;
}

async function stkPush({ phone, amount, reference, description, callbackUrl }) {
  const shortcode = env("MPESA_SHORTCODE");
  const ts = timestamp();
  const till = env("MPESA_TYPE") === "till";
  const body = {
    BusinessShortCode: shortcode,
    Password: Buffer.from(shortcode + env("MPESA_PASSKEY") + ts).toString("base64"),
    Timestamp: ts,
    TransactionType: till ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
    Amount: Math.max(1, Math.round(amount)),
    PartyA: phone,
    PartyB: till ? (env("MPESA_TILL") || shortcode) : shortcode,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: reference.slice(0, 12),
    TransactionDesc: description.slice(0, 13)
  };
  const r = await fetch(`${BASE()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ResponseCode !== "0") throw new Error(j.errorMessage || j.ResponseDescription || `M-Pesa request failed (${r.status}).`);
  return { checkoutRequestId: j.CheckoutRequestID, merchantRequestId: j.MerchantRequestID };
}

module.exports = { configured, normalizePhone, stkPush };
