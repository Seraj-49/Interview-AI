import crypto from "crypto";
import Razorpay from "razorpay";
import { CREDIT_PACKAGES, getCreditPackage } from "../config/creditPackages.js";
import Transaction from "../models/transaction.model.js";
import User from "../models/usermodel.js";

const paymentMethods = ["UPI", "Debit/Credit Card", "Net Banking"];
const demoConfig = (name) => String(process.env[name] || "").trim().toLowerCase();
const demoEnabled = () => demoConfig("DEMO_PAYMENT_ENABLED") === "true";
const demoResult = () => demoConfig("DEMO_PAYMENT_RESULT") === "failure" ? "failure" : "success";
const razorpayEnabled = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && demoConfig("RAZORPAY_MODE") === "test");
const razorpay = () => new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

export const getCreditPackages = async (req, res) => {
    return res.status(200).json({ packages: CREDIT_PACKAGES, demoEnabled: demoEnabled() && !razorpayEnabled(), razorpayEnabled: razorpayEnabled(), razorpayKeyId: razorpayEnabled() ? process.env.RAZORPAY_KEY_ID : null });
};

export const createRazorpayOrder = async (req, res) => {
    try {
        if (!razorpayEnabled()) return res.status(503).json({ message: "Razorpay Test Mode is not configured on the server." });
        const selected = getCreditPackage(req.body.packageId);
        if (!selected) return res.status(400).json({ message: "Invalid credit package." });
        console.info("[Razorpay] creating Test order", { packageId: selected.id, amount: selected.amount, currency: "INR" });
        const order = await razorpay().orders.create({ amount: selected.amount, currency: "INR", receipt: `ai_${req.userId}_${Date.now()}` });
        const transaction = await Transaction.create({ userId: req.userId, transactionId: `RZP-${order.id}`, packageId: selected.id, packageName: selected.name, credits: selected.credits, amount: selected.amount, paymentType: "razorpay_test", paymentMethod: "Pending", razorpayOrderId: order.id, status: "pending" });
        console.info("[Razorpay] Test order created", { orderId: order.id, amount: order.amount, currency: order.currency });
        return res.status(201).json({ order: { id: order.id, amount: order.amount, currency: order.currency }, keyId: process.env.RAZORPAY_KEY_ID, transactionId: transaction.transactionId });
    } catch (error) { console.error("[Razorpay] order creation failed", { status: error.statusCode, description: error.error?.description || error.message }); return res.status(500).json({ message: `Unable to create Razorpay order: ${error.error?.description || error.message}` }); }
};

export const verifyRazorpayPayment = async (req, res) => {
    try {
        if (!razorpayEnabled()) return res.status(503).json({ message: "Razorpay Test Mode is not configured on the server." });
        const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
        if (!orderId || !paymentId || !signature) return res.status(400).json({ message: "Incomplete Razorpay payment data." });
        const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
        console.info("[Razorpay] verification received", { orderId, paymentId });
        if (Buffer.byteLength(expected) !== Buffer.byteLength(signature) || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) { console.warn("[Razorpay] signature verification failed", { orderId, paymentId }); return res.status(400).json({ message: "Razorpay signature verification failed." }); }
        const transaction = await Transaction.findOne({ userId: req.userId, razorpayOrderId: orderId, paymentType: "razorpay_test" });
        if (!transaction) return res.status(404).json({ message: "Payment order not found." });
        if (transaction.razorpayPaymentId && transaction.razorpayPaymentId !== paymentId) return res.status(409).json({ message: "Payment order is already associated with another payment." });
        const completed = await Transaction.findOneAndUpdate({ _id: transaction._id, status: "pending" }, { $set: { status: "success", razorpayPaymentId: paymentId } }, { new: true }) || await Transaction.findById(transaction._id);
        if (completed.status !== "success") return res.status(409).json({ message: "Payment cannot be completed." });
        const updatedUser = await User.findOneAndUpdate({ _id: req.userId, processedPaymentIds: { $ne: paymentId } }, { $inc: { credits: completed.credits }, $addToSet: { processedPaymentIds: paymentId } }, { new: true });
        const user = updatedUser || await User.findById(req.userId);
        await Transaction.findByIdAndUpdate(completed._id, { $set: { creditsAdded: true } });
        console.info("[Razorpay] verification complete", { orderId, paymentId, creditsAdded: Boolean(updatedUser) });
        return res.status(200).json({ credits: user.credits, transaction: completed, message: updatedUser ? "Razorpay Test payment verified. Credits added." : "Payment was already verified." });
    } catch (error) { console.error("[Razorpay] verification error", { message: error.message }); return res.status(500).json({ message: `Unable to verify Razorpay payment: ${error.message}` }); }
};

export const recordRazorpayFailure = async (req, res) => {
    try {
        const { orderId, error = {} } = req.body;
        if (!orderId) return res.status(400).json({ message: "Razorpay order ID is required." });
        const details = { code: error.code, description: error.description, source: error.source, step: error.step, reason: error.reason };
        const transaction = await Transaction.findOneAndUpdate({ userId: req.userId, razorpayOrderId: orderId, status: "pending" }, { $set: { status: "failed", paymentFailure: details } }, { new: true });
        console.warn("[Razorpay] checkout failure", { orderId, ...details });
        return res.status(200).json({ transaction, error: details });
    } catch (error) { return res.status(500).json({ message: `Unable to record Razorpay failure: ${error.message}` }); }
};

export const createDemoTransaction = async (req, res) => {
    try {
        if (!demoEnabled()) return res.status(403).json({ message: "Demo payments are disabled on this server." });
        const { packageId, paymentMethod, requestId } = req.body;
        const selected = getCreditPackage(packageId);
        if (!selected) return res.status(400).json({ message: "Invalid credit package." });
        if (!paymentMethods.includes(paymentMethod)) return res.status(400).json({ message: "Select a valid demo payment method." });
        if (requestId) {
            const existing = await Transaction.findOne({ userId: req.userId, checkoutRequestId: requestId });
            if (existing) return res.status(200).json({ transaction: existing });
        }
        const transaction = await Transaction.create({
            userId: req.userId,
            transactionId: `DEMO-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`,
            checkoutRequestId: requestId || undefined,
            packageId: selected.id,
            packageName: selected.name,
            credits: selected.credits,
            amount: selected.amount,
            paymentMethod,
            paymentType: "demo",
            status: "pending",
        });
        return res.status(201).json({ transaction });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: "This demo checkout is already being processed." });
        return res.status(500).json({ message: `Unable to create demo transaction: ${error.message}` });
    }
};

export const completeDemoTransaction = async (req, res) => {
    try {
        if (!demoEnabled()) return res.status(403).json({ message: "Demo payments are disabled on this server." });
        const transaction = await Transaction.findOne({ transactionId: req.body.transactionId, userId: req.userId });
        if (!transaction) return res.status(404).json({ message: "Demo transaction not found." });

        if (transaction.status === "pending") {
            const nextStatus = demoResult() === "success" ? "success" : "failed";
            await Transaction.findOneAndUpdate({ _id: transaction._id, status: "pending" }, { $set: { status: nextStatus } });
        }

        const completed = await Transaction.findById(transaction._id);
        if (completed.status === "failed") return res.status(200).json({ transaction: completed, message: "Demo payment failed. No credits were added." });

        const userWithCredits = await User.findOneAndUpdate(
            { _id: req.userId, processedPaymentIds: { $ne: completed.transactionId } },
            { $inc: { credits: completed.credits }, $addToSet: { processedPaymentIds: completed.transactionId } },
            { new: true }
        );
        const user = userWithCredits || await User.findById(req.userId);
        if (!completed.creditsAdded) await Transaction.findByIdAndUpdate(completed._id, { $set: { creditsAdded: true } });
        return res.status(200).json({ transaction: { ...completed.toObject(), creditsAdded: true }, credits: user.credits, message: userWithCredits ? "Demo payment successful. Credits added." : "Demo payment was already completed." });
    } catch (error) {
        return res.status(500).json({ message: `Unable to complete demo transaction: ${error.message}` });
    }
};

export const getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.userId })
            .select("transactionId packageName credits amount currency status paymentMethod paymentType razorpayOrderId razorpayPaymentId createdAt")
            .sort({ createdAt: -1 });
        return res.status(200).json(transactions);
    } catch (error) {
        return res.status(500).json({ message: `Unable to get transactions: ${error.message}` });
    }
};
