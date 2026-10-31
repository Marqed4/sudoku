import random
from typing import List, Tuple
import sudoku_engine as engine


class Hints:
    @staticmethod
    def get_hint(board: List[List[str]], how_many_hints: int) -> Tuple[List[List[str]], List[Tuple[int, int]]]:
        """Fill `how_many_hints` randomly chosen empty cells with their correct values.
        Returns (new_board, hint_locations). Does not mutate the input.
        Raises ValueError if the board is malformed or has no solution."""
        cells = engine.parse_board(board)
        solved = engine.solve(board)
        if solved is None:
            raise ValueError("board has no solution")

        empties = [(r, c) for r in range(9) for c in range(9) if cells[r * 9 + c] == 0]
        chosen = random.sample(empties, min(max(how_many_hints, 0), len(empties)))

        result = engine.to_board(cells)
        for r, c in chosen:
            result[r][c] = solved[r][c]
        return result, chosen
