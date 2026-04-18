import Link from 'next/link';
import { MessageCircle, ShoppingCart } from 'lucide-react';
import { getWhatsAppUrl, formatCurrency } from './siteConfig';

type PreviewItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  categoryName: string | null;
};

export function PopularDishes({
  previewItems,
  storefrontHref,
}: {
  previewItems: PreviewItem[];
  storefrontHref: string;
}) {
  return (
    <section
      id="pratos"
      className="section-shell section-divider overflow-hidden"
      style={{ backgroundColor: 'rgba(255, 255, 255, 0.55)' }}
    >
      <div
        className="absolute left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
        style={{ top: '7.5rem', backgroundColor: 'rgba(200, 135, 63, 0.12)' }}
      />
      <div className="content-shell">
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
          <div className="grid gap-6 lg:grid-cols-2">
            {previewItems.map((item, index) => {
              const featured = index === 0;

              return (
                <article
                  key={item.id}
                  className={`soft-card overflow-hidden rounded-[2rem]${
                    featured ? ' lg:col-span-2 lg:grid lg:grid-cols-[1.12fr_0.88fr]' : ''
                  }`}
                >
                  {/* ── Image ───────────────────────────────────────────── */}
                  <div
                    className={`food-image-frame relative block w-full${
                      featured ? ' h-[360px] min-h-[360px] lg:min-h-[500px]' : ' h-[360px] min-h-[360px]'
                    }`}
                  >
                    <img
                      src={
                        item.imageUrl ??
                        'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80'
                      }
                      alt={item.name}
                      width={featured ? 720 : 640}
                      height={featured ? 500 : 360}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="food-image absolute inset-0 block h-full w-full object-cover object-center"
                    />

                    {/* Overlay bottom row */}
                    <div className="absolute inset-x-0 bottom-0 z-[3] p-6 sm:p-7">
                      <div className="flex flex-wrap items-end justify-between gap-3">

                        {featured ? (
                          /* Featured: badge "Assinatura da casa" + ingredient excerpt below */
                          <div className="flex flex-col gap-1.5">
                            <span
                              className="inline-flex self-start rounded-full px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.24em]"
                              style={{
                                backgroundColor: 'rgba(18, 12, 10, 0.46)',
                                color: 'rgba(255,255,255,0.84)',
                              }}
                            >
                              Assinatura da casa
                            </span>
                            {item.description ? (
                              <span
                                className="text-[0.67rem] font-semibold uppercase tracking-[0.18em]"
                                style={{ color: 'rgba(255,255,255,0.72)' }}
                              >
                                {item.description.slice(0, 40).toUpperCase()}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          /* Non-featured: "PRATO DO DIA" label + ingredient excerpt */
                          <div className="flex flex-col gap-1">
                            <span
                              className="text-[0.62rem] font-semibold uppercase tracking-[0.26em]"
                              style={{ color: 'rgba(255,255,255,0.62)' }}
                            >
                              Prato do dia
                            </span>
                            {item.description ? (
                              <span
                                className="text-[0.67rem] font-semibold uppercase tracking-[0.16em]"
                                style={{ color: 'rgba(255,255,255,0.84)' }}
                              >
                                {item.description.slice(0, 38).toUpperCase()}
                              </span>
                            ) : null}
                          </div>
                        )}

                        {/* Price badge */}
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

                  {/* ── Text area ───────────────────────────────────────── */}
                  <div
                    className={`flex flex-col justify-between${
                      featured ? ' p-8 sm:p-10 lg:p-12' : ' p-7 sm:p-8'
                    }`}
                  >
                    <div>
                      {/* Featured badge */}
                      {featured ? (
                        <span
                          className="inline-flex rounded-full px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em]"
                          style={{ backgroundColor: 'rgba(200, 135, 63, 0.12)', color: 'var(--brand)' }}
                        >
                          Mais pedido da casa
                        </span>
                      ) : null}

                      {/* Category kicker (featured only, above title) */}
                      {featured && item.categoryName ? (
                        <p
                          className="mt-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em]"
                          style={{ color: 'var(--brand)' }}
                        >
                          {item.categoryName}
                        </p>
                      ) : null}

                      {/* Title */}
                      <h3
                        className={`leading-none tracking-[-0.045em]${
                          featured ? ' mt-6 text-[2.15rem] lg:text-[3rem]' : ' mt-1 text-[2.15rem]'
                        }`}
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-strong)' }}
                      >
                        {item.name}
                      </h3>

                      {/* Description */}
                      <p
                        className={`mt-4 max-w-xl${featured ? ' text-base leading-7 lg:text-[1.08rem] lg:leading-8' : ' text-base leading-7'}`}
                        style={{ color: 'var(--ink-muted)' }}
                      >
                        {item.description ||
                          'Receita preparada com atenção ao ponto, ao sabor e à experiência de entrega.'}
                      </p>

                      {/* Tag pills — category name as pill (matches original ingredient tags visual) */}
                      {item.categoryName ? (
                        <div className="mt-5 flex flex-wrap gap-2">
                          <span
                            className="inline-flex rounded-full border px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em]"
                            style={{
                              borderColor: 'rgba(107, 62, 46, 0.2)',
                              color: 'var(--brand)',
                              backgroundColor: 'rgba(107, 62, 46, 0.05)',
                            }}
                          >
                            {item.categoryName}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Buttons */}
                    <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Link href={storefrontHref} className="premium-button px-6 py-3 sm:w-auto">
                          <ShoppingCart className="h-4 w-4" />
                          Adicionar ao carrinho
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
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
