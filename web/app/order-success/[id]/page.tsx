'use client';

import { use } from 'react';
import { OrderTrackingView } from '@/components/order/OrderTrackingView';
import { SiteFooter, SiteHeader } from '@/components/site/SiteChrome';

export default function OrderSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <>
      <SiteHeader fallbackMenuHref="/" />
      <OrderTrackingView orderId={id} />
      <SiteFooter />
    </>
  );
}
