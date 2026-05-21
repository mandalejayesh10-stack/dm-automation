import { Router } from "express";
import Stripe from "stripe";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";

export const billingRouter = Router();
const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

billingRouter.post("/stripe/checkout", requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(501).json({ error: "Stripe is not configured" });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: `${env.APP_URL}/dashboard/billing?success=true`,
      cancel_url: `${env.APP_URL}/dashboard/billing?cancelled=true`,
      line_items: [{ price: String(req.body.priceId), quantity: 1 }],
      metadata: { userId: req.user?.id ?? "dev" }
    });
    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

billingRouter.post("/razorpay/subscription", requireAuth, async (_req, res) => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return res.status(501).json({ error: "Razorpay is not configured" });
  res.json({ status: "ready", provider: "razorpay" });
});
