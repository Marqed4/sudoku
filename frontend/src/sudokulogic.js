// Pure helpers for the Sudoku page. No React in here, so they are easy to test.

export const emptyBoard = () => Array.from({ length: 9 }, () => Array(9).fill('.'))

// Pencil marks are stored as one bitmask per cell: bit (d - 1) is set when digit d is noted.
export const emptyNotes = () => Array.from({ length: 9 }, () => Array(9).fill(0))

export const noteBit = (digit) => 1 << (Number(digit) - 1)

// Turn whatever the backend sends (strings, numbers, 0, null) into a clean 9x9 grid
// of '1'-'9' and '.'. Returns null if the shape is wrong.
export function normalizeBoard(raw) {
    if (!Array.isArray(raw) || raw.length !== 9) return null
    const out = []
    for (const row of raw) {
        if (!Array.isArray(row) || row.length !== 9) return null
        out.push(row.map((cell) => {
            const s = String(cell ?? '.').trim()
            return /^[1-9]$/.test(s) ? s : '.'
        }))
    }
    return out
}

// True when two cells share a row, column, or 3x3 box.
export const sameUnit = (r1, c1, r2, c2) =>
    r1 === r2
    || c1 === c2
    || (Math.floor(r1 / 3) === Math.floor(r2 / 3) && Math.floor(c1 / 3) === Math.floor(c2 / 3))

// Remove a digit from the pencil marks of every cell that sees (r, c).
export function clearNoteFromPeers(notes, r, c, digit) {
    const bit = noteBit(digit)
    return notes.map((row, ri) => row.map((n, ci) => (sameUnit(r, c, ri, ci) ? n & ~bit : n)))
}

// A 9x9 grid of booleans: true where a filled cell repeats a digit in its row, column, or box.
export function findConflicts(board) {
    const bad = Array.from({ length: 9 }, () => Array(9).fill(false))

    const units = []
    for (let i = 0; i < 9; i++) {
        const row = []
        const col = []
        const box = []
        for (let j = 0; j < 9; j++) {
            row.push([i, j])
            col.push([j, i])
            box.push([Math.floor(i / 3) * 3 + Math.floor(j / 3), (i % 3) * 3 + (j % 3)])
        }
        units.push(row, col, box)
    }

    for (const unit of units) {
        const seen = {}
        for (const [r, c] of unit) {
            const v = board[r][c]
            if (v === '.' || v === '') continue
            if (!seen[v]) seen[v] = []
            seen[v].push([r, c])
        }
        for (const cells of Object.values(seen)) {
            if (cells.length > 1) cells.forEach(([r, c]) => { bad[r][c] = true })
        }
    }
    return bad
}

// Completely filled with no repeated digits means it is a valid solved Sudoku.
export function isSolved(board) {
    if (!board) return false
    if (board.some((row) => row.some((cell) => cell === '.' || cell === ''))) return false
    return !findConflicts(board).some((row) => row.some(Boolean))
}

// How many of each digit are on the board, indexed 1-9.
export function countDigits(board) {
    const counts = Array(10).fill(0)
    board.forEach((row) => row.forEach((cell) => {
        if (cell !== '.' && cell !== '') counts[Number(cell)]++
    }))
    return counts
}

export function formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    const mm = String(m).padStart(2, '0')
    const ss = String(sec).padStart(2, '0')
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}