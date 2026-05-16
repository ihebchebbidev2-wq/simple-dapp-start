import React from "react";

interface FlagIconProps {
  country: string;
  className?: string;
}

const flags: Record<string, React.FC<{ className?: string }>> = {
  ca: ({ className }) => (
    <svg viewBox="0 0 640 480" className={className}>
      <path fill="#fff" d="M0 0h640v480H0z" />
      <path fill="#d52b1e" d="M0 0h160v480H0zM480 0h160v480H480z" />
      <path fill="#d52b1e" d="M319.8 40.4c-2.4.8-7.2 4-8.4 9.6l-11.6 58.8-48-27.6c-4-2-8.8 1.2-6.8 6l16.4 40-36-4.8c-4-.4-6.4 4.4-3.6 7.6l32.8 32.8-8.4 3.6c-2.4 1.2-3.6 4-2 6.4l12 18.8-24.8 8c-2.4.8-3.2 3.6-1.6 5.6l44.8 56H259l-12 36h11.6l-8.4 21.2 36-8.4 4 44.4 16.4-28.8 16 28.8 4-44.4 36.4 8.4-8.4-21.2h11.6l-12-36h-13.6l44.8-56c1.6-2 .8-4.8-1.6-5.6l-24.8-8 12-18.8c1.6-2.4.4-5.2-2-6.4l-8.4-3.6 32.8-32.8c2.8-3.2.4-8-3.6-7.6l-36 4.8 16.4-40c2-4.8-2.8-8-6.8-6l-48 27.6L328.6 50c-1.2-5.6-6-8.8-8.8-9.6z" />
    </svg>
  ),
  us: ({ className }) => (
    <svg viewBox="0 0 640 480" className={className}>
      <path fill="#bd3d44" d="M0 0h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640z" />
      <path fill="#fff" d="M0 37h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640z" />
      <path fill="#192f5d" d="M0 0h260v259H0z" />
    </svg>
  ),
  eu: ({ className }) => (
    <svg viewBox="0 0 640 480" className={className}>
      <rect fill="#039" width="640" height="480" />
      <g fill="#fc0" transform="translate(320,242)">
        {[...Array(12)].map((_, i) => (
          <g key={i} transform={`rotate(${i * 30})`}>
            <path d="M0,-120 l4.6,14.1h14.8l-12,8.7 4.6,14.1L0,-91.8l-12,8.7 4.6-14.1-12-8.7h14.8z" />
          </g>
        ))}
      </g>
    </svg>
  ),
  fr: ({ className }) => (
    <svg viewBox="0 0 640 480" className={className}>
      <rect fill="#002395" width="213.3" height="480" />
      <rect fill="#fff" x="213.3" width="213.4" height="480" />
      <rect fill="#ed2939" x="426.7" width="213.3" height="480" />
    </svg>
  ),
  es: ({ className }) => (
    <svg viewBox="0 0 640 480" className={className}>
      <rect fill="#c60b1e" width="640" height="480" />
      <rect fill="#ffc400" y="120" width="640" height="240" />
    </svg>
  ),
};

export default function FlagIcon({ country, className = "w-5 h-4 inline-block rounded-sm overflow-hidden" }: FlagIconProps) {
  const Flag = flags[country];
  return Flag ? <Flag className={className} /> : null;
}
