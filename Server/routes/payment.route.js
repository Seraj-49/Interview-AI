import express from "express";
import isAuth from "../middlewares/isAuth.js";
import { completeDemoTransaction, createDemoTransaction, createRazorpayOrder, getCreditPackages, getTransactions, recordRazorpayFailure, verifyRazorpayPayment } from "../controllers/payment.controller.js";

const paymentRouter = express.Router();
paymentRouter.get("/packages", isAuth, getCreditPackages);
paymentRouter.get("/transactions", isAuth, getTransactions);
paymentRouter.post("/demo/create", isAuth, createDemoTransaction);
paymentRouter.post("/demo/complete", isAuth, completeDemoTransaction);
paymentRouter.post("/razorpay/order", isAuth, createRazorpayOrder);
paymentRouter.post("/razorpay/verify", isAuth, verifyRazorpayPayment);
paymentRouter.post("/razorpay/failure", isAuth, recordRazorpayFailure);
export default paymentRouter;
