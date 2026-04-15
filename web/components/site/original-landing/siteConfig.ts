export const PHONE_DISPLAY = '+55 15 99144-2274';
export const WHATSAPP_NUMBER = '5515991442274';
export const ADDRESS = 'R. Gustavo Teixeira, 42 - Vila Independência';
export const MAPS_URL = 'https://maps.app.goo.gl/B2EL1dMpC4auAbj96';
export const INSTAGRAM_URL =
  'https://www.instagram.com/daianaxavier_marmitaria?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==';

export function getWhatsAppUrl(message = 'Olá! Gostaria de fazer um pedido.') {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
