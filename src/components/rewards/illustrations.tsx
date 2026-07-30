/**
 * Premium hand-built SVG illustrations for the Rewards Hub feature modules.
 * No emoji artwork — every scene is vector with gradients, glass panels,
 * soft lighting and floating decorative elements. Animation is driven by the
 * parent `.group` hover state plus a few always-on ambient loops, so the whole
 * set stays GPU-cheap (transform/opacity only).
 */

type Props = { className?: string };

const base = "h-full w-full";

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-em`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--primary-glow)" />
        <stop offset="100%" stopColor="var(--accent)" />
      </linearGradient>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--rw-gold-soft)" />
        <stop offset="55%" stopColor="var(--rw-gold)" />
        <stop offset="100%" stopColor="var(--rw-gold-deep)" />
      </linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stopColor="oklch(1 0 0)" stopOpacity="0.24" />
        <stop offset="100%" stopColor="oklch(1 0 0)" stopOpacity="0.03" />
      </linearGradient>
      <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.55" />
        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="oklch(1 0 0)" stopOpacity="0" />
        <stop offset="50%" stopColor="oklch(1 0 0)" stopOpacity="0.5" />
        <stop offset="100%" stopColor="oklch(1 0 0)" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

function Sparkle({ x, y, r = 3, delay = 0 }: { x: number; y: number; r?: number; delay?: number }) {
  return (
    <g className="rw-twinkle" style={{ animationDelay: `${delay}s`, transformOrigin: `${x}px ${y}px` }}>
      <path
        d={`M${x} ${y - r * 2} L${x + r * 0.55} ${y - r * 0.55} L${x + r * 2} ${y} L${x + r * 0.55} ${y + r * 0.55} L${x} ${y + r * 2} L${x - r * 0.55} ${y + r * 0.55} L${x - r * 2} ${y} L${x - r * 0.55} ${y - r * 0.55} Z`}
        fill="var(--rw-gold-soft)"
      />
    </g>
  );
}

function Coin({ x, y, s = 1, delay = 0, id }: { x: number; y: number; s?: number; delay?: number; id: string }) {
  return (
    <g className="rw-float" style={{ animationDelay: `${delay}s` }} transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="3" rx="13" ry="4" fill="oklch(0 0 0)" opacity="0.25" />
      <circle cx="0" cy="0" r="13" fill={`url(#${id}-gold)`} />
      <circle cx="0" cy="0" r="9" fill="none" stroke="oklch(1 0 0)" strokeOpacity="0.45" strokeWidth="1.5" />
      <path d="M-3.4 -4.6h6.8M0 -4.6v9.2M-3.4 4.6h6.8" stroke="oklch(0.25 0.05 80)" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Daily spin — 3D wheel, coins, gift boxes, sparkles               */

export function SpinIllustration({ className = "" }: Props) {
  const id = "rwspin";
  const segs = 8;
  return (
    <svg viewBox="0 0 320 260" className={`${base} ${className}`} role="img" aria-label="Illustration of a glowing prize wheel surrounded by coins and gift boxes">
      <Defs id={id} />
      <circle cx="160" cy="126" r="112" fill={`url(#${id}-halo)`} className="rw-pulse-glow" />

      <g className="rw-wheel" style={{ transformOrigin: "160px 126px" }}>
        <circle cx="160" cy="132" r="86" fill="oklch(0 0 0)" opacity="0.35" />
        <circle cx="160" cy="126" r="86" fill={`url(#${id}-gold)`} />
        <circle cx="160" cy="126" r="78" fill="oklch(0.16 0.02 160)" />
        {Array.from({ length: segs }).map((_, i) => {
          const a0 = (i / segs) * Math.PI * 2 - Math.PI / 2;
          const a1 = ((i + 1) / segs) * Math.PI * 2 - Math.PI / 2;
          const p = (a: number) => `${160 + Math.cos(a) * 78} ${126 + Math.sin(a) * 78}`;
          return (
            <path
              key={i}
              d={`M160 126 L${p(a0)} A78 78 0 0 1 ${p(a1)} Z`}
              fill={i % 2 ? "var(--primary)" : "var(--accent)"}
              opacity={i % 2 ? 0.85 : 0.5}
            />
          );
        })}
        {Array.from({ length: segs }).map((_, i) => {
          const a = (i / segs) * Math.PI * 2 - Math.PI / 2;
          return (
            <line
              key={i}
              x1="160"
              y1="126"
              x2={160 + Math.cos(a) * 78}
              y2={126 + Math.sin(a) * 78}
              stroke="oklch(1 0 0)"
              strokeOpacity="0.28"
              strokeWidth="1.5"
            />
          );
        })}
        <circle cx="160" cy="126" r="78" fill={`url(#${id}-glass)`} />
      </g>

      {/* moving light reflection */}
      <g clipPath="url(#rwspin-clip)">
        <clipPath id="rwspin-clip">
          <circle cx="160" cy="126" r="86" />
        </clipPath>
        <rect className="rw-sheen" x="-120" y="30" width="90" height="200" fill={`url(#${id}-sheen)`} transform="rotate(18 160 126)" />
      </g>

      {/* hub + pointer */}
      <circle cx="160" cy="126" r="26" fill="oklch(0.18 0.02 160)" stroke="var(--rw-gold)" strokeWidth="2.5" />
      <circle cx="160" cy="126" r="18" fill={`url(#${id}-em)`} className="rw-breathe" style={{ transformOrigin: "160px 126px" }} />
      <path d="M154 120l14 6-14 6z" fill="oklch(0.14 0.02 160)" />
      <path d="M160 24l11 20h-22z" fill="var(--rw-gold)" />

      {/* gift boxes */}
      <g className="rw-float" style={{ animationDelay: "0.4s" }}>
        <rect x="24" y="176" width="44" height="38" rx="8" fill={`url(#${id}-em)`} />
        <rect x="24" y="176" width="44" height="13" rx="6" fill="var(--rw-gold)" opacity="0.9" />
        <rect x="42" y="176" width="8" height="38" fill="var(--rw-gold)" opacity="0.9" />
      </g>
      <g className="rw-float" style={{ animationDelay: "1.1s" }}>
        <rect x="256" y="188" width="34" height="30" rx="7" fill="var(--accent)" opacity="0.9" />
        <rect x="269" y="188" width="7" height="30" fill="var(--rw-gold-soft)" />
      </g>

      <Coin id={id} x={44} y={70} s={0.9} />
      <Coin id={id} x={286} y={96} s={0.75} delay={0.6} />
      <Coin id={id} x={258} y={44} s={0.55} delay={1.2} />
      <Sparkle x={96} y={38} r={4} />
      <Sparkle x={232} y={210} r={3} delay={0.8} />
      <Sparkle x={300} y={150} r={2.5} delay={1.4} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Rewards store — opening luxury gift box, flying coupons          */

export function StoreIllustration({ className = "" }: Props) {
  const id = "rwstore";
  return (
    <svg viewBox="0 0 320 260" className={`${base} ${className}`} role="img" aria-label="Illustration of a luxury gift box opening with restaurant vouchers flying out">
      <Defs id={id} />
      <circle cx="160" cy="150" r="104" fill={`url(#${id}-halo)`} className="rw-pulse-glow" />

      {/* flying coupons */}
      {[
        { x: 40, y: 78, r: -16, d: 0 },
        { x: 214, y: 54, r: 12, d: 0.5 },
        { x: 236, y: 122, r: -8, d: 1 },
      ].map((c, i) => (
        <g key={i} className="rw-coupon rw-float" style={{ animationDelay: `${c.d}s` }} transform={`translate(${c.x} ${c.y}) rotate(${c.r})`}>
          <rect x="0" y="0" width="72" height="42" rx="9" fill={`url(#${id}-glass)`} stroke="var(--rw-gold)" strokeOpacity="0.8" strokeWidth="1.5" />
          <circle cx="46" cy="0" r="6" fill="var(--rw-bg-hole)" />
          <circle cx="46" cy="42" r="6" fill="var(--rw-bg-hole)" />
          <rect x="9" y="12" width="28" height="6" rx="3" fill="var(--rw-gold-soft)" />
          <rect x="9" y="24" width="18" height="5" rx="2.5" fill="oklch(1 0 0)" opacity="0.4" />
          <path d="M52 16h12M52 26h12" stroke="var(--primary-glow)" strokeWidth="3" strokeLinecap="round" />
        </g>
      ))}

      {/* box */}
      <ellipse cx="160" cy="234" rx="86" ry="14" fill="oklch(0 0 0)" opacity="0.35" />
      <rect x="86" y="146" width="148" height="88" rx="16" fill={`url(#${id}-em)`} />
      <rect x="86" y="146" width="148" height="88" rx="16" fill={`url(#${id}-glass)`} />
      <rect x="146" y="146" width="28" height="88" fill="var(--rw-gold)" opacity="0.9" />

      {/* lid */}
      <g className="rw-lid" style={{ transformOrigin: "160px 148px" }}>
        <rect x="74" y="112" width="172" height="38" rx="12" fill="var(--rw-gold)" />
        <rect x="74" y="112" width="172" height="38" rx="12" fill={`url(#${id}-glass)`} />
        <rect x="146" y="112" width="28" height="38" fill="var(--rw-gold-deep)" opacity="0.75" />
        {/* ribbon bow */}
        <path d="M160 112c-22-6-34-22-20-30 11-6 20 12 20 30z" fill="var(--rw-gold-soft)" />
        <path d="M160 112c22-6 34-22 20-30-11-6-20 12-20 30z" fill="var(--rw-gold-deep)" />
        <circle cx="160" cy="108" r="7" fill="var(--rw-gold)" />
      </g>

      <Coin id={id} x={58} y={196} s={0.8} delay={0.3} />
      <Coin id={id} x={268} y={198} s={0.65} delay={0.9} />
      <Sparkle x={112} y={70} r={4} />
      <Sparkle x={200} y={96} r={3} delay={0.6} />
      <Sparkle x={286} y={64} r={2.5} delay={1.2} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Badges — trophy, medals, ribbons                                  */

export function BadgesIllustration({ className = "" }: Props) {
  const id = "rwbadge";
  return (
    <svg viewBox="0 0 320 260" className={`${base} ${className}`} role="img" aria-label="Illustration of a golden trophy with achievement medals and ribbons">
      <Defs id={id} />
      <circle cx="160" cy="126" r="104" fill={`url(#${id}-halo)`} className="rw-pulse-glow" />

      <g className="rw-trophy">
        <path d="M104 44h112v42a56 56 0 0 1-112 0z" fill={`url(#${id}-gold)`} />
        <path d="M104 44h112v42a56 56 0 0 1-112 0z" fill={`url(#${id}-glass)`} />
        {/* handles */}
        <path d="M104 54H80a26 26 0 0 0 26 34" fill="none" stroke="var(--rw-gold)" strokeWidth="9" strokeLinecap="round" />
        <path d="M216 54h24a26 26 0 0 1-26 34" fill="none" stroke="var(--rw-gold)" strokeWidth="9" strokeLinecap="round" />
        <rect x="150" y="140" width="20" height="30" fill="var(--rw-gold-deep)" />
        <rect x="118" y="170" width="84" height="16" rx="6" fill="var(--rw-gold)" />
        <rect x="106" y="186" width="108" height="20" rx="8" fill="var(--rw-gold-deep)" />
        {/* engraved star */}
        <path d="M160 62l8.4 17 18.8 2.7-13.6 13.2 3.2 18.7L160 104.8l-16.8 8.8 3.2-18.7-13.6-13.2 18.8-2.7z" fill="oklch(0.2 0.03 90)" opacity="0.55" />
        <rect className="rw-sheen" x="-140" y="30" width="60" height="180" fill={`url(#${id}-sheen)`} transform="rotate(14 160 120)" />
      </g>

      {/* medals with ribbons */}
      <g className="rw-medal" style={{ transformOrigin: "48px 168px" }}>
        <path d="M36 128l12 30 12-30-12-8z" fill="var(--accent)" opacity="0.85" />
        <circle cx="48" cy="176" r="24" fill={`url(#${id}-gold)`} />
        <circle cx="48" cy="176" r="16" fill="oklch(0.18 0.02 160)" />
        <circle cx="48" cy="176" r="16" fill={`url(#${id}-glass)`} />
        <path d="M48 166l3.6 7.4 8.1 1.2-5.9 5.7 1.4 8-7.2-3.8-7.2 3.8 1.4-8-5.9-5.7 8.1-1.2z" fill="var(--rw-gold-soft)" />
      </g>
      <g className="rw-medal" style={{ transformOrigin: "274px 186px", animationDelay: "0.7s" }}>
        <path d="M262 148l12 28 12-28-12-8z" fill="var(--primary)" opacity="0.8" />
        <circle cx="274" cy="192" r="20" fill={`url(#${id}-em)`} />
        <circle cx="274" cy="192" r="13" fill="oklch(0.18 0.02 160)" />
        <path d="M268 192l4 4 8-9" stroke="var(--rw-gold-soft)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      <Sparkle x={100} y={30} r={4} />
      <Sparkle x={228} y={40} r={3} delay={0.7} />
      <Sparkle x={196} y={214} r={2.6} delay={1.3} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 4. My rewards — wallet, coupons, VIP card                            */

export function WalletIllustration({ className = "" }: Props) {
  const id = "rwwallet";
  return (
    <svg viewBox="0 0 320 260" className={`${base} ${className}`} role="img" aria-label="Illustration of a premium reward wallet holding coupons and a VIP membership card">
      <Defs id={id} />
      <circle cx="160" cy="140" r="100" fill={`url(#${id}-halo)`} className="rw-pulse-glow" />

      {/* cards fanned out of the wallet */}
      <g className="rw-card-1" transform="rotate(-10 160 150)">
        <rect x="72" y="70" width="176" height="98" rx="16" fill="var(--accent)" opacity="0.55" />
        <rect x="72" y="70" width="176" height="98" rx="16" fill={`url(#${id}-glass)`} />
      </g>
      <g className="rw-card-2" transform="rotate(-3 160 150)">
        <rect x="84" y="58" width="164" height="96" rx="16" fill={`url(#${id}-em)`} />
        <rect x="84" y="58" width="164" height="96" rx="16" fill={`url(#${id}-glass)`} />
        <rect x="100" y="76" width="34" height="24" rx="6" fill="var(--rw-gold)" />
        <rect x="100" y="112" width="70" height="8" rx="4" fill="oklch(1 0 0)" opacity="0.6" />
        <rect x="100" y="128" width="44" height="7" rx="3.5" fill="oklch(1 0 0)" opacity="0.35" />
        <text x="228" y="86" textAnchor="end" fontSize="17" fontWeight="700" fill="var(--rw-gold-soft)" fontFamily="inherit">VIP</text>
        <rect className="rw-sheen" x="-140" y="40" width="70" height="150" fill={`url(#${id}-sheen)`} transform="rotate(16 160 110)" />
      </g>

      {/* wallet body */}
      <ellipse cx="160" cy="238" rx="94" ry="13" fill="oklch(0 0 0)" opacity="0.35" />
      <path d="M62 148h196a14 14 0 0 1 14 14v56a18 18 0 0 1-18 18H66a18 18 0 0 1-18-18v-56a14 14 0 0 1 14-14z" fill="oklch(0.2 0.03 160)" />
      <path d="M62 148h196a14 14 0 0 1 14 14v56a18 18 0 0 1-18 18H66a18 18 0 0 1-18-18v-56a14 14 0 0 1 14-14z" fill={`url(#${id}-glass)`} />
      <g className="rw-wallet-flap" style={{ transformOrigin: "160px 176px" }}>
        <path d="M48 176h224v20a16 16 0 0 1-16 16H64a16 16 0 0 1-16-16z" fill={`url(#${id}-em)`} opacity="0.92" />
        <rect x="196" y="182" width="52" height="20" rx="10" fill="var(--rw-gold)" />
        <circle cx="222" cy="192" r="5" fill="oklch(0.2 0.03 90)" opacity="0.6" />
      </g>

      <Coin id={id} x={46} y={106} s={0.7} />
      <Coin id={id} x={286} y={148} s={0.6} delay={0.8} />
      <Sparkle x={266} y={62} r={3.4} />
      <Sparkle x={54} y={196} r={2.6} delay={1} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Ways to earn — coins flowing into a wallet, tray, QR, calendar    */

export function EarnIllustration({ className = "" }: Props) {
  const id = "rwearn";
  return (
    <svg viewBox="0 0 320 260" className={`${base} ${className}`} role="img" aria-label="Illustration of coins flowing into a wallet beside a serving tray, QR code and calendar">
      <Defs id={id} />
      <circle cx="170" cy="140" r="102" fill={`url(#${id}-halo)`} className="rw-pulse-glow" />

      {/* falling coin stream */}
      <g className="rw-stream">
        <Coin id={id} x={148} y={30} s={0.75} />
        <Coin id={id} x={176} y={68} s={0.62} delay={0.4} />
        <Coin id={id} x={150} y={104} s={0.5} delay={0.9} />
      </g>

      {/* tray */}
      <g className="rw-float" style={{ animationDelay: "0.3s" }}>
        <ellipse cx="66" cy="112" rx="48" ry="15" fill="var(--accent)" opacity="0.55" />
        <ellipse cx="66" cy="106" rx="48" ry="15" fill={`url(#${id}-glass)`} stroke="var(--rw-gold)" strokeOpacity="0.7" strokeWidth="2" />
        <path d="M40 104a26 22 0 0 1 52 0z" fill="var(--rw-gold)" opacity="0.85" />
      </g>

      {/* QR tile */}
      <g className="rw-float" style={{ animationDelay: "1s" }}>
        <rect x="238" y="52" width="58" height="58" rx="12" fill="oklch(0.2 0.03 160)" stroke="var(--primary)" strokeOpacity="0.6" strokeWidth="2" />
        {[
          [248, 62], [248, 88], [274, 62],
        ].map(([x, y], i) => (
          <g key={i}>
            <rect x={x} y={y} width="14" height="14" rx="3" fill="none" stroke="var(--primary-glow)" strokeWidth="3" />
          </g>
        ))}
        <rect x="274" y="88" width="6" height="6" fill="var(--rw-gold-soft)" />
        <rect x="284" y="96" width="6" height="6" fill="var(--rw-gold-soft)" />
        <rect x="266" y="96" width="6" height="6" fill="var(--primary-glow)" />
      </g>

      {/* calendar */}
      <g className="rw-float" style={{ animationDelay: "1.6s" }}>
        <rect x="30" y="164" width="62" height="56" rx="12" fill={`url(#${id}-glass)`} stroke="var(--accent)" strokeOpacity="0.7" strokeWidth="2" />
        <rect x="30" y="164" width="62" height="16" rx="8" fill="var(--accent)" opacity="0.8" />
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => (
            <rect key={`${r}${c}`} x={40 + c * 16} y={190 + r * 11} width="8" height="6" rx="2" fill="oklch(1 0 0)" opacity={r === 1 && c === 1 ? 0.9 : 0.28} />
          )),
        )}
      </g>

      {/* wallet catching the coins */}
      <ellipse cx="176" cy="240" rx="80" ry="12" fill="oklch(0 0 0)" opacity="0.32" />
      <path d="M110 152h132a16 16 0 0 1 16 16v50a18 18 0 0 1-18 18H112a18 18 0 0 1-18-18v-50a16 16 0 0 1 16-16z" fill={`url(#${id}-em)`} />
      <path d="M110 152h132a16 16 0 0 1 16 16v50a18 18 0 0 1-18 18H112a18 18 0 0 1-18-18v-50a16 16 0 0 1 16-16z" fill={`url(#${id}-glass)`} />
      <rect x="188" y="182" width="70" height="26" rx="13" fill="var(--rw-gold)" />
      <circle cx="212" cy="195" r="6" fill="oklch(0.2 0.03 90)" opacity="0.55" />

      {/* review stars */}
      <g className="rw-float" style={{ animationDelay: "0.7s" }}>
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M${262 + i * 20} 168l4 8.2 9 1.3-6.5 6.3 1.5 8.9-8-4.2-8 4.2 1.5-8.9-6.5-6.3 9-1.3z`}
            fill="var(--rw-gold-soft)"
            opacity={0.5 + i * 0.25}
          />
        ))}
      </g>

      <Sparkle x={116} y={44} r={3.4} />
      <Sparkle x={220} y={110} r={2.6} delay={0.9} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 6. History — timeline, tickets, clock, coins                         */

export function HistoryIllustration({ className = "" }: Props) {
  const id = "rwhist";
  return (
    <svg viewBox="0 0 320 260" className={`${base} ${className}`} role="img" aria-label="Illustration of a rewards timeline with tickets, a clock and coins">
      <Defs id={id} />
      <circle cx="160" cy="130" r="100" fill={`url(#${id}-halo)`} className="rw-pulse-glow" />

      {/* timeline spine */}
      <line x1="52" y1="130" x2="268" y2="130" stroke="oklch(1 0 0)" strokeOpacity="0.14" strokeWidth="4" strokeLinecap="round" />
      <line className="rw-timeline" x1="52" y1="130" x2="268" y2="130" stroke={`url(#${id}-em)`} strokeWidth="4" strokeLinecap="round" />

      {[52, 124, 196, 268].map((x, i) => (
        <g key={x} className="rw-node" style={{ transformOrigin: `${x}px 130px`, animationDelay: `${i * 0.25}s` }}>
          <circle cx={x} cy="130" r="13" fill="oklch(0.18 0.02 160)" stroke="var(--primary)" strokeWidth="2.5" />
          <circle cx={x} cy="130" r="5" fill="var(--rw-gold)" />
        </g>
      ))}

      {/* tickets above/below the line */}
      <g className="rw-float">
        <rect x="82" y="52" width="88" height="46" rx="10" fill={`url(#${id}-glass)`} stroke="var(--rw-gold)" strokeOpacity="0.75" strokeWidth="1.5" />
        <circle cx="126" cy="52" r="6" fill="var(--rw-bg-hole)" />
        <circle cx="126" cy="98" r="6" fill="var(--rw-bg-hole)" />
        <rect x="92" y="64" width="26" height="6" rx="3" fill="var(--rw-gold-soft)" />
        <rect x="92" y="78" width="18" height="5" rx="2.5" fill="oklch(1 0 0)" opacity="0.4" />
        <path d="M136 68h22M136 80h22" stroke="var(--primary-glow)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g className="rw-float" style={{ animationDelay: "0.9s" }}>
        <rect x="164" y="168" width="80" height="42" rx="10" fill={`url(#${id}-glass)`} stroke="var(--accent)" strokeOpacity="0.7" strokeWidth="1.5" />
        <rect x="174" y="180" width="24" height="6" rx="3" fill="var(--accent)" />
        <rect x="174" y="192" width="40" height="5" rx="2.5" fill="oklch(1 0 0)" opacity="0.35" />
      </g>

      {/* clock */}
      <g className="rw-float" style={{ animationDelay: "0.5s" }}>
        <circle cx="252" cy="66" r="30" fill="oklch(0.18 0.02 160)" stroke="var(--rw-gold)" strokeWidth="3" />
        <circle cx="252" cy="66" r="30" fill={`url(#${id}-glass)`} />
        <g className="rw-hand" style={{ transformOrigin: "252px 66px" }}>
          <line x1="252" y1="66" x2="252" y2="48" stroke="var(--rw-gold-soft)" strokeWidth="3" strokeLinecap="round" />
        </g>
        <line x1="252" y1="66" x2="266" y2="72" stroke="var(--primary-glow)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="252" cy="66" r="3.5" fill="var(--rw-gold)" />
      </g>

      <Coin id={id} x={62} y={196} s={0.8} delay={0.2} />
      <Coin id={id} x={112} y={214} s={0.6} delay={0.9} />
      <Sparkle x={294} y={172} r={3} />
      <Sparkle x={40} y={70} r={2.6} delay={0.8} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Help & FAQ — chef mascot with speech bubbles                      */

export function HelpIllustration({ className = "" }: Props) {
  const id = "rwhelp";
  return (
    <svg viewBox="0 0 320 260" className={`${base} ${className}`} role="img" aria-label="Illustration of a friendly chef mascot answering questions with speech bubbles">
      <Defs id={id} />
      <circle cx="150" cy="140" r="100" fill={`url(#${id}-halo)`} className="rw-pulse-glow" />

      {/* speech bubbles */}
      <g className="rw-bubble">
        <rect x="196" y="36" width="98" height="54" rx="18" fill={`url(#${id}-glass)`} stroke="var(--primary)" strokeOpacity="0.55" strokeWidth="1.5" />
        <path d="M214 90l-6 18 20-18z" fill="var(--primary)" opacity="0.35" />
        <text x="245" y="72" textAnchor="middle" fontSize="30" fontWeight="800" fill="var(--rw-gold-soft)" fontFamily="inherit">?</text>
      </g>
      <g className="rw-bubble" style={{ animationDelay: "0.9s" }}>
        <rect x="228" y="112" width="70" height="42" rx="14" fill={`url(#${id}-glass)`} stroke="var(--accent)" strokeOpacity="0.55" strokeWidth="1.5" />
        <rect x="240" y="126" width="34" height="6" rx="3" fill="oklch(1 0 0)" opacity="0.45" />
        <rect x="240" y="138" width="22" height="5" rx="2.5" fill="oklch(1 0 0)" opacity="0.28" />
      </g>

      {/* chef */}
      <ellipse cx="132" cy="238" rx="72" ry="12" fill="oklch(0 0 0)" opacity="0.32" />
      <g className="rw-chef">
        {/* hat */}
        <path d="M96 74c-18 0-28-12-24-26 4-13 20-16 27-9 3-14 24-19 34-9 12-9 30-1 29 12 12 1 17 12 12 22-4 8-13 10-22 10z" fill="oklch(0.97 0.01 90)" />
        <rect x="94" y="70" width="82" height="18" rx="7" fill="oklch(0.92 0.01 90)" />
        {/* head */}
        <rect x="104" y="86" width="62" height="56" rx="24" fill="oklch(0.78 0.06 60)" />
        <circle cx="122" cy="112" r="4.5" fill="oklch(0.2 0.02 60)" />
        <circle cx="150" cy="112" r="4.5" fill="oklch(0.2 0.02 60)" />
        <path d="M124 126q11 10 22 0" stroke="oklch(0.28 0.04 40)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        {/* body */}
        <path d="M100 142h70a26 26 0 0 1 26 26v56H74v-56a26 26 0 0 1 26-26z" fill={`url(#${id}-em)`} />
        <path d="M100 142h70a26 26 0 0 1 26 26v56H74v-56a26 26 0 0 1 26-26z" fill={`url(#${id}-glass)`} />
        <path d="M135 142l16 14-16 14-16-14z" fill="oklch(1 0 0)" opacity="0.35" />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx="135" cy={186 + i * 16} r="3.6" fill="var(--rw-gold)" />
        ))}
      </g>

      {/* gift box beside the chef */}
      <g className="rw-float" style={{ animationDelay: "0.6s" }}>
        <rect x="30" y="176" width="48" height="44" rx="10" fill="var(--accent)" opacity="0.85" />
        <rect x="30" y="176" width="48" height="14" rx="7" fill="var(--rw-gold)" />
        <rect x="49" y="176" width="9" height="44" fill="var(--rw-gold)" />
      </g>

      <Sparkle x={64} y={62} r={3.6} />
      <Sparkle x={296} y={188} r={2.8} delay={0.8} />
    </svg>
  );
}
