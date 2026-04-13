'use client';

import { use } from 'react';
import { OrderTrackingView } from '@/components/order/OrderTrackingView';

export default function OrderSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <OrderTrackingView orderId={id} />;
}
