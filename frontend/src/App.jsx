import SudokuScanner from './components/SudokuScanner'
import ScanReview from './components/ScanReview'
import RunningSprite from './components/RunningSprite'

import SudokuBoard from './components/SudokuBoard'
import NumberPad from './components/NumberPad'
import './components/SudokuBoard.css'

import Pong from './components/Pong'

import { useState, useEffect, useRef, useMemo } from 'react'

import { request, wakeBackend } from './Api'
import {
    emptyBoard,
    emptyNotes,
    normalizeBoard,
    clearNoteFromPeers,
    noteBit,
    isSolved,
    countDigits,
    formatTime,
} from './SudokuLogic'

import './App.css'
import './components/SudokuExtras.css'

// < ---- Display ---->
const EMPTY_BOARD = emptyBoard()

const NEED_PUZZLE = 'Please upload or generate a puzzle first.'

// "Generate" asks the backend for a puzzle, then (for easier levels) reveals extra clues
// from the solution so the puzzle has at least this many. Hard keeps the backend's puzzle as is.
const DIFFICULTIES = {
    easy: { label: 'Easy', clues: 40 },
    medium: { label: 'Medium', clues: 32 },
    hard: { label: 'Hard', clues: 0 },
    custom: { label: 'Scanned', clues: 0 },
}

// Safely read and parse a value
// from localStorage, clearing it if corrupted
function loadFromStorage(key) {
    const saved = localStorage.getItem(key)
    if (!saved || saved === 'undefined') {
        return null
    }

    // Return JSON if data is mangled,
    // just return null...
    try {
        return JSON.parse(saved)
    } catch (error) {
        localStorage.removeItem(key)
        return null
    }
}

// Save a value, or remove the key when the value is null. Never throws
// (private browsing and full storage both make setItem fail).
function saveToStorage(key, value) {
    try {
        if (value === null || value === undefined) {
            localStorage.removeItem(key)
        } else {
            localStorage.setItem(key, JSON.stringify(value))
        }
    } catch (error) {
        // Not being able to save is not worth interrupting the game for.
    }
}

function StatusBadge({ result1, result2, onResult1Expire, onResult2Expire}) {

    useEffect(() => {
        if (result1 !== null) {
            const timer = setTimeout(() => {
                onResult1Expire()
            }, 15000)
            return () => clearTimeout(timer)
        }
    }, [result1])

    useEffect(() => {
        if (result2 !== null) {
            const timer = setTimeout(() => {
                onResult2Expire()
            }, 15000)
            return () => clearTimeout(timer)
        }
    }, [result2])

    return (
        <>
            {result1 !== null && (
                <div className={`badge rounded-pill border border-dark status-badge px-3 py-2 ${result1 ? 'solvable' : 'unsolvable'}`}>
                    {result1 ? 'Unadulterated board is solvable' : 'Unadulterated board unsolvable'}
                </div>
            )}
            {result2 !== null && (
                <div className={`badge rounded-pill border border-dark status-badge px-3 py-2 ${result2 ? 'correct' : 'incorrect'}`}>
                    {result2 ? 'Board Solution Is Correct' : 'Board Solution Is Incorrect'}
                </div>
            )}
        </>
    )
}

// < ---- User Help Functions ---->

function HoverReveal({ hovered }) {
    return (
        <>
            {hovered && (
                <div className="explanation-text">
                    <p className="mb-2">This webpage is hosted on a free-tier of https://render.com.</p>
                    <p className="mb-0">Please wait a minute for the backend to wake up after making a request.</p>
                </div>
            )}
        </>
    );
}

function App() {

    // The three things undo/redo has to rewind together: the digits, the pencil marks,
    // and which cells were filled by hints.
    const [game, setGame] = useState(() => ({
        board: normalizeBoard(loadFromStorage('sudoku-board')),
        notes: loadFromStorage('sudoku-notes') ?? emptyNotes(),
        hintCells: loadFromStorage('sudoku-hint-cells'),
    }))
    const [history, setHistory] = useState({ past: [], future: [] })

    const [originalBoard, setOriginalBoard] = useState(() => loadFromStorage('original-sudoku-board'))
    const [clues, setClues] = useState(() => loadFromStorage('sudoku-clues'))

    const [canBeSolved, setCanBeSolved] = useState(null)
    const [correctSolution, setCorrectSolution] = useState(null)
    const [hints, setHints] = useState(1)

    // Input: which cell is selected, and whether digits make pencil marks instead.
    const [selected, setSelected] = useState(null)
    const [pencilMode, setPencilMode] = useState(false)

    // Difficulty for "Generate", plus the timer and best times.
    const [difficulty, setDifficulty] = useState(() => {
        const saved = localStorage.getItem('sudoku-difficulty')
        return saved && DIFFICULTIES[saved] && saved !== 'custom' ? saved : 'medium'
    })
    const [meta, setMeta] = useState(() => loadFromStorage('sudoku-meta') ?? { difficulty: 'custom', assisted: false, recorded: false })
    const [elapsed, setElapsed] = useState(() => Number(localStorage.getItem('sudoku-elapsed')) || 0)
    const [bestTimes, setBestTimes] = useState(() => loadFromStorage('sudoku-best-times') ?? {})
    const [lastResult, setLastResult] = useState(null)
    const [pageHidden, setPageHidden] = useState(document.hidden)

    // Network state.
    const [backend, setBackend] = useState('waking') // 'waking' | 'ready' | 'down'
    const [busy, setBusy] = useState(null)
    const [error, setError] = useState(null)
    const [NetworkingHelpHover, setNetworkingHelpHover] = useState(false);

    // A scanned puzzle waiting for the person to check it.
    const [pendingScan, setPendingScan] = useState(null)

    // Secret pong game. Click the title 5 times within 2 seconds to open it.
    const [showPong, setShowPong] = useState(false)
    const titleClicks = useRef([])

    // <---- Derived ---->

    const board = game.board ?? EMPTY_BOARD
    const hasPuzzle = Boolean(game.board && originalBoard)
    const solved = useMemo(() => isSolved(game.board), [game.board])
    const counts = useMemo(() => countDigits(board), [board])

    const bestTime = bestTimes[meta.difficulty]

    // Anything typed or noted beyond the starting clues counts as progress worth protecting.
    const hasProgress = hasPuzzle && !solved && (
        game.board.some((row, r) => row.some((v, c) => v !== originalBoard[r]?.[c]))
        || game.notes.some((row) => row.some((n) => n !== 0))
    )

    const confirmDiscard = (what) =>
        !hasProgress || window.confirm(`You have a puzzle in progress. ${what} will replace it and your progress will be lost. Continue?`)

    // <---- Wake the backend ---->

    // Render's free tier sleeps when idle. A cheap request on page load starts the wake-up
    // right away, so it is usually ready by the time someone clicks a button.
    useEffect(() => {
        let cancelled = false
        wakeBackend().then((ok) => {
            if (!cancelled) setBackend(ok ? 'ready' : 'down')
        })
        return () => { cancelled = true }
    }, [])

    // <---- Saving ---->

    useEffect(() => {
        saveToStorage('sudoku-board', game.board)
        saveToStorage('sudoku-notes', game.notes)
        saveToStorage('sudoku-hint-cells', game.hintCells)
    }, [game])

    useEffect(() => {
        saveToStorage('original-sudoku-board', originalBoard)
        saveToStorage('sudoku-clues', clues)
        saveToStorage('sudoku-meta', meta)
    }, [originalBoard, clues, meta])

    useEffect(() => {
        localStorage.setItem('sudoku-elapsed', String(elapsed))
    }, [elapsed])

    useEffect(() => {
        localStorage.setItem('sudoku-difficulty', difficulty)
    }, [difficulty])

    // <---- Timer ---->

    useEffect(() => {
        const onVisibility = () => setPageHidden(document.hidden)
        document.addEventListener('visibilitychange', onVisibility)
        return () => document.removeEventListener('visibilitychange', onVisibility)
    }, [])

    // Runs while a puzzle is open and unsolved. Pauses when the tab is hidden or a window is on top.
    const timerActive = hasPuzzle && !solved && !pageHidden && !showPong && !pendingScan
    useEffect(() => {
        if (!timerActive) return
        const id = setInterval(() => setElapsed((e) => e + 1), 1000)
        return () => clearInterval(id)
    }, [timerActive])

    // When the puzzle is solved: record a best time, unless a hint or "Solve For Me" was used.
    useEffect(() => {
        if (solved && !meta.recorded) {
            let newBest = false
            if (!meta.assisted && (bestTime === undefined || elapsed < bestTime)) {
                newBest = true
                const next = { ...bestTimes, [meta.difficulty]: elapsed }
                setBestTimes(next)
                saveToStorage('sudoku-best-times', next)
            }
            setMeta((m) => ({ ...m, recorded: true }))
            setLastResult({ newBest })
        } else if (!solved && meta.recorded) {
            // Undid or changed a solved board: it can be solved (and recorded) again.
            setMeta((m) => ({ ...m, recorded: false }))
            setLastResult(null)
        }
    }, [solved])

    // Errors fade after a while, like the other badges.
    useEffect(() => {
        if (!error) return
        const timer = setTimeout(() => setError(null), 15000)
        return () => clearTimeout(timer)
    }, [error])

    // <---- Edits, undo and redo ---->

    // Apply a change and remember the previous state so it can be undone.
    const commit = (next) => {
        setHistory((h) => ({ past: [...h.past, game].slice(-100), future: [] }))
        setGame(next)
    }

    const undo = () => {
        if (history.past.length === 0) return
        setHistory({ past: history.past.slice(0, -1), future: [game, ...history.future] })
        setGame(history.past[history.past.length - 1])
    }

    const redo = () => {
        if (history.future.length === 0) return
        setHistory({ past: [...history.past, game], future: history.future.slice(1) })
        setGame(history.future[0])
    }

    // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Works wherever focus is.
    useEffect(() => {
        const onKeyDown = (e) => {
            if (showPong || pendingScan) return
            if (!(e.ctrlKey || e.metaKey)) return
            const key = e.key.toLowerCase()
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault()
                undo()
            } else if ((key === 'z' && e.shiftKey) || key === 'y') {
                e.preventDefault()
                redo()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    })

    const handleSelect = (r, c) => setSelected(r === null || r === undefined ? null : [r, c])

    // Set a digit (or '.' to erase) in one cell. In pencil mode a digit toggles a note instead.
    const setCell = (r, c, val) => {
        if (!game.board || busy) return
        if (clues?.[r]?.[c] || game.hintCells?.[r]?.[c]) return // clues and hints are locked

        const current = game.board[r][c]

        if (pencilMode && val !== '.') {
            if (current !== '.') return
            const notes = game.notes.map((row) => [...row])
            notes[r][c] ^= noteBit(val)
            commit({ ...game, notes })
            return
        }

        // Nothing to change (erasing an empty cell with no notes, or retyping the same digit).
        if (val === current && (val !== '.' || game.notes[r][c] === 0)) return

        const newBoard = game.board.map((row, ri) => row.map((x, ci) => (ri === r && ci === c ? val : x)))
        let notes = game.notes.map((row, ri) => row.map((n, ci) => (ri === r && ci === c ? 0 : n)))
        if (val !== '.') notes = clearNoteFromPeers(notes, r, c, val) // that digit is no longer a candidate nearby
        commit({ ...game, board: newBoard, notes })
    }

    // The number pad acts on whichever cell is selected.
    const padDigit = (d) => selected && setCell(selected[0], selected[1], d)
    const padErase = () => selected && setCell(selected[0], selected[1], '.')

    // <---- Game Logic ---->

    // Run an async action with one-at-a-time protection and a readable error if it fails.
    const guard = async (name, action) => {
        if (busy) return
        setBusy(name)
        setError(null)
        try {
            await action()
        } catch (err) {
            setError(err.message || 'Something went wrong.')
        } finally {
            setBusy(null)
        }
    }

    // Ask the backend to solve a puzzle. Returns a clean 9x9 board, or null if it can't be solved.
    const solveBoard = async (puzzle) => {
        const data = await request('/api/solve_sudoku', {
            method: 'POST',
            json: { originalBoard: puzzle },
        })
        return normalizeBoard(data.solved_board)
    }

    const isValid = () => guard('valid', async () => {
        if (!originalBoard) throw new Error(NEED_PUZZLE)
        const data = await request('/api/is_valid_sudoku', {
            method: 'POST',
            json: { originalBoard },
        })
        setCanBeSolved(data.is_valid)
    })

    // Can be used to take board + adulturations and see if
    // board is solvable, way to cheat
    const solveSudoku = () => guard('solve', async () => {
        if (!originalBoard) throw new Error(NEED_PUZZLE)
        const solution = await solveBoard(originalBoard)
        if (!solution) throw new Error("This puzzle can't be solved.")
        commit({ board: solution, notes: emptyNotes(), hintCells: game.hintCells })
        setMeta((m) => ({ ...m, assisted: true }))
    })

    // How do you pass the orginal board and an integer value
    const getHint = () => guard('hint', async () => {
        if (!originalBoard || !game.board) throw new Error(NEED_PUZZLE)

        const data = await request('/api/get_hint', {
            method: 'POST',
            json: { board: game.board, hints },
        })
        const newBoard = normalizeBoard(data.board)
        if (!newBoard) throw new Error('The hint came back in an unexpected shape.')

        // Merge the new hint cells into the ones already used on this puzzle.
        const hintCells = game.hintCells
            ? game.hintCells.map((row) => [...row])
            : Array.from({ length: 9 }, () => Array(9).fill(false))
        let notes = game.notes
        for (const [row, col] of data.hint_locations ?? []) {
            hintCells[row][col] = true
            notes = notes.map((nr, ri) => nr.map((n, ci) => (ri === row && ci === col ? 0 : n)))
            notes = clearNoteFromPeers(notes, row, col, newBoard[row][col])
        }

        commit({ board: newBoard, notes, hintCells })
        setMeta((m) => ({ ...m, assisted: true }))
    })

    // Return solved board state & original board state (clues - board)
    const testBoardCorrect = () => guard('test', async () => {
        if (!originalBoard || !game.board) throw new Error(NEED_PUZZLE)
        const solved_board = await solveBoard(originalBoard)
        if (!solved_board) throw new Error("This puzzle can't be solved.")
        const data = await request('/api/is_board_state_correct', {
            method: 'POST',
            json: { solved_board, board: game.board },
        })
        setCorrectSolution(data.result)
    })

    // <---- New Game ---->

    // Start a fresh puzzle: clears notes, hints, history, and the timer.
    const loadPuzzle = (newBoard, level = 'custom') => {
        setGame({ board: newBoard, notes: emptyNotes(), hintCells: null })
        setHistory({ past: [], future: [] })
        setClues(newBoard.map((row) => row.map((cell) => cell !== '.')))
        setOriginalBoard(newBoard)
        setMeta({ difficulty: level, assisted: false, recorded: false })
        setElapsed(0)
        setLastResult(null)
        setCanBeSolved(null)
        setCorrectSolution(null)
        setSelected(null)
    }

    // Reveal extra clues from the solution until the puzzle has at least `target` of them.
    const easePuzzle = async (puzzle, target) => {
        const have = puzzle.flat().filter((cell) => cell !== '.').length
        if (have >= target) return puzzle

        const solution = await solveBoard(puzzle)
        if (!solution) return puzzle

        const empties = []
        puzzle.forEach((row, r) => row.forEach((cell, c) => {
            if (cell === '.') empties.push([r, c])
        }))
        for (let i = empties.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[empties[i], empties[j]] = [empties[j], empties[i]]
        }

        const eased = puzzle.map((row) => [...row])
        empties.slice(0, target - have).forEach(([r, c]) => {
            eased[r][c] = solution[r][c]
        })
        return eased
    }

    const generateSudoku = () => guard('generate', async () => {
        if (!confirmDiscard('A new puzzle')) return

        const data = await request(`/api/generate_random_sudoku_puzzle?difficulty=${difficulty}`)
        let puzzle = normalizeBoard(data.array)
        if (!puzzle) throw new Error('The new puzzle came back in an unexpected shape.')

        const target = DIFFICULTIES[difficulty].clues
        if (target > 0) puzzle = await easePuzzle(puzzle, target)

        loadPuzzle(puzzle, difficulty)
    })

    // <---- Scan review ---->

    const closeScan = () => {
        if (pendingScan?.imageUrl) URL.revokeObjectURL(pendingScan.imageUrl)
        setPendingScan(null)
    }

    const acceptScan = (checkedBoard) => {
        if (!confirmDiscard('The scanned puzzle')) return
        loadPuzzle(checkedBoard, 'custom')
        closeScan()
    }

    // <---- Secret Pong ---->

    // Open pong after 5 clicks on the title within 2 seconds.
    const handleTitleClick = () => {
        const now = Date.now()

        // Keep only the clicks from the last 2 seconds.
        titleClicks.current = [...titleClicks.current.filter(t => now - t < 2000), now]

        if (titleClicks.current.length >= 5) {
            titleClicks.current = []
            setShowPong(true)
        }
    }

    // Save your work as an image!
    // print(data.is_valid)

    return (
        <>
            <RunningSprite />
            <div className="container py-3">
                <div className="warning-container">
                    <div className="btn btn-sudoku btn-experiencing-issue rounded-pill px-4"
                        onMouseEnter={() => setNetworkingHelpHover(true)}
                        onMouseLeave={() => setNetworkingHelpHover(false)}>
                        {backend === 'waking' ? '⏳ Backend Waking Up...' : '⚠️ Experiencing Issues?'}
                    </div>

                    <HoverReveal hovered={NetworkingHelpHover} />
                </div>

                <div className="title-wrap my-4">
                    <div className="app-subtitle" aria-hidden="true">
                        <svg viewBox="-1 -1 140 30" className="app-subtitle-svg">
                            <defs>
                                <path id="subtitle-curve" d="M4 30 Q30 4 70 14 T112 24" fill="none" />
                                {/* black text with a silver glint sweeping across */}
                                <linearGradient id="subtitle-shine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="40" y2="0">
                                    <stop offset="0" stopColor="#000" />
                                    <stop offset="0.38" stopColor="#000" />
                                    <stop offset="0.5" stopColor="#f4f4f4" />
                                    <stop offset="0.62" stopColor="#000" />
                                    <stop offset="1" stopColor="#000" />
                                    <animateTransform attributeName="gradientTransform" type="translate" from="-40 0" to="140 0" dur="2.2s" repeatCount="indefinite" />
                                </linearGradient>
                            </defs>
                            <text className="app-subtitle-text">
                                <textPath href="#subtitle-curve">click the title</textPath>
                            </text>
                            {/* tiny arrow pointing down at the title */}
                            <path className="app-subtitle-arrow" d="M120 26 Q128 28 131 36 M127 34 L131 37 L133 31" fill="none" />
                        </svg>
                    </div>

                    <h1 className="app-title text-center my-0"
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={handleTitleClick}>SUDOKU</h1>
                </div>

                {/* Upload / camera buttons above the board */}
                <SudokuScanner onScanned={setPendingScan} disabled={Boolean(busy)} />

                {/* A ready-made puzzle image, so visitors can try the scanner without a photo */}
                <p className="sample-link text-center mb-0">
                    No puzzle handy?{' '}
                    <a href={`${import.meta.env.BASE_URL}sample-sudoku.png`} download="sample-sudoku.png">
                        Download a sample to try the scanner
                    </a>
                </p>

                <div className="row g-3 align-items-start justify-content-center my-3">

                    {/* Left: how to play */}
                    <div className="col-12 col-lg-3 order-2 order-lg-1">
                        <div className="card info-card h-100">
                            <div className="card-body d-flex flex-column gap-3">
                                <h2 className="mb-0 text-center"><u>How 2 Play</u>❓</h2>
                                <hr className="my-0" />
                                <p className="mb-0">Upload or take a photo of your Sudoku puzzle.</p>
                                <p className="mb-0">Check the scan, fix any misread digits, and the board populates.</p>
                                <p className="mb-0">Select a cell, then type 1-9 or use the pad. Arrow keys or WASD move around, N toggles notes, Ctrl+Z undoes.</p>
                                <p className="mb-0">Use the buttons below to solve, test, validate, or generate a new puzzle.</p>
                            </div>
                        </div>
                    </div>

                    {/* Center: the board */}
                    <div className="col-12 col-lg-auto order-1 order-lg-2 d-flex flex-column align-items-center">
                        <div className="board-meta">
                            <span>⏱ {formatTime(elapsed)}</span>
                            <span>🏆 {DIFFICULTIES[meta.difficulty]?.label ?? 'Custom'}: {bestTime !== undefined ? formatTime(bestTime) : '--:--'}</span>
                        </div>

                        <SudokuBoard
                            board={board}
                            clues={clues}
                            hintCells={game.hintCells}
                            notes={game.notes}
                            selected={selected}
                            onSelect={handleSelect}
                            onInput={setCell}
                            onTogglePencil={() => setPencilMode((p) => !p)}
                        />

                        <NumberPad
                            counts={counts}
                            pencilMode={pencilMode}
                            disabled={!selected || !game.board || Boolean(busy)}
                            onDigit={padDigit}
                            onErase={padErase}
                            onTogglePencil={() => setPencilMode((p) => !p)}
                            onUndo={undo}
                            onRedo={redo}
                            canUndo={history.past.length > 0}
                            canRedo={history.future.length > 0}
                        />
                    </div>

                    {/* Right: tips & tricks */}
                    <div className="col-12 col-lg-3 order-3">
                        <div className="card info-card h-100">
                            <div className="card-body d-flex flex-column gap-3">
                                <h2 className="mb-0 text-center"><u>Tips & Tricks</u>🫡</h2>
                                <hr className="my-0" />
                                <p className="mb-0">Start with rows, columns, or boxes that have the most clues.</p>
                                <p className="mb-0">If a number can only go in one cell in a row, it must go there.</p>
                                <p className="mb-0">Eliminate candidates by scanning each row, column, and 3×3 box.</p>
                                <p className="mb-0">Select a filled cell to light up every matching digit on the board.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hints, generate, validate, manual and auto solve */}
                <div className="d-flex flex-wrap justify-content-center align-items-center gap-2">
                    <div className="btn-group">
                        <button className="btn btn-sudoku rounded-start-pill px-4" onClick={getHint} disabled={Boolean(busy)}>Get Hint💡</button>
                        <select id="number-select" className="form-select form-select-hints rounded-end-pill" value={hints} onChange={(e) => setHints(Number(e.target.value))}>
                            {[1, 2, 3, 4, 5].map(n => (
                                <option key={n} value={n}>Hints: {n}</option>
                            ))}
                        </select>
                    </div>

                    <div className="btn-group">
                        <button className="btn btn-sudoku btn-sudoku-accent rounded-start-pill px-4" onClick={generateSudoku} disabled={Boolean(busy)}>Generate New Puzzle</button>
                        <select
                            id="difficulty-select"
                            className="form-select form-select-hints rounded-end-pill"
                            aria-label="Puzzle difficulty"
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                        >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                        </select>
                    </div>

                    <button className="btn btn-sudoku rounded-pill px-4" onClick={isValid} disabled={Boolean(busy)}>Can Be Solved?</button>
                    <button className="btn btn-sudoku btn-sudoku-accent rounded-pill px-4" onClick={testBoardCorrect} disabled={Boolean(busy)}>Test My Solution</button>
                    <button className="btn btn-sudoku rounded-pill px-4" onClick={solveSudoku} disabled={Boolean(busy)}>Solve For Me</button>
                </div>

                <div className="status-row d-flex flex-wrap justify-content-center align-items-center gap-2 mt-3">
                    {busy && (
                        <div className="badge rounded-pill border border-dark status-badge pong-badge-neutral px-3 py-2" role="status">
                            ⏳ Working on it...
                        </div>
                    )}
                    {error && (
                        <div className="badge rounded-pill border border-dark status-badge unsolvable px-3 py-2 text-wrap" role="alert">
                            {error}
                        </div>
                    )}
                    {solved && (
                        <div className="badge rounded-pill border border-dark status-badge correct px-3 py-2">
                            🎉 Solved in {formatTime(elapsed)}{lastResult?.newBest ? ' · New best!' : ''}{meta.assisted ? ' (with help)' : ''}
                        </div>
                    )}
                    <StatusBadge
                        result1={canBeSolved}
                        result2={correctSolution}
                        onResult1Expire={() => setCanBeSolved(null)}
                        onResult2Expire={() => setCorrectSolution(null)}
                    />
                </div>
            </div>

            <footer className="app-footer text-center">
                <p className="mb-1">© {new Date().getFullYear()} Numberwump &amp; Sons Puzzle Holdings, LLC (Limited Liability Logic)</p>
                <p className="mb-1">Proudly synergizing 81 squares since last Tuesday. All rights reserved, except the ones we misplaced.</p>
                <p className="mb-0">Not affiliated with any real company, number, or your math teacher. Please don't take us seriously.</p>
            </footer>

            {/* Check a scanned puzzle before it loads */}
            {pendingScan && (
                <ScanReview
                    initialBoard={pendingScan.board}
                    imageUrl={pendingScan.imageUrl}
                    onCancel={closeScan}
                    onConfirm={acceptScan}
                />
            )}

            {/* Secret pong, opened by clicking the title 5 times */}
            {showPong && <Pong onExit={() => setShowPong(false)} />}
        </>
    )
}

export default App