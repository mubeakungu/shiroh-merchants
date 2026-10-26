// Tells the shop page whether "Pay now with M-Pesa" can be offered.
const { configured } = require("../lib/mpesa.js");
const storage = !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN));

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ mpesa: configured() && storage, sandbox: process.env.MPESA_ENV !== "production" });
};
