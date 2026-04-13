type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  const iconSize = compact ? 34 : 52;

  return (
    <div className="flex items-center gap-2.5 sm:gap-4" aria-label="Família Mineira">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 72 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <path
          d="M17 28C17 20.8203 22.8203 15 30 15H42C49.1797 15 55 20.8203 55 28V44C55 51.1797 49.1797 57 42 57H30C22.8203 57 17 51.1797 17 44V28Z"
          fill="#9C7047"
          stroke="#C98B64"
          strokeWidth="2.4"
        />
        <path
          d="M17 31C20.5 29.2 23.8 28.3 27.2 28.3H44.8C48.2 28.3 51.5 29.2 55 31"
          stroke="#E6B08B"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M27 20.5C28.8 18.9 31.1 18 33.5 18H38.5C40.9 18 43.2 18.9 45 20.5L48 23.2H24L27 20.5Z"
          fill="#8C623C"
          stroke="#C98B64"
          strokeWidth="2.2"
        />
        <path d="M12 28.8C12 24.9 15.1 21.8 19 21.8H20.8V35.5H19C15.1 35.5 12 32.4 12 28.8Z" fill="#9C7047" stroke="#C98B64" strokeWidth="2.2" />
        <path d="M60 28.8C60 24.9 56.9 21.8 53 21.8H51.2V35.5H53C56.9 35.5 60 32.4 60 28.8Z" fill="#9C7047" stroke="#C98B64" strokeWidth="2.2" />
        <path d="M34 10C34 10 31.7 6.8 34 3.8" stroke="#C98B64" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M41 9C41 9 38.7 5.8 41 2.8" stroke="#C98B64" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M48 11C48 11 45.7 7.8 48 4.8" stroke="#C98B64" strokeWidth="2.4" strokeLinecap="round" />
        <path
          d="M20.2 11.4C20.2 8.5 23.4 6.7 25.9 8.2C27.1 8.9 27.8 10.1 27.8 11.4C27.8 13.4 25.8 15.5 22.9 17.7C20 15.5 20.2 13.4 20.2 11.4Z"
          fill="#C98B64"
        />
        <path
          d="M52.2 11.4C52.2 8.5 55.4 6.7 57.9 8.2C59.1 8.9 59.8 10.1 59.8 11.4C59.8 13.4 57.8 15.5 54.9 17.7C52 15.5 52.2 13.4 52.2 11.4Z"
          fill="#88A35B"
        />
      </svg>

      <div className="leading-none">
        <div
          className={`${compact ? 'text-[1.45rem] sm:text-[2rem]' : 'text-[2.2rem] sm:text-[2.5rem]'} tracking-[-0.06em]`}
          style={{ fontFamily: 'var(--font-display)', color: '#88A35B', lineHeight: 0.82 }}
        >
          Família
        </div>
        <div
          className={`${compact ? 'text-[1.08rem] sm:text-[1.5rem]' : 'text-[1.6rem] sm:text-[1.85rem]'} tracking-[-0.055em]`}
          style={{ fontFamily: 'var(--font-display)', color: '#C98B64', lineHeight: 0.84 }}
        >
          Mineira
        </div>
        <div
          className={`${compact ? 'mt-0.5 text-[0.38rem]' : 'mt-1 text-[0.52rem]'} uppercase tracking-[0.18em] sm:text-[0.58rem]`}
          style={{ color: 'rgba(80, 64, 52, 0.76)' }}
        >
          Marmitaria e Doceria
        </div>
        {!compact ? (
          <div
            className="mt-1 text-[0.86rem] sm:text-[0.95rem]"
            style={{ color: '#88A35B', fontFamily: 'cursive' }}
          >
            Daiana Xavier
          </div>
        ) : null}
      </div>
    </div>
  );
}
