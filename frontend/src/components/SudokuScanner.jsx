import { useRef, useState, useEffect } from 'react'
import { request } from '../Api'
import { normalizeBoard } from '../SudokuLogic'

// onScanned({ board, imageUrl }) receives the recognised grid. It is not loaded
// straight onto the board: the app shows it in a review dialog first.
function SudokuScanner({ onScanned, disabled }) {

    const fileInputRef = useRef(null)
    const cameraInputRef = useRef(null)

    const [loading, setLoading] = useState(false)
    const [slow, setSlow] = useState(false)
    const [error, setError] = useState(null)

    // After a few seconds, explain why it is taking a while (the free-tier backend may be asleep).
    useEffect(() => {
        if (!loading) {
            setSlow(false)
            return
        }
        const timer = setTimeout(() => setSlow(true), 5000)
        return () => clearTimeout(timer)
    }, [loading])

    const getArrayFromImage = async (e) => {
        const file = e.target.files[0]
        // Clear the input so choosing the same photo again still fires onChange.
        e.target.value = ''
        if (!file) return

        const formData = new FormData()
        formData.append('image', file)

        setLoading(true)
        setError(null)

        try {
            const data = await request('/api/get_array_from_image', { method: 'POST', formData })
            const board = normalizeBoard(data.array)
            if (!board) {
                throw new Error("Couldn't read a 9x9 grid from that image. Try a clearer, straight-on photo.")
            }
            onScanned({ board, imageUrl: URL.createObjectURL(file) })
        } catch (err) {
            setError(err.message || 'Something went wrong while reading the puzzle.')
        } finally {
            setLoading(false)
        }
    }

    const busy = loading || disabled

    return (
        <div className="d-flex flex-column align-items-center gap-2">
            <div className="d-flex flex-column flex-sm-row justify-content-center gap-2">
                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={getArrayFromImage}
                    style={{ display: 'none' }}
                />
                <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraInputRef}
                    onChange={getArrayFromImage}
                    style={{ display: 'none' }}
                />
                <button
                    className="btn btn-sudoku rounded-pill px-4"
                    disabled={busy}
                    onClick={() => fileInputRef.current.click()}
                >
                    {loading && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
                    {loading ? 'Reading Puzzle...' : 'Upload Puzzle Image'}
                </button>
                <button
                    className="btn btn-sudoku rounded-pill px-4"
                    disabled={busy}
                    onClick={() => cameraInputRef.current.click()}
                >
                    Take Photo of Puzzle
                </button>
            </div>

            {slow && (
                <div className="badge rounded-pill border border-dark status-badge pong-badge-neutral px-3 py-2" role="status">
                    Still working. The backend may be waking up, which can take up to a minute.
                </div>
            )}
            {error && (
                <div className="badge rounded-pill border border-dark status-badge unsolvable px-3 py-2 text-wrap" role="alert">
                    {error}
                </div>
            )}
        </div>
    )
}

export default SudokuScanner