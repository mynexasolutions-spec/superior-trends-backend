import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';

export const submitContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return next(new AppError('Name, email, and message are required', 400));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return next(new AppError('Please provide a valid email address', 400));
    }

    const contact = await prisma.contactMessage.create({
      data: {
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        subject: subject?.trim() || null,
        message: String(message).trim(),
        status: 'NEW',
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Thank you! We will get back to you within 1–2 business days.',
      data: { contact: { id: contact.id } },
    });
  } catch (error) {
    next(error);
  }
};

export const getContactMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: messages.length,
      data: { messages },
    });
  } catch (error) {
    next(error);
  }
};

export const updateContactStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['NEW', 'READ'].includes(status)) {
      return next(new AppError('Status must be NEW or READ', 400));
    }

    const message = await prisma.contactMessage.update({
      where: { id },
      data: { status },
    });

    res.status(200).json({
      status: 'success',
      data: { message },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteContactMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.contactMessage.delete({ where: { id } });

    res.status(200).json({
      status: 'success',
      message: 'Message deleted',
    });
  } catch (error) {
    next(error);
  }
};
