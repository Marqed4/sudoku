"""Compare the original brute-force solver, Algorithm X, and the bitmask/MRV solver.
Run: python benchmark.py   (Unix only: uses signal.alarm for the legacy timeout)"""
import copy
import signal
import statistics
import time

import algorithm_x
import legacy_solver
import sudoku_engine as engine

PUZZLES = {
    "easy (36 clues)": "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
    "hard (Inkala, 21 clues)": "800000000003600000070090200050007000000045700000100030001000068008500010090000400",
    "17-clue minimum": "000000010400000000020000000000050407008000300001090000300400200050100000000806000",
}
LEGACY_TIMEOUT = 20


def board(s):
    return [[c if c != "0" else "." for c in s[r * 9:(r + 1) * 9]] for r in range(9)]


class Timeout(Exception):
    pass


def _alarm(*_):
    raise Timeout


def timed(fn, b, repeats):
    times = []
    for _ in range(repeats):
        t = time.perf_counter()
        fn(copy.deepcopy(b))
        times.append(time.perf_counter() - t)
    return statistics.median(times)


def legacy_time(b):
    signal.signal(signal.SIGALRM, _alarm)
    signal.alarm(LEGACY_TIMEOUT)
    try:
        t = time.perf_counter()
        legacy_solver.SudokuSolutions.solve_sudoku(copy.deepcopy(b))
        return f"{time.perf_counter() - t:.3f} s"
    except Timeout:
        return f"> {LEGACY_TIMEOUT} s (timed out)"
    finally:
        signal.alarm(0)


if __name__ == "__main__":
    print(f"{'puzzle':26}{'legacy':>22}{'algorithm X':>14}{'bitmask+MRV':>14}")
    for name, s in PUZZLES.items():
        b = board(s)
        assert algorithm_x.solve(b) == engine.solve(b)
        print(f"{name:26}{legacy_time(b):>22}"
              f"{timed(algorithm_x.solve, b, 5) * 1000:>11.2f} ms"
              f"{timed(engine.solve, b, 5) * 1000:>11.2f} ms")
