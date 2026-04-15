const stats = [
  { number: '2.500+', label: 'clientes satisfeitos', detail: 'Pedidos recorrentes em ritmo de almoço de confiança.' },
  { number: '4,9', label: 'avaliação média', detail: 'Feedback constante sobre sabor, temperatura e atendimento.' },
  { number: '30 min', label: 'entrega média', detail: 'Cobertura ágil para quem precisa comer bem sem perder tempo.' },
];

export function TrustSection() {
  return (
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
            {stats.map((stat) => (
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
  );
}
