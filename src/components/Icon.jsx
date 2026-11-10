const paths = {
  scroll: <path d="M5 6h14M5 12h14M5 18h9" />,
  flash: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  video: <><path d="M3 7h12v10H3z" /><path d="m15 11 6-3v8l-6-3" /></>,
  sliders: <><path d="M4 7h9M19 7h1M4 17h1M11 17h9" /><circle cx="16" cy="7" r="2.2" /><circle cx="8" cy="17" r="2.2" /></>,
  heart: <path d="M12 21s-7.5-4.6-9.6-9.2A5.4 5.4 0 0 1 12 6.4a5.4 5.4 0 0 1 9.6 5.4C19.5 16.4 12 21 12 21z" />,
  play: <path d="M7 4.5v15l12-7.5z" />,
  pause: <><path d="M7 4h4v16H7z" /><path d="M14 4h4v16h-4z" /></>,
  prev: <><path d="M6 5v14" /><path d="m18 5-9 7 9 7z" /></>,
  next: <><path d="M18 5v14" /><path d="m6 5 9 7-9 7z" /></>,
  record: <circle cx="12" cy="12" r="6.5" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  download: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />,
};

export default function Icon({ name, size = 22, fill = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
