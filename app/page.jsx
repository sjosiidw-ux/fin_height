"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, Box, Check, ChevronRight, CirclePlay, Cpu,
  Crosshair, Download, FileText, Gauge, Layers3, Maximize2, MousePointer2, Pause, Play, Radio, ScanLine,
  Settings2, SlidersHorizontal, Sparkles, Table2, TimerReset, TrendingUp, Waves, Workflow, Zap,
} from "lucide-react";

const ModelViewer = dynamic(() => import("./model-viewer"), {
  ssr: false,
  loading: () => <div className="scene-loading">Initializing digital twin...</div>,
});

const solutions = [
  {
    id: "laser",
    number: "01",
    kicker: "NON-CONTACT / INLINE",
    name: "Line laser + encoder",
    type: "Continuous profile scan",
    source: "/models/inline_laser_encoder.glb",
    blendSource: "/models/inline_laser_encoder.blend",
    accent: "#61e8d5",
    accentSoft: "rgba(97,232,213,.16)",
    icon: ScanLine,
    status: "Beam synchronized",
    visual: "Laser triangulation",
    description: "A line laser watches every crest without touching the radiator. Encoder ticks give each peak a position before the PLC commits it to the inspection record.",
    outcome: "Remove contact bounce at line speed.",
    stats: [
      ["Resolution", "1.5 um"],
      ["Response", "30 us"],
      ["Buffer", "100 peaks"],
    ],
    tags: ["Line beam averaging", "Air-purge ready", "PLC peak buffer"],
    flow: ["Encoder pulse", "Laser crest", "PLC peak buffer", "HMI decision"],
    signal: "laser",
    evidence: [
      ["01", "Non-contact", "No probe pressure on thin formed sheet"],
      ["02", "Spatially locked", "Incremental encoder ties height to travel"],
      ["03", "Traceable", "Peak set is ready for SPC and audit"],
    ],
  },
  {
    id: "roller",
    number: "02",
    kicker: "CONTACT / RETROFIT",
    name: "Rolling LVDT indexer",
    type: "Controlled peak tracking",
    source: "/models/rolling_lvdt_indexer.glb?v=system2-synchronized-v2",
    blendSource: "/models/system_03_arduino_hid_indexer.blend",
    accent: "#b79cff",
    accentSoft: "rgba(183,156,255,.17)",
    icon: CirclePlay,
    status: "Fixed crest inspection",
    visual: "Motorized peak capture",
    description: "A NEMA-17 lead screw indexes a 3D-printed locating tray beneath a raised, stationary LVDT head. The supplied Blender model carries the original tray and roller mechanism.",
    outcome: "Turn an existing LVDT into a repeatable, logged sequence.",
    stats: [
      ["Contact", "Rolling"],
      ["Indexing", "Lead screw"],
      ["Logging", "Arduino HID"],
    ],
    tags: ["NEMA-17 drive", "3D printed tray", "Arduino Leonardo"],
    flow: ["Tray index", "Roller rides crest", "LVDT reads", "HID Enter event"],
    signal: "roller",
    evidence: [
      ["01", "Fixed inspection point", "Original roller-and-LVDT station geometry"],
      ["02", "Repeatable motion", "Lead screw fixes the sample position"],
      ["03", "Low-friction bridge", "Arduino sends the accepted result to HMI"],
    ],
  },
];

const defectLibrary = [
  { id: "nominal", label: "Nominal run", short: "PASS", description: "Reference geometry inside the acceptance window." },
  { id: "low_fin", label: "Low fin", short: "LOW", description: "Crest falls below the 1.00 mm lower limit." },
  { id: "bent_fin", label: "Bent fin", short: "BEND", description: "Irregular profile widens the detected peak." },
  { id: "missing_fin", label: "Missing fin", short: "MISS", description: "Expected encoder position has no valid crest." },
  { id: "vibration", label: "Vibration", short: "VIB", description: "Mechanical noise challenges the filtered signal." },
  { id: "encoder_slip", label: "Encoder slip", short: "SLIP", description: "Position trace shifts from the physical peak." },
];

const componentMaps = {
  laser: [
    { id: "laser-head", match: "Omron ZX2-LD50L", name: "Line laser head", note: "Non-contact CMOS triangulation sensor." },
    { id: "beam", match: "Visible red laser beam", name: "Projected scan beam", note: "Red line establishes the crest measurement plane." },
    { id: "encoder", match: "Incremental encoder", name: "Incremental encoder", note: "Locks each measurement to tray travel position." },
    { id: "air", match: "air purge nozzle", name: "Air purge nozzle", note: "Keeps the optical window clear of contamination." },
    { id: "plc", match: "PLC scan-buffer", name: "PLC peak buffer", note: "Stores validated fin crests for the HMI decision." },
  ],
  roller: [
    { id: "tray", match: "3D printed moving tray base", name: "3D-printed locating tray", note: "Carries and locates the folded-fin stack." },
    { id: "motor", match: "NEMA 17", name: "NEMA-17 stepper", note: "Drives indexed tray travel through the lead screw." },
    { id: "screw", match: "Precision lead screw", name: "Precision lead screw", note: "Provides repeatable position increments." },
    { id: "lvdt", match: "Peak-drop LVDT", name: "Peak-drop LVDT", note: "Converts vertical roller movement into height data." },
    { id: "roller", match: "Black rubber roller tip", name: "Rolling contact tip", note: "Tracks the formed sheet from valley to crest." },
    { id: "arduino", match: "Arduino Leonardo", name: "Arduino Leonardo", note: "Sends accepted values to the HMI via USB HID." },
  ],
};

function downloadBatchCsv(solution, scenario) {
  const rows = ["fin_no,height_mm,status,position_mm,scenario", ...Array.from({ length: 12 }, (_, index) => {
    const defective = scenario !== "nominal" && index === 7;
    const height = defective && scenario === "low_fin" ? 0.942 : (1.202 + Math.sin(index * 0.67) * (solution.id === "laser" ? 0.004 : 0.014)).toFixed(3);
    return `${String(index + 1).padStart(2, "0")},${height},${defective ? "HOLD" : "PASS"},${(index * 2.5).toFixed(2)},${scenario}`;
  })];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const href = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = href; link.download = `${solution.id}-${scenario}-inspection-batch.csv`; link.click(); URL.revokeObjectURL(href);
}

function ComponentInspector({ solution, activeId, onSelect }) {
  const parts = componentMaps[solution.id];
  const active = parts.find((part) => part.id === activeId) || parts[0];
  return <aside className="component-inspector" aria-label="3D component labels">
    <header><span>COMPONENT MAP</span><b>CLICK PARTS IN 3D</b></header>
    <div className="component-chips">{parts.map((part) => <button key={part.id} onClick={() => onSelect(part.id)} className={part.id === active.id ? "active" : ""}>{part.name}</button>)}</div>
    <div className="component-detail"><span>SELECTED</span><b>{active.name}</b><p>{active.note}</p></div>
  </aside>;
}

function SignalTrace({ solution, playing }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => setPhase((value) => (value + 1) % 1000), 55);
    return () => clearInterval(timer);
  }, [playing]);

  const paths = useMemo(() => {
    const points = Array.from({ length: 121 }, (_, index) => {
      const x = (index / 120) * 680;
      const moving = index + phase * 0.7;
      if (solution.signal === "laser") {
        const profile = 48 + Math.sin(index * 0.31) * 11;
        const noise = Math.sin(moving * 2.7) * 0.65 + Math.sin(moving * 0.7) * 0.35;
        return [x, profile + noise, profile];
      }
      const folded = 44 + Math.abs(Math.sin(index * 0.33 + phase * 0.014)) * 36;
      const contactNoise = Math.sin(moving * 0.38) * 0.8;
      return [x, folded + contactNoise, folded];
    });
    const makePath = (valueIndex) => points.map(([x, raw, smooth], index) => `${index ? "L" : "M"}${x.toFixed(1)},${[raw, smooth][valueIndex].toFixed(1)}`).join(" ");
    return { raw: makePath(0), smooth: makePath(1) };
  }, [phase, solution.signal]);

  return <div className="signal-card">
    <div className="signal-head"><span><Activity size={15} /> Live measurement stream</span><b style={{ color: solution.accent }}>{playing ? "ACQUIRING" : "HOLD"}</b></div>
    <svg viewBox="0 0 680 104" preserveAspectRatio="none" aria-label="Animated measurement signal">
      <path d="M0,17H680 M0,52H680 M0,87H680" className="signal-grid" />
      <path d={paths.smooth} className="signal-filter" />
      <path d={paths.raw} className="signal-raw" style={{ stroke: solution.accent }} />
      <line x1="0" y1="0" x2="0" y2="104" className={playing ? "signal-cursor moving" : "signal-cursor"} style={{ stroke: solution.accent }} />
    </svg>
    <div className="signal-foot">
      <span><i style={{ background: solution.accent }} />Measured profile</span>
      <span><i className="filter-dot" />Validated geometry</span>
      <strong>{solution.signal === "laser" ? "Encoder locked" : "Continuous roller contact"}</strong>
    </div>
  </div>;
}

function ProcessRail({ solution }) {
  return <div className="process-rail">
    {solution.flow.map((step, index) => <div className="process-step" key={step}>
      <span>{String(index + 1).padStart(2, "0")}</span>
      <b>{step}</b>
      {index < solution.flow.length - 1 && <ChevronRight className="rail-arrow" size={16} />}
    </div>)}
  </div>;
}

function ProcessGraph({ solution, playing, speed, scenario }) {
  const [phase, setPhase] = useState(0);
  const [mode, setMode] = useState("filtered");
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => setPhase((value) => value + 1), Math.round(75 / speed));
    return () => clearInterval(timer);
  }, [playing, speed]);
  const graph = useMemo(() => {
    const count = 145;
    const values = Array.from({ length: count }, (_, index) => {
      const travel = index + phase * 0.72;
      const folded = Math.pow(Math.abs(Math.sin(travel * 0.20)), solution.id === "laser" ? 1.6 : 1.22);
      const noise = solution.id === "laser" ? Math.sin(travel * 2.2) * 0.004 : Math.sin(travel * 1.4) * 0.014;
      const isTarget = index > 94 && index < 111;
      const lowFin = scenario === "low_fin" && isTarget ? -0.22 * folded : 0;
      const bend = scenario === "bent_fin" && isTarget ? Math.sin(travel * 0.8) * 0.045 : 0;
      const vibration = scenario === "vibration" ? Math.sin(travel * 4.4) * 0.024 : 0;
      const missing = scenario === "missing_fin" && isTarget ? -0.28 * folded : 0;
      return 0.96 + folded * 0.27 + noise + lowFin + bend + vibration + missing;
    });
    const filtered = values.map((_, index) => {
      const start = Math.max(0, index - 3); const end = Math.min(values.length, index + 4);
      return values.slice(start, end).reduce((sum, item) => sum + item, 0) / (end - start);
    });
    const derivative = filtered.map((value, index) => (index ? (value - filtered[index - 1]) * 12 : 0));
    const active = mode === "raw" ? values : mode === "derivative" ? derivative : filtered;
    const min = mode === "derivative" ? -0.22 : 0.78;
    const max = mode === "derivative" ? 0.22 : 1.48;
    const point = (value, index) => `${index ? "L" : "M"}${(index / (count - 1) * 720).toFixed(1)},${(150 - ((value - min) / (max - min)) * 132).toFixed(1)}`;
    const path = active.map(point).join(" ");
    const rawPath = values.map(point).join(" ");
    const markers = filtered.map((value, index) => ({ value, index })).filter(({ value, index }) => index > 2 && index < count - 2 && value > filtered[index - 1] && value > filtered[index + 1] && value > 1.15);
    return { path, rawPath, markers, min, max };
  }, [mode, phase, scenario, solution.id]);

  return <section className="graph-section">
    <div className="graph-heading"><div><p className="eyebrow"><Activity size={14} /> ACQUISITION + DSP</p><h2>Inspect the<br /><em>actual signal.</em></h2></div><p>The waveform uses the simulator patterns from the supplied project: formed-fin profiles, sensor noise, vibration, filtering and a deliberate low-fin defect.</p></div>
    <div className="process-graph">
      <header><div className="graph-tabs">{[["raw", "RAW INPUT"], ["filtered", "FILTERED"], ["derivative", "DERIVATIVE"]].map(([key, label]) => <button key={key} onClick={() => setMode(key)} className={mode === key ? "active" : ""}>{label}</button>)}</div><span><i /> {playing ? `${Math.round(1000 * speed)} Hz LIVE` : "ACQUISITION HOLD"}</span></header>
      <svg viewBox="0 0 720 160" preserveAspectRatio="none" aria-label="Live inspection signal graph"><path d="M0,18H720 M0,51H720 M0,84H720 M0,117H720 M0,150H720" className="graph-grid" />{mode !== "derivative" && <><path d="M0,112H720" className="tolerance-line" /><path d="M0,28H720" className="tolerance-line" /></>} {mode === "filtered" && <path d={graph.rawPath} className="graph-raw-muted" />}<path d={graph.path} className="graph-line" style={{ stroke: solution.accent }} />{mode !== "derivative" && graph.markers.map(({ index, value }) => <circle key={index} cx={index / 144 * 720} cy={150 - ((value - graph.min) / (graph.max - graph.min)) * 132} r="3.5" fill="#d6fa53" />)}</svg>
      <footer><span>0.80 mm</span><b>{mode === "derivative" ? "RATE OF CHANGE" : "1.00 - 1.45 mm ACCEPTANCE BAND"}</b><span>1.65 mm</span></footer>
    </div>
  </section>;
}

function HmiConsole({ solution, playing, setPlaying, speed, setSpeed, scenario, setScenario }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => setTick((value) => value + 1), Math.round(180 / speed));
    return () => clearInterval(timer);
  }, [playing, speed]);

  const stable = solution.id === "laser";
  const nominal = stable ? 1.204 : 1.211;
  const ripple = stable ? Math.sin(tick * 0.48) * 0.003 : Math.sin(tick * 0.32) * 0.011;
  const critical = scenario === "low_fin" || scenario === "missing_fin";
  const height = critical ? 0.942 : nominal + ripple + (scenario === "vibration" ? Math.sin(tick * 2.1) * 0.018 : 0);
  const withinTolerance = height >= 1.0 && height <= 1.45;
  const rollingAverage = nominal + (stable ? Math.sin(tick * 0.09) * 0.001 : Math.sin(tick * 0.08) * 0.004);
  const standardDeviation = stable ? 0.006 : 0.018;
  const drift = stable ? 0.0002 : 0.0007;
  const fault = scenario !== "nominal";
  const anomaly = critical ? 0.92 : scenario === "nominal" ? stable ? 0.04 : 0.11 : 0.38;
  const marker = Math.min(100, Math.max(0, ((height - 0.8) / 0.85) * 100));

  return <section className="hmi-section">
    <div className="hmi-heading"><p className="eyebrow"><Cpu size={14} /> LIVE INSPECTION HMI</p><h2>From waveform<br />to <em>quality decision.</em></h2><p>Inspired by the acquisition, peak validation, rolling SPC and anomaly workflow in the supplied inspection-system codebase.</p></div>
    <div className="hmi-console">
      <header><span><i /> ACQUISITION / 1 kHz</span><b>{solution.name.toUpperCase()}</b><span>WINDOW / 50 PEAKS</span></header>
      <div className="hmi-main">
        <div className="live-readout"><span>CURRENT CREST</span><strong>{height.toFixed(3)} <small>mm</small></strong><b className={withinTolerance ? "pass" : "fail"}>{withinTolerance ? "PASS / WITHIN TOLERANCE" : "FAIL LOW / HOLD PART"}</b></div>
        <div className="tolerance-track"><div className="tolerance-labels"><span>0.80</span><b>ACCEPTANCE BAND 1.00 - 1.45 mm</b><span>1.65</span></div><div className="track"><i className="acceptance" /><em style={{ left: `${marker}%` }} /></div><div className="tolerance-note"><span>Physical min</span><span>Target 1.20 mm</span><span>Physical max</span></div></div>
        <button className={fault ? "fault-button armed" : "fault-button"} onClick={() => setScenario(fault ? "nominal" : "low_fin")}><AlertTriangle size={15} />{fault ? "CLEAR TEST FAULT" : "INJECT LOW-FIN TEST"}</button>
      </div>
      <div className="hmi-stats"><div><span>ROLLING AVG</span><b>{rollingAverage.toFixed(3)} mm</b></div><div><span>SIGMA</span><b>{standardDeviation.toFixed(3)} mm</b></div><div><span>DRIFT / PEAK</span><b>+{drift.toFixed(4)} mm</b></div><div><span>ANOMALY</span><b className={anomaly > 0.5 ? "fail" : ""}>{anomaly.toFixed(2)}</b></div></div>
      <div className="operator-controls"><button onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}{playing ? "PAUSE CELL" : "RUN CELL"}</button><label><SlidersHorizontal size={14} /> CYCLE RATE <input type="range" min="0.5" max="1.5" step="0.25" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /><b>{speed.toFixed(2)}x</b></label></div>
      <footer><span><Check size={13} /> Peak detector: prominence + pitch validation</span><span><Check size={13} /> Traceability: sample, position, result</span></footer>
    </div>
  </section>;
}

function ReviewLab({ solution, scenario, setScenario, replay, setReplay, scrubbing, setScrubbing, playing, setPlaying }) {
  const [presentationStep, setPresentationStep] = useState(0);
  const critical = scenario === "low_fin" || scenario === "missing_fin";
  const recentPeaks = Array.from({ length: 6 }, (_, index) => {
    const target = index === 4 && scenario !== "nominal";
    const value = target && critical ? 0.942 : 1.201 + Math.sin(index * 0.9) * (solution.id === "laser" ? 0.004 : 0.014);
    return { id: 42 + index, value, status: target && critical ? "HOLD" : "PASS", pitch: target && scenario === "encoder_slip" ? "3.34" : "2.50" };
  });
  const present = ["Problem: thin fins create contact uncertainty", "System 1: line laser removes probe bounce", "System 2: roller LVDT creates a practical retrofit", "Decision: traceable peaks and SPC-ready evidence"];
  const togglePresentation = async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); };

  return <section className="review-lab">
    <header className="review-heading"><div><p className="eyebrow"><Settings2 size={14} /> INSPECTION REVIEW</p><h2>Test the measurement path.<br /><em>Review the evidence.</em></h2></div><p>Run controlled scenarios against the same model, waveform and batch evidence used throughout the demonstrator.</p></header>
    <div className="review-grid">
      <article className="defect-card"><header><span>DEFECT LIBRARY</span><b>{scenario.replace("_", " ").toUpperCase()}</b></header><div className="defect-list">{defectLibrary.map((item) => <button key={item.id} onClick={() => setScenario(item.id)} className={scenario === item.id ? "active" : ""}><span>{item.short}</span><div><b>{item.label}</b><small>{item.description}</small></div></button>)}</div></article>
      <article className="replay-card"><header><span>INSPECTION REPLAY</span><b>{scrubbing ? "SCRUB MODE" : playing ? "LIVE CYCLE" : "PAUSED"}</b></header><div className="replay-visual"><div className="replay-ruler">{Array.from({ length: 11 }, (_, index) => <i key={index} style={{ left: `${index * 10}%` }} />)}<em style={{ left: `${replay}%` }} /></div><strong>FIN {Math.min(13, Math.max(1, Math.floor(replay / 8) + 1)).toString().padStart(2, "0")}</strong><p>Model carriage, graph cursor and peak record are linked to this position.</p></div><input aria-label="Inspection replay position" type="range" min="0" max="100" value={replay} onChange={(event) => { setReplay(Number(event.target.value)); setScrubbing(true); setPlaying(false); }} /><footer><button onClick={() => { setScrubbing(false); setReplay(0); setPlaying(true); }}><Play size={14} fill="currentColor" /> RESUME LIVE</button><span>{replay.toFixed(0)}% / cycle</span></footer></article>
      <article className="spc-card"><header><span>ROLLING SPC</span><TrendingUp size={17} /></header><div className="spc-metrics"><div><b>{solution.id === "laser" ? "1.33" : "1.08"}</b><span>EST. Cpk</span></div><div><b>{solution.id === "laser" ? "0.006" : "0.018"}</b><span>SIGMA / mm</span></div><div><b>{critical ? "1" : "0"}</b><span>HOLDS / 50</span></div></div><svg viewBox="0 0 280 74" preserveAspectRatio="none"><path d="M0,48 L28,44 L54,47 L82,35 L108,42 L135,33 L162,39 L190,30 L218,38 L246,29 L280,35" className="spc-line" style={{ stroke: solution.accent }} /><path d="M0,16H280 M0,61H280" className="spc-limit" /></svg><footer><span>LOWER LIMIT 1.00</span><span>TARGET 1.20</span><span>UPPER LIMIT 1.45</span></footer></article>
    </div>
    <div className="evidence-grid">
      <article className="peak-table-card"><header><span><Table2 size={15} /> LATEST PEAK RECORDS</span><button onClick={() => downloadBatchCsv(solution, scenario)}><Download size={14} /> CSV</button></header><div className="peak-table"><div className="peak-row labels"><span>FIN</span><span>HEIGHT</span><span>PITCH</span><span>STATUS</span></div>{recentPeaks.map((peak) => <div className={peak.status === "HOLD" ? "peak-row hold" : "peak-row"} key={peak.id}><span>#{peak.id}</span><span>{peak.value.toFixed(3)} mm</span><span>{peak.pitch} mm</span><b>{peak.status}</b></div>)}</div></article>
      <article className="comparison-card"><header><span>BEFORE / AFTER</span><b>MEASUREMENT CONFIDENCE</b></header><div className="comparison-lines"><div><span>Conventional point contact</span><i><em style={{ width: "42%" }} /></i><b>BOUNCE RISK</b></div><div><span>{solution.name}</span><i><em style={{ width: solution.id === "laser" ? "94%" : "78%" }} /></i><b>TRACEABLE</b></div></div><p>Move between stations to show the difference between a noisy single-point check and a measured profile.</p></article>
      <article className="investment-card"><header><span>INVESTMENT VIEW</span><FileText size={16} /></header><div><span>Line laser + encoder</span><b>Best for line-speed automation</b></div><div><span>Rolling LVDT indexer</span><b>Best for low-cost retrofit</b></div><footer><button onClick={() => window.print()}><FileText size={14} /> PRINT / PDF REPORT</button></footer></article>
    </div>
    <div className="presentation-card"><div className="present-copy"><p>REVIEW FLOW / {String(presentationStep + 1).padStart(2, "0")}</p><h3>{present[presentationStep]}</h3></div><div className="present-actions"><button onClick={() => setPresentationStep((value) => (value + 1) % present.length)}>NEXT POINT <ArrowDownRight size={15} /></button><button onClick={togglePresentation}><Maximize2 size={15} /> FULL SCREEN</button></div></div>
  </section>;
}

export default function Home() {
  const [selected, setSelected] = useState("laser");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [scenario, setScenario] = useState("nominal");
  const [replay, setReplay] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [activeComponent, setActiveComponent] = useState("laser-head");
  const solution = solutions.find((item) => item.id === selected);
  const Icon = solution.icon;
  const fault = scenario !== "nominal";
  const activePart = componentMaps[solution.id].find((part) => part.id === activeComponent) || componentMaps[solution.id][0];
  const selectSolution = (id) => {
    setSelected(id);
    // Lead with the measurement point for the retrofit station. It makes
    // the rolling wheel immediately legible before the user explores the
    // tray, motor and electronics through the component map.
    setActiveComponent(id === "roller" ? "roller" : componentMaps[id][0].id);
    setScrubbing(false);
  };
  const handleModelPart = (objectName) => {
    const match = componentMaps[solution.id].find((part) => objectName.toLowerCase().includes(part.match.toLowerCase()));
    if (match) setActiveComponent(match.id);
  };

  return <main style={{ "--accent": solution.accent, "--accent-soft": solution.accentSoft }}>
    <nav className="top-nav">
      <a className="brand" href="#top" aria-label="Fin Sight home"><span className="brand-mark">F</span><span>FIN</span><i>//</i><span>SIGHT</span></a>
      <div className="nav-context"><span>MAHLE / CONCEPT CELL</span><b>Fin-height inspection twin</b></div>
      <div className="nav-live"><i /><span>SIMULATION ONLINE</span></div>
    </nav>

    <section id="top" className="hero-section">
      <div className="hero-copy">
        <p className="eyebrow"><Sparkles size={14} /> DIGITAL TWIN / INSPECTION R&D</p>
        <h1>Every fin has a<br /><em>signal worth trusting.</em></h1>
        <p className="hero-lede">A boardroom-ready demonstration of two practical routes from unstable contact checks to traceable radiator-fin measurement.</p>
        <div className="hero-actions">
          <button className="primary-action" onClick={() => document.getElementById("twin").scrollIntoView({ behavior: "smooth" })}>Enter the twin <ArrowDownRight size={18} /></button>
          <span><MousePointer2 size={15} /> Drag, zoom, inspect</span>
        </div>
      </div>
      <div className="hero-orbit" aria-hidden="true">
        <div className="orbit-core"><span>02</span><small>working<br />paths</small></div>
        <div className="orbit-ring one" /><div className="orbit-ring two" /><div className="orbit-blip cyan" /><div className="orbit-blip violet" />
      </div>
      <div className="hero-proof"><span>THE QUESTION</span><b>How do we measure a thin, moving folded sheet without turning the sensor into the error?</b></div>
    </section>

    <section id="twin" className="twin-section">
      <header className="section-header">
        <div><p className="eyebrow"><Box size={14} /> INTERACTIVE 3D STATIONS</p><h2>See the mechanism.<br /><em>Read the logic.</em></h2></div>
        <p>Each model is built to show the actual measurement path, the controls around it, and the data hand-off that makes the result useful.</p>
      </header>

      <div className="solution-selector" role="tablist" aria-label="Inspection solution selection">
        {solutions.map((item) => {
          const ItemIcon = item.icon;
          const active = item.id === selected;
          return <button key={item.id} role="tab" aria-selected={active} onClick={() => selectSolution(item.id)} className={active ? "solution-choice active" : "solution-choice"}>
            <span>{item.number}</span><ItemIcon size={19} /><div><b>{item.name}</b><small>{item.type}</small></div><ChevronRight size={17} />
          </button>;
        })}
      </div>

      <div className="twin-stage">
        <div className="stage-topline"><span><Radio size={14} /> {solution.kicker}</span><span>{solution.visual}</span><b><i /> {solution.status}</b></div>
        <div className="stage-copy">
          <span className="stage-number">/{solution.number}</span>
          <h3>{solution.name}</h3>
          <p>{solution.description}</p>
        </div>
        <div className="scene-frame"><ModelViewer source={solution.source} accent={solution.accent} playing={playing} speed={speed} fault={fault} replay={replay} scrubbing={scrubbing} highlightName={activePart.match} onComponentClick={handleModelPart} /></div>
        <ComponentInspector solution={solution} activeId={activeComponent} onSelect={setActiveComponent} />
        <div className="stage-specs">
          {solution.stats.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}
        </div>
        <button className="play-control" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause station animation" : "Run station animation"}>
          {playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}<span>{playing ? "PAUSE TWIN" : "RUN TWIN"}</span>
        </button>
        <a className="download-control" href={solution.blendSource} download aria-label={`Download ${solution.name} Blender model`}><Download size={16} /><span>BLENDER FILE</span></a>
        <div className="stage-corner top-left" /><div className="stage-corner bottom-right" />
      </div>

      <div className="twin-bottom"><div className="outcome"><span>THE CHANGE</span><h3>{solution.outcome}</h3></div><div className="tag-list">{solution.tags.map((tag) => <span key={tag}><Check size={13} /> {tag}</span>)}</div></div>
    </section>

    <HmiConsole solution={solution} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} scenario={scenario} setScenario={setScenario} />

    <ProcessGraph solution={solution} playing={playing} speed={speed} scenario={scenario} />

    <ReviewLab solution={solution} scenario={scenario} setScenario={setScenario} replay={replay} setReplay={setReplay} scrubbing={scrubbing} setScrubbing={setScrubbing} playing={playing} setPlaying={setPlaying} />

    <section className="sequence-section">
      <div className="sequence-heading"><p className="eyebrow"><Workflow size={14} /> DATA PATH</p><h2>Four events.<br />One defensible result.</h2></div>
      <ProcessRail solution={solution} />
    </section>

    <section className="proof-section">
      <div className="proof-title"><p className="eyebrow"><Crosshair size={14} /> DESIGNED FOR THE REAL FIN</p><h2>Not a generic<br /><em>machine visual.</em></h2><p>The folded fins, transport tray, sensing hardware and relevant controls are modeled as one inspection cell.</p></div>
      <div className="proof-grid">{solution.evidence.map(([number, title, copy]) => <article key={title}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div><ArrowDownRight size={19} /></article>)}</div>
    </section>

    <footer className="site-footer"><a className="brand" href="#top"><span className="brand-mark">F</span><span>FIN</span><i>//</i><span>SIGHT</span></a><span>Radiator fin-height inspection / Digital twin concept / 2026</span><span>LASER + ROLLING LVDT</span></footer>
  </main>;
}
