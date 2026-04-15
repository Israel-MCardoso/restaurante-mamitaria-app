import { Star } from 'lucide-react';

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

export function Testimonials() {
  return (
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
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4" style={{ fill: 'var(--gold)', color: 'var(--gold)' }} />
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
  );
}
