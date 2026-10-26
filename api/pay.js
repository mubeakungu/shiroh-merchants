// Creates an order and sends an M-Pesa STK push to the customer's phone.
const crypto = require("crypto");
const { priceOrder } = require("../lib/pricing.js");
const { configured, normalizePhone, stkPush } = require("../lib/mpesa.js");
const { saveOrder, linkCheckout } = require("../lib/store.js");

const clean = (v, n = 200) => String(v || "").trim().slice(0, n);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!configured()) return res.status(503).json({ error: "M-Pesa payments are not switched on yet. Please order on WhatsApp." });
  try {
    const b = req.body || {};
    const phone = normalizePhone(b.mpesaPhone || b.customer?.phone);
    if (!phone) return res.status(400).json({ error: "Enter the Safaricom number to pay from, like 0712 345 678." });
    const priced = priceOrder({ cart: b.cart, promo: b.promo, delivery: b.delivery });
    const c = b.customer || {};
    if (!clean(c.name)) return res.status(400).json({ error: "Enter your full name." });
    if (b.delivery !== "pickup" && !(clean(c.town) && clean(c.area) && clean(c.address)))
      return res.status(400).json({ error: "Fill in the delivery address." });

    const id = "SM-" + crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 7);
    const order = {
      id, createdAt: Date.now(), status: "awaiting_payment", ...priced, delivery: b.delivery,
      customer: { name: clean(c.name, 80), phone: clean(c.phone, 20), email: clean(c.email, 120), town: clean(c.town, 80), area: clean(c.area, 80), address: clean(c.address) },
      mpesaPhone: phone
    };
    const host = process.env.SITE_URL || `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
    const push = await stkPush({
      phone, amount: order.total, reference: id, description: "Shiroh order",
      callbackUrl: `${host.replace(/\/$/, "")}/api/callback?t=${encodeURIComponent(process.env.CALLBACK_SECRET)}`
    });
    order.checkoutRequestId = push.checkoutRequestId;
    await saveOrder(order);
    await linkCheckout(push.checkoutRequestId, id);
    res.status(200).json({ orderId: id, total: order.total });
  } catch (e) {
    res.status(400).json({ error: e.message || "Payment could not be started. Please try again." });
  }
};
