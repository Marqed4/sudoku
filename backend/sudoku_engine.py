"""
Core Sudoku engine: bitmask constraint search, solution counting,
technique-based grading, and unique-solution puzzle generation.

Board format everywhere else in the app: 9x9 list of lists, '.' = empty,
digits as strings ('1'..'9'). Internally a board is a flat list of 81 ints (0 = empty).
Requires Python 3.10+ (int.bit_count).
"""
import random
from typing import List, Optional

FULL = 0x1FF  # nine bits, one per digit
BOX = [(i // 27) * 3 + (i % 9) // 3 for i in range(81)]

UNITS = (
    [[r * 9 + c for c in range(9)] for r in range(9)]
    + [[r * 9 + c for r in range(9)] for c in range(9)]
    + [[(br * 3 + r) * 9 + bc * 3 + c for r in range(3) for c in range(3)]
       for br in range(3) for bc in range(3)]
)
PEERS = [
    sorted({p for u in UNITS if i in u for p in u} - {i}) for i in range(81)
]

Board = List[List[str]]


# ---------- parsing / formatting ----------

def parse_board(board) -> List[int]:
    """Validate shape and cell values; return a flat list of 81 ints (0 = empty).
    Accepts '.', '0', '' or 0 for empty and '1'-'9' or 1-9 for digits."""
    if not isinstance(board, (list, tuple)) or len(board) != 9:
        raise ValueError("board must have 9 rows")
    cells = []
    for row in board:
        if not isinstance(row, (list, tuple)) or len(row) != 9:
            raise ValueError("each row must have 9 cells")
        for v in row:
            s = str(v)
            if s in (".", "0", ""):
                cells.append(0)
            elif len(s) == 1 and s in "123456789":
                cells.append(int(s))
            else:
                raise ValueError(f"invalid cell value: {v!r}")
    return cells


def to_board(cells: List[int]) -> Board:
    return [[str(cells[r * 9 + c]) if cells[r * 9 + c] else "." for c in range(9)]
            for r in range(9)]


def _masks(cells):
    """Used-digit bitmasks per row/col/box, or None if the givens conflict."""
    rows, cols, boxes = [0] * 9, [0] * 9, [0] * 9
    for i, d in enumerate(cells):
        if d:
            bit = 1 << (d - 1)
            r, c, b = i // 9, i % 9, BOX[i]
            if (rows[r] | cols[c] | boxes[b]) & bit:
                return None
            rows[r] |= bit
            cols[c] |= bit
            boxes[b] |= bit
    return rows, cols, boxes


# ---------- search ----------

def _search(cells, masks, limit, rng=None, out=None) -> int:
    """Backtracking with minimum-remaining-values cell selection.
    Counts solutions up to `limit`; stores the first one in `out` if given.
    A cell with one candidate has n == 1, so MRV also performs naked-single propagation."""
    rows, cols, boxes = masks
    best, best_cand, best_n = -1, 0, 10
    for i in range(81):
        if cells[i] == 0:
            cand = FULL & ~(rows[i // 9] | cols[i % 9] | boxes[BOX[i]])
            n = cand.bit_count()
            if n < best_n:
                best, best_cand, best_n = i, cand, n
                if n <= 1:
                    break
    if best == -1:
        if out is not None and not out:
            out.append(cells[:])
        return 1
    if best_n == 0:
        return 0

    digits = [d for d in range(1, 10) if best_cand >> (d - 1) & 1]
    if rng is not None:
        rng.shuffle(digits)
    r, c, b = best // 9, best % 9, BOX[best]
    found = 0
    for d in digits:
        bit = 1 << (d - 1)
        cells[best] = d
        rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit
        found += _search(cells, masks, limit - found, rng, out)
        cells[best] = 0
        rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit
        if found >= limit:
            break
    return found


def solve(board) -> Optional[Board]:
    """Return a solved copy of the board, or None if it has no solution.
    Never mutates the input. Raises ValueError on malformed input."""
    cells = parse_board(board)
    masks = _masks(cells)
    if masks is None:
        return None
    out: list = []
    _search(cells, masks, 1, None, out)
    return to_board(out[0]) if out else None


def count_solutions(board, limit: int = 2) -> int:
    """Number of solutions, stopping at `limit`. count == 1 means a unique solution."""
    cells = parse_board(board)
    masks = _masks(cells)
    if masks is None:
        return 0
    return _search(cells, masks, limit)


def has_conflicts(board) -> bool:
    """True if any row, column or box repeats a digit (does NOT test solvability)."""
    return _masks(parse_board(board)) is None


# ---------- grading ----------

def _cands(cells, i) -> int:
    used = 0
    for p in PEERS[i]:
        if cells[p]:
            used |= 1 << (cells[p] - 1)
    return FULL & ~used


def grade(board) -> Optional[str]:
    """Grade by the weakest technique set that solves the puzzle without guessing:
      'easy'   - naked singles only
      'medium' - needs hidden singles too
      'hard'   - stalls; needs techniques beyond these (or search)
    Returns None if the board is contradictory."""
    cells = parse_board(board)
    if _masks(cells) is None:
        return None
    used_hidden = False
    while True:
        if all(cells):
            return "medium" if used_hidden else "easy"
        progress = False
        for i in range(81):
            if cells[i] == 0:
                m = _cands(cells, i)
                if m == 0:
                    return None
                if m.bit_count() == 1:
                    cells[i] = m.bit_length()
                    progress = True
        if progress:
            continue
        for unit in UNITS:
            for d in range(1, 10):
                if any(cells[p] == d for p in unit):
                    continue
                spots = [p for p in unit if cells[p] == 0 and _cands(cells, p) >> (d - 1) & 1]
                if not spots:
                    return None
                if len(spots) == 1:
                    cells[spots[0]] = d
                    used_hidden = progress = True
        if not progress:
            return "hard"


# ---------- generation ----------

CLUE_TARGETS = {"easy": 38, "medium": 32, "hard": 26}


def _random_solution(rng) -> List[int]:
    out: list = []
    _search([0] * 81, ([0] * 9, [0] * 9, [0] * 9), 1, rng, out)
    return out[0]


def _dig(solution, target_clues, rng) -> List[int]:
    """Remove cells in random order, keeping each removal only if the
    solution stays unique. Stops at target_clues or when nothing more can go."""
    cells = solution[:]
    clues = 81
    order = list(range(81))
    rng.shuffle(order)
    for i in order:
        if clues <= target_clues:
            break
        saved, cells[i] = cells[i], 0
        masks = _masks(cells)
        if _search(cells, masks, 2) != 1:
            cells[i] = saved
        else:
            clues -= 1
    return cells


def generate(difficulty: str = "medium", rng: Optional[random.Random] = None,
             max_attempts: int = 60) -> Board:
    """Unique-solution puzzle whose technique grade matches `difficulty`.
    If no attempt matches in max_attempts, returns the closest-grade last attempt."""
    if difficulty not in CLUE_TARGETS:
        raise ValueError(f"difficulty must be one of {sorted(CLUE_TARGETS)}")
    rng = rng or random.Random()
    puzzle = None
    for _ in range(max_attempts):
        puzzle = to_board(_dig(_random_solution(rng), CLUE_TARGETS[difficulty], rng))
        if grade(puzzle) == difficulty:
            return puzzle
    return puzzle
