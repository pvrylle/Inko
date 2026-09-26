"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import type { SpriteAtlas } from "./sprite-manifest";

// Simple cross-instance image cache so switching animations (or mounting the
// mascot in several places) never re-downloads a sheet.
const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
  imageCache.set(url, promise);
  return promise;
}

type SpriteMascotProps = {
  atlas: SpriteAtlas | null;
  className?: string;
  /** Freeze on the first frame (e.g. sleeping). */
  paused?: boolean;
  /** contain = letterbox; cover = fill the box (compact chips). */
  fit?: "contain" | "cover";
};

/**
 * Canvas-based sprite-sheet player. Draws one frame of a uniform grid atlas per
 * tick at the atlas fps, scaling each frame to fit the canvas box. Honors
 * prefers-reduced-motion by holding the first frame.
 */
export function SpriteMascot({
  atlas,
  className = "",
  paused = false,
  fit = "contain",
}: SpriteMascotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !atlas) return;

    let raf = 0;
    let frame = 0;
    let last = 0;
    let img: HTMLImageElement | null = null;
    let cancelled = false;
    const interval = 1000 / atlas.fps;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx || !img) return;
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw === 0 || ch === 0) return;
      const pxW = Math.round(cw * dpr);
      const pxH = Math.round(ch * dpr);
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW;
        canvas.height = pxH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const col = frame % atlas.cols;
      const row = Math.floor(frame / atlas.cols);
      const sx = col * atlas.frameWidth;
      const sy = row * atlas.frameHeight;

      const scale =
        fit === "cover"
          ? Math.max(cw / atlas.frameWidth, ch / atlas.frameHeight)
          : Math.min(cw / atlas.frameWidth, ch / atlas.frameHeight);
      const dw = atlas.frameWidth * scale;
      const dh = atlas.frameHeight * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      ctx.drawImage(img, sx, sy, atlas.frameWidth, atlas.frameHeight, dx, dy, dw, dh);
    };

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < interval) return;
      last = t;
      frame = (frame + 1) % atlas.count;
      draw();
    };

    void loadImage(atlas.url).then((loaded) => {
      if (cancelled) return;
      img = loaded;
      frame = 0;
      draw();
      if (!reduced && !paused && atlas.count > 1) {
        raf = requestAnimationFrame(tick);
      }
    });

    const onResize = () => draw();
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [atlas, reduced, paused, fit]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
