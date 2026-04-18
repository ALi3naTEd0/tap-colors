'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen = 'menu' | 'game' | 'results'

interface GameColor {
  name: string
  hex: string
  glow: string
  points: number
  freq: number
}

interface Circle {
  id: string
  color: GameColor
  x: number    // px from left (center of circle)
  y: number    // px from top  (center of circle)
  bornAt: number
  popped: boolean
  expiring: boolean
}

interface Result {
  date: string
  level: number
  score: number
  tapped: number
  missed: number
}

// ─── Config ──────────────────────────────────────────────────────────────────

const COLORS: GameColor[] = [
  { name: 'Rojo',     hex: '#FF4B4B', glow: 'rgba(255,75,75,0.5)',   points: 1, freq: 523 },
  { name: 'Azul',     hex: '#3B82F6', glow: 'rgba(59,130,246,0.5)',  points: 1, freq: 659 },
  { name: 'Amarillo', hex: '#FBBF24', glow: 'rgba(251,191,36,0.5)',  points: 2, freq: 784 },
  { name: 'Verde',    hex: '#22C55E', glow: 'rgba(34,197,94,0.5)',   points: 2, freq: 622 },
  { name: 'Naranja',  hex: '#F97316', glow: 'rgba(249,115,22,0.5)',  points: 3, freq: 587 },
  { name: 'Morado',   hex: '#A855F7', glow: 'rgba(168,85,247,0.5)',  points: 3, freq: 698 },
  { name: 'Rosa',     hex: '#EC4899', glow: 'rgba(236,72,153,0.5)',  points: 5, freq: 880 },
]

interface LevelConfig {
  maxCircles: number
  lifeMs: number
  spawnMs: number
  size: number
  pointMult: number
}

function getLevelConfig(level: number): LevelConfig {
  // Progressive difficulty: capped so it stays playable
  const clamped = Math.min(level, 12)
  return {
    maxCircles: Math.min(1 + Math.floor((clamped - 1) / 2), 5),
    lifeMs:     Math.max(5000 - (clamped - 1) * 350, 1400),
    spawnMs:    Math.max(3000 - (clamped - 1) * 220, 800),
    size:       Math.max(160 - (clamped - 1) * 8, 80),
    pointMult:  1 + (clamped - 1) * 0.25,
  }
}

const GAME_SECS = 60
const STORAGE_KEY = 'tap-colors-results'
const SIZE_PREF_KEY = 'tap-colors-size'
const EXPIRY_WARN_MS = 800 // show expiring state before removal

const SIZE_MULTS = { large: 1.0, medium: 0.65, small: 0.45, hard: 0.28, pro: 0.15 } as const
type SizeMode = keyof typeof SIZE_MULTS

// ─── Storage ─────────────────────────────────────────────────────────────────

function readResults(): Result[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') }
  catch { return [] }
}

function writeResult(r: Result) {
  const all = readResults()
  localStorage.setItem(STORAGE_KEY, JSON.stringify([r, ...all].slice(0, 50)))
}

// ─── Audio ───────────────────────────────────────────────────────────────────

function beep(freq: number, points: number) {
  try {
    const ac = new AudioContext()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.type = 'sine'
    osc.frequency.value = freq
    // More points = slightly longer/louder sound
    const duration = 0.18 + points * 0.03
    gain.gain.setValueAtTime(0.3, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
    osc.start()
    osc.stop(ac.currentTime + duration)
    setTimeout(() => ac.close(), 600)
  } catch { /* audio unavailable */ }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TapColorsGame() {
  const [screen, setScreen]         = useState<Screen>('menu')
  const [level, setLevel]           = useState(1)
  const [circles, setCircles]       = useState<Circle[]>([])
  const [score, setScore]           = useState(0)
  const [tapped, setTapped]         = useState(0)
  const [missed, setMissed]         = useState(0)
  const [timeLeft, setTimeLeft]     = useState(GAME_SECS)
  const [lastResult, setLastResult] = useState<Result | null>(null)
  const [results, setResults]       = useState<Result[]>([])
  const [scoreBump, setScoreBump]   = useState(false)
  const [sizeMode, setSizeMode]     = useState<SizeMode>('large')

  const gameAreaRef  = useRef<HTMLDivElement>(null)
  const scoreRef     = useRef(0)
  const tappedRef    = useRef(0)
  const missedRef    = useRef(0)
  const startRef     = useRef(0)
  const levelRef     = useRef(1)
  const screenRef    = useRef<Screen>('menu')
  const sizeModeRef  = useRef<SizeMode>('large')

  useEffect(() => { levelRef.current = level }, [level])
  useEffect(() => { sizeModeRef.current = sizeMode }, [sizeMode])

  useEffect(() => {
    const saved = localStorage.getItem(SIZE_PREF_KEY)
    if (saved === 'large' || saved === 'medium' || saved === 'small' || saved === 'hard' || saved === 'pro') {
      setSizeMode(saved)
      sizeModeRef.current = saved
    }
  }, [])

  const toggleSize = useCallback((mode: SizeMode) => {
    setSizeMode(mode)
    sizeModeRef.current = mode
    localStorage.setItem(SIZE_PREF_KEY, mode)
  }, [])

  const stopTimers = useCallback(() => {
    // timers stored in closure refs below; this just signals stop via screenRef
    screenRef.current = 'menu'
  }, [])

  const endGame = useCallback(() => {
    screenRef.current = 'results'
    const result: Result = {
      date: new Date().toLocaleDateString('es-ES'),
      level: levelRef.current,
      score: scoreRef.current,
      tapped: tappedRef.current,
      missed: missedRef.current,
    }
    writeResult(result)
    setLastResult(result)
    setResults(readResults())
    setCircles([])
    setScreen('results')
  }, [])

  const startGame = useCallback((lvl: number) => {
    screenRef.current = 'game'
    scoreRef.current  = 0
    tappedRef.current = 0
    missedRef.current = 0
    startRef.current  = Date.now()
    levelRef.current  = lvl
    setLevel(lvl)
    setScore(0)
    setTapped(0)
    setMissed(0)
    setTimeLeft(GAME_SECS)
    setCircles([])
    setScreen('game')
  }, [])

  // ── Spawn loop ──
  useEffect(() => {
    if (screen !== 'game') return
    const cfg = getLevelConfig(level)

    const spawn = () => {
      if (screenRef.current !== 'game') return
      const area = gameAreaRef.current
      if (!area) return
      const { width, height } = area.getBoundingClientRect()
      const circleSize = Math.round(cfg.size * SIZE_MULTS[sizeModeRef.current])
      const half = circleSize / 2 + 8

      setCircles(prev => {
        const active = prev.filter(c => !c.popped && !c.expiring)
        if (active.length >= cfg.maxCircles) return prev
        const color = COLORS[Math.floor(Math.random() * COLORS.length)]
        return [...prev, {
          id: crypto.randomUUID(),
          color,
          x: half + Math.random() * Math.max(0, width - half * 2),
          y: half + Math.random() * Math.max(0, height - half * 2),
          bornAt: Date.now(),
          popped: false,
          expiring: false,
        }]
      })
    }

    spawn()
    const id = setInterval(spawn, cfg.spawnMs)
    return () => clearInterval(id)
  }, [screen, level])

  // ── Countdown + expiry loop ──
  useEffect(() => {
    if (screen !== 'game') return
    const cfg = getLevelConfig(level)

    const id = setInterval(() => {
      if (screenRef.current !== 'game') return

      // Time check
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000)
      const remaining = GAME_SECS - elapsed
      if (remaining <= 0) {
        clearInterval(id)
        endGame()
        return
      }
      setTimeLeft(remaining)

      // Expiry check
      const now = Date.now()
      setCircles(prev => {
        let changed = false
        const next = prev.map(c => {
          if (c.popped || c.expiring) return c
          const age = now - c.bornAt
          if (age >= cfg.lifeMs - EXPIRY_WARN_MS && age < cfg.lifeMs) {
            changed = true
            return { ...c, expiring: true }
          }
          return c
        })
        const expired = next.filter(c => !c.popped && now - c.bornAt >= cfg.lifeMs)
        if (expired.length) {
          changed = true
          missedRef.current += expired.length
          setMissed(missedRef.current)
          return next.filter(c => c.popped || now - c.bornAt < cfg.lifeMs)
        }
        return changed ? next : prev
      })
    }, 150)

    return () => clearInterval(id)
  }, [screen, level, endGame])

  const tapCircle = useCallback((id: string, color: GameColor, mult: number) => {
    const pts = Math.round(color.points * mult)
    beep(color.freq, color.points)
    scoreRef.current += pts
    tappedRef.current++
    setScore(scoreRef.current)
    setTapped(tappedRef.current)
    setScoreBump(true)
    setTimeout(() => setScoreBump(false), 220)
    setCircles(prev => prev.map(c => c.id === id ? { ...c, popped: true } : c))
    setTimeout(() => setCircles(prev => prev.filter(c => c.id !== id)), 320)
  }, [])

  useEffect(() => { setResults(readResults()) }, [])

  // ── Best score for current level ──
  const bestForLevel = results.filter(r => r.level === level).reduce((b, r) => Math.max(b, r.score), 0)
  const cfg = getLevelConfig(level)
  const effectiveSize = Math.round(cfg.size * SIZE_MULTS[sizeMode])

  // ─── Screens ───────────────────────────────────────────────────────────────

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setResults([])
  }, [])

  if (screen === 'menu') {
    return (
      <MenuScreen
        level={level}
        onLevelChange={setLevel}
        onStart={() => startGame(level)}
        results={results}
        bestForLevel={bestForLevel}
        onClearHistory={clearHistory}
        sizeMode={sizeMode}
        onSizeModeChange={toggleSize}
      />
    )
  }

  if (screen === 'results') {
    return (
      <ResultsScreen
        result={lastResult}
        onReplay={() => startGame(level)}
        onNextLevel={() => startGame(level + 1)}
        onMenu={() => { stopTimers(); setScreen('menu') }}
      />
    )
  }

  // ─── Game Screen ───────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-white flex flex-col overflow-hidden"
      style={{ userSelect: 'none', touchAction: 'none' }}
    >
      <GameHud
        score={score}
        missed={missed}
        timeLeft={timeLeft}
        level={level}
        scoreBump={scoreBump}
      />
      <div ref={gameAreaRef} className="flex-1 relative">
        {circles.map(c => (
          <GameCircle
            key={c.id}
            circle={c}
            size={effectiveSize}
            pointMult={cfg.pointMult}
            onTap={tapCircle}
          />
        ))}
      </div>
    </div>
  )
}

// ─── HUD ─────────────────────────────────────────────────────────────────────

function GameHud({
  score, missed, timeLeft, level, scoreBump,
}: {
  score: number; missed: number; timeLeft: number; level: number; scoreBump: boolean
}) {
  const urgent = timeLeft <= 10
  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 shrink-0">
      <div className="flex flex-col items-center min-w-[56px]">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Nivel</span>
        <span className="text-2xl font-black text-gray-700">{level}</span>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Puntos</span>
        <span
          key={score}
          className="text-4xl font-black text-indigo-500 tabular-nums"
          style={{ animation: scoreBump ? 'score-pop 0.22s ease-out' : undefined }}
        >
          {score}
        </span>
      </div>

      <div className="flex flex-col items-center min-w-[56px]">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Tiempo</span>
        <span className={`text-2xl font-black tabular-nums ${urgent ? 'timer-urgent' : 'text-gray-700'}`}>
          {timeLeft}
        </span>
      </div>
    </div>
  )
}

// ─── Circle ──────────────────────────────────────────────────────────────────

function GameCircle({
  circle, size, pointMult, onTap,
}: {
  circle: Circle
  size: number
  pointMult: number
  onTap: (id: string, color: GameColor, mult: number) => void
}) {
  const pts = Math.round(circle.color.points * pointMult)

  let animation: string
  if (circle.popped) {
    animation = 'circle-pop 0.32s ease-out forwards'
  } else if (circle.expiring) {
    animation = 'circle-expire 0.8s ease-in forwards'
  } else {
    animation = 'circle-appear 0.28s ease-out, circle-breathe 2s ease-in-out 0.28s infinite'
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${circle.color.name} – ${pts} puntos`}
      onClick={() => { if (!circle.popped && !circle.expiring) onTap(circle.id, circle.color, pointMult) }}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !circle.popped && !circle.expiring) onTap(circle.id, circle.color, pointMult) }}
      style={{
        position: 'absolute',
        left: circle.x,
        top: circle.y,
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: circle.color.hex,
        boxShadow: `0 0 ${size * 0.4}px ${size * 0.22}px ${circle.color.glow}`,
        animation,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
      }}
    >
      <span style={{
        color: 'rgba(255,255,255,0.95)',
        fontWeight: 900,
        fontSize: size * 0.19,
        lineHeight: 1,
        textShadow: '0 1px 4px rgba(0,0,0,0.2)',
        pointerEvents: 'none',
        letterSpacing: '-0.01em',
      }}>
        {circle.color.name}
      </span>
      <span style={{
        color: 'rgba(255,255,255,0.75)',
        fontWeight: 700,
        fontSize: size * 0.13,
        lineHeight: 1,
        pointerEvents: 'none',
      }}>
        +{pts}
      </span>
    </div>
  )
}

// ─── Menu Screen ─────────────────────────────────────────────────────────────

function MenuScreen({
  level, onLevelChange, onStart, results, bestForLevel, onClearHistory, sizeMode, onSizeModeChange,
}: {
  level: number
  onLevelChange: (l: number) => void
  onStart: () => void
  results: Result[]
  bestForLevel: number
  onClearHistory: () => void
  sizeMode: SizeMode
  onSizeModeChange: (m: SizeMode) => void
}) {
  const [confirmClear, setConfirmClear] = useState(false)

  const handleClearClick = () => {
    if (confirmClear) {
      onClearHistory()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-7 p-6">
      {/* Title */}
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="Tap Colors" className="w-20 h-20 mx-auto mb-1" />
        <h1 className="text-5xl font-black tracking-tight text-gray-900">Tap Colors</h1>
        <p className="text-gray-400 mt-1 text-lg font-semibold">¡Toca los colores!</p>
      </div>

      {/* Level picker */}
      <div className="flex flex-col items-center gap-2 w-full max-w-xs">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nivel</span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onLevelChange(Math.max(1, level - 1))}
            disabled={level <= 1}
            className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 text-xl font-black flex items-center justify-center disabled:opacity-30 hover:bg-gray-200 active:scale-95 transition-all"
          >
            −
          </button>
          <div className="flex flex-col items-center min-w-[80px]">
            <span className="text-6xl font-black text-indigo-500">{level}</span>
            <span className="text-xs text-gray-400 font-semibold mt-0.5">
              {getLevelDescription(level)}
            </span>
          </div>
          <button
            onClick={() => onLevelChange(level + 1)}
            className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 text-xl font-black flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
          >
            +
          </button>
        </div>
        {bestForLevel > 0 && (
          <span className="text-sm text-gray-400 font-semibold">
            Mejor: <span className="text-indigo-400 font-black">{bestForLevel} pts</span>
          </span>
        )}
      </div>

      {/* Size toggle */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tamaño</span>
        <div className="flex bg-gray-100 rounded-full p-1 gap-1">
          {([['large', 'Grande'], ['medium', 'Mediano'], ['small', 'Pequeño'], ['hard', 'Hard'], ['pro', 'Pro']] as [SizeMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => onSizeModeChange(mode)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                sizeMode === mode
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Play button */}
      <button
        onClick={onStart}
        className="bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white text-2xl font-black py-5 px-16 rounded-3xl shadow-lg shadow-indigo-200 transition-all"
      >
        ¡Jugar!
      </button>

      {/* Recent results */}
      {results.length > 0 && (
        <div className="w-full max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Últimas partidas</p>
            <button
              onClick={handleClearClick}
              className={`text-xs font-bold px-3 py-1 rounded-full transition-all ${
                confirmClear
                  ? 'bg-red-500 text-white'
                  : 'text-gray-300 hover:text-red-400'
              }`}
            >
              {confirmClear ? '¿Borrar todo?' : 'Limpiar'}
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {results.slice(0, 5).map((r, i) => (
              <div key={i} className="bg-gray-50 rounded-xl px-4 py-2 flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  Niv. {r.level} · {r.date}
                </span>
                <span className="font-black text-indigo-500 text-sm">⭐ {r.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getLevelDescription(level: number): string {
  if (level <= 2) return 'Básico'
  if (level <= 4) return 'Normal'
  if (level <= 6) return 'Rápido'
  if (level <= 8) return 'Avanzado'
  return 'Experto'
}

// ─── Results Screen ───────────────────────────────────────────────────────────

function ResultsScreen({
  result, onReplay, onNextLevel, onMenu,
}: {
  result: Result | null
  onReplay: () => void
  onNextLevel: () => void
  onMenu: () => void
}) {
  const emoji = !result ? '🌟'
    : result.score >= 40 ? '🏆'
    : result.score >= 20 ? '🎉'
    : '⭐'

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-7 p-6">
      <div className="text-8xl">{emoji}</div>
      <h2 className="text-4xl font-black text-gray-900 text-center">¡Muy bien!</h2>

      {result && (
        <div className="bg-gray-50 rounded-3xl p-8 w-full max-w-xs flex flex-col items-center gap-5">
          <div className="text-center">
            <div className="text-7xl font-black text-indigo-500">{result.score}</div>
            <div className="text-gray-400 font-semibold">puntos · Nivel {result.level}</div>
          </div>
          <div className="w-full flex justify-around text-center">
            <div>
              <div className="text-3xl font-black text-gray-700">{result.tapped}</div>
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide">tocados</div>
            </div>
            <div className="w-px bg-gray-200" />
            <div>
              <div className="text-3xl font-black text-gray-300">{result.missed}</div>
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide">perdidos</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onNextLevel}
          className="bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white text-xl font-black py-4 px-8 rounded-2xl shadow-lg shadow-indigo-200 transition-all"
        >
          Nivel {result ? result.level + 1 : '?'} →
        </button>
        <button
          onClick={onReplay}
          className="bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 text-xl font-bold py-4 px-8 rounded-2xl transition-all"
        >
          Repetir nivel
        </button>
        <button
          onClick={onMenu}
          className="text-gray-400 text-base font-semibold py-2 transition-all hover:text-gray-600"
        >
          Menú principal
        </button>
      </div>
    </div>
  )
}
