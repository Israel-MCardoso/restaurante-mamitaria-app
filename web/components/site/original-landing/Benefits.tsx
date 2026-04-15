import { ChefHat, Heart, Leaf, Truck } from 'lucide-react';

const benefits = [
  {
    icon: Heart,
    title: 'Feito com carinho',
    description: 'Cada marmita sai da cozinha com acabamento de comida servida em casa, não de linha de produção.',
  },
  {
    icon: Leaf,
    title: 'Ingredientes frescos',
    description:
      'Compras diárias e preparo do zero para manter sabor limpo, cor bonita e textura de almoço recém-feito.',
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

export function Benefits() {
  return (
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
                className="flex gap-6 border-t pt-8 pb-7"
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
  );
}
