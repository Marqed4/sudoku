import { useEffect, useRef, useState } from 'react'

// A small pencil that jogs across the bottom of the page every so often.
// Click it and it stops to say something about Sudoku in Japanese (with an English gloss).
// The motion lives in App.css (.sprite-*) and is switched off for reduced-motion users.

const LINES = [
    { ja: '数独は数字のパズルだよ', en: 'Sudoku is a number puzzle!' },
    { ja: '同じ行に同じ数字は入らないよ', en: "The same digit can't repeat in a row!" },
    { ja: 'ひらめいた！ここは3だ！', en: 'Aha! This one is a 3!' },
    { ja: 'えんぴつでメモしよう', en: "Let's jot it down in pencil!" },
    { ja: '候補を消していこう', en: "Let's eliminate the candidates!" },
    { ja: 'まちがえても大丈夫！', en: "It's okay to make mistakes!" },
    { ja: '数字は独身に限る', en: 'The name 数独 comes from this: "digits must stay single"' },
    { ja: '9×9のマスを全部うめよう', en: "Let's fill all 81 squares!" },
    { ja: 'ヒントがほしい？', en: 'Want a hint?' },
    { ja: 'あせらないでね', en: 'No rush!' },
]

const SPEAK_MS = 3200

export default function RunningSprite() {
    const [line, setLine] = useState(null)
    const last = useRef(-1)
    const timer = useRef(null)

    useEffect(() => () => clearTimeout(timer.current), [])

    // Pick a line different from the last one, show it, and hide it again after a moment.
    const speak = () => {
        let i
        do {
            i = Math.floor(Math.random() * LINES.length)
        } while (i === last.current)
        last.current = i
        setLine(LINES[i])
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setLine(null), SPEAK_MS)
    }

    return (
        <div className={`sprite-runner${line ? ' is-talking' : ''}`} onClick={speak} aria-hidden="true">
            {line && (
                <div className="sprite-bubble" key={line.ja}>
                    <span className="sprite-bubble-ja" lang="ja">{line.ja}</span>
                    <span className="sprite-bubble-en">{line.en}</span>
                </div>
            )}
            <svg className="sprite-body" viewBox="0 0 56 44">
                <g className="sprite-leg sprite-leg-a">
                    <line x1="19" y1="24" x2="15" y2="36" />
                </g>
                <g className="sprite-leg sprite-leg-b">
                    <line x1="31" y1="24" x2="35" y2="36" />
                </g>
                <rect x="6" y="12" width="30" height="12" rx="1.5" fill="#C2693F" />
                <rect x="6" y="12" width="5" height="12" fill="#C4B99A" />
                <rect x="1" y="13" width="6" height="10" rx="2.5" fill="#E8B4A6" stroke="#1A1612" strokeWidth="1" />
                <path d="M36 12 L48 18 L36 24 Z" fill="#F0E4C8" stroke="#1A1612" strokeWidth="1" strokeLinejoin="round" />
                <path d="M44.4 16.2 L48 18 L44.4 19.8 Z" fill="#1A1612" />
                <circle cx="32" cy="16" r="1.5" fill="#1A1612" />
                <rect x="6" y="12" width="30" height="12" rx="1.5" fill="none" stroke="#1A1612" strokeWidth="1" />
            </svg>
        </div>
    )
}
