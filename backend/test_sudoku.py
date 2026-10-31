import copy
import random
import unittest

import sudoku_engine as engine
import algorithm_x
from CreateNewBoard import CreateNewBoard
from Hints import Hints
from SudokuSolutions import SudokuSolutions

HARD = ("8........" "..36....." ".7..9.2.." ".5...7..." "....457.." "...1...3."
        "..1....68" "..85...1." ".9....4..")


def hard_board():
    return [[c if c != "0" else "." for c in HARD[r * 9:(r + 1) * 9]] for r in range(9)]


def is_complete_valid(b):
    cells = engine.parse_board(b)
    return all(cells) and not engine.has_conflicts(b)


class SolverTests(unittest.TestCase):
    def test_solves_hard_puzzle_and_keeps_givens(self):
        puzzle = hard_board()
        solved = engine.solve(puzzle)
        self.assertTrue(is_complete_valid(solved))
        for r in range(9):
            for c in range(9):
                if puzzle[r][c] != ".":
                    self.assertEqual(puzzle[r][c], solved[r][c])

    def test_does_not_mutate_input(self):
        puzzle = hard_board()
        before = copy.deepcopy(puzzle)
        engine.solve(puzzle)
        self.assertEqual(puzzle, before)

    def test_unsolvable_returns_none(self):
        # No row/col/box conflict among givens, but cell (0,8) has no candidate.
        b = [["."] * 9 for _ in range(9)]
        b[0][:8] = list("12345678")
        b[1][8] = "9"
        self.assertFalse(engine.has_conflicts(b))
        self.assertIsNone(engine.solve(b))
        self.assertFalse(SudokuSolutions.is_solvable(b))

    def test_conflicting_givens(self):
        b = [["."] * 9 for _ in range(9)]
        b[0][0] = b[0][1] = "5"
        self.assertTrue(engine.has_conflicts(b))
        self.assertIsNone(engine.solve(b))

    def test_count_solutions(self):
        self.assertEqual(engine.count_solutions(hard_board()), 1)
        self.assertEqual(engine.count_solutions([["."] * 9 for _ in range(9)], limit=5), 5)

    def test_algorithm_x_agrees(self):
        self.assertEqual(algorithm_x.solve(hard_board()), engine.solve(hard_board()))

    def test_malformed_input_raises(self):
        for bad in (None, [], [["."] * 9] * 8, [["."] * 8] * 9, [["x"] * 9] * 9, [["10"] * 9] * 9):
            with self.assertRaises(ValueError):
                engine.parse_board(bad)

    def test_accepts_int_cells(self):
        b = CreateNewBoard.give_test_puzzle()
        b[0][0] = 6  # int instead of str
        self.assertEqual(engine.parse_board(b)[0], 6)


class GeneratorTests(unittest.TestCase):
    def test_unique_and_graded(self):
        for diff in ("easy", "medium", "hard"):
            for seed in range(5):
                p = engine.generate(diff, random.Random(seed))
                self.assertEqual(engine.count_solutions(p), 1, (diff, seed))
                self.assertEqual(engine.grade(p), diff, (diff, seed))

    def test_seeded_generation_is_reproducible(self):
        self.assertEqual(engine.generate("medium", random.Random(7)),
                         engine.generate("medium", random.Random(7)))

    def test_bad_difficulty(self):
        with self.assertRaises(ValueError):
            engine.generate("impossible")


class HintTests(unittest.TestCase):
    def test_hints_are_correct_and_input_untouched(self):
        puzzle = hard_board()
        before = copy.deepcopy(puzzle)
        solved = engine.solve(puzzle)
        new, locs = Hints.get_hint(puzzle, 3)
        self.assertEqual(puzzle, before)
        self.assertEqual(len(locs), 3)
        for r, c in locs:
            self.assertEqual(before[r][c], ".")
            self.assertEqual(new[r][c], solved[r][c])

    def test_more_hints_than_empties(self):
        solved = engine.solve(hard_board())
        solved[0][0] = "."
        new, locs = Hints.get_hint(solved, 10)
        self.assertEqual(len(locs), 1)

    def test_unsolvable_raises(self):
        b = [["."] * 9 for _ in range(9)]
        b[0][:8] = list("12345678")
        b[1][8] = "9"
        with self.assertRaises(ValueError):
            Hints.get_hint(b, 1)


class GradeTests(unittest.TestCase):
    def test_known_hard_is_hard(self):
        self.assertEqual(engine.grade(hard_board()), "hard")

    def test_nearly_complete_is_easy(self):
        solved = engine.solve(hard_board())
        solved[4][4] = "."
        self.assertEqual(engine.grade(solved), "easy")


if __name__ == "__main__":
    unittest.main()
