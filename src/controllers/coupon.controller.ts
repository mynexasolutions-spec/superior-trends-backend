import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';

export const getAllCouponsAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: coupons.length,
      data: { coupons },
    });
  } catch (error) {
    next(error);
  }
};

export const createCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      code,
      type,
      value,
      minimumOrder,
      maximumDiscount,
      usageLimit,
      startDate,
      endDate,
      status,
    } = req.body;

    if (!code?.trim() || !type || value == null || !startDate || !endDate) {
      return next(new AppError('Code, type, value, start date, and end date are required', 400));
    }

    const couponCode = code.trim().toUpperCase();

    // Check unique code
    const existing = await prisma.coupon.findUnique({
      where: { code: couponCode },
    });
    if (existing) {
      return next(new AppError('Coupon code already exists', 400));
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: couponCode,
        type: String(type).toUpperCase(),
        value: Number(value),
        minimumOrder: Number(minimumOrder) || 0,
        maximumDiscount: maximumDiscount != null ? Number(maximumDiscount) : null,
        usageLimit: usageLimit != null ? Number(usageLimit) : null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status !== undefined ? Boolean(status) : true,
      },
    });

    res.status(201).json({
      status: 'success',
      data: { coupon },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      code,
      type,
      value,
      minimumOrder,
      maximumDiscount,
      usageLimit,
      startDate,
      endDate,
      status,
    } = req.body;

    const existing = await prisma.coupon.findUnique({
      where: { id },
    });
    if (!existing) {
      return next(new AppError('Coupon not found', 404));
    }

    const updatedData: Record<string, any> = {};

    if (code !== undefined) {
      const newCode = code.trim().toUpperCase();
      if (newCode !== existing.code) {
        const double = await prisma.coupon.findUnique({ where: { code: newCode } });
        if (double) {
          return next(new AppError('Coupon code already exists', 400));
        }
      }
      updatedData.code = newCode;
    }

    if (type !== undefined) updatedData.type = String(type).toUpperCase();
    if (value !== undefined) updatedData.value = Number(value);
    if (minimumOrder !== undefined) updatedData.minimumOrder = Number(minimumOrder) || 0;
    if (maximumDiscount !== undefined) updatedData.maximumDiscount = maximumDiscount != null ? Number(maximumDiscount) : null;
    if (usageLimit !== undefined) updatedData.usageLimit = usageLimit != null ? Number(usageLimit) : null;
    if (startDate !== undefined) updatedData.startDate = new Date(startDate);
    if (endDate !== undefined) updatedData.endDate = new Date(endDate);
    if (status !== undefined) updatedData.status = Boolean(status);

    const coupon = await prisma.coupon.update({
      where: { id },
      data: updatedData,
    });

    res.status(200).json({
      status: 'success',
      data: { coupon },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.coupon.findUnique({
      where: { id },
    });
    if (!existing) {
      return next(new AppError('Coupon not found', 404));
    }

    await prisma.coupon.delete({
      where: { id },
    });

    res.status(200).json({
      status: 'success',
      message: 'Coupon deleted successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

export const applyCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, subtotal } = req.body;

    if (!code?.trim() || subtotal == null) {
      return next(new AppError('Coupon code and order subtotal are required', 400));
    }

    const couponCode = code.trim().toUpperCase();
    const orderSubtotal = Number(subtotal);

    const coupon = await prisma.coupon.findUnique({
      where: { code: couponCode },
    });

    if (!coupon) {
      return next(new AppError('Invalid coupon code', 404));
    }

    if (!coupon.status) {
      return next(new AppError('This coupon is no longer active', 400));
    }

    const now = new Date();
    if (now < new Date(coupon.startDate)) {
      return next(new AppError('This coupon is not active yet', 400));
    }

    if (now > new Date(coupon.endDate)) {
      return next(new AppError('This coupon has expired', 400));
    }

    if (orderSubtotal < Number(coupon.minimumOrder)) {
      return next(
        new AppError(
          `Minimum order value to apply this coupon is ₹${coupon.minimumOrder}`,
          400
        )
      );
    }

    let discount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discount = orderSubtotal * (Number(coupon.value) / 100);
      if (coupon.maximumDiscount) {
        discount = Math.min(discount, Number(coupon.maximumDiscount));
      }
    } else {
      // FIXED
      discount = Number(coupon.value);
    }

    // Clamp discount to subtotal
    discount = Math.min(discount, orderSubtotal);

    res.status(200).json({
      status: 'success',
      data: {
        coupon,
        discount: Number(discount.toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getActiveCouponsPublic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: {
        status: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: {
        id: true,
        code: true,
        type: true,
        value: true,
        minimumOrder: true,
        maximumDiscount: true,
        endDate: true,
      },
      orderBy: { endDate: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      results: coupons.length,
      data: { coupons },
    });
  } catch (error) {
    next(error);
  }
};
