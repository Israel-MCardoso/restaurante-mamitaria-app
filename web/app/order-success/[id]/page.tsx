'use client';

import { OrderTrackingView } from '@/components/order/OrderTrackingView';

export default function OrderSuccessPage({ params }: { params: { id: string } }) {
  return <OrderTrackingView orderId={params.id} />;
}
