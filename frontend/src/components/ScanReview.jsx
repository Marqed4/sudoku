import { useState, useMemo, useEffect } from 'react'
import SudokuBoard from './SudokuBoard'
import NumberPad from './NumberPad'
import { findConflicts } from '../SudokuLogic'

// Shown after a scan, before the puzzle loads. OCR misreads digits, so the person
// gets to compare against their photo and fix cells first.
function ScanReview({ initialBoard, imageUrl, onCancel, onConfirm }) {

    const [board, setBoard] = useState(initialBoard)
    const [selected, setSelected] = useState(null)

    const digitCount = useMemo(() => board.flat().filter((c) => c !== '.').length, [board])
    const conflictCount = useMemo(() => findConflicts(board).flat().filter(Boolean).length, [board])

    const setCell = (r, c, val) => {
        setBoard((b) => b.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? val : x)) : row)))
    }

    const handleSelect = (r, c) => setSelected(r === null || r === undefined ? null : [r, c])

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onCancel()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onCancel])

    return (
        <div className="scan-review-overlay" role="dialog" aria-modal="true" aria-label="Check the scanned puzzle">
            <div className="scan-review">
                <h2 className="text-center mb-2"><u>Check The Scan</u>🔍</h2>
                <p className="text-center mb-3">
                    Tap a cell, then pick the right digit. Repeated digits show in red.
                </p>

                {imageUrl && (
                    <div className="text-center">
                        <img className="scan-review-photo" src={imageUrl} alt="The photo you uploaded" />
                    </div>
                )}

                <div className="d-flex justify-content-center">
                    <SudokuBoard
                        board={board}
                        selected={selected}
                        onSelect={handleSelect}
                        onInput={setCell}
                    />
                </div>

                <NumberPad
                    disabled={!selected}
                    onDigit={(d) => selected && setCell(selected[0], selected[1], d)}
                    onErase={() => selected && setCell(selected[0], selected[1], '.')}
                />

                <div className="d-flex flex-wrap justify-content-center gap-2 mt-3">
                    <div className="badge rounded-pill border border-dark status-badge pong-badge-neutral px-3 py-2">
                        {digitCount} digits found
                    </div>
                    {conflictCount > 0 && (
                        <div className="badge rounded-pill border border-dark status-badge unsolvable px-3 py-2">
                            {conflictCount} cells repeat a digit
                        </div>
                    )}
                </div>

                <div className="d-flex flex-wrap justify-content-center gap-2 mt-3">
                    <button type="button" className="btn btn-sudoku rounded-pill px-4" onClick={onCancel}>Cancel</button>
                    <button
                        type="button"
                        className="btn btn-sudoku btn-sudoku-accent rounded-pill px-4"
                        disabled={digitCount === 0}
                        onClick={() => onConfirm(board)}
                    >
                        Load Puzzle
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ScanReview