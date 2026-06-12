import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';

const DEFAULT_SETTINGS: Record<string, string> = {
  cod_allowed: 'true',
  free_shipping_threshold: '1500',
  shipping_charge: '100',
};

export const getSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const settings = await prisma.setting.findMany();
    
    // Create a combined map of defaults + database values
    const settingsMap = { ...DEFAULT_SETTINGS };
    for (const item of settings) {
      settingsMap[item.key] = item.value;
    }

    res.status(200).json({
      status: 'success',
      data: {
        settings: settingsMap,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return next(new AppError('Settings key-value object is required', 400));
    }

    // Update settings in database
    const results = await prisma.$transaction(
      Object.entries(settings).map(([key, val]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: String(val) },
          create: { key, value: String(val) },
        })
      )
    );

    // Merge and return updated list
    const finalSettings = await prisma.setting.findMany();
    const settingsMap = { ...DEFAULT_SETTINGS };
    for (const item of finalSettings) {
      settingsMap[item.key] = item.value;
    }

    res.status(200).json({
      status: 'success',
      data: {
        settings: settingsMap,
      },
    });
  } catch (error) {
    next(error);
  }
};
