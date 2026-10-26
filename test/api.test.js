// Runs the API handlers against fake Daraja and Redis services. No network needed.
const assert = require("assert");
Object.assign(process.env, {
  MPESA_CONSUMER_KEY: "k", MPESA_CONSUMER_SECRET: "s", MPESA_SHORTCODE: "174379", MPESA_PASSKEY: "pk",
  CALLBACK_SECRET: "cbsecret", ADMIN_PASSWORD: "admin-pass-123", KV_REST_API_URL: "https://kv.test", KV_REST_API_TOKEN: "t"
});
const kv = new Map(), z = new Map();
let lastStk = null;
global.fetch = async (url, opt = {}) => {
  const json = o => ({ ok: true, status: 200, json: async () => o });
  if (url.startsWith("https://kv.test")) {
    const [c, ...a] = JSON.parse(opt.body);
    if (c === "SET") { kv.set(a[0], a[1]); return json({ result: "OK" }); }
    if (c === "GET") return json({ result: kv.get(a[0]) ?? null });
    if (c === "ZADD") { z.set(a[2], +a[1]); return json({ result: 1 }); }
    if (c === "ZRANGE") return json({ result: [...z].sort((x, y) => y[1] - x[1]).map(e => e[0]) });
    if (c === "MGET") return json({ result: a.map(k => kv.get(k) ?? null) });
  }
  if (url.includes("/oauth/")) return json({ access_token: "tok" });
  if (url.includes("/stkpush/")) { lastStk = JSON.parse(opt.body); return json({ ResponseCode: "0", CheckoutRequestID: "ws_CO_1", MerchantRequestID: "m1" }); }
  throw new Error("unexpected fetch " + url);
};
const call = async (h, { method = "GET", body, query = {}, headers = {} } = {}) => {
  let out = {};
  const res = { setHeader() {}, status(c) { out.code = c; return this; }, json(j) { out.body = j; return this; } };
  await require("../api/" + h)({ method, body, query, headers: { host: "shop.test", ...headers } }, res);
  return out;
};
const { PRODUCTS } = require("../lib/pricing.js");
const pid = name => Object.values(PRODUCTS).find(p => p.name.startsWith(name)).id;

(async () => {
  assert.deepStrictEqual((await call("health.js")).body.mpesa, true);
  const customer = { name: "Jane W", phone: "0712 345 678", town: "Nairobi", area: "Kilimani", address: "Block B" };

  // tampered client price is ignored: server charges catalogue price
  const rice = pid("Pishori rice"), milk = pid("Fresh farm milk, 1 L");
  let r = await call("pay.js", { method: "POST", body: { cart: { [rice]: 2, [milk]: 3 }, promo: "shiroh10", delivery: "standard", customer, price: 1 } });
  assert.strictEqual(r.code, 200, JSON.stringify(r.body));
  const expectSub = 1150 * 2 + 70 * 3, expectDisc = Math.round(expectSub * 0.1);
  assert.strictEqual(r.body.total, expectSub - expectDisc + 250);
  assert.strictEqual(lastStk.Amount, r.body.total);
  assert.strictEqual(lastStk.PartyA, "254712345678");
  assert.ok(lastStk.CallBackURL.startsWith("https://shop.test/api/callback?t=cbsecret"));
  const id = r.body.orderId;

  assert.strictEqual((await call("status.js", { query: { id } })).body.status, "awaiting_payment");
  // forged callback without the secret is rejected
  assert.strictEqual((await call("callback.js", { method: "POST", query: { t: "nope" }, body: {} })).code, 403);
  await call("callback.js", { method: "POST", query: { t: "cbsecret" }, body: { Body: { stkCallback: {
    CheckoutRequestID: "ws_CO_1", ResultCode: 0, ResultDesc: "ok",
    CallbackMetadata: { Item: [{ Name: "Amount", Value: r.body.total }, { Name: "MpesaReceiptNumber", Value: "QAB12CD34E" }] } } } } });
  const s = (await call("status.js", { query: { id } })).body;
  assert.strictEqual(s.status, "paid"); assert.strictEqual(s.receipt, "QAB12CD34E");

  // prescription medicine and services can't be paid directly; stock is enforced
  assert.strictEqual((await call("pay.js", { method: "POST", body: { cart: { [pid("Amoxicillin")]: 1 }, delivery: "standard", customer } })).code, 400);
  assert.strictEqual((await call("pay.js", { method: "POST", body: { cart: { [pid("Home deep cleaning")]: 1 }, delivery: "standard", customer } })).code, 400);
  assert.strictEqual((await call("pay.js", { method: "POST", body: { cart: { [pid("Digital camera")]: 99 }, delivery: "standard", customer } })).code, 400);
  assert.strictEqual((await call("pay.js", { method: "POST", body: { cart: { [rice]: 1 }, delivery: "standard", customer: { ...customer, phone: "12345" } } })).code, 400);

  // admin
  assert.strictEqual((await call("orders.js", { headers: { "x-admin-password": "wrong" } })).code, 401);
  const list = (await call("orders.js", { headers: { "x-admin-password": "admin-pass-123" } })).body.orders;
  assert.strictEqual(list.length, 1); assert.strictEqual(list[0].id, id);
  const up = await call("orders.js", { method: "POST", headers: { "x-admin-password": "admin-pass-123" }, body: { id, status: "dispatched" } });
  assert.strictEqual(up.body.order.status, "dispatched");
  console.log("all API tests passed");
})().catch(e => { console.error(e); process.exit(1); });
