import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './error.middleware.js';
import { isValidUuid } from '../utils/uuid.js';

const clearAuthCookie = (res: Response): void => {
  res.cookie('token', '', {
    expires: new Date(0),
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
};

interface DecodedToken {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export const protect = (req: Request, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  // Get token from authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // Or from cookies
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token || token === 'none') {
    return next(new AppError('Not authorized to access this route', 401));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as DecodedToken;
    if (!isValidUuid(decoded.id)) {
      clearAuthCookie(res);
      return next(new AppError('Session expired. Please log in again.', 401));
    }
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch {
    clearAuthCookie(res);
    return next(new AppError('Session expired. Please log in again.', 401));
  }
};

export const restrictTo = (...roles: Array<'USER' | 'ADMIN'>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

export const optionalProtect = (req: Request, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token || token === 'none') {
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as DecodedToken;
    if (isValidUuid(decoded.id)) {
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };
    }
    next();
  } catch (error) {
    next();
  }
};
