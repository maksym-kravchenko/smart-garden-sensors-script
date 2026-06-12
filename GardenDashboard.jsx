import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Garden Monitor — single-file dashboard.
 *
 * This is written as a client component. To use it in Next.js (app router):
 *   1. Add  'use client'  as the first line.
 *   2. Replace the simulation block (see SIMULATION below) with the useMqtt hook.
 *
 * Colours: matcha + pale white-green + white, light theme.
 */

const palette = {
  bg1: "#FBFCF8",
  bg2: "#EAF1DF",
  card: "#FFFFFF",
  border: "#E4EBD8",
  matcha: "#8BA86B",
  matchaDeep: "#6E8C53",
  matchaSoft: "#E6EFD7",
  track: "#EDF2E3",
  ink: "#2F3A2A",
  muted: "#75836A",
  on: "#6E8C53",
  off: "#B6BFA8",
};

function fmtTime(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function Gauge({ value, max, unit, color }) {
  const size = 132;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(value / max, 1));
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={palette.track}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)" }}
      />
      <g style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: "Fraunces, serif",
            fontWeight: 600,
            fontSize: 30,
            fill: palette.ink,
          }}
        >
          {Math.round(value)}
        </text>
        <text
          x="50%"
          y="66%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 13, fill: palette.muted, letterSpacing: 0.5 }}
        >
          {unit}
        </text>
      </g>
    </svg>
  );
}

function SensorCard({ title, icon, value, max, unit, color, status, statusColor }) {
  return (
    <div
      className="flex flex-col items-center rounded-3xl p-6"
      style={{
        background: palette.card,
        border: `1px solid ${palette.border}`,
        boxShadow: "0 10px 30px -18px rgba(60,80,40,0.35)",
      }}
    >
      <div className="flex w-full items-center justify-between">
        <span
          className="text-sm font-medium"
          style={{ color: palette.muted, letterSpacing: 0.3 }}
        >
          {title}
        </span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div className="my-4">
        <Gauge value={value} max={max} unit={unit} color={color} />
      </div>
      <span
        className="rounded-full px-3 py-1 text-xs font-semibold"
        style={{ background: palette.matchaSoft, color: statusColor }}
      >
        {status}
      </span>
    </div>
  );
}

function Switch({ on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      className="relative rounded-full"
      style={{
        width: 64,
        height: 34,
        background: on ? palette.on : palette.off,
        transition: "background 0.25s ease",
        border: "none",
        cursor: "pointer",
      }}
    >
      <span
        className="absolute rounded-full"
        style={{
          top: 4,
          left: on ? 34 : 4,
          width: 26,
          height: 26,
          background: "#fff",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          transition: "left 0.25s cubic-bezier(.4,0,.2,1)",
        }}
      />
    </button>
  );
}

function ModeToggle({ mode, onChange }) {
  const options = ["auto", "manual"];
  return (
    <div
      className="flex rounded-full p-1"
      style={{ background: palette.track }}
    >
      {options.map((opt) => {
        const active = mode === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="rounded-full px-5 py-2 text-sm font-semibold capitalize"
            style={{
              background: active ? palette.card : "transparent",
              color: active ? palette.matchaDeep : palette.muted,
              boxShadow: active
                ? "0 4px 12px -6px rgba(60,80,40,0.4)"
                : "none",
              transition: "all 0.2s ease",
              border: "none",
              cursor: "pointer",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export default function GardenDashboard() {
  const [soil, setSoil] = useState(48);
  const [light, setLight] = useState(620);
  const [mode, setMode] = useState("auto");
  const [status, setStatus] = useState("off");
  const [updated, setUpdated] = useState(new Date());
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // ---- SIMULATION (replace with useMqtt in Next.js) -----------------------
  useEffect(() => {
    const id = setInterval(() => {
      setSoil((s) => {
        const next = Math.max(8, Math.min(95, s + (Math.random() * 6 - 3.4)));
        // auto pump logic mirrors what the ESP32 firmware would decide
        if (modeRef.current === "auto") {
          setStatus(next < 35 ? "on" : "off");
        }
        return next;
      });
      setLight((l) => Math.max(0, Math.min(1000, l + (Math.random() * 80 - 40))));
      setUpdated(new Date());
    }, 1500);
    return () => clearInterval(id);
  }, []);
  // -------------------------------------------------------------------------

  const soilStatus = soil < 35 ? "Dry" : soil < 65 ? "Moist" : "Wet";
  const lightStatus = light < 300 ? "Low" : light < 700 ? "Medium" : "Bright";

  const soilColor = soil < 35 ? "#C9A24B" : palette.matcha;
  const pumpOn = status === "on";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(1200px 600px at 80% -10%, ${palette.matchaSoft} 0%, transparent 60%), linear-gradient(160deg, ${palette.bg1} 0%, ${palette.bg2} 100%)`,
        color: palette.ink,
        fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');`}</style>

      <div className="mx-auto max-w-3xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div
              className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase"
              style={{ color: palette.matchaDeep, letterSpacing: 1.5 }}
            >
              <span
                className="inline-block rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  background: palette.matcha,
                  boxShadow: `0 0 0 4px ${palette.matchaSoft}`,
                }}
              />
              Live
            </div>
            <h1
              style={{
                fontFamily: "Fraunces, serif",
                fontWeight: 600,
                fontSize: 38,
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              Garden Monitor
            </h1>
          </div>
          <div className="text-right text-xs" style={{ color: palette.muted }}>
            <div>Last update</div>
            <div style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmtTime(updated)}
            </div>
          </div>
        </div>

        {/* Sensors */}
        <div className="mb-5 grid grid-cols-2 gap-5">
          <SensorCard
            title="Soil Moisture"
            icon="🌱"
            value={soil}
            max={100}
            unit="%"
            color={soilColor}
            status={soilStatus}
            statusColor={palette.matchaDeep}
          />
          <SensorCard
            title="Light"
            icon="☀️"
            value={light}
            max={1000}
            unit="lux"
            color={palette.matcha}
            status={lightStatus}
            statusColor={palette.matchaDeep}
          />
        </div>

        {/* Pump */}
        <div
          className="rounded-3xl p-6"
          style={{
            background: palette.card,
            border: `1px solid ${palette.border}`,
            boxShadow: "0 10px 30px -18px rgba(60,80,40,0.35)",
          }}
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 22 }}>💧</span>
              <div>
                <div className="font-semibold" style={{ fontSize: 17 }}>
                  Water Pump
                </div>
                <div className="text-xs" style={{ color: palette.muted }}>
                  {mode === "auto"
                    ? "Controlled automatically by soil moisture"
                    : "Manual control"}
                </div>
              </div>
            </div>
            <span
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: pumpOn ? palette.matchaSoft : palette.track,
                color: pumpOn ? palette.matchaDeep : palette.muted,
              }}
            >
              <span
                className="inline-block rounded-full"
                style={{
                  width: 7,
                  height: 7,
                  background: pumpOn ? palette.on : palette.off,
                }}
              />
              {pumpOn ? "ON" : "OFF"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span
              className="text-sm font-medium"
              style={{ color: palette.muted }}
            >
              Mode
            </span>
            <ModeToggle mode={mode} onChange={setMode} />
          </div>

          {/* Switch only in manual mode */}
          {mode === "manual" && (
            <div
              className="mt-5 flex items-center justify-between rounded-2xl p-4"
              style={{ background: palette.bg1, border: `1px solid ${palette.border}` }}
            >
              <span className="text-sm font-medium">Pump power</span>
              <Switch
                on={pumpOn}
                onToggle={() => setStatus(pumpOn ? "off" : "on")}
              />
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: palette.muted }}>
          ESP32 · soil · light · pump
        </p>
      </div>
    </div>
  );
}
