"use client";

import { useEffect, useRef } from "react";

export function ParticleMesh() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let frame = 0;
    let start = performance.now();
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let isVisible = true;

    const draw = (now: number) => {
      frame = 0;
      const time = reduceMotion ? 0.8 : (now - start) / 5200;
      context.clearRect(0, 0, width, height);

      const columns = width < 600 ? 31 : 53;
      const rows = width < 600 ? 18 : 25;

      for (let row = 0; row < rows; row += 1) {
        const depth = row / (rows - 1);
        const perspective = 0.56 + depth * 1.18;

        for (let column = 0; column < columns; column += 1) {
          const across = column / (columns - 1);
          const worldX = (across - 0.5) * 2.55;
          const ridge =
            Math.sin(worldX * 4.1 + time * 1.4) * 0.12 +
            Math.cos(depth * 7.2 - time) * 0.065 +
            Math.sin((worldX + depth) * 7.4 + time * 0.45) * 0.028;
          const crown = Math.exp(-worldX * worldX * 0.9) * 0.13;
          const x = width / 2 + (worldX * width * 0.53) / perspective;
          const y =
            height * 0.17 +
            depth * height * 0.78 +
            (ridge - crown) * height * (1 - depth * 0.35);

          if (x < -10 || x > width + 10 || y < -10 || y > height + 10) {
            continue;
          }

          const shimmer =
            0.72 + Math.sin(column * 1.7 + row * 0.8 + time * 3) * 0.28;
          const alpha = Math.max(0.18, (1 - depth * 0.55) * shimmer);
          const radius = (1.05 + (1 - depth) * 1.2) * (width < 600 ? 0.72 : 1);

          context.beginPath();
          context.fillStyle = `rgba(255, 116, 121, ${alpha})`;
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }

      if (!reduceMotion && isVisible) frame = requestAnimationFrame(draw);
    };

    const resize = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }

      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw(performance.now());
    };

    const resizeObserver = new ResizeObserver(resize);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? true;

      if (!isVisible && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (isVisible && !reduceMotion && !frame) {
        frame = requestAnimationFrame(draw);
      }
    });

    resizeObserver.observe(canvas);
    visibilityObserver.observe(canvas);
    resize();

    return () => {
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      cancelAnimationFrame(frame);
      start = 0;
    };
  }, []);

  return <canvas ref={canvasRef} className="hl-particle-canvas" aria-hidden />;
}
