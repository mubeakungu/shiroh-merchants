// Order storage on Upstash Redis (Vercel's "Upstash for Redis" integration sets these variables).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function cmd(...args) {
  if (!URL_ || !TOKEN) throw new Error("Order storage is not set up. Add the Upstash for Redis integration in Vercel.");
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

const saveOrder = async o => {
  await cmd("SET", `order:${o.id}`, JSON.stringify(o));
  await cmd("ZADD", "orders", String(o.createdAt), o.id);
};
const getOrder = async id => {
  const v = await cmd("GET", `order:${id}`);
  return v ? JSON.parse(v) : null;
};
const linkCheckout = (checkoutId, orderId) => cmd("SET", `checkout:${checkoutId}`, orderId, "EX", "604800");
const orderForCheckout = checkoutId => cmd("GET", `checkout:${checkoutId}`);
const listOrders = async (limit = 200) => {
  const ids = await cmd("ZRANGE", "orders", "0", String(limit - 1), "REV");
  if (!ids.length) return [];
  const vals = await cmd("MGET", ...ids.map(id => `order:${id}`));
  return vals.filter(Boolean).map(v => JSON.parse(v));
};

module.exports = { saveOrder, getOrder, linkCheckout, orderForCheckout, listOrders };
