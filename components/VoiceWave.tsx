"use client";

import { useEffect, useRef } from "react";

interface VoiceWaveProps {
  isActive: boolean;
  analyserNode: AnalyserNode | null;
  color?: string;
  width?: number;
  height?: number;
}

export function VoiceWave({
  isActive,
  analyserNode,
  color = "#1558D6",
  width = 320,
  height = 80,
}: VoiceWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const dataArrayRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (analyserNode && !dataArrayRef.current) {
      dataArrayRef.current = new Float32Array(analyserNode.frequencyBinCount);
    }

    const LINE_COUNT = 4;
    let frame = 0;

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, width, height);

      let amplitude = 0;
      if (analyserNode && dataArrayRef.current) {
        (analyserNode.getFloatFrequencyData as (arr: Float32Array) => void)(dataArrayRef.current);
        const sum = dataArrayRef.current.reduce((a, b) => a + b, 0);
        const validVals = Array.from(dataArrayRef.current).filter(v => isFinite(v) && v > -100); amplitude = validVals.length > 0 ? Math.min(1, (validVals.reduce((a,b)=>a+b,0)/validVals.length + 100) / 100) : 0;
      } else if (isActive) {
        // Gentle idle pulse when active but no audio data
        amplitude = 0.08 + Math.sin(frame * 0.04) * 0.04;
      }

      // Minimum amplitude so lines are always visible when active
      const minAmp = isActive ? 0.06 : 0.02;
      const finalAmp = Math.max(amplitude, minAmp);

      for (let l = 0; l < LINE_COUNT; l++) {
        const phaseOffset = l * (Math.PI * 0.5);
        const alphaBase = isActive ? 0.55 : 0.2;
        const alpha = alphaBase + (l * 0.1);

        ctx.beginPath();
        ctx.strokeStyle = isActive ? color : "#9AA0A6";
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";

        for (let x = 0; x <= width; x++) {
          const t = x / width;
          const phase = phaseOffset + (frame * 0.025) + (l * 0.3);
          const freq = 2.5 + l * 0.4;
          const y =
            height / 2 +
            Math.sin(t * Math.PI * freq + phase) *
              finalAmp *
              height *
              0.38 *
              Math.sin(t * Math.PI); // envelope: taper at edges

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      frame++;
      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, analyserNode, color, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block", maxWidth: "100%" }}
    />
  );
}
