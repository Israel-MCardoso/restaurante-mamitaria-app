import { Clock, MapPin, Phone } from 'lucide-react';
import { ADDRESS, MAPS_URL, PHONE_DISPLAY } from './siteConfig';

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

export function InfoSection() {
  return (
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
  );
}
