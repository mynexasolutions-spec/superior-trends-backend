/** Order lifecycle — stored as strings in DB */
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** Allowed statuses */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
];

export function isValidOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUS_FLOW.includes(value as OrderStatus);
}

export function getNextOrderStatuses(current: string): OrderStatus[] {
  const currentStatus = current as OrderStatus;
  // Terminal statuses
  if (currentStatus === ORDER_STATUS.DELIVERED || currentStatus === ORDER_STATUS.CANCELLED) {
    return [];
  }
  // Return all other statuses
  return ORDER_STATUS_FLOW.filter(status => status !== currentStatus);
}

