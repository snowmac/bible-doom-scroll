import { useEffect, useRef } from 'react';

// Full-bleed animated background behind every mode. Renders at half resolution; it's blurry glow anyway.
export default function BackgroundCanvas({ bg, paused }) {
  const ref = useRef(null);
  useEffect(() => {
    if (paused) return undefined;
    const cv = ref.current, c = cv.getContext('2d');
    let raf = 0;
    const fit = () => {
      cv.width = Math.max(2, Math.round(window.innerWidth * 0.5));
      cv.height = Math.max(2, Math.round(window.innerHeight * 0.5));
    };
    fit();
    window.addEventListener('resize', fit);
    const loop = (t) => {
      if (!document.hidden) bg.draw(c, cv.width, cv.height, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
  }, [bg, paused]);
  return <canvas ref={ref} className="bgcanvas" data-paused={paused || undefined} aria-hidden="true" />;
}
