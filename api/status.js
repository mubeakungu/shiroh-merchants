// The shop page polls this while the customer enters their M-Pesa PIN.
const { getOrder } = require("../lib/store.js");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const id = String(req.query.id || "");
  if (!/^SM-[0-9A-F]{7}$/.test(id)) return res.status(400).json({ error: "Unknown order." });
  try {
    const o = await getOrder(id);
    if (!o) return res.status(404).json({ error: "Unknown order." });
    res.status(200).json({ status: o.status, total: o.total, receipt: o.mpesaReceipt || null, reason: o.failReason || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
