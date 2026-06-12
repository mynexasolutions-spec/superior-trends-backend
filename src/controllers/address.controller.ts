import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';

export const getMyAddresses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: addresses.length,
      data: {
        addresses,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { fullName, phone, addressLine1, addressLine2, city, state, country, pincode, isDefault } = req.body;

    if (!fullName || !phone || !addressLine1 || !city || !state || !country || !pincode) {
      return next(new AppError('All core address fields are required', 400));
    }

    // If this address is set to default, unset other defaults
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check if user has any addresses yet. If not, make this default automatically
    const count = await prisma.address.count({ where: { userId } });

    const address = await prisma.address.create({
      data: {
        userId,
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        country,
        pincode,
        isDefault: count === 0 ? true : (isDefault || false),
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        address,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { fullName, phone, addressLine1, addressLine2, city, state, country, pincode, isDefault } = req.body;

    const existing = await prisma.address.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return next(new AppError('Address not found or unauthorized', 404));
    }

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updatedData: any = {};
    if (fullName) updatedData.fullName = fullName;
    if (phone) updatedData.phone = phone;
    if (addressLine1) updatedData.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) updatedData.addressLine2 = addressLine2;
    if (city) updatedData.city = city;
    if (state) updatedData.state = state;
    if (country) updatedData.country = country;
    if (pincode) updatedData.pincode = pincode;
    if (isDefault !== undefined) updatedData.isDefault = isDefault;

    const address = await prisma.address.update({
      where: { id },
      data: updatedData,
    });

    res.status(200).json({
      status: 'success',
      data: {
        address,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const existing = await prisma.address.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return next(new AppError('Address not found or unauthorized', 404));
    }

    await prisma.address.delete({
      where: { id },
    });

    // If deleted address was default, set another address as default
    if (existing.isDefault) {
      const nextDefault = await prisma.address.findFirst({
        where: { userId },
      });
      if (nextDefault) {
        await prisma.address.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
