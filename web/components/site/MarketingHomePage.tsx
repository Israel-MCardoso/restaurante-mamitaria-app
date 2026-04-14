import Link from 'next/link';
import {
  ArrowRight,
  ChefHat,
  Clock,
  Heart,
  Leaf,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PreviewItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  categoryName: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const WHATSAPP_NUMBER = '5515991442274';
const PHONE_DISPLAY = '+55 15 99144-2274';
const ADDRESS = 'R. Gustavo Teixeira, 42 - Vila Independência';
const MAPS_URL = 'https://maps.app.goo.gl/B2EL1dMpC4auAbj96';

function getWhatsAppUrl(message = 'Olá! Gostaria de fazer um pedido.') {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// ─── Static data ──────────────────────────────────────────────────────────────

const trustStats = [
  { number: '2.500+', label: 'clientes satisfeitos', detail: 'Pedidos recorrentes em ritmo de almoço de confiança.' },
  { number: '4,9', label: 'avaliação média', detail: 'Feedback constante sobre sabor, temperatura e atendimento.' },
  { number: '30 min', label: 'entrega média', detail: 'Cobertura ágil para quem precisa comer bem sem perder tempo.' },
];

const benefits = [
  {
    icon: Heart,
    title: 'Feito com carinho',
    description: 'Cada marmita sai da cozinha com acabamento de comida servida em casa, não de linha de produção.',
  },
  {
    icon: Leaf,
    title: 'Ingredientes frescos',
    description: 'Compras diárias e preparo do zero para manter sabor limpo, cor bonita e textura de almoço recém-feito.',
  },
  {
    icon: Truck,
    title: 'Entrega rápida',
    description: 'Logística pensada para o horário mais corrido do dia, com comida chegando quente e no ponto.',
  },
  {
    icon: ChefHat,
    title: 'Receitas tradicionais',
    description: 'Um cardápio construído sobre clássicos mineiros, com tempero caseiro e repertório afetivo.',
  },
];

const testimonials = [
  {
    name: 'Ana Paula Silva',
    rating: 5,
    text: 'A melhor marmita que já comi. O tempero é impecável e a entrega sempre acontece no horário.',
    date: 'Há 1 semana',
  },
  {
    name: 'Carlos Eduardo',
    rating: 5,
    text: 'Comida caseira de verdade, com sabor de receita de família. O feijão tropeiro virou meu pedido fixo.',
    date: 'Há 2 semanas',
  },
  {
    name: 'Juliana Mendes',
    rating: 5,
    text: 'Qualidade consistente, preço justo e apresentação muito boa. A costela no bafo é memorável.',
    date: 'Há 3 semanas',
  },
  {
    name: 'Roberto Alves',
    rating: 5,
    text: 'Marmita bem servida, quentinha e com atendimento rápido. Dá para confiar até nos dias mais corridos.',
    date: 'Há 1 mês',
  },
];

const infos = [
  {
    icon: Clock,
    title: 'Horário',
    details: ['Segunda a sexta', '11:00 às 14:30'],
  },
  {
    icon: Phone,
    title: 'Contato',
    details: [`WhatsApp: ${PHONE_DISPLAY}`, 'Pagamento via PIX ou dinheiro'],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

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
    <main className="page-shell">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen items-end overflow-hidden pt-32">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1621179816782-1c39a6583fbc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmF6aWxpYW4lMjBmZWlqb2FkYSUyMGZvb2R8ZW58MXx8fHwxNzc1NzU3MTcxfDA&ixlib=rb-4.1.0&q=80&w=1600')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(18, 12, 10, 0.86) 0%, rgba(18, 12, 10, 0.58) 44%, rgba(18, 12, 10, 0.34) 100%)',
          }}
        />
        <div
          className="hero-orb absolute -left-10 top-40 h-48 w-48 rounded-full blur-3xl"
          style={{ backgroundColor: 'rgba(200, 135, 63, 0.24)' }}
        />
        <div
          className="hero-orb absolute bottom-24 right-12 h-64 w-64 rounded-full blur-3xl"
          style={{ backgroundColor: 'rgba(111, 143, 114, 0.18)', animationDelay: '1.5s' }}
        />

        <div className="content-shell relative z-10 w-full pb-14 sm:pb-18 lg:pb-24">
          <div className="grid items-end gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.34fr)] lg:gap-10">
            <div className="max-w-4xl text-white">
              <div
                className="eyebrow-dot hero-reveal inline-flex items-center gap-3 rounded-full px-4 py-2"
                style={{
                  backgroundColor: 'rgba(255, 250, 244, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                }}
              >
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-white/88">
                  Almoço caseiro entregue no mesmo dia
                </span>
              </div>

              <div className="hero-reveal hero-reveal-delay mt-8 max-w-4xl">
                <span className="mb-4 block text-sm font-semibold uppercase tracking-[0.28em] text-white/58">
                  Sabor Mineiro
                </span>
                <h1
                  className="max-w-[12ch] text-[clamp(4rem,9vw,8.4rem)] font-semibold leading-[0.92] tracking-[-0.055em]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Comida mineira com presença de almoço especial.
                </h1>
                <p className="mt-7 max-w-2xl text-[clamp(1.05rem,1.8vw,1.32rem)] leading-8 text-white/80 sm:leading-9">
                  Marmitas preparadas diariamente com receitas tradicionais, ingredientes frescos e o cuidado de quem
                  trata cada pedido como visita esperada para o almoço.
                </p>
              </div>

              <div className="hero-reveal hero-reveal-delay mt-10 flex flex-col items-start gap-4 sm:flex-row">
                <Link href={primaryHref} className="premium-button px-8 py-4 sm:w-auto">
                  Fazer pedido
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={getWhatsAppUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="premium-button premium-button--ghost px-8 py-4 text-white sm:w-auto"
                  style={{ color: 'white' }}
                >
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp
                </a>
              </div>

              <div className="hero-reveal hero-reveal-delay mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/14 pt-6 text-sm text-white/72">
                <span>4,9 de média com mais de 2.500 pedidos avaliados</span>
                <span className="hidden h-1.5 w-1.5 rounded-full bg-white/28 sm:block" />
                <span>Atendimento direto pelo WhatsApp oficial da casa</span>
              </div>
            </div>

            <div className="hidden gap-6 text-white/84 lg:grid">
              <div className="border-t border-white/14 pt-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-white/48">Cozinha do dia</p>
                <p className="mt-3 text-lg leading-8 text-white/82">
                  Pratos montados em pequenos lotes para manter textura, aroma e temperatura até a entrega.
                </p>
              </div>
              <div className="border-t border-white/14 pt-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-white/48">Receita de casa</p>
                <p className="mt-3 text-lg leading-8 text-white/82">
                  Temperos feitos do zero, sem atalhos industriais, com repertório de mesa mineira tradicional.
                </p>
              </div>
              <div className="border-t border-white/14 pt-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-white/48">Atendimento</p>
                <p className="mt-3 text-lg leading-8 text-white/82">
                  Pedido pelo WhatsApp com resposta rápida para almoço prático, elegante e sem surpresa.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 md:block">
          <div className="flex h-12 w-7 items-start justify-center rounded-full border border-white/28 p-2">
            <div className="h-2.5 w-1 rounded-full bg-white/80" />
          </div>
        </div>
      </section>

      {/* ── Trust ─────────────────────────────────────────────────────────── */}
      <section className="section-shell section-divider" style={{ backgroundColor: 'var(--surface-dark)' }}>
        <div className="content-shell">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_2fr] lg:gap-12">
            <div>
              <span className="section-kicker" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Credibilidade construída no dia a dia
              </span>
              <h2
                className="mt-4 text-[clamp(2.8rem,4vw,4.4rem)] leading-[0.95] tracking-[-0.05em] text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Presença local com padrão de casa bem servida.
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3 md:gap-8">
              {trustStats.map((stat) => (
                <div key={stat.label} className="border-t border-white/14 pt-5 text-white">
                  <div
                    className="text-[clamp(3rem,5vw,4.5rem)] font-semibold leading-none tracking-[-0.05em]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {stat.number}
                  </div>
                  <p className="mt-4 text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-white/52">
                    {stat.label}
                  </p>
                  <p className="mt-4 max-w-xs text-base leading-7 text-white/72">{stat.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits ──────────────────────────────────────────────────────── */}
      <section className="section-shell">
        <div className="content-shell">
          <div className="section-intro lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.7fr)] lg:items-end lg:justify-between">
            <div>
              <span className="section-kicker">O que eleva a experiência</span>
              <h2 className="section-title mt-4">Mais do que praticidade, uma refeição com presença.</h2>
            </div>
            <p className="section-copy lg:justify-self-end">
              A proposta combina tradição mineira, agilidade urbana e um cuidado visual que faz a refeição chegar com
              cara de almoço importante, mesmo nos dias mais corridos.
            </p>
          </div>

          <div className="grid gap-x-14 gap-y-1 lg:grid-cols-2">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <article
                  key={benefit.title}
                  className="flex gap-6 border-t pb-7 pt-8"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <span
                    className="mt-1 text-[1.15rem] font-semibold tracking-[0.18em]"
                    style={{ color: 'rgba(106, 91, 83, 0.52)', fontFamily: 'var(--font-display)' }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1">
                    <Icon className="h-5 w-5" style={{ color: 'var(--gold)', strokeWidth: 1.7 }} />
                    <h3
                      className="mt-5 text-[2rem] leading-none tracking-[-0.04em]"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-strong)' }}
                    >
                      {benefit.title}
                    </h3>
                    <p className="mt-4 max-w-lg text-[1.03rem] leading-8" style={{ color: 'var(--ink-muted)' }}>
                      {benefit.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Popular Dishes ────────────────────────────────────────────────── */}
      <section
        id="pratos"
        className="section-shell section-divider overflow-hidden"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.55)' }}
      >
        <div
          className="absolute left-1/2 top-30 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
          style={{ backgroundColor: 'rgba(200, 135, 63, 0.12)' }}
        />
        <div className="content-shell">
          {/* Section intro */}
          <div className="section-intro lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.7fr)] lg:items-end lg:justify-between">
            <div>
              <span className="section-kicker">Cardápio em destaque</span>
              <h2 className="section-title mt-4">Pratos com cara de favoritos instantâneos.</h2>
            </div>
            <p className="section-copy lg:justify-self-end">
              Uma curadoria de combinações que chegam bem montadas, apetitosas e fáceis de escolher quando o almoço
              pede praticidade sem abrir mão de sabor.
            </p>
          </div>

          {/* Empty state */}
          {previewItems.length === 0 ? (
            <div className="soft-card rounded-[2rem] p-8">
              <span className="section-kicker">Cardápio em atualização</span>
              <h3
                className="mt-4 text-[2.4rem] leading-none tracking-[-0.05em]"
                style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}
              >
                Cardápio indisponível no momento.
              </h3>
              <p className="mt-4 max-w-2xl text-base leading-7" style={{ color: 'var(--ink-muted)' }}>
                A cozinha ainda está atualizando os pratos disponíveis para hoje. A loja funcional continua disponível
                normalmente.
              </p>
            </div>
          ) : (
            /* Editorial 2-column grid — mirrors ProductGrid layout from the original */
            <div className="grid gap-6 lg:grid-cols-2">
              {previewItems.map((item, index) => {
                const isFeatured = index === 0;

                return (
                  <article
                    key={item.id}
                    className={`soft-card overflow-hidden rounded-[2rem]${
                      isFeatured ? ' lg:col-span-2 lg:grid lg:grid-cols-[1.12fr_0.88fr]' : ''
                    }`}
                  >
                    {/* Image frame with price + category overlay */}
                    <div
                      className={`food-image-frame relative block w-full${
                        isFeatured ? ' min-h-[500px]' : ' h-[360px]'
                      }`}
                    >
                      <img
                        src={
                          item.imageUrl ??
                          'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80'
                        }
                        alt={item.name}
                        width={isFeatured ? 720 : 640}
                        height={isFeatured ? 500 : 360}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        className="food-image"
                      />
                      {/* Overlay: category badge + price */}
                      <div className="absolute inset-x-0 bottom-0 z-[3] p-6 sm:p-7">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <span
                            className="inline-flex rounded-full px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.24em]"
                            style={{
                              backgroundColor: 'rgba(18, 12, 10, 0.46)',
                              color: 'rgba(255,255,255,0.84)',
                            }}
                          >
                            {isFeatured ? 'Assinatura da casa' : 'Prato do dia'}
                          </span>
                          <span
                            className="rounded-full px-4 py-2 text-sm font-semibold"
                            style={{
                              backgroundColor: 'rgba(255, 248, 240, 0.16)',
                              color: 'white',
                              backdropFilter: 'blur(10px)',
                            }}
                          >
                            {formatCurrency(item.price)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div
                      className={`flex flex-col justify-between${
                        isFeatured ? ' p-8 sm:p-10 lg:p-12' : ' p-7 sm:p-8'
                      }`}
                    >
                      <div>
                        {isFeatured ? (
                          <span
                            className="inline-flex rounded-full px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em]"
                            style={{ backgroundColor: 'rgba(200, 135, 63, 0.12)', color: 'var(--brand)' }}
                          >
                            Mais pedido da casa
                          </span>
                        ) : null}

                        {item.categoryName ? (
                          <p
                            className="mt-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em]"
                            style={{ color: 'var(--brand)' }}
                          >
                            {item.categoryName}
                          </p>
                        ) : null}

                        <h3
                          className={`leading-none tracking-[-0.045em]${
                            isFeatured ? ' mt-6 text-[3rem]' : ' mt-4 text-[2.15rem]'
                          }`}
                          style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-strong)' }}
                        >
                          {item.name}
                        </h3>
                        <p
                          className={`mt-4 max-w-xl${isFeatured ? ' text-[1.08rem] leading-8' : ' text-base leading-7'}`}
                          style={{ color: 'var(--ink-muted)' }}
                        >
                          {item.description ||
                            'Receita preparada com atenção ao ponto, ao sabor e à experiência de entrega.'}
                        </p>
                      </div>

                      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <Link href={primaryHref} className="premium-button px-6 py-3 sm:w-auto">
                          {isFeatured ? (
                            <ShoppingBag className="h-4 w-4" />
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                          {isFeatured ? 'Ver cardápio completo' : 'Ver no cardápio'}
                        </Link>
                        <a
                          href={getWhatsAppUrl(`Olá! Gostaria de pedir: ${item.name}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="premium-button premium-button--ghost px-6 py-3 sm:w-auto"
                          style={{
                            color: 'var(--brand)',
                            borderColor: 'var(--line)',
                            background: 'rgba(255,250,244,0.62)',
                          }}
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <section id="sobre" className="section-shell" style={{ backgroundColor: 'rgba(234, 217, 192, 0.42)' }}>
        <div className="content-shell">
          <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <div className="relative overflow-hidden rounded-[2.25rem] soft-card">
              <div
                className="relative flex h-[520px] items-end justify-center overflow-hidden sm:h-[620px]"
                style={{
                  background:
                    'radial-gradient(circle at 50% 24%, rgba(255,255,255,0.9) 0%, rgba(255,248,240,0.78) 38%, rgba(226,183,146,0.72) 100%)',
                }}
              >
                <img
                  src="/daiana-xavier.png"
                  alt="Daiana Xavier"
                  width="720"
                  height="620"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain object-bottom"
                />
              </div>
            </div>

            <div>
              <span className="section-kicker">Quem cozinha</span>
              <h2 className="section-title mt-4">História de recomeço, afeto e comida com propósito.</h2>

              <div className="mt-8 space-y-6 text-[1.05rem] leading-8" style={{ color: 'var(--ink-muted)' }}>
                <p>
                  <strong style={{ color: 'var(--brand)' }}>Daiana Xavier</strong> é empreendedora na área de
                  gastronomia, mineira, mãe de quatro filhos e apaixonada por transformar comida em experiências
                  afetivas.
                </p>
                <p>
                  Após recomeçar sua vida em Sorocaba, construiu uma trajetória sólida com base em dedicação,
                  consistência e amor pelo que faz. Hoje, como CEO do Ateliê Daiana Xavier, leva diariamente o
                  verdadeiro sabor da comida caseira para seus clientes.
                </p>
                <p>Sua missão é simples: oferecer mais do que refeições — criar momentos que marcam.</p>
              </div>

              <div className="mt-10 border-t pt-6" style={{ borderColor: 'var(--line)' }}>
                <p
                  className="text-[0.74rem] font-semibold uppercase tracking-[0.26em]"
                  style={{ color: 'rgba(106, 91, 83, 0.62)' }}
                >
                  Essência
                </p>
                <p className="mt-3 text-lg leading-8" style={{ color: 'var(--ink)' }}>
                  "Mais do que refeições, experiências afetivas servidas com sabor de casa."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────────────── */}
      <section id="depoimentos" className="section-shell section-divider">
        <div className="content-shell">
          <div className="section-intro lg:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)] lg:items-end lg:justify-between">
            <div>
              <span className="section-kicker">Avaliações reais</span>
              <h2 className="section-title mt-4">
                Confiança percebida no primeiro pedido e confirmada nos próximos.
              </h2>
            </div>
            <p className="section-copy lg:justify-self-end">
              Os depoimentos mostram um padrão que se repete: sabor consistente, entrega confiável e sensação de
              refeição feita com mais cuidado do que o comum no delivery.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {testimonials.map((testimonial) => (
              <article key={testimonial.name} className="soft-card rounded-[2rem] p-8 sm:p-10">
                <div className="flex items-center gap-1">
                  {Array.from({ length: testimonial.rating }).map((_, index) => (
                    <Star key={index} className="h-4 w-4" style={{ fill: 'var(--gold)', color: 'var(--gold)' }} />
                  ))}
                </div>

                <p
                  className="mt-8 max-w-[32rem] text-[1.35rem] leading-9 tracking-[-0.015em]"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-strong)' }}
                >
                  "{testimonial.text}"
                </p>

                <div className="mt-8 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
                  <p className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                    {testimonial.name}
                  </p>
                  <p className="mt-1 text-sm uppercase tracking-[0.22em]" style={{ color: 'rgba(106, 91, 83, 0.62)' }}>
                    {testimonial.date}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Info ──────────────────────────────────────────────────────────── */}
      <section className="section-shell" style={{ backgroundColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="content-shell">
          <div className="section-intro">
            <span className="section-kicker">Informações úteis</span>
            <h2 className="section-title mt-4">Tudo o que você precisa para pedir sem atrito.</h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.95fr_0.95fr_1.1fr]">
            {infos.map((info) => {
              const Icon = info.icon;
              return (
                <article key={info.title} className="soft-card rounded-[2rem] p-8 sm:p-9">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ backgroundColor: 'rgba(200, 135, 63, 0.12)' }}
                  >
                    <Icon className="h-6 w-6" style={{ color: 'var(--brand)', strokeWidth: 1.7 }} />
                  </div>
                  <h3
                    className="mt-8 text-[2rem] leading-none tracking-[-0.04em]"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-strong)' }}
                  >
                    {info.title}
                  </h3>
                  <div className="mt-6 space-y-3 text-[1rem] leading-7" style={{ color: 'var(--ink-muted)' }}>
                    {info.details.map((detail) => (
                      <p key={detail}>{detail}</p>
                    ))}
                  </div>
                </article>
              );
            })}

            <article className="soft-card rounded-[2rem] p-8 sm:p-9">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(200, 135, 63, 0.12)' }}
              >
                <MapPin className="h-6 w-6" style={{ color: 'var(--brand)', strokeWidth: 1.7 }} />
              </div>
              <h3
                className="mt-8 text-[2rem] leading-none tracking-[-0.04em]"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-strong)' }}
              >
                Localidade
              </h3>
              <p className="mt-6 text-[1rem] leading-7" style={{ color: 'var(--ink-muted)' }}>
                {ADDRESS}
              </p>
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="premium-button mt-8 inline-flex w-auto px-6 py-3"
              >
                Abrir no Maps
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="section-shell overflow-hidden" style={{ backgroundColor: 'var(--surface-dark)' }}>
        <div
          className="absolute -left-16 top-10 h-56 w-56 rounded-full blur-3xl"
          style={{ backgroundColor: 'rgba(200, 135, 63, 0.18)' }}
        />
        <div
          className="absolute -right-16 bottom-10 h-64 w-64 rounded-full blur-3xl"
          style={{ backgroundColor: 'rgba(111, 143, 114, 0.16)' }}
        />

        <div className="content-shell relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <span className="section-kicker" style={{ color: 'rgba(255,255,255,0.42)' }}>
              Pedido imediato
            </span>
            <h2
              className="mx-auto mt-4 max-w-[10ch] text-[clamp(3.2rem,6vw,5.4rem)] leading-[0.94] tracking-[-0.05em] text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Seu próximo almoço pode sair daqui em minutos.
            </h2>
            <p className="mx-auto mt-7 max-w-2xl text-[1.1rem] leading-8 text-white/74">
              Monte seu pedido pelo cardápio e receba uma marmita quentinha, bem montada e pronta para transformar a
              pausa do dia em um momento melhor.
            </p>

            <div className="mt-10 flex justify-center">
              <Link href={primaryHref} className="premium-button px-8 py-4 sm:w-auto">
                Pedir agora
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>

            <p className="mt-6 text-sm uppercase tracking-[0.22em] text-white/46">
              Atendimento complementar pelo WhatsApp
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
