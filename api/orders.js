// Admin: list orders and mark them dispatched or delivered. Protected by ADMIN_PASSWORD.
const crypto = require("crypto");
const { listOrders, getOrder, saveOrder } = require("../lib/store.js");

const STATUSES = ["awaiting_payment", "paid", "payment_failed", "dispatched", "delivered", "cancelled"];

function authorised(req) {
  const want = process.env.ADMIN_PASSWORD || "";
  const got = String(req.headers["x-admin-password"] || "");
  return want.length >= 8 && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!authorised(req)) return res.status(401).json({ error: "Wrong password." });
  try {
    if (req.method === "GET") return res.status(200).json({ orders: await listOrders() });
    if (req.method === "POST") {
      const { id, status } = req.body || {};
      if (!STATUSES.includes(status)) return res.status(400).json({ error: "Unknown status." });
      const o = await getOrder(String(id));
      if (!o) return res.status(404).json({ error: "Order not found." });
      o.status = status;
      o.updatedAt = Date.now();
      await saveOrder(o);
      return res.status(200).json({ order: o });
    }
    res.status(405).json({ error: "Use GET or POST." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
