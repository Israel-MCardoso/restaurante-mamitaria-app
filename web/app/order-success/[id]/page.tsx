'use client';

import { use } from 'react';
import { OrderTrackingView } from '@/components/order/OrderTrackingView';
import { AppFooter, AppHeader } from '@/components/site/SiteChrome';

export default function OrderSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <>
      <AppHeader backHref="/" backLabel="Voltar ao início" />
      <OrderTrackingView orderId={id} />
      <AppFooter />
    </>
  );
}
