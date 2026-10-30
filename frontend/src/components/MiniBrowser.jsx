import './Pong.css'

// A tiny fake browser window: tab strip, toolbar, and a scrolling "page" area for its children.
// The page area carries the same plaster wall as the Sudoku site's <body>.
function MiniBrowser({
    icon,
    onIconClick,
    tabTitle,
    url,
    onClose,
    onBack,
    backLabel = 'Back',
    onReload,
    reloadLabel = 'Reload',
    bookmarks = [],
    size, // 'small' scales the whole window down to 65% (see .pong-window-small)
    children,
}) {
    return (
        <div className="pong-overlay" role="dialog" aria-label={tabTitle}>
            <div className={`pong-window${size === 'small' ? ' pong-window-small' : ''}`}>

                <div className="pong-chrome">
                    <div className="pong-tabstrip">
                        <div className="pong-tab">
                            <span
                                className="pong-tab-icon"
                                aria-hidden="true"
                                onClick={onIconClick}
                                style={onIconClick ? { cursor: 'pointer', userSelect: 'none' } : undefined}
                            >
                                {icon}
                            </span>
                            <span className="pong-tab-title">{tabTitle}</span>
                            <button className="pong-tab-close" onClick={onClose} aria-label="Close tab" title="Close">×</button>
                        </div>
                    </div>
                    <div className="pong-toolbar">
                        <button className="pong-nav" onClick={onBack} aria-label={backLabel} title={backLabel}>←</button>
                        <button className="pong-nav" disabled aria-label="Forward">→</button>
                        <button className="pong-nav" onClick={onReload} aria-label={reloadLabel} title={reloadLabel}>↻</button>
                        <div className="pong-address" title={url}>
                            <span className="pong-address-icon" aria-hidden="true">ⓘ</span>
                            <span className="pong-address-text">{url}</span>
                        </div>
                    </div>

                    {/* Bookmarks bar: one folder per label. */}
                    {bookmarks.length > 0 && (
                        <div className="pong-bookmarks" aria-label="Bookmarks">
                            {bookmarks.map(label => (
                                <span className="pong-bookmark" key={label}>
                                    <svg viewBox="0 0 20 16" width="18" height="14" aria-hidden="true">
                                        <path
                                            d="M1.5 3.5A1.5 1.5 0 0 1 3 2h4l1.6 1.8H17a1.5 1.5 0 0 1 1.5 1.5V13a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13z"
                                            fill="currentColor"
                                        />
                                    </svg>
                                    {label}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="pong-viewport">
                    {children}
                </div>
            </div>
        </div>
    )
}

export default MiniBrowser