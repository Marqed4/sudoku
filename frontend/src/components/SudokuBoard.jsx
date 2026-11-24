import { useMemo, useRef } from 'react'
import { findConflicts, sameUnit } from '../sudokulogic'

// Keys that move the selection, as [row change, column change].
// Arrow keys, WASD, and vim-style hjkl all work.
const MOVES = {
    ArrowUp: [-1, 0], w: [-1, 0], k: [-1, 0],
    ArrowDown: [1, 0], s: [1, 0], j: [1, 0],
    ArrowLeft: [0, -1], a: [0, -1], h: [0, -1],
    ArrowRight: [0, 1], d: [0, 1], l: [0, 1],
}

const ERASE_KEYS = ['Backspace', 'Delete', '0', ' ']
const clampIndex = (n) => Math.max(0, Math.min(8, n))

// Props:
//   board, clues, hintCells  the 9x9 grids ('.' is empty)
//   notes                    9x9 pencil-mark bitmasks (optional)
//   selected                 [row, col] or null; onSelect(row, col) or onSelect(null)
//   onInput(row, col, val)   a digit '1'-'9', or '.' to erase
//   onTogglePencil()         called when N is pressed (optional)
function SudokuBoard({ board, clues, hintCells, notes, selected, onSelect, onInput, onTogglePencil }) {

    const cellRefs = useRef([])
    const conflicts = useMemo(() => (board ? findConflicts(board) : null), [board])

    if (!board) return null

    const selRow = selected?.[0]
    const selCol = selected?.[1]
    const selValue = selected ? board[selRow][selCol] : '.'

    const select = (r, c) => onSelect?.(r, c)

    const handleKeyDown = (e) => {
        if (!selected || e.ctrlKey || e.metaKey || e.altKey) return

        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

        // Movement: arrows / WASD / hjkl step one cell, Home and End jump along the row,
        // PageUp and PageDown jump along the column.
        let target = null
        if (MOVES[key]) {
            const [dr, dc] = MOVES[key]
            target = [clampIndex(selRow + dr), clampIndex(selCol + dc)]
        } else if (key === 'Home') {
            target = [selRow, 0]
        } else if (key === 'End') {
            target = [selRow, 8]
        } else if (key === 'PageUp') {
            target = [0, selCol]
        } else if (key === 'PageDown') {
            target = [8, selCol]
        }

        if (target) {
            e.preventDefault()
            select(target[0], target[1])
            cellRefs.current[target[0] * 9 + target[1]]?.focus()
            return
        }

        if (/^[1-9]$/.test(key)) {
            e.preventDefault()
            onInput?.(selRow, selCol, key)
        } else if (ERASE_KEYS.includes(key)) {
            e.preventDefault()
            onInput?.(selRow, selCol, '.')
        } else if (key === 'n') {
            onTogglePencil?.()
        } else if (key === 'Escape') {
            onSelect?.(null)
            document.activeElement?.blur()
        }
    }

    return (
        <div className="sudoku-board" role="group" aria-label="Sudoku board" onKeyDown={handleKeyDown}>
            {board.map((row, rowIndex) => (
                row.map((cell, colIndex) => {
                    const boxRow = Math.floor(rowIndex / 3)
                    const boxCol = Math.floor(colIndex / 3)
                    const isOrange = (boxRow + boxCol) % 2 === 0
                    const isClue = clues?.[rowIndex]?.[colIndex] ?? false
                    const isHint = hintCells?.[rowIndex]?.[colIndex] ?? false

                    const value = cell === '.' ? '' : cell
                    const noteBits = notes?.[rowIndex]?.[colIndex] ?? 0

                    const isSelected = selRow === rowIndex && selCol === colIndex
                    const isPeer = Boolean(selected) && !isSelected && sameUnit(selRow, selCol, rowIndex, colIndex)
                    const isMatch = selValue !== '.' && value === selValue
                    const isConflict = conflicts[rowIndex][colIndex]

                    const className = [
                        'sudoku-cell',
                        isOrange ? 'cell-orange' : 'cell-white',
                        colIndex % 3 === 2 && colIndex !== 8 ? 'border-right' : '',
                        rowIndex % 3 === 2 && rowIndex !== 8 ? 'border-bottom' : '',
                        isClue ? 'cell-clue' : '',
                        isHint ? 'cell-hint' : '',
                        isPeer ? 'cell-peer' : '',
                        isMatch ? 'cell-match' : '',
                        isConflict ? 'cell-conflict' : '',
                        isSelected ? 'cell-selected' : '',
                    ].filter(Boolean).join(' ')

                    // One cell is in the tab order (the selected one, or the first), so Tab
                    // enters the board once and leaves it again instead of trapping focus.
                    const tabIndex = (selected ? isSelected : rowIndex === 0 && colIndex === 0) ? 0 : -1

                    return (
                        <div
                            key={`${rowIndex}-${colIndex}`}
                            ref={(el) => { cellRefs.current[rowIndex * 9 + colIndex] = el }}
                            className={className}
                            role="button"
                            aria-pressed={isSelected}
                            aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}, ${value || 'empty'}${isClue ? ', given' : ''}${isConflict ? ', conflict' : ''}`}
                            tabIndex={tabIndex}
                            onFocus={() => select(rowIndex, colIndex)}
                            onClick={() => select(rowIndex, colIndex)}
                        >
                            {value}
                            {!value && noteBits !== 0 && (
                                <span className="cell-notes" aria-hidden="true">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                                        <span key={d} className={String(d) === selValue ? 'note-match' : undefined}>
                                            {noteBits & (1 << (d - 1)) ? d : ''}
                                        </span>
                                    ))}
                                </span>
                            )}
                        </div>
                    )
                })
            ))}
        </div>
    )
}

export default SudokuBoard