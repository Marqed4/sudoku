"""Knuth's Algorithm X on a dict-of-sets exact cover (after Ali Assaf's formulation).
Included for benchmarking against the bitmask/MRV solver."""
from itertools import product
import sudoku_engine as engine


def _select(X, Y, r):
    cols = []
    for j in Y[r]:
        for i in X[j]:
            for k in Y[i]:
                if k != j:
                    X[k].remove(i)
        cols.append(X.pop(j))
    return cols


def _deselect(X, Y, r, cols):
    for j in reversed(Y[r]):
        X[j] = cols.pop()
        for i in X[j]:
            for k in Y[i]:
                if k != j:
                    X[k].add(i)


def _solve(X, Y, solution):
    if not X:
        yield list(solution)
        return
    c = min(X, key=lambda c: len(X[c]))
    for r in list(X[c]):
        solution.append(r)
        cols = _select(X, Y, r)
        yield from _solve(X, Y, solution)
        _deselect(X, Y, r, cols)
        solution.pop()


def solve(board):
    cells = engine.parse_board(board)
    Y = {}
    for r, c, n in product(range(9), range(9), range(1, 10)):
        b = (r // 3) * 3 + c // 3
        Y[(r, c, n)] = [("rc", r, c), ("rn", r, n), ("cn", c, n), ("bn", b, n)]
    X = {}
    for r, cols in Y.items():
        for c in cols:
            X.setdefault(c, set()).add(r)
    try:
        for i, n in enumerate(cells):
            if n:
                _select(X, Y, (i // 9, i % 9, n))
    except KeyError:  # conflicting givens
        return None
    for sol in _solve(X, Y, []):
        out = cells[:]
        for r, c, n in sol:
            out[r * 9 + c] = n
        return engine.to_board(out)
    return None
