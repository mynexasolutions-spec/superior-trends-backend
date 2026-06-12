import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';
import { env } from '../config/env.js';
import { isValidUuid } from '../utils/uuid.js';

const signToken = (id: string, email: string, role: string): string => {
  return jwt.sign({ id, email, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: '7d',
  });
};

const sendTokenResponse = (user: any, statusCode: number, res: Response) => {
  const token = signToken(user.id, user.email, user.role);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };

  res.cookie('token', token, cookieOptions);

  // Remove password from response
  const { password, ...userResponse } = user;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: userResponse,
    },
  });
};

export const signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return next(new AppError('Please provide name, email and password', 400));
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingUser) {
      return next(new AppError('Email address is already in use', 400));
    }

    // Hash password manually
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in PostgreSQL
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    });

    sendTokenResponse(user, 201, res);
  } catch (error: any) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate email & password inputs
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // Check if user exists in PostgreSQL
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(new AppError('Invalid credentials', 401));
    }

    sendTokenResponse(user, 200, res);
  } catch (error: any) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authorized', 401));
    }
    if (!isValidUuid(req.user.id)) {
      res.cookie('token', '', {
        expires: new Date(0),
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
      return next(new AppError('Session expired. Please log in again.', 401));
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const { password, ...userResponse } = user;

    res.status(200).json({
      status: 'success',
      data: {
        user: userResponse,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.cookie('token', '', {
      expires: new Date(0),
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    next(error);
  }
};
