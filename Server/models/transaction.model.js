import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    packageId: { type: String, required: true },
    packageName: { type: String, required: true },
    credits: { type: Number, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    transactionId: { type: String, required: true, unique: true },
    checkoutRequestId: { type: String, unique: true, sparse: true },
    paymentMethod: { type: String, default: "Pending" },
    paymentType: { type: String, enum: ["demo", "razorpay_test"], default: "demo" },
    status: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    paymentFailure: {
        code: String,
        description: String,
        source: String,
        step: String,
        reason: String,
    },
    creditsAdded: { type: Boolean, default: false },
}, { timestamps: true });

const Transaction = mongoose.model("Transaction", transactionSchema);
export default Transaction;
