import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/error.middleware.js';

// Initialize Razorpay conditionally (to avoid crashes if keys are empty/missing)
const getRazorpayInstance = () => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError('Razorpay credentials are not configured on the server', 500);
  }
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
};

export const createRazorpayOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return next(new AppError('Order ID is required', 400));
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    const razorpay = getRazorpayInstance();

    // Razorpay amount is in baisa (1 OMR = 1000 baisa)
    const amountInPaise = Math.round(Number(order.total) * 100);

    const options = {
      amount: amountInPaise,
      currency: 'OMR',
      receipt: order.orderNumber,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Save/Update payment record in DB
    await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: 'RAZORPAY',
        paymentStatus: 'PENDING',
        razorpayOrderId: razorpayOrder.id,
        amount: order.total,
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        razorpayOrder,
        keyId: env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyRazorpayPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return next(new AppError('Payment verification details (paymentId, orderId, signature) are required', 400));
    }

    // Verify cryptographic signature
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpaySignature;

    if (!isAuthentic) {
      // Mark payment failed in DB
      await prisma.payment.updateMany({
        where: { razorpayOrderId },
        data: { paymentStatus: 'FAILED' },
      });
      return next(new AppError('Payment signature verification failed', 400));
    }

    // Update payment record
    const updatedPayments = await prisma.payment.updateMany({
      where: { razorpayOrderId },
      data: {
        paymentStatus: 'SUCCESS',
        razorpayPaymentId,
        transactionData: { razorpaySignature } as any,
      },
    });

    // Find the associated order
    const paymentRecord = await prisma.payment.findFirst({
      where: { razorpayOrderId },
    });

    let updatedOrder = null;

    if (paymentRecord) {
      updatedOrder = await prisma.order.update({
        where: { id: paymentRecord.orderId },
        data: {
          paymentStatus: 'SUCCESS',
          orderStatus: 'PENDING',
        },
        include: { items: true, payments: true },
      });

      if (updatedOrder.userId) {
        const cart = await prisma.cart.findFirst({
          where: { userId: updatedOrder.userId },
        });
        if (cart) {
          await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
          await prisma.cart.update({
            where: { id: cart.id },
            data: { subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0 },
          });
        }
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Payment verified successfully',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};
