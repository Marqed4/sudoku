<div align="center">
  <br/>
  <p>
    <img src="frontend/src/assets/Favicon.png" title="SolveSudoku" alt="SolveSudoku logo" width="100" />
  </p>

  <h1>𝑆𝑢𝑑𝑜𝑘𝑢</h1>
  <p>A full‑stack Sudoku solver, scanner, and generator</p>

  <p>
    <a href="https://github.com/YOUR_USER/YOUR_REPO/actions/workflows/tests.yml"><img src="https://github.com/YOUR_USER/YOUR_REPO/actions/workflows/tests.yml/badge.svg" alt="Tests" /></a>
  </p>

  <p>
    🌐 <a href="https://marqed.it/Sudoku">Visit us & learn more</a>  
  </p>
  <p>
    🎮 <a href="https://sudoku.marqed.it/">Play</a>
  </p>
  <br/>
</div>
<div align="center">
  Upload a puzzle or perhaps generate one. If you're stuck get some hints or have us solve the puzzle entirely. Test your solution or check if the puzzle could be solved all along.
</div>

---

<h2 align="center">Views</h2>

<p align="center"><img src="Examples/Screenshot%202026-06-21%20092112.png" /></p>

---

<h2 align="center">Features</h2>

__Instant Board Scanner__ - Snap a photo of a Sudoku puzzle and convert it into a playable 9×9 grid. Images are read by the Gemini API, and the result is validated (shape and cell values) before it reaches the board.

__Smart Solver__ - Get a full solution instantly. The solver is bitmask backtracking that always branches on the most constrained cell, which also performs naked-single propagation.

__Hint Engine__ - Stuck on a puzzle? Request one or multiple hints, generated from the solved board and applied directly to your grid.

__Puzzle Generator__ - Create fresh boards on demand in three difficulties. Every generated puzzle has exactly one solution, and difficulty is graded by the solving techniques required (naked singles, hidden singles, or beyond), not just clue count.

__Board Editor__ - Manually tweak cells, fix mistakes.

__Progress Persistence__ - Your board, hints, and state are saved automatically in local storage.

__Error Checking__ - Optional real-time validation to catch duplicates and impossible moves. The API distinguishes a board with conflicts from a board with no solution.

---

<h2 align="center">Solver Performance</h2>

Median runtimes on one machine, comparing the original brute-force solver, Algorithm X (exact cover), and the current bitmask solver. Reproduce with `python benchmark.py` in `backend/`.

| Puzzle | Original | Algorithm X | Bitmask + MRV (current) |
|---|---|---|---|
| 36 clues | 0.204 s | 1.91 ms | 0.19 ms |
| Hard (21 clues) | 2.445 s | 62.68 ms | 43.88 ms |
| 17-clue minimum | timed out at 20 s | 2.47 ms | 21.29 ms |

Three puzzles is a small sample. Algorithm X is faster on the 17-clue case, so the current solver is not best everywhere.

---

<h2 align="center">Architecture</h2>
<h2 align="center">Class Diagram</h2>

<p align="center"><img src="Examples/Screenshot%202026-06-21%20034200.png" /></p>

<!-- TODO: full system architecture diagram goes here -->

---

<h2 align="center">API</h2>

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET | `/api/generate_random_sudoku_puzzle?difficulty=easy\|medium\|hard` | New unique-solution puzzle |
| POST | `/api/is_valid_sudoku` | Returns `is_valid` (no conflicts) and `is_solvable` |
| POST | `/api/solve_sudoku` | Solved board, or 422 if unsolvable |
| POST | `/api/get_hint` | Fill `hints` empty cells with correct values |
| POST | `/api/is_board_state_correct` | Compare a board to its solution |
| POST | `/api/get_array_from_image` | Scan a photo into a 9×9 board |

Boards are 9×9 arrays of strings: `"."` for empty, `"1"` to `"9"` otherwise. Malformed input returns 400, and well-formed but unsolvable boards return 422.

---

<h2 align="center">Running Locally</h2>

Requires Python 3.10+ and Node.

```bash
# Backend (port 2000)
cd backend
pip install -r requirements.txt
cp .env.example .env        # add your GEMINI_API_KEY
python Main.py

# Frontend (port 2001)
cd frontend
npm install
npm run dev
```

Run the tests with `python -m unittest -v` from `backend/`.

---

<h2 align="center">Deployment</h2>
<p align="center"><img src="Examples/Screenshot%202026-06-27%20040541.png" /></p>

The app is split across two services hosted on [Render](https://render.com):

| Service | Runtime | Host |
|---|---|---|
| Sudoku Frontend | Static Site (Vite build) | Global CDN |
| Sudoku Backend | Python / Flask + Gunicorn | Virginia |

The frontend is served as a static site via Render's global CDN. The backend runs as a persistent web service, handling API requests for puzzle generation, solving, hints, and image processing.

**Note:** The backend runs on Render's free tier, which spins down after periods of inactivity. If the service has been idle, the first request (puzzle generation, solving, hints, or scanning) can take 50+ seconds while it spins back up. Please be patient, subsequent requests will be fast.

---

<h2 align="center">Ethics</h2>

SolveSudoku takes zero liability for puzzles you could've solved yourself.

---

<h2 align="center">Contributing</h2>

If you're considering contributing to __Sudoku__, first of all, __thank you!__
Check the [Contribution Guidelines](CONTRIBUTING.md) before getting started.

---

<h2 align="center">License</h2>

Unless specified otherwise, this repository is licensed under [AGPL-3.0](LICENSE)
