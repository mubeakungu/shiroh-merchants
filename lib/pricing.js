// Recomputes an order from product ids so the amount charged never comes from the browser.
const { RAW } = require("../products.js");

const PRODUCTS = Object.fromEntries(RAW.map((r, i) => ["p" + (i + 1), {
  id: "p" + (i + 1), name: r[0], price: r[4], stock: r[8], kind: r[9] || ""
}]));
const PROMOS = { SHIROH10: 0.10 };

function deliveryFee(afterDiscount, method) {
  if (method === "pickup") return 0;
  if (method === "express") return 600;
  return afterDiscount >= 5000 ? 0 : 250;
}

function priceOrder({ cart, promo, delivery }) {
  if (!cart || typeof cart !== "object") throw new Error("Your cart is empty.");
  if (!["standard", "express", "pickup"].includes(delivery)) throw new Error("Choose a delivery option.");
  const lines = [];
  for (const [id, qty] of Object.entries(cart)) {
    const p = PRODUCTS[id];
    const q = Math.floor(Number(qty));
    if (!p || !(q > 0)) throw new Error("One of the items in your cart is no longer available.");
    if (p.kind === "svc") throw new Error("Services are booked through Talk to an expert, not paid at checkout.");
    if (p.kind === "rx") throw new Error("Prescription medicine is confirmed by a pharmacist on WhatsApp before payment.");
    if (q > p.stock) throw new Error(`Only ${p.stock} of ${p.name} in stock.`);
    lines.push({ id, name: p.name, qty: q, price: p.price, total: p.price * q });
  }
  if (!lines.length) throw new Error("Your cart is empty.");
  const sub = lines.reduce((s, l) => s + l.total, 0);
  const rate = PROMOS[String(promo || "").toUpperCase()] || 0;
  const disc = Math.round(sub * rate);
  const fee = deliveryFee(sub - disc, delivery);
  return { lines, sub, disc, promo: rate ? String(promo).toUpperCase() : null, fee, total: sub - disc + fee };
}

module.exports = { priceOrder, PRODUCTS };
