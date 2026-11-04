import clsx from 'clsx';

type ArtKind = 'diya' | 'lantern' | 'bowl' | 'textile' | 'jewel' | 'paper' | 'arch';

function kindFor(name: string, category: string): ArtKind {
  const value = `${name} ${category}`.toLowerCase();
  if (value.includes('diya') || value.includes('lamp')) return 'diya';
  if (value.includes('lantern') || value.includes('glass')) return 'lantern';
  if (value.includes('bowl') || value.includes('plate') || value.includes('dish')) return 'bowl';
  if (value.includes('stole') || value.includes('textile') || value.includes('runner') || value.includes('cushion') || value.includes('fabric'))
    return 'textile';
  if (value.includes('jewel') || value.includes('necklace') || value.includes('earring')) return 'jewel';
  if (value.includes('stationery') || value.includes('paper') || value.includes('journal')) return 'paper';
  return 'arch';
}

const palettes = [
  { bg: ['#173C3D', '#215757'], metal: '#D99A55', light: '#F0D2A8', accent: '#8EBAB0' },
  { bg: ['#DBE8D8', '#C3D8BE'], metal: '#8A5A2B', light: '#F6F8F3', accent: '#01949A' },
  { bg: ['#E7F1E9', '#CFE3D3'], metal: '#B0783D', light: '#FFFFFF', accent: '#173C3D' },
  { bg: ['#215757', '#173C3D'], metal: '#E4C08A', light: '#F6F8F3', accent: '#DBE8D8' },
];

export function ProductArt({
  name,
  category,
  images,
  className,
  decorative = true,
}: {
  name: string;
  category: string;
  images?: string[];
  className?: string;
  decorative?: boolean;
}) {
  const image = images?.find((src) => src && !src.startsWith('data:') && src.length < 500);
  if (image) {
    return (
      <div className={clsx('overflow-hidden rounded-xl bg-pale', className)}>
        <img src={image} alt={name} loading="lazy" className="h-full w-full object-cover" />
      </div>
    );
  }

  const kind = kindFor(name, category);
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palette = palettes[hash % palettes.length]!;
  const id = `art-${hash % 997}-${kind}`;

  return (
    <div className={clsx('relative overflow-hidden rounded-xl', className)} aria-hidden={decorative}>
      <svg viewBox="0 0 320 220" className="h-full w-full" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : name}>
        <defs>
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palette.bg[0]} />
            <stop offset="100%" stopColor={palette.bg[1]} />
          </linearGradient>
          <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palette.light} />
            <stop offset="55%" stopColor={palette.metal} />
            <stop offset="100%" stopColor={palette.bg[0]} />
          </linearGradient>
          <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.light} stopOpacity="0.9" />
            <stop offset="100%" stopColor={palette.light} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="320" height="220" fill={`url(#${id}-bg)`} />
        <circle cx="266" cy="36" r="70" fill={palette.accent} opacity="0.13" />
        <circle cx="42" cy="192" r="58" fill={palette.light} opacity="0.07" />
        <path d="M0 186C66 166 118 196 176 182C230 169 272 178 320 162V220H0Z" fill={palette.light} opacity="0.06" />

        {kind === 'diya' && (
          <g>
            <ellipse cx="160" cy="196" rx="78" ry="10" fill="#000" opacity="0.16" />
            <path d="M96 148C106 174 134 188 160 188C186 188 214 174 224 148C204 156 186 160 160 160C134 160 116 156 96 148Z" fill={`url(#${id}-metal)`} />
            <path d="M96 148C120 142 200 142 224 148C210 136 186 130 160 130C134 130 110 136 96 148Z" fill={palette.light} opacity="0.65" />
            <circle cx="160" cy="94" r="42" fill={`url(#${id}-glow)`} />
            <path d="M160 72C168 84 174 92 174 102C174 112 168 120 160 120C152 120 146 112 146 102C146 92 152 84 160 72Z" fill={palette.light} />
            <path d="M160 88C164 95 167 99 167 105C167 110 164 114 160 114C156 114 153 110 153 105C153 99 156 95 160 88Z" fill={palette.metal} />
            <path d="M116 152C136 146 184 146 204 152" stroke={palette.bg[0]} strokeWidth="2" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {kind === 'lantern' && (
          <g>
            <ellipse cx="160" cy="198" rx="58" ry="8" fill="#000" opacity="0.16" />
            <path d="M132 54H188" stroke={palette.metal} strokeWidth="4" strokeLinecap="round" />
            <path d="M160 34V54" stroke={palette.metal} strokeWidth="3" strokeLinecap="round" />
            <path d="M130 70L190 70L204 164C180 178 140 178 116 164Z" fill={palette.metal} opacity="0.45" />
            <path d="M138 76L182 76L192 158C172 168 148 168 128 158Z" fill={palette.light} opacity="0.28" />
            <rect x="146" y="104" width="28" height="42" rx="13" fill={palette.light} opacity="0.65" />
            <circle cx="160" cy="125" r="34" fill={`url(#${id}-glow)`} />
            <path d="M122 74H198" stroke={palette.metal} strokeWidth="3" strokeLinecap="round" />
            <path d="M120 164H200" stroke={palette.metal} strokeWidth="3" strokeLinecap="round" />
            <path d="M160 96C166 106 170 112 170 120C170 128 166 134 160 134C154 134 150 128 150 120C150 112 154 106 160 96Z" fill={palette.light} />
          </g>
        )}

        {kind === 'bowl' && (
          <g>
            <ellipse cx="160" cy="192" rx="84" ry="9" fill="#000" opacity="0.16" />
            <path d="M78 120C84 160 116 184 160 184C204 184 236 160 242 120C226 128 198 132 160 132C122 132 94 128 78 120Z" fill={`url(#${id}-metal)`} />
            <ellipse cx="160" cy="120" rx="82" ry="18" fill={palette.bg[0]} opacity="0.7" />
            <ellipse cx="160" cy="119" rx="74" ry="13" fill={palette.light} opacity="0.28" />
            <path d="M88 123C112 132 208 132 232 123" stroke={palette.light} strokeWidth="2" opacity="0.5" />
            {[0, 1, 2, 3, 4].map((i) => (
              <path
                key={i}
                d={`M${105 + i * 20} 145 Q${112 + i * 20} ${155 + (i % 2) * 6} ${118 + i * 20} 168`}
                stroke={palette.bg[0]}
                strokeWidth="1.4"
                opacity="0.35"
                fill="none"
              />
            ))}
          </g>
        )}

        {kind === 'textile' && (
          <g>
            <rect x="58" y="58" width="204" height="112" rx="8" fill={palette.light} opacity="0.18" />
            <path d="M58 84H262M58 112H262M58 140H262" stroke={palette.light} strokeWidth="1.2" opacity="0.35" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <path key={i} d={`M${72 + i * 26} 58V170`} stroke={palette.metal} strokeWidth="1" opacity="0.3" />
            ))}
            <path d="M58 58C96 74 122 46 160 62C198 78 226 50 262 66V170C222 154 196 182 160 166C124 150 96 178 58 162Z" fill={palette.light} opacity="0.16" />
            <path d="M72 92L88 76L104 92L88 108Z" fill={palette.accent} opacity="0.8" />
            <path d="M126 92L142 76L158 92L142 108Z" fill={palette.metal} opacity="0.85" />
            <path d="M180 92L196 76L212 92L196 108Z" fill={palette.accent} opacity="0.55" />
            <path d="M72 140L88 124L104 140L88 156Z" fill={palette.metal} opacity="0.6" />
            <path d="M126 140L142 124L158 140L142 156Z" fill={palette.accent} opacity="0.7" />
            <path d="M180 140L196 124L212 140L196 156Z" fill={palette.light} opacity="0.35" />
            <path d="M58 178C68 172 78 184 88 178" stroke={palette.light} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          </g>
        )}

        {kind === 'jewel' && (
          <g>
            <circle cx="160" cy="112" r="56" stroke={palette.metal} strokeWidth="7" fill="none" />
            <circle cx="160" cy="112" r="38" stroke={palette.light} strokeWidth="2" fill="none" opacity="0.55" />
            <circle cx="160" cy="112" r="13" fill={palette.accent} />
            <circle cx="160" cy="112" r="6" fill={palette.light} />
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <circle
                key={angle}
                cx={160 + 56 * Math.cos((angle * Math.PI) / 180)}
                cy={112 + 56 * Math.sin((angle * Math.PI) / 180)}
                r="5"
                fill={palette.light}
              />
            ))}
          </g>
        )}

        {kind === 'paper' && (
          <g>
            <rect x="96" y="46" width="128" height="140" rx="7" fill={palette.light} opacity="0.9" transform="rotate(-4 160 116)" />
            <rect x="90" y="52" width="128" height="140" rx="7" fill={palette.bg[0]} opacity="0.28" />
            <path d="M112 86H196M112 104H196M112 122H176M112 140H188" stroke={palette.light} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <path d="M112 162H150" stroke={palette.metal} strokeWidth="3" strokeLinecap="round" />
            <path d="M206 44L224 62L198 88L180 70Z" fill={palette.metal} />
          </g>
        )}

        {kind === 'arch' && (
          <g>
            <path d="M92 180V100C92 62 122 38 160 38C198 38 228 62 228 100V180Z" fill={`url(#${id}-metal)`} opacity="0.72" />
            <path d="M116 180V106C116 82 136 66 160 66C184 66 204 82 204 106V180Z" fill={palette.bg[0]} opacity="0.55" />
            <circle cx="160" cy="118" r="18" fill={palette.light} opacity="0.72" />
            <path d="M92 180H228" stroke={palette.light} strokeWidth="2" opacity="0.5" />
          </g>
        )}
      </svg>
    </div>
  );
}
