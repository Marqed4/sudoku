import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './Pong.css'
import './PongExtras.css'
import MiniBrowser from './MiniBrowser'
import RickRoll from './RickRoll'
import {
    SIZE,
    PADDLE_SIZE,
    WIN_SCORE,
    DIFFICULTIES,
    createGame,
    startCountdown,
    countdownNumber,
    stepGame,
    ballVisible,
} from './PongEngine'

// < ---- Constants ---->

// The physics (ball, computer, scoring) live in pongEngine.js and run in the browser.
// This file draws them and handles the player's input.

// The board is drawn like a 3 x 3 sudoku: each "box" is BOX cells wide.
const BOX = SIZE / 3

// Player paddle speed in rows per second (keyboard), and glide speed after a click or drag.
const PADDLE_SPEED = 12
const CLICK_SPEED = 40

// Shown in the mini browser's address bar.
const SITE_URL = 'pong.marqed.it'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// localStorage can throw (private browsing), and a missing high score isn't worth a crash.
function readStorage(key) {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, value)
    } catch {
        // Ignore.
    }
}

// Best win per difficulty: { easy: { computer: 1 }, ... } where lower is better.
function loadBest() {
    try {
        return JSON.parse(readStorage('pong-best')) ?? {}
    } catch {
        return {}
    }
}

// < ---- Display ---->

const INITIAL_UI = {
    phase: 'ready',
    count: 0,
    playerScore: 0,
    computerScore: 0,
    lastScorer: null,
    winner: null,
}

// What the status badge says. tone matches the sudoku page's badge classes:
// 'solvable' is green, 'unsolvable' is red, 'neutral' is the quiet paper badge.
function statusFor(ui, paused) {
    if (paused) return { text: 'Paused', tone: 'neutral' }
    switch (ui.phase) {
        case 'over':
            return ui.winner === 'player'
                ? { text: '🎉 You win! 🎉', tone: 'solvable' }
                : { text: '😢 The computer wins 😢', tone: 'unsolvable' }
        case 'point':
            return ui.lastScorer === 'player'
                ? { text: '🎉 Point to you!', tone: 'solvable' }
                : { text: '😢 You missed! Point to the computer', tone: 'unsolvable' }
        case 'countdown':
            return { text: 'Get ready...', tone: 'neutral' }
        case 'playing':
            return { text: `First to ${WIN_SCORE} wins`, tone: 'neutral' }
        default:
            return { text: 'Press Start', tone: 'neutral' }
    }
}

const boardStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
    userSelect: 'none',
    gap: 0, // The moving pieces assume cells are exactly 1/SIZE of the board, so no grid gap.
    position: 'relative', // The ball and paddles are positioned on top of the grid.
    touchAction: 'none', // Dragging on the board moves the paddle instead of scrolling the page.
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

    // React only holds what changes a few times a game (phase, scores, countdown number).
    // The ball and paddles are moved directly every frame, with no re-render.
    const [ui, setUi] = useState(INITIAL_UI)
    const [paused, setPaused] = useState(false)
    const [difficulty, setDifficulty] = useState(() => {
        const saved = readStorage('pong-difficulty')
        return DIFFICULTIES[saved] ? saved : 'medium'
    })
    const [best, setBest] = useState(loadBest)

    // Secret: click the title (or either paddle emoji) 5 times within 2 seconds to open the rickroll window.
    const [showRick, setShowRick] = useState(false)
    const showRickRef = useRef(false)  // Lets the key handlers ignore the game while it's open.
    const iconClicks = useRef([])

    const gameRef = useRef(createGame())
    const uiRef = useRef(INITIAL_UI)     // The last snapshot sent to React, to skip no-op updates.
    const pausedRef = useRef(false)
    const difficultyRef = useRef(difficulty)

    const heldRef = useRef('stay')       // Keyboard direction currently held down.
    const lastDirRef = useRef('up')      // Last direction pressed (for quick taps).
    const minTravelRef = useRef(0)       // Rows a quick tap still has to travel.
    const targetRef = useRef(null)       // Row (paddle top) a click or drag is gliding toward.
    const paddleYRef = useRef((SIZE - PADDLE_SIZE) / 2) // Player paddle top, in fractional rows.
    const draggingRef = useRef(false)

    const boardRef = useRef(null)
    const paddleElRef = useRef(null)
    const computerElRef = useRef(null)
    const ballElRef = useRef(null)

    // <---- Syncing the engine to React ---->

    const recordWin = useCallback((computerScore) => {
        setBest((prev) => {
            const level = difficultyRef.current
            const previous = prev[level]
            if (previous && previous.computer <= computerScore) return prev
            const next = { ...prev, [level]: { computer: computerScore } }
            writeStorage('pong-best', JSON.stringify(next))
            return next
        })
    }, [])

    // Copy the engine's phase and scores into React state, but only when one of them changed.
    const sync = useCallback(() => {
        const g = gameRef.current
        const next = {
            phase: g.phase,
            count: g.phase === 'countdown' ? countdownNumber(g) : 0,
            playerScore: g.playerScore,
            computerScore: g.computerScore,
            lastScorer: g.lastScorer,
            winner: g.winner,
        }
        const prev = uiRef.current
        if (Object.keys(next).some((key) => next[key] !== prev[key])) {
            uiRef.current = next
            setUi(next)
            if (next.phase === 'over' && prev.phase !== 'over' && next.winner === 'player') {
                recordWin(next.computerScore)
            }
        }
    }, [recordWin])

    // <---- New Game ---->

    const newGame = useCallback((autoStart = false) => {
        const g = createGame()
        gameRef.current = g
        paddleYRef.current = (SIZE - PADDLE_SIZE) / 2
        targetRef.current = null
        heldRef.current = 'stay'
        pausedRef.current = false
        setPaused(false)
        if (autoStart) startCountdown(g)
        sync()
    }, [sync])

    const changeDifficulty = (level) => {
        difficultyRef.current = level
        setDifficulty(level)
        writeStorage('pong-difficulty', level)
    }

    // <---- Start, pause, resume ---->

    const pauseGame = useCallback(() => {
        const phase = gameRef.current.phase
        if (!pausedRef.current && (phase === 'countdown' || phase === 'playing' || phase === 'point')) {
            pausedRef.current = true
            setPaused(true)
        }
    }, [])

    const handleMainButton = () => {
        const g = gameRef.current
        if (g.phase === 'over') {
            newGame(true)
        } else if (g.phase === 'ready') {
            startCountdown(g)
            sync()
        } else {
            pausedRef.current = !pausedRef.current
            setPaused(pausedRef.current)
        }
    }

    // Pause when the tab is hidden or the window loses focus, so a rally isn't lost while looking away.
    useEffect(() => {
        const onVisibility = () => {
            if (document.hidden) pauseGame()
        }
        document.addEventListener('visibilitychange', onVisibility)
        window.addEventListener('blur', pauseGame)
        return () => {
            document.removeEventListener('visibilitychange', onVisibility)
            window.removeEventListener('blur', pauseGame)
        }
    }, [pauseGame])

    // <---- Secret Rickroll ---->

    const handleSecretClick = () => {
        const now = Date.now()

        // Keep only the clicks from the last 2 seconds.
        iconClicks.current = [...iconClicks.current.filter(t => now - t < 2000), now]

        if (iconClicks.current.length >= 5) {
            iconClicks.current = []
            pauseGame() // Pause the game underneath.
            showRickRef.current = true
            setShowRick(true)
        }
    }

    const closeRick = useCallback(() => {
        showRickRef.current = false
        setShowRick(false)
    }, [])

    // <---- Game loop (60 fps, no React re-render) ---->

    useEffect(() => {
        let raf
        let last = performance.now()

        const movePlayerPaddle = (dt) => {
            let y = paddleYRef.current
            const held = heldRef.current

            if (held !== 'stay' || minTravelRef.current > 0) {
                // Keyboard / on-screen buttons: move while held; a quick tap still travels at least a row.
                const dir = held !== 'stay' ? held : lastDirRef.current
                const step = PADDLE_SPEED * dt
                minTravelRef.current = Math.max(0, minTravelRef.current - step)
                y += dir === 'up' ? -step : step
                targetRef.current = null
            } else if (targetRef.current !== null) {
                // Click or drag: glide to the chosen row.
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

        const draw = (g) => {
            if (paddleElRef.current) {
                paddleElRef.current.style.transform =
                    `translateY(${(paddleYRef.current / PADDLE_SIZE) * 100}%)`
            }
            if (computerElRef.current) {
                computerElRef.current.style.transform =
                    `translateY(${(g.computerTop / PADDLE_SIZE) * 100}%)`
            }
            if (ballElRef.current) {
                const el = ballElRef.current
                el.style.display = ballVisible(g) ? 'block' : 'none'
                // The ball piece is one cell wide and positioned by its top-left corner.
                el.style.transform =
                    `translate(${(g.ballX - 0.5) * 100}%, ${(g.ballY - 0.5) * 100}%)`
            }
        }

        const frame = (now) => {
            const dt = Math.min((now - last) / 1000, 0.05)
            last = now

            const g = gameRef.current
            if (!pausedRef.current) {
                if (g.phase !== 'over') movePlayerPaddle(dt)
                stepGame(g, dt, paddleYRef.current, DIFFICULTIES[difficultyRef.current])
                sync()
            }
            draw(g)
            raf = requestAnimationFrame(frame)
        }

        raf = requestAnimationFrame(frame)
        return () => cancelAnimationFrame(raf)
    }, [sync])

    // <---- Controls ---->

    // Don't leave a sudoku cell focused underneath the game.
    useEffect(() => {
        document.activeElement?.blur()
    }, [])

    // Keyboard: W / S or the arrow keys.
    useEffect(() => {
        const directionFor = (key) => {
            if (key === 'w' || key === 'W' || key === 'ArrowUp') return 'up'
            if (key === 's' || key === 'S' || key === 'ArrowDown') return 'down'
            return null
        }

        const onKeyDown = (e) => {
            // The rickroll window is on top: leave the game alone.
            if (showRickRef.current) return

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

    // Mouse, pen, and touch: press anywhere on the board and the paddle glides to that row;
    // keep the pointer down and drag, and it follows. One set of pointer events covers all three.
    const movePaddleTo = (row) => {
        if (gameRef.current.phase === 'over') return
        targetRef.current = clamp(row - Math.floor(PADDLE_SIZE / 2), 0, SIZE - PADDLE_SIZE)
        minTravelRef.current = 0
    }

    const rowFromPointer = (e) => {
        const rect = boardRef.current.getBoundingClientRect()
        const fraction = clamp((e.clientY - rect.top) / rect.height, 0, 0.9999)
        return Math.floor(fraction * SIZE)
    }

    const onBoardPointerDown = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        boardRef.current.setPointerCapture?.(e.pointerId)
        draggingRef.current = true
        movePaddleTo(rowFromPointer(e))
    }

    const onBoardPointerMove = (e) => {
        if (draggingRef.current) movePaddleTo(rowFromPointer(e))
    }

    const onBoardPointerEnd = () => {
        draggingRef.current = false
    }

    // On-screen up / down buttons for touch screens: hold to move.
    const holdStart = (direction) => (e) => {
        e.preventDefault()
        heldRef.current = direction
        lastDirRef.current = direction
        minTravelRef.current = 1
    }

    const holdEnd = () => {
        heldRef.current = 'stay'
    }

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

                out.push(<div key={`${row}-${col}`} className={className} style={cellStyle} />)
            }
        }
        return out
    }, [])

    const status = statusFor(ui, paused)
    const bestForLevel = best[difficulty]

    const mainButtonLabel =
        ui.phase === 'over' ? 'Play Again'
            : ui.phase === 'ready' ? 'Start'
                : paused ? 'Resume'
                    : 'Pause'

    return (
        <>
            {/* The "website": same classes, same wall, same footer as the Sudoku page. */}
            <MiniBrowser
                icon="🏓"
                onIconClick={handleSecretClick}
                tabTitle="Pong"
                url={SITE_URL}
                onClose={onExit}
                onBack={onExit}
                backLabel="Back to Sudoku"
                onReload={() => newGame(false)}
                reloadLabel="New game"
                bookmarks={['Click', 'The', 'Next', 'Title']}
            >
                    <div className="container py-3">

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
                                        <textPath href="#pong-subtitle-curve">click the title</textPath>
                                    </text>
                                    {/* tiny arrow pointing down at the title */}
                                    <path className="app-subtitle-arrow" d="M120 26 Q128 28 131 36 M127 34 L131 37 L133 31" fill="none" />
                                </svg>
                            </div>

                            <h1 className="app-title text-center my-0"
                                style={{ cursor: 'pointer', userSelect: 'none' }}
                                onClick={handleSecretClick}>PONG</h1>
                        </div>

                        <div className="row g-3 align-items-start justify-content-center my-3">

                            {/* Left: how to play */}
                            <div className="col-12 col-lg-3 order-2 order-lg-1">
                                <div className="card info-card h-100">
                                    <div className="card-body d-flex flex-column gap-3">
                                        <h2 className="mb-0 text-center"><u>How 2 Play</u><span onClick={handleSecretClick} style={{ cursor: 'pointer', userSelect: 'none' }}>🏓</span></h2>
                                        <hr className="my-0" />
                                        <p className="mb-0">Press Start, then move your paddle with W / S or ↑ / ↓.</p>
                                        <p className="mb-0">Or click, tap, or drag anywhere on the board and the paddle follows.</p>
                                        <p className="mb-0">First to {WIN_SCORE} wins. Esc leaves the game.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Center: the board */}
                            <div className="col-12 col-lg-auto order-1 order-lg-2 d-flex justify-content-center">
                                <div className="pong-stage">
                                    <div className="pong-score">
                                        <span>You {ui.playerScore}</span>
                                        <span>{ui.computerScore} Computer</span>
                                    </div>

                                    <div
                                        ref={boardRef}
                                        className="sudoku-board pong-board"
                                        style={boardStyle}
                                        onPointerDown={onBoardPointerDown}
                                        onPointerMove={onBoardPointerMove}
                                        onPointerUp={onBoardPointerEnd}
                                        onPointerCancel={onBoardPointerEnd}
                                    >
                                        {cells}

                                        {/* Player paddle */}
                                        <div
                                            ref={paddleElRef}
                                            className="pong-piece pong-paddle-player"
                                            style={{
                                                ...pieceBase,
                                                height: `${CELL_PCT * PADDLE_SIZE}%`,
                                            }}
                                        />

                                        {/* Computer paddle */}
                                        <div
                                            ref={computerElRef}
                                            className="pong-piece pong-paddle-computer"
                                            style={{
                                                ...pieceBase,
                                                height: `${CELL_PCT * PADDLE_SIZE}%`,
                                                left: `${CELL_PCT * (SIZE - 1)}%`,
                                            }}
                                        />

                                        {/* Ball: a small orb */}
                                        <div
                                            ref={ballElRef}
                                            className="pong-piece"
                                            style={{
                                                ...pieceBase,
                                                aspectRatio: '1 / 1',
                                            }}
                                        >
                                            <div className="pong-ball pong-ball-orb" />
                                        </div>

                                        {/* 3, 2, 1 before each serve */}
                                        {ui.phase === 'countdown' && !paused && (
                                            <div key={ui.count} className="pong-countdown" aria-live="assertive">{ui.count}</div>
                                        )}
                                        {paused && (
                                            <div className="pong-countdown pong-paused">Paused</div>
                                        )}
                                    </div>

                                    <div className="pong-best">
                                        🏆 Best win ({DIFFICULTIES[difficulty].label}): {bestForLevel ? `${WIN_SCORE} to ${bestForLevel.computer}` : 'none yet'}
                                    </div>

                                    {/* Touch screens: hold to move */}
                                    <div className="pong-touch-controls">
                                        <button
                                            type="button"
                                            className="btn btn-sudoku rounded-pill pong-hold-btn"
                                            aria-label="Move paddle up"
                                            onPointerDown={holdStart('up')}
                                            onPointerUp={holdEnd}
                                            onPointerLeave={holdEnd}
                                            onPointerCancel={holdEnd}
                                        >
                                            ▲
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sudoku rounded-pill pong-hold-btn"
                                            aria-label="Move paddle down"
                                            onPointerDown={holdStart('down')}
                                            onPointerUp={holdEnd}
                                            onPointerLeave={holdEnd}
                                            onPointerCancel={holdEnd}
                                        >
                                            ▼
                                        </button>
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
                                        <p className="mb-0">Hit the ball with the edge of your paddle to change its angle.</p>
                                        <p className="mb-0">Every hit speeds up the rally, so park near the middle between returns.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Start / pause, difficulty, new game, back */}
                        <div className="d-flex flex-wrap justify-content-center align-items-center gap-2">
                            <button
                                className="btn btn-sudoku btn-sudoku-accent rounded-pill px-4"
                                onClick={handleMainButton}
                            >
                                {mainButtonLabel}
                            </button>
                            <select
                                className="form-select form-select-hints rounded-pill"
                                aria-label="Computer difficulty"
                                value={difficulty}
                                onChange={(e) => changeDifficulty(e.target.value)}
                            >
                                {Object.entries(DIFFICULTIES).map(([key, level]) => (
                                    <option key={key} value={key}>Computer: {level.label}</option>
                                ))}
                            </select>
                            <button className="btn btn-sudoku rounded-pill px-4" onClick={() => newGame(false)}>New Game</button>
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
            </MiniBrowser>

            {showRick && <RickRoll onExit={closeRick} />}
        </>
    )
}

export default PongGame