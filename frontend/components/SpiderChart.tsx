"use client";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface Scores {
  predictability: number;
  profitability: number;
  growth: number;
  moat: number;
  financial_strength: number;
  valuation: number;
}

const LABEL_MAP: Record<keyof Scores, string> = {
  predictability: "Predictability",
  profitability: "Profitability",
  growth: "Growth",
  moat: "Moat",
  financial_strength: "Fin. Strength",
  valuation: "Valuation",
};

export default function SpiderChart({ scores, size = 260 }: { scores: Scores; size?: number }) {
  const data = (Object.keys(LABEL_MAP) as (keyof Scores)[]).map(key => ({
    subject: LABEL_MAP[key],
    value: scores[key],
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="rgba(148,163,184,0.15)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
        />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          dataKey="value"
          stroke="#c9a84c"
          fill="#c9a84c"
          fillOpacity={0.18}
          strokeWidth={1.5}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => [`${v}/100`]}
          contentStyle={{ background: "#0f1628", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#e2e8f0" }}
          itemStyle={{ color: "#c9a84c" }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
