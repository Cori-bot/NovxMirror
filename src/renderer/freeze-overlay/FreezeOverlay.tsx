import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { VideoBounds } from '../../main/types';

const DRAW_COLOR = '#60a5fa';
const DRAW_WIDTH = 4;

export default function FreezeOverlay() {
  const [layout, setLayout] = useState<VideoBounds | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    window.novxFreeze.onLayout((next) => setLayout(next));
    window.novxFreeze.onImage((path) => setImageSrc(path));
    window.novxFreeze.onToggleDraw(() => {
      setDrawingEnabled((prev) => {
        const next = !prev;
        window.novxFreeze.setInteractive(next);
        return next;
      });
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(layout.width * dpr);
    canvas.height = Math.floor(layout.height * dpr);
    canvas.style.width = `${String(layout.width)}px`;
    canvas.style.height = `${String(layout.height)}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = DRAW_WIDTH;
    ctx.strokeStyle = DRAW_COLOR;
    ctxRef.current = ctx;
  }, [layout]);

  const onMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!drawingEnabled || !ctxRef.current) return;
    drawingRef.current = true;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const onMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !drawingEnabled || !ctxRef.current) return;
    ctxRef.current.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctxRef.current.stroke();
  };

  useEffect(() => {
    const stop = () => {
      drawingRef.current = false;
    };
    window.addEventListener('mouseup', stop);
    return () => {
      window.removeEventListener('mouseup', stop);
    };
  }, []);

  if (!layout) return null;

  return (
    <div style={{ width: '100%', height: '100%', background: 'transparent' }}>
      <div
        style={{
          position: 'absolute',
          left: layout.x,
          top: layout.y,
          width: layout.width,
          height: layout.height,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        ) : null}
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: drawingEnabled ? 'auto' : 'none',
            cursor: 'crosshair',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            padding: '5px 10px',
            borderRadius: 999,
            background: 'rgba(13,17,23,0.72)',
            border: '1px solid rgba(59,130,246,0.32)',
            color: '#93c5fd',
            font: '600 11px/1 sans-serif',
            opacity: drawingEnabled ? 1 : 0,
            transition: 'opacity 0.15s ease',
            zIndex: 3,
          }}
        >
          Mode dessin
        </div>
      </div>
    </div>
  );
}
