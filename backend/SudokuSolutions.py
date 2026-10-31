from typing import List, Optional
import sudoku_engine as engine

Board = List[List[str]]


class SudokuSolutions:
    """Thin compatibility layer over sudoku_engine so existing routes keep working.
    Nothing here mutates the board passed in."""

    @staticmethod
    def is_valid_sudoku(board: Board) -> bool:
        """No repeated digit in any row, column or box. Does not prove solvability."""
        return not engine.has_conflicts(board)

    @staticmethod
    def is_solvable(board: Board) -> bool:
        return engine.count_solutions(board, limit=1) == 1

    @staticmethod
    def solve_sudoku(board: Board) -> Optional[Board]:
        """Solved copy of the board, or None if unsolvable."""
        return engine.solve(board)

    @staticmethod
    def test_correctness(solved_board: Board, current_board: Board) -> bool:
        """True if current_board is a completed grid equal to the given solution."""
        try:
            return engine.parse_board(solved_board) == engine.parse_board(current_board) \
                and all(engine.parse_board(current_board))
        except ValueError:
            return False
