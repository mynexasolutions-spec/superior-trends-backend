import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';

const cartItemInclude = {
  product: {
    include: {
      images: { orderBy: { sortOrder: 'asc' as const } },
      category: { select: { id: true, name: true, slug: true } },
    },
  },
  variant: true,
} as const;

// Helper to get or create cart
const getOrCreateCart = async (userId: string | null, sessionId: string | null) => {
  if (userId) {
    let cart = await prisma.cart.findFirst({
      where: { userId },
      include: { items: { include: cartItemInclude } },
    });
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: { items: { include: cartItemInclude } },
      });
    }
    return cart;
  } else if (sessionId) {
    let cart = await prisma.cart.findFirst({
      where: { sessionId },
      include: { items: { include: cartItemInclude } },
    });
    if (!cart) {
      cart = await prisma.cart.create({
        data: { sessionId },
        include: { items: { include: cartItemInclude } },
      });
    }
    return cart;
  }
  throw new AppError('Either user authentication or session ID is required to manage cart', 400);
};

// Helper to recalculate cart totals
const recalculateCartTotals = async (cartId: string) => {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
  });

  let subtotal = 0;
  for (const item of items) {
    subtotal += Number(item.price) * item.quantity;
  }

  // Load dynamic settings
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: ['free_shipping_threshold', 'shipping_charge'],
      },
    },
  });

  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
  const freeShippingThreshold = Number(settingsMap.get('free_shipping_threshold') ?? '1500');
  const standardShippingCharge = Number(settingsMap.get('shipping_charge') ?? '100');

  // Assuming flat 5% tax
  const tax = subtotal * 0.05;
  const shipping = subtotal >= freeShippingThreshold || subtotal === 0 ? 0 : standardShippingCharge;
  const total = subtotal + tax + shipping;

  await prisma.cart.update({
    where: { id: cartId },
    data: {
      subtotal,
      tax,
      shipping,
      total,
    },
  });
};

export const getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user ? req.user.id : null;
    const { sessionId } = req.query;

    const cart = await getOrCreateCart(userId, sessionId ? String(sessionId) : null);

    res.status(200).json({
      status: 'success',
      data: {
        cart,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const addToCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user ? req.user.id : null;
    const { sessionId, productId, variantId, quantity = 1, mode = 'add' } = req.body;
    const setQuantity = mode === 'set';

    if (!productId) {
      return next(new AppError('Product ID is required', 400));
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    let itemPrice = Number(product.salePrice);

    // If variant selected, verify variant and use variant pricing
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
      });
      if (!variant) {
        return next(new AppError('Product variant not found', 404));
      }
      itemPrice = Number(variant.salePrice || variant.mrp);
    }

    const cart = await getOrCreateCart(userId, sessionId ? String(sessionId) : null);

    // Check if item already in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        variantId: variantId || null,
      },
    });

    if (existingItem) {
      const nextQty = setQuantity
        ? Number(quantity)
        : existingItem.quantity + Number(quantity);
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: Math.max(1, nextQty) },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          variantId: variantId || null,
          quantity: Number(quantity),
          price: itemPrice,
        },
      });
    }

    await recalculateCartTotals(cart.id);

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: cartItemInclude } },
    });

    res.status(200).json({
      status: 'success',
      data: {
        cart: updatedCart,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCartItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { cartItemId, quantity } = req.body;

    if (!cartItemId || quantity === undefined) {
      return next(new AppError('Cart item ID and quantity are required', 400));
    }

    const existingItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
    });
    if (!existingItem) {
      return next(new AppError('Cart item not found', 404));
    }

    if (Number(quantity) <= 0) {
      await prisma.cartItem.delete({
        where: { id: cartItemId },
      });
    } else {
      await prisma.cartItem.update({
        where: { id: cartItemId },
        data: { quantity: Number(quantity) },
      });
    }

    await recalculateCartTotals(existingItem.cartId);

    const updatedCart = await prisma.cart.findUnique({
      where: { id: existingItem.cartId },
      include: { items: { include: cartItemInclude } },
    });

    res.status(200).json({
      status: 'success',
      data: {
        cart: updatedCart,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const removeFromCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { cartItemId } = req.body;

    if (!cartItemId) {
      return next(new AppError('Cart item ID is required', 400));
    }

    const existingItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
    });
    if (!existingItem) {
      return next(new AppError('Cart item not found', 404));
    }

    await prisma.cartItem.delete({
      where: { id: cartItemId },
    });

    await recalculateCartTotals(existingItem.cartId);

    const updatedCart = await prisma.cart.findUnique({
      where: { id: existingItem.cartId },
      include: { items: { include: cartItemInclude } },
    });

    res.status(200).json({
      status: 'success',
      data: {
        cart: updatedCart,
      },
    });
  } catch (error) {
    next(error);
  }
};
