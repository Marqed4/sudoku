import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './Pong.css'

// < ---- Constants ---->

// Board constants must match Pong.py on the backend.
const SIZE = 27
const PADDLE_SIZE = 3
const WIN_SCORE = 5

// The board is drawn like a 3 x 3 sudoku: each "box" is BOX cells wide.
const BOX = SIZE / 3

// Wait this long (ms) after each response before asking for the next tick.
const TICK_MS = 150

// Player paddle speed in rows per second (keyboard), and glide speed after a click.
const PADDLE_SPEED = 12
const CLICK_SPEED = 40

const API = import.meta.env.VITE_API_URL

// Shown in the mini browser's address bar, e.g. "http://localhost:2001/pong".
const SITE_URL = typeof window !== 'undefined' ? `${window.location.origin}/pong` : '/pong'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// < ---- Display ---->

// What the status badge says. tone matches the sudoku page's badge classes:
// 'solvable' is green, 'unsolvable' is red, 'neutral' is the quiet paper badge.
function statusFor(state, running, error) {
    if (error) return { text: error, tone: 'unsolvable' }
    if (!state) return { text: 'Waking up the backend...', tone: 'neutral' }
    if (state.game_over) {
        return state.player_won
            ? { text: '🎉 You win! 🎉', tone: 'solvable' }
            : { text: '😢 The computer wins 😢', tone: 'unsolvable' }
    }
    if (!state.ball_exists) {
        // A missed ball is left on column 0 (player missed) or the last column (computer missed).
        return state.ball_col === 0
            ? { text: '😢 You missed! Point to the computer', tone: 'unsolvable' }
            : { text: '🎉 Point to you!', tone: 'solvable' }
    }
    return { text: running ? `First to ${WIN_SCORE} wins` : 'Press Start', tone: 'neutral' }
}

const boardStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
    userSelect: 'none',
    gap: 0, // The moving pieces assume cells are exactly 1/SIZE of the board, so no grid gap.
    position: 'relative', // The ball and paddles are positioned on top of the grid.
}

const cellStyle = {
    minWidth: 0,
    overflow: 'hidden',
    cursor: 'pointer',
}

// Overlay pieces: one cell wide, positioned with transforms (percentages are of the piece's own size).
const CELL_PCT = 100 / SIZE
const pieceBase = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: `${CELL_PCT}%`,
    pointerEvents: 'none',
    willChange: 'transform',
}

function PongGame({ onExit }) {

    const [state, setState] = useState(null)
    const [running, setRunning] = useState(false)
    const [error, setError] = useState(null)
    const [helpHover, setHelpHover] = useState(false)

    // How the ball and computer paddle animate between ticks.
    // ms is how long a tick takes; snap jumps with no animation (new game, new serve).
    const [motion, setMotion] = useState({ ms: TICK_MS, snap: true })

    const stateRef = useRef(null)
    const heldRef = useRef('stay')       // Keyboard direction currently held down.
    const lastDirRef = useRef('up')      // Last direction pressed (for quick taps).
    const minTravelRef = useRef(0)       // Rows a quick tap still has to travel.
    const targetRef = useRef(null)       // Row (paddle top) a click is gliding toward.
    const paddleYRef = useRef((SIZE - PADDLE_SIZE) / 2) // Player paddle top, in fractional rows.
    const paddleElRef = useRef(null)
    const lastResponseRef = useRef(null) // When the last tick came back, to time the animation.
    const msRef = useRef(TICK_MS)

    // <---- New Game ---->

    const startNewGame = useCallback(async () => {
        setError(null)
        setRunning(false)
        targetRef.current = null
        try {
            const response = await fetch(`${API}/api/pong/new_game`)
            if (!response.ok) throw new Error('Bad response')
            const data = await response.json()
            stateRef.current = data.state
            paddleYRef.current = data.state.player_top
            setMotion({ ms: 0, snap: true })
            setState(data.state)
        } catch (err) {
            setError("Couldn't reach the backend. Give it a minute to wake up, then try again.")
        }
    }, [])

    useEffect(() => {
        startNewGame()
    }, [startNewGame])

    // <---- Game Logic ---->

    // Ask the backend for one tick at a time while running.
    // The player paddle is moved locally (see the animation loop below), so we send
    // its current row and always say 'stay'.
    useEffect(() => {
        if (!running) return

        let cancelled = false
        let timer = null
        lastResponseRef.current = null

        const tick = async () => {
            try {
                const response = await fetch(`${API}/api/pong/step`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        state: { ...stateRef.current, player_top: Math.round(paddleYRef.current) },
                        direction: 'stay',
                    })
                })
                if (!response.ok) throw new Error('Bad response')
                const data = await response.json()
                if (cancelled) return

                const prev = stateRef.current
                if (data.state.last_hit !== prev?.last_hit) {
                    console.log('Last hit:', data.state.last_hit)
                }

                // Time the animation to how long ticks really take, smoothed so it doesn't jitter.
                const now = performance.now()
                if (lastResponseRef.current !== null) {
                    const dt = clamp(now - lastResponseRef.current, 60, 500)
                    msRef.current = msRef.current * 0.5 + dt * 0.5
                }
                lastResponseRef.current = now

                // Jump instead of glide when the ball respawns or teleports.
                const jumped = !prev?.ball_exists
                    || Math.abs(data.state.ball_row - prev.ball_row) > 2
                    || Math.abs(data.state.ball_col - prev.ball_col) > 2
                setMotion({ ms: Math.round(msRef.current), snap: jumped })

                // The player paddle is owned by this component, not the server.
                const next = { ...data.state, player_top: Math.round(paddleYRef.current) }
                stateRef.current = next
                setState(next)

                if (next.game_over || !next.ball_exists) {
                    setRunning(false)
                    return
                }
            } catch (err) {
                if (cancelled) return
                setError('Lost connection to the backend.')
                setRunning(false)
                return
            }

            timer = setTimeout(tick, TICK_MS)
        }

        tick()

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [running])

    // <---- Smooth player paddle (60 fps, no React re-render) ---->

    useEffect(() => {
        let raf
        let last = performance.now()

        const frame = (now) => {
            const dt = Math.min((now - last) / 1000, 0.05)
            last = now

            const s = stateRef.current
            if (s && !s.game_over) {
                let y = paddleYRef.current
                const held = heldRef.current

                if (held !== 'stay' || minTravelRef.current > 0) {
                    // Keyboard: move while held; a quick tap still travels at least a row.
                    const dir = held !== 'stay' ? held : lastDirRef.current
                    const step = PADDLE_SPEED * dt
                    minTravelRef.current = Math.max(0, minTravelRef.current - step)
                    y += dir === 'up' ? -step : step
                    targetRef.current = null
                } else if (targetRef.current !== null) {
                    // Click: glide to the clicked row.
                    const diff = targetRef.current - y
                    const step = CLICK_SPEED * dt
                    if (Math.abs(diff) <= step) {
                        y = targetRef.current
                        targetRef.current = null
                    } else {
                        y += Math.sign(diff) * step
                    }
                }
                paddleYRef.current = clamp(y, 0, SIZE - PADDLE_SIZE)
            }

            if (paddleElRef.current) {
                paddleElRef.current.style.transform =
                    `translateY(${(paddleYRef.current / PADDLE_SIZE) * 100}%)`
            }
            raf = requestAnimationFrame(frame)
        }

        raf = requestAnimationFrame(frame)
        return () => cancelAnimationFrame(raf)
    }, [])

    // <---- Controls ---->

    // Don't leave a sudoku cell focused underneath the game.
    useEffect(() => {
        document.activeElement?.blur()
    }, [])

    useEffect(() => {
        const directionFor = (key) => {
            if (key === 'w' || key === 'W' || key === 'ArrowUp') return 'up'
            if (key === 's' || key === 'S' || key === 'ArrowDown') return 'down'
            return null
        }

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                onExit()
                return
            }
            const direction = directionFor(e.key)
            if (!direction) return
            // Stop the page from scrolling while playing.
            e.preventDefault()
            heldRef.current = direction
            lastDirRef.current = direction
            if (!e.repeat) minTravelRef.current = 1
        }

        const onKeyUp = (e) => {
            const direction = directionFor(e.key)
            if (direction && heldRef.current === direction) heldRef.current = 'stay'
        }

        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
        }
    }, [onExit])

    // Click: glide the paddle's middle cell to the clicked row.
    // Only touches refs, so it can stay the same function for the whole game.
    const movePaddleTo = useCallback((row) => {
        if (!stateRef.current || stateRef.current.game_over) return
        targetRef.current = clamp(row - Math.floor(PADDLE_SIZE / 2), 0, SIZE - PADDLE_SIZE)
        minTravelRef.current = 0
    }, [])

    // <---- Board ---->

    // The cells never change, so build them once. They reuse the sudoku board's paper
    // cells (grain, hairlines, box shading, heavy box lines every BOX cells).
    const cells = useMemo(() => {
        const out = []
        for (let row = 0; row < SIZE; row++) {
            for (let col = 0; col < SIZE; col++) {
                const isOrange = (Math.floor(row / BOX) + Math.floor(col / BOX)) % 2 === 0
                let className = `sudoku-cell ${isOrange ? 'cell-orange' : 'cell-white'}`
                if (col % BOX === BOX - 1 && col !== SIZE - 1) className += ' border-right'
                if (row % BOX === BOX - 1 && row !== SIZE - 1) className += ' border-bottom'

                out.push(
                    <div
                        key={`${row}-${col}`}
                        className={className}
                        style={cellStyle}
                        onClick={() => movePaddleTo(row)}
                    />
                )
            }
        }
        return out
    }, [movePaddleTo])

    const glide = motion.snap ? 'none' : `transform ${motion.ms}ms linear`

    const status = statusFor(state, running, error)
    const needsRestart = Boolean(error || state?.game_over)

    return (
        <div className="pong-overlay" role="dialog" aria-label="Pong">
            <div className="pong-window">

                {/* Mini browser chrome: tab strip + toolbar. */}
                <div className="pong-chrome">
                    <div className="pong-tabstrip">
                        <div className="pong-tab">
                            <span className="pong-tab-icon" aria-hidden="true">🏓</span>
                            <span className="pong-tab-title">Pong</span>
                            <button className="pong-tab-close" onClick={onExit} aria-label="Close tab" title="Close">×</button>
                        </div>
                    </div>
                    <div className="pong-toolbar">
                        <button className="pong-nav" onClick={onExit} aria-label="Back to Sudoku" title="Back to Sudoku">←</button>
                        <button className="pong-nav" disabled aria-label="Forward">→</button>
                        <button className="pong-nav" onClick={startNewGame} aria-label="New game" title="New game">↻</button>
                        <div className="pong-address" title={SITE_URL}>
                            <span className="pong-address-icon" aria-hidden="true">ⓘ</span>
                            <span className="pong-address-text">{SITE_URL}</span>
                        </div>
                    </div>
                </div>

                {/* The "website": same classes, same wall, same footer as the Sudoku page. */}
                <div className="pong-viewport">
                    <div className="container py-3">

                        <div className="warning-container">
                            <div className="btn btn-sudoku btn-experiencing-issue rounded-pill px-4"
                                onMouseEnter={() => setHelpHover(true)}
                                onMouseLeave={() => setHelpHover(false)}>
                                ⚠️ Experiencing Issues?
                            </div>

                            {helpHover && (
                                <div className="explanation-text">
                                    <p className="mb-2">This webpage is hosted on a free-tier of https://render.com.</p>
                                    <p className="mb-0">Please wait a minute for the backend to wake up after making a request.</p>
                                </div>
                            )}
                        </div>

                        <div className="title-wrap my-4">
                            <div className="app-subtitle" aria-hidden="true">
                                <svg viewBox="-1 -1 140 30" className="app-subtitle-svg">
                                    <defs>
                                        <path id="pong-subtitle-curve" d="M4 30 Q30 4 70 14 T112 24" fill="none" />
                                        {/* black text with a silver glint sweeping across */}
                                        <linearGradient id="pong-subtitle-shine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="40" y2="0">
                                            <stop offset="0" stopColor="#000" />
                                            <stop offset="0.38" stopColor="#000" />
                                            <stop offset="0.5" stopColor="#f4f4f4" />
                                            <stop offset="0.62" stopColor="#000" />
                                            <stop offset="1" stopColor="#000" />
                                            <animateTransform attributeName="gradientTransform" type="translate" from="-40 0" to="140 0" dur="2.2s" repeatCount="indefinite" />
                                        </linearGradient>
                                    </defs>
                                    <text className="app-subtitle-text" style={{ fill: 'url(#pong-subtitle-shine)' }}>
                                        <textPath href="#pong-subtitle-curve">back to sudoku</textPath>
                                    </text>
                                    {/* tiny arrow pointing down at the title */}
                                    <path className="app-subtitle-arrow" d="M120 26 Q128 28 131 36 M127 34 L131 37 L133 31" fill="none" />
                                </svg>
                            </div>

                            <h1 className="app-title text-center my-0"
                                style={{ cursor: 'pointer', userSelect: 'none' }}
                                onClick={onExit}>PONG</h1>
                        </div>

                        <div className="row g-3 align-items-start justify-content-center my-3">

                            {/* Left: how to play */}
                            <div className="col-12 col-lg-3 order-2 order-lg-1">
                                <div className="card info-card h-100">
                                    <div className="card-body d-flex flex-column gap-3">
                                        <h2 className="mb-0 text-center"><u>How 2 Play</u>🏓</h2>
                                        <hr className="my-0" />
                                        <p className="mb-0">Press Start, then move your paddle with W / S or ↑ / ↓.</p>
                                        <p className="mb-0">Or click any row and the paddle glides there.</p>
                                        <p className="mb-0">First to {WIN_SCORE} wins. Esc leaves the game.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Center: the board */}
                            <div className="col-12 col-lg-auto order-1 order-lg-2 d-flex justify-content-center">
                                <div className="pong-stage">
                                    <div className="pong-score">
                                        <span>You {state?.player_score ?? 0}</span>
                                        <span>{state?.computer_score ?? 0} Computer</span>
                                    </div>

                                    <div className="sudoku-board pong-board" style={boardStyle}>
                                        {cells}

                                        {state && (
                                            <>
                                                {/* Player paddle: moved directly by the animation loop. */}
                                                <div
                                                    ref={paddleElRef}
                                                    className="pong-piece pong-paddle-player"
                                                    style={{
                                                        ...pieceBase,
                                                        height: `${CELL_PCT * PADDLE_SIZE}%`,
                                                    }}
                                                />

                                                {/* Computer paddle: glides between server positions. */}
                                                <div
                                                    className="pong-piece pong-paddle-computer"
                                                    style={{
                                                        ...pieceBase,
                                                        height: `${CELL_PCT * PADDLE_SIZE}%`,
                                                        left: `${CELL_PCT * (SIZE - 1)}%`,
                                                        transform: `translateY(${(state.computer_top / PADDLE_SIZE) * 100}%)`,
                                                        transition: glide,
                                                    }}
                                                />

                                                {/* Ball: a small orb that glides between server positions. */}
                                                {state.ball_exists && (
                                                    <div
                                                        className="pong-piece"
                                                        style={{
                                                            ...pieceBase,
                                                            aspectRatio: '1 / 1',
                                                            transform: `translate(${state.ball_col * 100}%, ${state.ball_row * 100}%)`,
                                                            transition: glide,
                                                        }}
                                                    >
                                                        <div className="pong-ball pong-ball-orb" />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: tips & tricks */}
                            <div className="col-12 col-lg-3 order-3">
                                <div className="card info-card h-100">
                                    <div className="card-body d-flex flex-column gap-3">
                                        <h2 className="mb-0 text-center"><u>Tips &amp; Tricks</u>😎</h2>
                                        <hr className="my-0" />
                                        <p className="mb-0">Read where the ball is heading, not where it is.</p>
                                        <p className="mb-0">Short taps beat long holds for small adjustments.</p>
                                        <p className="mb-0">Park near the middle: it's the shortest trip to anywhere.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Start / pause, new game, back */}
                        <div className="d-flex flex-wrap justify-content-center align-items-center gap-2">
                            <button
                                className="btn btn-sudoku btn-sudoku-accent rounded-pill px-4"
                                disabled={!state && !error}
                                onClick={needsRestart ? startNewGame : () => setRunning(r => !r)}
                            >
                                {error ? 'Try Again' : state?.game_over ? 'Play Again' : running ? 'Pause' : 'Start'}
                            </button>
                            <button className="btn btn-sudoku rounded-pill px-4" onClick={startNewGame}>New Game</button>
                            <button className="btn btn-sudoku rounded-pill px-4" onClick={onExit}>Back To Sudoku</button>
                        </div>

                        <div className="status-row d-flex flex-wrap justify-content-center align-items-center gap-2 mt-3">
                            <div
                                key={status.text}
                                className={`badge rounded-pill border border-dark status-badge px-3 py-2 ${status.tone === 'neutral' ? 'pong-badge-neutral' : status.tone}`}
                            >
                                {status.text}
                            </div>
                        </div>
                    </div>

                    <footer className="app-footer text-center">
                        <p className="mb-1">© {new Date().getFullYear()} Pongwump &amp; Sons Paddle Holdings, LLC (Limited Liability Lobbing)</p>
                        <p className="mb-1">Proudly bouncing 27 × 27 squares since last Tuesday. All rights reserved, except the ones that hit the wall.</p>
                        <p className="mb-0">Not affiliated with any real company, ball, or your PE teacher. Please don't take us seriously.</p>
                    </footer>
                </div>
            </div>
        </div>
    )
}

export default PongGame