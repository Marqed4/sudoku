from typing import List, Optional
import random
import sudoku_engine as engine


class CreateNewBoard:
    @staticmethod
    def generate_random_sudoku_puzzle(difficulty: str = "medium",
                                      rng: Optional[random.Random] = None) -> List[List[str]]:
        """Unique-solution puzzle graded by solving technique (easy/medium/hard)."""
        return engine.generate(difficulty, rng)

    # Old (misspelled) name kept so nothing else breaks.
    generate_ranodom_sudoku_puzzle = generate_random_sudoku_puzzle

    @staticmethod
    def give_test_puzzle() -> List[List[str]]:
        # Cells are now consistently strings ('.' or '1'-'9'), like every other board.
        rows = [
            ". . . . . 1 2 3 .", "1 2 3 . . 8 . 4 .", "8 . 4 . . 7 6 5 .",
            "7 6 5 . . . . . .", ". . . . . . . . .", ". . . . . . 1 2 3",
            ". 1 2 3 . . 8 . 4", ". 8 . 4 . . 7 6 5", ". 7 6 5 . . . . .",
        ]
        return [r.split() for r in rows]

    @staticmethod
    def give_solves_test_puzzle() -> List[List[str]]:
        return engine.solve(CreateNewBoard.give_test_puzzle())
