'use client';

import { Header } from './original-landing/Header';
import { Hero } from './original-landing/Hero';
import { TrustSection } from './original-landing/TrustSection';
import { Benefits } from './original-landing/Benefits';
import { PopularDishes } from './original-landing/PopularDishes';
import { AboutSection } from './original-landing/AboutSection';
import { Testimonials } from './original-landing/Testimonials';
import { InfoSection } from './original-landing/InfoSection';
import { FinalCTA } from './original-landing/FinalCTA';
import { Footer } from './original-landing/Footer';

type PreviewItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  categoryName: string | null;
};

export function MarketingHomePage({
  storefrontHref,
  restaurantName: _restaurantName,
  previewItems,
}: {
  storefrontHref: string | null;
  restaurantName: string | null;
  previewItems: PreviewItem[];
}) {
  const primaryHref = storefrontHref ?? '/checkout';

  return (
    <div className="page-shell">
      <Header storefrontHref={primaryHref} />
      <Hero storefrontHref={primaryHref} />
      <TrustSection />
      <Benefits />
      <PopularDishes previewItems={previewItems} storefrontHref={primaryHref} />
      <AboutSection />
      <Testimonials />
      <InfoSection />
      <FinalCTA storefrontHref={primaryHref} />
      <Footer storefrontHref={primaryHref} />
    </div>
  );
}
