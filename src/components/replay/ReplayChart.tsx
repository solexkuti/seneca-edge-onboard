// Lightweight Charts renderer.
//
// Wrapped to be client-only — Lightweight Charts touches `window`/canvas at
// import time, so the parent route should mount it after hydration. Exposes
// imperative `setData` / `update` methods plus optional SL/TP price-line
// markers via refs.

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type IPriceLine,
} from "lightweight-charts";
import type { Candle } from "@/lib/replay/types";

export interface ReplayChartHandle {
  setData: (candles: Candle[]) => void;
  update: (candle: Candle) => void;
  setLevels: (levels: { entry?: number | null; sl?: number | null; tp?: number | null }) => void;
}

interface Props {
  className?: string;
}

export const ReplayChart = forwardRef<ReplayChartHandle, Props>(function ReplayChart(
  { className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const linesRef = useRef<{ entry?: IPriceLine; sl?: IPriceLine; tp?: IPriceLine }>({});

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#111114" },
        textColor: "#A1A1AA",
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      rightPriceScale: { borderColor: "#1F1F23" },
      timeScale: { borderColor: "#1F1F23", timeVisible: true, secondsVisible: false },
      autoSize: true,
      crosshair: { mode: 1 },
    });
    // Candles use SOLID semantic performance colors — never gradient.
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => chart.timeScale().fitContent());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      linesRef.current = {};
    };
  }, []);

  useImperativeHandle(ref, () => ({
    setData(candles) {
      const series = seriesRef.current;
      if (!series) return;
      series.setData(
        candles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
      chartRef.current?.timeScale().fitContent();
    },
    update(candle) {
      seriesRef.current?.update({
        time: candle.time as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
    },
    setLevels({ entry, sl, tp }) {
      const series = seriesRef.current;
      if (!series) return;
      const cur = linesRef.current;
      if (cur.entry) { series.removePriceLine(cur.entry); cur.entry = undefined; }
      if (cur.sl)    { series.removePriceLine(cur.sl);    cur.sl = undefined; }
      if (cur.tp)    { series.removePriceLine(cur.tp);    cur.tp = undefined; }
      if (entry != null) {
        cur.entry = series.createPriceLine({
          price: entry, color: "#FFB347", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "Entry",
        });
      }
      if (sl != null) {
        cur.sl = series.createPriceLine({
          price: sl, color: "#EF4444", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "SL",
        });
      }
      if (tp != null) {
        cur.tp = series.createPriceLine({
          price: tp, color: "#22C55E", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "TP",
        });
      }
    },
  }), []);

  return <div ref={containerRef} className={className} style={{ width: "100%", height: "100%" }} />;
});
