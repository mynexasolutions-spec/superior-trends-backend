import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';
import {
  ORDER_STATUS,
  getNextOrderStatuses,
  isValidOrderStatus,
} from '../constants/orderStatus.js';
import { emitOrderUpdated, emitStockUpdated } from '../socket/socket.js';

const generateOrderNumber = () => `ST-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

/** Orders the customer actually placed: paid online or confirmed COD (not abandoned Razorpay checkout). */
const placedOrderWhere = {
  OR: [
    { paymentStatus: 'SUCCESS' as const },
    { payments: { some: { paymentMethod: 'COD' as const } } },
  ],
};

function isPlacedOrder(order: {
  paymentStatus: string;
  payments?: { paymentMethod: string }[];
}): boolean {
  if (order.paymentStatus === 'SUCCESS') return true;
  return (order.payments ?? []).some((p) => p.paymentMethod === 'COD');
}

async function restoreOrderStock(tx: any, orderId: string): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return;

  for (const item of order.items) {
    if (item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }
}

async function sendStockUpdatesForOrder(order: any): Promise<void> {
  try {
    const items = order.items || [];
    if (items.length === 0) return;

    const updates = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { stock: true },
      });
      if (!product) continue;

      let variantStock: number | null = null;
      if (item.variantId) {
        const variant = await prisma.productVariant.findUnique({
          where: { id: item.variantId },
          select: { stock: true },
        });
        variantStock = variant?.stock ?? null;
      }

      updates.push({
        productId: item.productId,
        stock: product.stock,
        variantId: item.variantId,
        variantStock,
      });
    }

    if (updates.length > 0) {
      emitStockUpdated(updates);
    }
  } catch (error) {
    console.error('Error broadcasting stock updates:', error);
  }
}

async function getProductMainImage(productId: string): Promise<string | null> {
  const img = await prisma.productImage.findFirst({
    where: { productId },
    orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
    select: { imageUrl: true },
  });
  return img?.imageUrl ?? null;
}

export const createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { addressId, paymentMethod, notes } = req.body;

    if (!addressId || !paymentMethod) {
      return next(new AppError('Address ID and Payment Method are required', 400));
    }

    if (paymentMethod === 'COD') {
      const codSetting = await prisma.setting.findUnique({ where: { key: 'cod_allowed' } });
      const isCodAllowed = (codSetting?.value ?? 'true') === 'true';
      if (!isCodAllowed) {
        return next(new AppError('Cash on Delivery (COD) is not allowed', 400));
      }
    }

    // 1. Fetch Cart and Cart Items
    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      return next(new AppError('Your cart is empty', 400));
    }

    // 2. Fetch Selected Shipping/Billing Address
    const address = await prisma.address.findUnique({
      where: { id: addressId, userId },
    });

    if (!address) {
      return next(new AppError('Shipping address not found', 404));
    }

    const shippingAddressJson = {
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      country: address.country,
      pincode: address.pincode,
    };

    const orderNumber = generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      // Stock Validation & Deduction
      for (const item of cart.items) {
        if (item.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            include: { product: true },
          });
          if (!variant) {
            throw new AppError('Product variant not found', 404);
          }
          if (variant.stock < item.quantity) {
            throw new AppError(`Insufficient stock for variant of product: ${variant.product.name}`, 400);
          }
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          });
        } else {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) {
            throw new AppError('Product not found', 404);
          }
          if (product.stock < item.quantity) {
            throw new AppError(`Insufficient stock for product: ${product.name}`, 400);
          }
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }

      const itemRows = await Promise.all(
        cart.items.map(async (item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.product.name,
          sku: item.product.sku,
          image: await getProductMainImage(item.productId),
          quantity: item.quantity,
          price: item.price,
        }))
      );

      const createdOrder = await tx.order.create({
        data: {
          userId,
          orderNumber,
          subtotal: cart.subtotal,
          discount: cart.discount,
          shipping: cart.shipping,
          tax: cart.tax,
          total: cart.total,
          paymentStatus: 'PENDING',
          orderStatus: ORDER_STATUS.PENDING,
          shippingAddress: shippingAddressJson,
          billingAddress: shippingAddressJson,
          notes,
          items: { create: itemRows },
        },
        include: {
          items: true,
        },
      });

      // If COD, clear Cart immediately
      if (paymentMethod === 'COD') {
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });

        await tx.cart.update({
          where: { id: cart.id },
          data: {
            subtotal: 0,
            discount: 0,
            shipping: 0,
            tax: 0,
            total: 0,
          },
        });

        // Create transaction payment log for COD
        await tx.payment.create({
          data: {
            orderId: createdOrder.id,
            paymentMethod: 'COD',
            paymentStatus: 'PENDING',
            amount: createdOrder.total,
          },
        });
      }

      return createdOrder;
    });

    res.status(201).json({
      status: 'success',
      data: {
        order,
      },
    });

    sendStockUpdatesForOrder(order).catch((err) =>
      console.error('Failed to send stock updates:', err)
    );
  } catch (error) {
    next(error);
  }
};

/** Create order from checkout payload (local cart + shipping form) */
export const createCheckoutOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const {
      shippingAddress,
      items,
      subtotal,
      discount = 0,
      shipping = 0,
      tax = 0,
      total,
      notes,
      paymentMethod = 'RAZORPAY',
    } = req.body;

    if (!shippingAddress || !Array.isArray(items) || items.length === 0) {
      return next(new AppError('Shipping address and cart items are required', 400));
    }

    if (total == null || Number(total) <= 0) {
      return next(new AppError('Valid order total is required', 400));
    }

    const method = String(paymentMethod || 'RAZORPAY').toUpperCase();
    if (method !== 'RAZORPAY' && method !== 'COD') {
      return next(new AppError('Payment method must be RAZORPAY or COD', 400));
    }

    if (method === 'COD') {
      const codSetting = await prisma.setting.findUnique({ where: { key: 'cod_allowed' } });
      const isCodAllowed = (codSetting?.value ?? 'true') === 'true';
      if (!isCodAllowed) {
        return next(new AppError('Cash on Delivery (COD) is not allowed', 400));
      }
    }

    const addressJson = {
      email: shippingAddress.email,
      firstName: shippingAddress.firstName,
      lastName: shippingAddress.lastName,
      phone: shippingAddress.phone || '',
      addressLine1: shippingAddress.address || shippingAddress.addressLine1,
      addressLine2: shippingAddress.apartment || shippingAddress.addressLine2 || '',
      city: shippingAddress.city,
      state: shippingAddress.state || '',
      country: shippingAddress.country || 'India',
      pincode: shippingAddress.postalCode || shippingAddress.pincode,
    };

    const orderNumber = generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      const itemRows = await Promise.all(
        items.map(
          async (item: {
            productId: string;
            productName: string;
            sku: string;
            quantity: number;
            price: number;
            image?: string;
            variantId?: string;
          }) => {
            const product = await tx.product.findUnique({ where: { id: item.productId } });
            if (!product) {
              throw new AppError(`Product not found: ${item.productId}`, 404);
            }
            const image =
              item.image?.trim() || (await getProductMainImage(item.productId));
            return {
              productId: item.productId,
              variantId: item.variantId || null,
              productName: item.productName || product.name,
              sku: item.sku || product.sku,
              image,
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || Number(product.salePrice),
            };
          }
        )
      );

      // Stock Validation & Deduction
      for (const row of itemRows) {
        if (row.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: row.variantId },
            include: { product: true },
          });
          if (!variant) {
            throw new AppError(`Product variant not found: ${row.variantId}`, 404);
          }
          if (variant.stock < row.quantity) {
            throw new AppError(`Insufficient stock for variant of product: ${variant.product.name}`, 400);
          }
          await tx.productVariant.update({
            where: { id: row.variantId },
            data: { stock: { decrement: row.quantity } },
          });
        } else {
          const product = await tx.product.findUnique({
            where: { id: row.productId },
          });
          if (!product) {
            throw new AppError(`Product not found: ${row.productId}`, 404);
          }
          if (product.stock < row.quantity) {
            throw new AppError(`Insufficient stock for product: ${product.name}`, 400);
          }
          await tx.product.update({
            where: { id: row.productId },
            data: { stock: { decrement: row.quantity } },
          });
        }
      }

      const createdOrder = await tx.order.create({
        data: {
          userId,
          orderNumber,
          subtotal: Number(subtotal) || 0,
          discount: Number(discount) || 0,
          shipping: Number(shipping) || 0,
          tax: Number(tax) || 0,
          total: Number(total),
          paymentStatus: method === 'COD' ? 'PENDING' : 'PENDING',
          orderStatus: ORDER_STATUS.PENDING,
          shippingAddress: addressJson,
          billingAddress: addressJson,
          notes,
          items: { create: itemRows },
        },
        include: { items: true, payments: true },
      });

      if (method === 'COD') {
        await tx.payment.create({
          data: {
            orderId: createdOrder.id,
            paymentMethod: 'COD',
            paymentStatus: 'PENDING',
            amount: createdOrder.total,
          },
        });

        const cart = await tx.cart.findFirst({ where: { userId } });
        if (cart) {
          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
          await tx.cart.update({
            where: { id: cart.id },
            data: { subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0 },
          });
        }
      }

      return createdOrder;
    });

    const orderWithPayments =
      method === 'COD'
        ? await prisma.order.findUnique({
            where: { id: order.id },
            include: { items: true, payments: true },
          })
        : order;

    res.status(201).json({
      status: 'success',
      data: { order: orderWithPayments ?? order },
    });

    sendStockUpdatesForOrder(orderWithPayments ?? order).catch((err) =>
      console.error('Failed to send stock updates:', err)
    );
  } catch (error) {
    next(error);
  }
};

export const getAllOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: true,
        payments: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { placedAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: { orders },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;

    const [orders, userReviews] = await Promise.all([
      prisma.order.findMany({
        where: {
          userId,
          ...placedOrderWhere,
        },
        include: {
          items: true,
          payments: true,
        },
        orderBy: { placedAt: 'desc' },
      }),
      prisma.review.findMany({
        where: { userId },
        select: { productId: true, rating: true },
      }),
    ]);

    const reviewMap = new Map(userReviews.map((r) => [r.productId, r.rating]));

    const ordersWithReviewStatus = orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        reviewRating: reviewMap.get(item.productId) ?? null,
      })),
    }));

    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: {
        orders: ordersWithReviewStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
      },
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Restrict access to order owner or admin
    if (order.userId !== userId && userRole !== 'ADMIN') {
      return next(new AppError('You do not have permission to view this order', 403));
    }

    if (userRole !== 'ADMIN' && !isPlacedOrder(order)) {
      return next(new AppError('Order not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const cancelOrderCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
      },
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.userId !== userId) {
      return next(new AppError('You do not have permission to cancel this order', 403));
    }

    if (order.orderStatus !== ORDER_STATUS.PENDING) {
      return next(new AppError('Only pending orders can be cancelled', 400));
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      await restoreOrderStock(tx, id);

      return await tx.order.update({
        where: { id },
        data: {
          orderStatus: ORDER_STATUS.CANCELLED,
        },
        include: {
          items: true,
          payments: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      });
    });

    emitOrderUpdated(updatedOrder);

    res.status(200).json({
      status: 'success',
      data: {
        order: updatedOrder,
      },
    });

    sendStockUpdatesForOrder(updatedOrder).catch((err) =>
      console.error('Failed to send stock updates:', err)
    );
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { orderStatus, paymentStatus } = req.body;

    const existing = await prisma.order.findUnique({
      where: { id },
    });
    if (!existing) {
      return next(new AppError('Order not found', 404));
    }

    const updatedData: Record<string, string> = {};

    if (orderStatus) {
      if (!isValidOrderStatus(orderStatus)) {
        return next(new AppError('Invalid order status', 400));
      }
      const allowedNext = getNextOrderStatuses(existing.orderStatus);
      if (orderStatus !== existing.orderStatus && !allowedNext.includes(orderStatus)) {
        return next(
          new AppError(
            `Cannot change status from ${existing.orderStatus} to ${orderStatus}. Allowed: ${allowedNext.join(', ') || 'none'}`,
            400
          )
        );
      }
      updatedData.orderStatus = orderStatus;
    }

    if (paymentStatus) {
      updatedData.paymentStatus = paymentStatus;
    }

    const order = await prisma.$transaction(async (tx) => {
      if (updatedData.orderStatus === ORDER_STATUS.CANCELLED) {
        await restoreOrderStock(tx, id);
      }

      if (orderStatus === 'DELIVERED') {
        updatedData.paymentStatus = 'SUCCESS';
        await tx.payment.updateMany({
          where: { orderId: id },
          data: { paymentStatus: 'SUCCESS' },
        });
      }

      return await tx.order.update({
        where: { id },
        data: updatedData,
        include: {
          items: true,
          payments: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      });
    });

    emitOrderUpdated(order);

    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });

    if (updatedData.orderStatus === ORDER_STATUS.CANCELLED) {
      sendStockUpdatesForOrder(order).catch((err) =>
        console.error('Failed to send stock updates:', err)
      );
    }
  } catch (error) {
    next(error);
  }
};

