import React, { useEffect, useRef, useState } from "react";

/**
 * Garden Monitor — single-file dashboard.
 * In Next.js: add 'use client' at the top and swap the SIMULATION block for the
 * useGarden() MQTT hook. The water-level interlock should be enforced on the
 * ESP32 too — the UI only reflects it.
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
  blue: "#4F9BE0",
  blueDeep: "#2F7BC4",
  blueSoft: "#E3F0FB",
  red: "#DB5A52",
  redDeep: "#B83E37",
  redSoft: "#FBE7E5",
};

function fmtTime(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function Gauge({ value, max, unit, color }) {
  const size = 132, stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(value / max, 1));
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={palette.track} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)" }}
      />
      <g style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 30, fill: palette.ink }}>
          {Math.round(value)}
        </text>
        <text x="50%" y="66%" textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 13, fill: palette.muted, letterSpacing: 0.5 }}>
          {unit}
        </text>
      </g>
    </svg>
  );
}

function SensorCard({ title, icon, value, max, unit, color, status, statusColor }) {
  return (
    <div className="flex flex-col items-center rounded-3xl p-6"
      style={{ background: palette.card, border: `1px solid ${palette.border}`,
        boxShadow: "0 10px 30px -18px rgba(60,80,40,0.35)" }}>
      <div className="flex w-full items-center justify-between">
        <span className="text-sm font-medium" style={{ color: palette.muted, letterSpacing: 0.3 }}>{title}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div className="my-4"><Gauge value={value} max={max} unit={unit} color={color} /></div>
      <span className="rounded-full px-3 py-1 text-xs font-semibold"
        style={{ background: palette.matchaSoft, color: statusColor }}>{status}</span>
    </div>
  );
}

function Switch({ on, onToggle, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onToggle}
      aria-pressed={on}
      disabled={disabled}
      className="relative rounded-full"
      style={{
        width: 64, height: 34,
        background: disabled ? palette.off : on ? palette.on : palette.off,
        opacity: disabled ? 0.45 : 1,
        transition: "background 0.25s ease", border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
      }}>
      <span className="absolute rounded-full"
        style={{ top: 4, left: on && !disabled ? 34 : 4, width: 26, height: 26,
          background: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          transition: "left 0.25s cubic-bezier(.4,0,.2,1)" }} />
    </button>
  );
}

function ModeToggle({ mode, onChange }) {
  return (
    <div className="flex rounded-full p-1" style={{ background: palette.track }}>
      {["auto", "manual"].map((opt) => {
        const active = mode === opt;
        return (
          <button key={opt} onClick={() => onChange(opt)}
            className="rounded-full px-5 py-2 text-sm font-semibold capitalize"
            style={{ background: active ? palette.card : "transparent",
              color: active ? palette.matchaDeep : palette.muted,
              boxShadow: active ? "0 4px 12px -6px rgba(60,80,40,0.4)" : "none",
              transition: "all 0.2s ease", border: "none", cursor: "pointer" }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Canister({ level, low }) {
  // level is illustrative (0-100). With a single bottom float you really only
  // have low/ok — drive `low` from the float and pass a fixed level if needed.
  const water = low ? palette.red : palette.blue;
  const waterDeep = low ? palette.redDeep : palette.blueDeep;
  const fill = Math.max(0, Math.min(100, level));
  return (
    <svg width="120" height="170" viewBox="0 0 120 170">
      <defs>
        <clipPath id="canBody">
          <rect x="20" y="28" width="80" height="130" rx="14" />
        </clipPath>
      </defs>
      {/* cap */}
      <rect x="46" y="10" width="28" height="14" rx="4" fill={palette.border} />
      <rect x="52" y="18" width="16" height="12" fill={palette.border} />
      {/* water */}
      <g clipPath="url(#canBody)">
        <rect x="20" y={28 + 130 * (1 - fill / 100)} width="80" height={130 * (fill / 100) + 4}
          fill={water} style={{ transition: "all 0.6s cubic-bezier(.4,0,.2,1)" }} />
        <ellipse cx="60" cy={28 + 130 * (1 - fill / 100)} rx="40" ry="6"
          fill={waterDeep} opacity="0.45"
          style={{ transition: "cy 0.6s cubic-bezier(.4,0,.2,1)" }} />
      </g>
      {/* glass body outline */}
      <rect x="20" y="28" width="80" height="130" rx="14" fill="none"
        stroke={low ? palette.redDeep : palette.border} strokeWidth="3" />
      {/* low-level marker line at the float position */}
      <line x1="20" y1="142" x2="100" y2="142" stroke={palette.muted}
        strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />
    </svg>
  );
}

export default function GardenDashboard() {
  const [soil, setSoil] = useState(48);
  const [light, setLight] = useState(620);
  const [mode, setMode] = useState("auto");
  const [status, setStatus] = useState("off");
  const [waterLevel, setWaterLevel] = useState(80);
  const [updated, setUpdated] = useState(new Date());

  const statusRef = useRef(status);
  statusRef.current = status;

  const waterLow = waterLevel < 18; // float reports "low" below this point

  // ---- SIMULATION (replace with useGarden() in Next.js) -------------------
  useEffect(() => {
    const id = setInterval(() => {
      setUpdated(new Date());
      setSoil((s) => Math.max(8, Math.min(95, s + (Math.random() * 6 - 3.4))));
      setLight((l) => Math.max(0, Math.min(1000, l + (Math.random() * 80 - 40))));
      setWaterLevel((w) => {
        const pumping = statusRef.current === "on";
        // pumping drains; idle slowly trickles back up (demo only)
        return Math.max(0, Math.min(100, pumping ? w - 3 : w + 0.5));
      });
    }, 1500);
    return () => clearInterval(id);
  }, []);
  // -------------------------------------------------------------------------

  // Pump decision + dry-run interlock. waterLow always wins.
  useEffect(() => {
    if (waterLow) { setStatus("off"); return; }
    if (mode === "auto") setStatus(soil < 35 ? "on" : "off");
  }, [soil, mode, waterLow]);

  const soilStatus = soil < 35 ? "Dry" : soil < 65 ? "Moist" : "Wet";
  const lightStatus = light < 300 ? "Low" : light < 700 ? "Medium" : "Bright";
  const soilColor = soil < 35 ? "#C9A24B" : palette.matcha;
  const pumpOn = status === "on";

  // Hard guard: starting the pump is impossible while the tank is empty.
  // Don't rely on the disabled <Switch> alone — the control path enforces it.
  const setPump = (on) => {
    if (on && waterLow) return;
    setStatus(on ? "on" : "off");
  };

  return (
    <div style={{ minHeight: "100vh",
      background: `radial-gradient(1200px 600px at 80% -10%, ${palette.matchaSoft} 0%, transparent 60%), linear-gradient(160deg, ${palette.bg1} 0%, ${palette.bg2} 100%)`,
      color: palette.ink, fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');`}</style>

      <div className="mx-auto max-w-3xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase"
              style={{ color: palette.matchaDeep, letterSpacing: 1.5 }}>
              <span className="inline-block rounded-full"
                style={{ width: 8, height: 8, background: palette.matcha, boxShadow: `0 0 0 4px ${palette.matchaSoft}` }} />
              Live
            </div>
            <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 38, lineHeight: 1.05, margin: 0 }}>
              Garden Monitor
            </h1>
          </div>
          <div className="text-right text-xs" style={{ color: palette.muted }}>
            <div>Last update</div>
            <div style={{ fontVariantNumeric: "tabular-nums" }}>{fmtTime(updated)}</div>
          </div>
        </div>

        {/* Sensors */}
        <div className="mb-5 grid grid-cols-2 gap-5">
          <SensorCard title="Soil Moisture" icon="🌱" value={soil} max={100} unit="%"
            color={soilColor} status={soilStatus} statusColor={palette.matchaDeep} />
          <SensorCard title="Light" icon="☀️" value={light} max={1000} unit="lux"
            color={palette.matcha} status={lightStatus} statusColor={palette.matchaDeep} />
        </div>

        {/* Water reservoir */}
        <div className="mb-5 rounded-3xl p-6"
          style={{ background: palette.card,
            border: `1px solid ${waterLow ? palette.redDeep : palette.border}`,
            boxShadow: "0 10px 30px -18px rgba(60,80,40,0.35)" }}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 22 }}>🪣</span>
              <div>
                <div className="font-semibold" style={{ fontSize: 17 }}>Water Reservoir</div>
                <div className="text-xs" style={{ color: palette.muted }}>Low-level float at the bottom</div>
              </div>
            </div>
            <span className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ background: waterLow ? palette.redSoft : palette.blueSoft,
                color: waterLow ? palette.redDeep : palette.blueDeep }}>
              <span className="inline-block rounded-full"
                style={{ width: 7, height: 7, background: waterLow ? palette.red : palette.blue }} />
              {waterLow ? "Low water" : "Water OK"}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Canister level={waterLevel} low={waterLow} />
            <div className="flex-1">
              <div className="rounded-2xl p-4 text-sm"
                style={{ background: waterLow ? palette.redSoft : palette.blueSoft,
                  color: waterLow ? palette.redDeep : palette.blueDeep, lineHeight: 1.5 }}>
                <strong>Safety interlock:</strong> when the level is low, the pump is
                switched off and a manual run is not possible. It re-enables once the
                reservoir is refilled.
              </div>
            </div>
          </div>
        </div>

        {/* Pump */}
        <div className="rounded-3xl p-6"
          style={{ background: palette.card, border: `1px solid ${palette.border}`,
            boxShadow: "0 10px 30px -18px rgba(60,80,40,0.35)" }}>
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 22 }}>💧</span>
              <div>
                <div className="font-semibold" style={{ fontSize: 17 }}>Water Pump</div>
                <div className="text-xs" style={{ color: palette.muted }}>
                  {waterLow ? "Locked — refill the reservoir"
                    : mode === "auto" ? "Controlled automatically by soil moisture"
                    : "Manual control"}
                </div>
              </div>
            </div>
            <span className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ background: pumpOn ? palette.matchaSoft : palette.track,
                color: pumpOn ? palette.matchaDeep : palette.muted }}>
              <span className="inline-block rounded-full"
                style={{ width: 7, height: 7, background: pumpOn ? palette.on : palette.off }} />
              {pumpOn ? "ON" : "OFF"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: palette.muted }}>Mode</span>
            <ModeToggle mode={mode} onChange={setMode} />
          </div>

          {mode === "manual" && (
            <div className="mt-5 flex items-center justify-between rounded-2xl p-4"
              style={{ background: palette.bg1, border: `1px solid ${palette.border}` }}>
              <div>
                <div className="text-sm font-medium">Pump power</div>
                {waterLow && (
                  <div className="text-xs" style={{ color: palette.redDeep }}>
                    Disabled — low water
                  </div>
                )}
              </div>
              <Switch on={pumpOn} disabled={waterLow}
                onToggle={() => setPump(!pumpOn)} />
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: palette.muted }}>
          ESP32 · soil · light · water level · pump
        </p>
      </div>
    </div>
  );
}
