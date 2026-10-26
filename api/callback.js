// Safaricom calls this when the customer approves or cancels the M-Pesa prompt.
const crypto = require("crypto");
const { getOrder, saveOrder, orderForCheckout } = require("../lib/store.js");

const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

module.exports = async (req, res) => {
  const secret = process.env.CALLBACK_SECRET || "";
  if (!secret || !same(String(req.query.t || ""), secret)) return res.status(403).json({ ResultCode: 1, ResultDesc: "Rejected" });
  try {
    const cb = req.body?.Body?.stkCallback;
    if (cb) {
      const id = await orderForCheckout(cb.CheckoutRequestID);
      const order = id && await getOrder(id);
      if (order && order.status === "awaiting_payment") {
        const meta = Object.fromEntries((cb.CallbackMetadata?.Item || []).map(i => [i.Name, i.Value]));
        if (cb.ResultCode === 0) {
          order.status = "paid";
          order.mpesaReceipt = meta.MpesaReceiptNumber || "";
          order.amountPaid = meta.Amount;
          order.paidAt = Date.now();
        } else {
          order.status = "payment_failed";
          order.failReason = cb.ResultDesc || "Payment was not completed";
        }
        await saveOrder(order);
      }
    }
  } catch (e) {
    console.error("callback error", e);
  }
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
};
