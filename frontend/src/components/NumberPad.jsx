// Tap-friendly input for phones (and mouse users). It acts on the selected cell.
// The pencil / undo / redo buttons only appear when their handlers are passed in,
// so the scan-review dialog can reuse this with just digits and erase.
function NumberPad({
    counts,            // how many of each digit are on the board; a digit with 9 placed is dimmed
    pencilMode,
    onDigit,
    onErase,
    onTogglePencil,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    disabled,
}) {
    return (
        // Keeping mousedown from moving focus means the selected cell stays focused,
        // so arrow keys keep working after a click on the pad.
        <div className="number-pad" onMouseDown={(e) => e.preventDefault()}>
            <div className="number-pad-digits">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <button
                        key={d}
                        type="button"
                        className="btn btn-sudoku pad-btn"
                        disabled={disabled || (!pencilMode && counts?.[d] >= 9)}
                        onClick={() => onDigit(String(d))}
                        aria-label={`${pencilMode ? 'Toggle note' : 'Enter'} ${d}`}
                    >
                        {d}
                    </button>
                ))}
            </div>

            <div className="number-pad-tools">
                {onTogglePencil && (
                    <button
                        type="button"
                        className={`btn btn-sudoku pad-btn${pencilMode ? ' active' : ''}`}
                        aria-pressed={pencilMode}
                        onClick={onTogglePencil}
                        title="Toggle pencil marks (N)"
                    >
                        ✏️ Notes
                    </button>
                )}
                <button type="button" className="btn btn-sudoku pad-btn" disabled={disabled} onClick={onErase}>
                    ⌫ Erase
                </button>
                {onUndo && (
                    <button type="button" className="btn btn-sudoku pad-btn" disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl+Z)">
                        ↶ Undo
                    </button>
                )}
                {onRedo && (
                    <button type="button" className="btn btn-sudoku pad-btn" disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl+Shift+Z)">
                        ↷ Redo
                    </button>
                )}
            </div>
        </div>
    )
}

export default NumberPad