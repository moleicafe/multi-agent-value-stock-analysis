"use client";
import { useEffect, useRef } from "react";

export interface OhlcBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Props {
  data: OhlcBar[];
  height?: number;
}

export default function CandlestickChart({ data, height = 380 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !data?.length) return;

    let cleanup: (() => void) | undefined;

    import("lightweight-charts").then((lc) => {
      if (!containerRef.current) return;

      const chart = lc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height,
        layout: {
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: "#94a3b8",
        },
        grid: {
          vertLines: { color: "rgba(148,163,184,0.08)" },
          horzLines: { color: "rgba(148,163,184,0.08)" },
        },
        crosshair: { mode: lc.CrosshairMode.Normal },
        rightPriceScale: { borderColor: "rgba(148,163,184,0.2)" },
        timeScale: { borderColor: "rgba(148,163,184,0.2)", timeVisible: true },
      });

      // v5 API: chart.addSeries(SeriesType, options)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candles = chart.addSeries((lc as any).CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      candles.setData(data as any);

      if (data[0]?.volume !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const volSeries = chart.addSeries((lc as any).HistogramSeries, {
          color: "#c9a84c",
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        volSeries.setData(data.map(d => ({
          time: d.time,
          value: d.volume ?? 0,
          color: d.close >= d.open ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
        })) as any);
      }

      chart.timeScale().fitContent();

      const ro = new ResizeObserver(() => {
        if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
      });
      ro.observe(containerRef.current);

      cleanup = () => {
        ro.disconnect();
        chart.remove();
      };
    });

    return () => cleanup?.();
  }, [data, height]);

  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        No chart data available
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
