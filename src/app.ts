import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import logger from './config/logger.js';
import { errorHandler } from './middlewares/error.middleware.js';
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import collectionRoutes from './routes/collection.routes.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import addressRoutes from './routes/address.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import reviewRoutes from './routes/review.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import sectionRoutes from './routes/section.routes.js';
import adminRoutes from './routes/admin.routes.js';
import contactRoutes from './routes/contact.routes.js';
import blogRoutes from './routes/blog.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import bannerRoutes from './routes/banner.routes.js';

const app = express();

// Standard middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, health checks)
      if (!origin) return callback(null, true);

      const sanitize = (url: string) => url.trim().replace(/\/$/, '');

      const allowedOrigins = [
        sanitize(env.FRONTEND_URL),
        sanitize(env.CORS_ORIGIN),
        sanitize(env.MASTER_URL || ''),
      ].filter(Boolean);

      const sanitizedOrigin = sanitize(origin);

      if (
        allowedOrigins.includes(sanitizedOrigin) ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        callback(null, true);
      } else {
        console.warn(
          `[CORS Blocked] Origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`
        );

        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Redirect morgan logs to Winston
const morganStream = {
  write: (message: string) => logger.info(message.trim()),
};
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined', { stream: morganStream }));

// API Routes (Mounted under /api/v1 prefix)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/collections', collectionRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/sections', sectionRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/contact', contactRoutes);
app.use('/api/v1/blogs', blogRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/coupons', couponRoutes);
app.use('/api/v1/banners', bannerRoutes);

// Root + health (Render and browsers ping `/` and `HEAD /`)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Superior Trends API is running',
    health: '/health',
    api: '/api/v1',
  });
});

app.head('/', (req, res) => {
  res.status(200).end();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use(errorHandler);

export default app;
