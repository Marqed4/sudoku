import { useState, useEffect } from 'react'
import MiniBrowser from './MiniBrowser'

// Rick Astley, "Never Gonna Give You Up".
const VIDEO_ID = 'oHg5SJYRHA0'

// Where the "Visit My Website" button goes.
const PERSONAL_SITE = 'https://marqed.it'

// Shown in the mini browser's address bar.
const SITE_URL = 'rickrtube.com'

function RickRoll({ onExit }) {

    // Bumping this remounts the iframe, which restarts the video.
    const [plays, setPlays] = useState(0)

    // Escape closes only this window, not the Pong window underneath it.
    // Capture phase + stopImmediatePropagation so Pong's own Escape handler never sees it.
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key !== 'Escape') return
            e.stopImmediatePropagation()
            onExit()
        }
        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
    }, [onExit])

    const replay = () => setPlays(p => p + 1)

    return (
        <MiniBrowser
            icon="🎵"
            tabTitle="Totally Normal Page"
            url={SITE_URL}
            onClose={onExit}
            onBack={onExit}
            backLabel="Back to Pong"
            onReload={replay}
            reloadLabel="Replay"
            bookmarks={['Hire', 'Me']}
            size="small"
        >
            <div className="container py-3">

                <div className="title-wrap my-4">
                    <div className="app-subtitle" aria-hidden="true">
                        <svg viewBox="-1 -1 140 30" className="app-subtitle-svg">
                            <defs>
                                <path id="rick-subtitle-curve" d="M4 30 Q30 4 70 14 T112 24" fill="none" />
                                {/* black text with a silver glint sweeping across */}
                                <linearGradient id="rick-subtitle-shine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="40" y2="0">
                                    <stop offset="0" stopColor="#000" />
                                    <stop offset="0.38" stopColor="#000" />
                                    <stop offset="0.5" stopColor="#f4f4f4" />
                                    <stop offset="0.62" stopColor="#000" />
                                    <stop offset="1" stopColor="#000" />
                                    <animateTransform attributeName="gradientTransform" type="translate" from="-40 0" to="140 0" dur="2.2s" repeatCount="indefinite" />
                                </linearGradient>
                            </defs>
                            <text className="app-subtitle-text" style={{ fill: 'url(#rick-subtitle-shine)' }}>
                                <textPath href="#rick-subtitle-curve">back to pong</textPath>
                            </text>
                            {/* tiny arrow pointing down at the title */}
                            <path className="app-subtitle-arrow" d="M120 26 Q128 28 131 36 M127 34 L131 37 L133 31" fill="none" />
                        </svg>
                    </div>

                    <h1 className="app-title text-center my-0"
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={onExit}>GOTCHA</h1>
                </div>

                <div className="row g-3 align-items-start justify-content-center my-3">

                    {/* Left: how to watch */}
                    <div className="col-12 col-lg-3 order-2 order-lg-1">
                        <div className="card info-card h-100">
                            <div className="card-body d-flex flex-column gap-3">
                                <h2 className="mb-0 text-center"><u>How 2 Watch</u>🎵</h2>
                                <hr className="my-0" />
                                <p className="mb-0">Press play if the video didn't start by itself.</p>
                                <p className="mb-0">There is no skip button.</p>
                                <p className="mb-0">Turn your volume up.</p>
                            </div>
                        </div>
                    </div>

                    {/* Center: the video, framed like the sudoku board */}
                    <div className="col-12 col-lg-auto order-1 order-lg-2 d-flex justify-content-center">
                        <div className="rick-frame">
                            <iframe
                                key={plays}
                                src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
                                title="Totally normal video"
                                allow="autoplay; encrypted-media; picture-in-picture"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allowFullScreen
                            />
                        </div>
                    </div>

                    {/* Right: tips & tricks */}
                    <div className="col-12 col-lg-3 order-3">
                        <div className="card info-card h-100">
                            <div className="card-body d-flex flex-column gap-3">
                                <h2 className="mb-0 text-center"><u>Tips &amp; Tricks</u>🫡</h2>
                                <hr className="my-0" />
                                <p className="mb-0">Resistance is futile.</p>
                                <p className="mb-0">Closing the tab only delays the inevitable.</p>
                                <p className="mb-0">No refunds on the dancing.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="d-flex flex-wrap justify-content-center align-items-center gap-2">
                    <button className="btn btn-sudoku rounded-pill px-4" onClick={replay}>Play Again</button>
                    <button className="btn btn-sudoku rounded-pill px-4" onClick={onExit}>Back To Pong</button>
                    <a
                        className="btn btn-sudoku btn-sudoku-accent rounded-pill px-4"
                        href={PERSONAL_SITE}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Visit My Website
                    </a>
                </div>

                <div className="status-row d-flex flex-wrap justify-content-center align-items-center gap-2 mt-3">
                    <div className="badge rounded-pill border border-dark status-badge px-3 py-2 pong-badge-neutral">
                        🎶 You have been rickrolled 🎶
                    </div>
                </div>
            </div>

            <footer className="app-footer text-center">
                <p className="mb-1">© {new Date().getFullYear()} Rickwump &amp; Sons Entertainment Holdings, LLC (Limited Liability Lip-sync)</p>
                <p className="mb-1">Proudly looping since 1987. All rights reserved, except the ones we lost track of.</p>
                <p className="mb-0">Not affiliated with any real singer, dance move, or your better judgment. Please don't take us seriously.</p>
            </footer>
        </MiniBrowser>
    )
}

export default RickRoll