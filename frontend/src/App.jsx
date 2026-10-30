import SudokuScanner from './components/SudokuScanner'

import SudokuBoard from './components/SudokuBoard'
import './components/SudokuBoard.css'

import Pong from './components/Pong'

import { useState, useEffect, useRef, React } from 'react'

import './App.css'

// < ---- Display ---->
const emptyBoard = Array(9).fill(null).map(() => Array(9).fill('.'))

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

function StatusBadge({ result1, result2, onResult1Expire, onResult2Expire}) {
    console.log('result1:', result1, 'result2:', result2)

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

    return null
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
    
    const [board, setBoard] = useState(() => loadFromStorage('sudoku-board'))
    const [originalBoard, setOriginalBoardState] = useState(() => loadFromStorage('original-sudoku-board'))
    const [clues, setClues] = useState(() => loadFromStorage('sudoku-clues'))
    const [hintCells, setHintCells] = useState(() => loadFromStorage('sudoku-hint-cells'))

    const [canBeSolved, setCanBeSolved] = useState(null)
    const [correctSolution, setCorrectSolution] = useState(null)
    const [hints, setHints] = useState(1)

    const [NetworkingHelpHover, setNetworkingHelpHover] = useState(false);

    // Secret pong game. Click the title 5 times within 2 seconds to open it.
    const [showPong, setShowPong] = useState(false)
    const titleClicks = useRef([])
    
    // <---- Game Logic ---->

    const isValid = async () => {
        if (!originalBoard) return alert("Please upload or generate a puzzle first")
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/is_valid_sudoku`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalBoard })
        })
        const data = await response.json()
        console.log(data.is_valid)
        setCanBeSolved(data.is_valid)
    }

    // Can be used to take board + adulturations and see if 
    // board is solvable, way to cheat
    const solveSudoku = async () => {
        if (!originalBoard) return alert("Please upload or generate a puzzle first")
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/solve_sudoku`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalBoard })
        })
        const data = await response.json()
        updateBoard(data.solved_board)
    }

    // Duplicated Code
    // Solve the puzzle but don't update the board
    const solveOriginalBoard = async () => {
        if (!originalBoard) return alert("Please upload or generate a puzzle first")
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/solve_sudoku`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalBoard })
        })
        const data = await response.json()
        return data.solved_board
    }

    // How do you pass the orginal board and an integer value
    const getHint = async () => {
    if (!originalBoard) return alert("Please upload or generate a puzzle first")

        console.table(board)
        console.log(hints)

        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/get_hint`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json' },
            body: JSON.stringify({ board, hints })
        })
        const data = await response.json()
        console.table(data.board)
        updateBoard(data.board)

        // Build a 9x9 boolean grid from the list of (row, col, value) hint tuples
        const newHintCells = Array(9).fill(null).map(() => Array(9).fill(false))
        data.hint_locations.forEach(([row, col, value]) => {
            newHintCells[row][col] = true
        })
        
        let savedHintCells = JSON.parse(localStorage.getItem('sudoku-hint-cells'));
        
        // User never used hints for this puzzle, build blank matrix.
        if (!savedHintCells) {
            savedHintCells = Array.from({ length: 9 }, () => Array(9).fill(false))
        }

        // Merge the array of old hints w/ new hints.
        for (let i = 0; i < 9; i++){
            for (let o = 0; o < 9; o++){
                if (newHintCells[i][o] === true){
                    savedHintCells[i][o] = true;
                }
            }
        }

        console.table(savedHintCells) // Used to print matrix
        localStorage.setItem('sudoku-hint-cells', JSON.stringify(savedHintCells))

        // Apply to puzzle board.
        setHintCells(savedHintCells)
    }

    // Return solved board state & original board state (clues - board)
    const testBoardCorrect = async () => {
        const solved_board = await solveOriginalBoard()
        console.log(solved_board)
        console.log(board)
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/is_board_state_correct`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ solved_board, board })

        })
        const data = await response.json()
        console.log(data.result)
        return setCorrectSolution(data.result)
    }

    // <---- New Game ---->

    const generateSudoku = async () => {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/generate_random_sudoku_puzzle`, {
            method: 'GET'
        })
        const data = await response.json()
        loadPuzzle(data.array)
        setCanBeSolved(null)
    }

    // Update a single cell and save to localStorage
    const updateCell = (row, col, val) => {
        const newBoard = board.map((r, ri) =>
            r.map((c, ci) => ri === row && ci === col ? val : c)
        )
        updateBoard(newBoard)
    }

    // Wrap setBoard so every update also saves to localStorage
    const updateBoard = (newBoard) => {
        setBoard(newBoard)
        if (newBoard === null) {
            localStorage.removeItem('sudoku-board')
        } else {
            localStorage.setItem('sudoku-board', JSON.stringify(newBoard))
        }
    }

    const setOriginalBoard = (newBoard) => {
        setOriginalBoardState(newBoard)
        if (newBoard === null) {
            localStorage.removeItem('original-sudoku-board')
        } else {
            localStorage.setItem('original-sudoku-board', JSON.stringify(newBoard))
        }
    }

    // Wrap updateBoard to also update clues
    const loadPuzzle = (newBoard) => {
        updateBoard(newBoard)
        setClues(newBoard.map(row => row.map(cell => cell !== '.')))
        localStorage.setItem('sudoku-clues', JSON.stringify(
            newBoard.map(row => row.map(cell => cell !== '.'))
        ))
        setOriginalBoard(newBoard)
        setCanBeSolved(null)
        setHintCells(null)
        localStorage.removeItem('sudoku-hint-cells')
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

    // TODO:
    // http://localhost:2000/api/give_test_puzzle
    // http://localhost:2000/api/give_solves_test_puzzle

    return (
        <>
            <div className="container py-3">
                <div className="warning-container">
                    <div className="btn btn-sudoku btn-experiencing-issue rounded-pill px-4"
                        onMouseEnter={() => setNetworkingHelpHover(true)}
                        onMouseLeave={() => setNetworkingHelpHover(false)}>
                        ⚠️ Experiencing Issues?
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
                <SudokuScanner setBoard={loadPuzzle} />

                <div className="row g-3 align-items-start justify-content-center my-3">

                    {/* Left: how to play */}
                    <div className="col-12 col-lg-3 order-2 order-lg-1">
                        <div className="card info-card h-100">
                            <div className="card-body d-flex flex-column gap-3">
                                <h2 className="mb-0 text-center"><u>How 2 Play</u>❓</h2>
                                <hr className="my-0" />
                                <p className="mb-0">Upload or take a photo of your Sudoku puzzle.</p>
                                <p className="mb-0">The board will populate automatically.</p>
                                <p className="mb-0">Use the buttons below to solve, test, validate, or generate a new puzzle.</p>
                            </div>
                        </div>
                    </div>

                    {/* Center: the board */}
                    <div className="col-12 col-lg-auto order-1 order-lg-2 d-flex justify-content-center">
                        <SudokuBoard board={board ?? emptyBoard} clues={clues} hintCells={hintCells} onCellChange={updateCell} />
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
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hints, generate, validate, manual and auto solve */}
                <div className="d-flex flex-wrap justify-content-center align-items-center gap-2">
                    <div className="btn-group">
                        <button className="btn btn-sudoku rounded-start-pill px-4" onClick={getHint}>Get Hint💡</button>
                        <select id="number-select" className="form-select form-select-hints rounded-end-pill" value={hints} onChange={(e) => setHints(Number(e.target.value))}>
                            {[1, 2, 3, 4, 5].map(n => (
                                <option key={n} value={n}>Hints: {n}</option>
                            ))}
                        </select>
                    </div>

                    <button className="btn btn-sudoku btn-sudoku-accent rounded-pill px-4" onClick={generateSudoku}>Generate New Puzzle</button>
                    <button className="btn btn-sudoku rounded-pill px-4" onClick={isValid}>Can Be Solved?</button>
                    <button className="btn btn-sudoku btn-sudoku-accent rounded-pill px-4" onClick={testBoardCorrect}>Test My Solution</button>
                    <button className="btn btn-sudoku rounded-pill px-4" onClick={solveSudoku}>Solve For Me</button>
                </div>

                <div className="status-row d-flex flex-wrap justify-content-center align-items-center gap-2 mt-3">
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

            {/* Secret pong, opened by clicking the title 5 times */}
            {showPong && <Pong onExit={() => setShowPong(false)} />}
        </>
    )
}

export default App