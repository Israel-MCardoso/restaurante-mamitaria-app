export function AboutSection() {
  return (
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
  );
}
