// Pong physics, run entirely in the browser. No React in here: the component owns one game
// object, calls stepGame() every animation frame, and draws whatever the object says.
//
// Units: one cell is 1.0. The board is SIZE x SIZE cells. The ball's position is its center.
// Speeds are cells per second, so motion is smooth at any frame rate.

export const SIZE = 27
export const PADDLE_SIZE = 3
export const WIN_SCORE = 5
export const BALL_RADIUS = 0.4

// The paddles fill column 0 (player) and the last column (computer). The ball bounces off
// the face that points into the board.
const PLAYER_FACE = 1
const COMPUTER_FACE = SIZE - 1

const SERVE_SPEED = 11          // Ball speed at the start of every rally.
const MAX_SPEED = 22            // The ball never gets faster than this.
const SPEEDUP_PER_HIT = 0.9     // Every paddle hit makes the rally a little quicker.
const MAX_BOUNCE_ANGLE = (50 * Math.PI) / 180 // Hitting the very edge of a paddle.
const MAX_SERVE_ANGLE = (25 * Math.PI) / 180

const COUNT_FROM = 3            // 3, 2, 1 before each serve...
const COUNT_STEP = 0.6          // ...at this many seconds per number.
const POINT_PAUSE = 1.2         // Breather after a point.

// Computer difficulty. speed is how fast its paddle can move (rows per second);
// error is how far off-center it may aim, which also varies the angles it returns.
export const DIFFICULTIES = {
    easy:   { label: 'Easy',   speed: 6.5, error: 1.7 },
    medium: { label: 'Medium', speed: 10,  error: 1.2 },
    hard:   { label: 'Hard',   speed: 12.5, error: 1.0 },
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// phase: 'ready' (not started), 'countdown', 'playing', 'point' (short pause), 'over'
export function createGame() {
    return {
        phase: 'ready',
        timer: 0,
        ballX: SIZE / 2,
        ballY: SIZE / 2,
        vx: 0,
        vy: 0,
        speed: SERVE_SPEED,
        rally: 0,
        computerTop: (SIZE - PADDLE_SIZE) / 2,
        aimRoll: 0,        // Random -1..1, re-rolled every time the player hits the ball.
        playerScore: 0,
        computerScore: 0,
        serveDir: 1,       // 1 serves toward the computer, -1 toward the player. Alternates.
        lastScorer: null,
        winner: null,
    }
}

export function startCountdown(g) {
    g.phase = 'countdown'
    g.timer = COUNT_FROM * COUNT_STEP
    g.ballX = SIZE / 2
    g.ballY = SIZE / 2
    g.vx = 0
    g.vy = 0
    g.rally = 0
    g.speed = SERVE_SPEED
}

// The number to show on screen during the countdown (3, 2, 1).
export const countdownNumber = (g) => Math.max(1, Math.ceil(g.timer / COUNT_STEP))

function serve(g) {
    const angle = (Math.random() * 2 - 1) * MAX_SERVE_ANGLE
    g.vx = g.serveDir * g.speed * Math.cos(angle)
    g.vy = g.speed * Math.sin(angle)
    g.serveDir = -g.serveDir
    g.aimRoll = Math.random() * 2 - 1
}

function award(g, who) {
    if (who === 'player') g.playerScore++
    else g.computerScore++
    g.lastScorer = who

    if (g.playerScore >= WIN_SCORE || g.computerScore >= WIN_SCORE) {
        g.phase = 'over'
        g.winner = g.playerScore > g.computerScore ? 'player' : 'computer'
    } else {
        g.phase = 'point'
        g.timer = POINT_PAUSE
    }
}

// Reflect the ball off a paddle. Where it lands on the paddle sets the angle:
// dead center goes straight, the edges send it off at up to MAX_BOUNCE_ANGLE.
function paddleBounce(g, paddleTop, dir) {
    const offset = clamp((g.ballY - (paddleTop + PADDLE_SIZE / 2)) / (PADDLE_SIZE / 2 + BALL_RADIUS), -1, 1)
    g.rally++
    g.speed = Math.min(MAX_SPEED, SERVE_SPEED + g.rally * SPEEDUP_PER_HIT)
    const angle = offset * MAX_BOUNCE_ANGLE
    g.vx = dir * g.speed * Math.cos(angle)
    g.vy = g.speed * Math.sin(angle)
}

function moveBall(g, dt, playerTop) {
    const prevX = g.ballX
    g.ballX += g.vx * dt
    g.ballY += g.vy * dt

    // Top and bottom walls.
    if (g.ballY < BALL_RADIUS) {
        g.ballY = 2 * BALL_RADIUS - g.ballY
        g.vy = Math.abs(g.vy)
    } else if (g.ballY > SIZE - BALL_RADIUS) {
        g.ballY = 2 * (SIZE - BALL_RADIUS) - g.ballY
        g.vy = -Math.abs(g.vy)
    }

    // Player paddle: the ball's left edge crossed the paddle's face this frame.
    if (g.vx < 0 && prevX - BALL_RADIUS >= PLAYER_FACE && g.ballX - BALL_RADIUS < PLAYER_FACE) {
        if (g.ballY >= playerTop - BALL_RADIUS && g.ballY <= playerTop + PADDLE_SIZE + BALL_RADIUS) {
            g.ballX = PLAYER_FACE + BALL_RADIUS
            paddleBounce(g, playerTop, 1)
            g.aimRoll = Math.random() * 2 - 1
        }
    }

    // Computer paddle: the ball's right edge crossed its face.
    if (g.vx > 0 && prevX + BALL_RADIUS <= COMPUTER_FACE && g.ballX + BALL_RADIUS > COMPUTER_FACE) {
        if (g.ballY >= g.computerTop - BALL_RADIUS && g.ballY <= g.computerTop + PADDLE_SIZE + BALL_RADIUS) {
            g.ballX = COMPUTER_FACE - BALL_RADIUS
            paddleBounce(g, g.computerTop, -1)
        }
    }

    // Past either edge: a point.
    if (g.ballX < 0) award(g, 'computer')
    else if (g.ballX > SIZE) award(g, 'player')
}

// The computer chases the ball while it is heading its way and drifts back to the middle
// otherwise. Its speed limit is what makes it beatable.
function moveComputer(g, dt, ai) {
    const tracking = g.phase === 'playing' && g.vx > 0
    const target = tracking
        ? g.ballY - PADDLE_SIZE / 2 + g.aimRoll * ai.error
        : (SIZE - PADDLE_SIZE) / 2
    const maxStep = ai.speed * dt
    g.computerTop = clamp(
        g.computerTop + clamp(target - g.computerTop, -maxStep, maxStep),
        0,
        SIZE - PADDLE_SIZE,
    )
}

// Advance the game by dt seconds. playerTop is the player paddle's top row (fractional).
export function stepGame(g, dt, playerTop, ai) {
    if (g.phase === 'countdown') {
        g.timer -= dt
        if (g.timer <= 0) {
            serve(g)
            g.phase = 'playing'
        }
    } else if (g.phase === 'point') {
        g.timer -= dt
        if (g.timer <= 0) startCountdown(g)
    }

    if (g.phase === 'playing') moveBall(g, dt, playerTop)
    moveComputer(g, dt, ai)
}

// The ball is drawn before the serve and during play, and hidden between points.
export const ballVisible = (g) => g.phase === 'ready' || g.phase === 'countdown' || g.phase === 'playing'