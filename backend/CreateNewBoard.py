from typing import List
import random

class CreateNewBoard:
    @staticmethod
    def generate_ranodom_sudoku_puzzle() -> List[List[int]]:
        grid = SudokuGenerator.generate_sudoku(empty_cells=40)
        return SudokuGenerator.format_grid(grid)
    
    @staticmethod 
    def give_test_puzzle() -> List[List[int]]:
        return [['.', '.', '.', '.', '.', 1, 2, 3, '.'],
                [1, 2, 3, '.', '.', 8, '.', 4, '.'],
                [8, '.', 4, '.', '.', 7, 6, 5, '.'],
                [7, 6, 5, '.', '.', '.', '.', '.', '.'],
                ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
                ['.', '.', '.', '.', '.', '.', 1, 2, 3],
                ['.', 1, 2, 3, '.', '.', 8, '.', 4],
                ['.', 8, '.', 4, '.', '.', 7, 6, 5],
                ['.', 7, 6, 5, '.', '.', '.', '.', '.']
            ]
        
    @staticmethod
    def give_solves_test_puzzle() -> List[List[int]]:
        return [[6, 5, 7, 9, 4, 1, 2, 3, 8],
                [1, 2, 3, 6, 5, 8, 9, 4, 7],
                [8, 9, 4, 2, 3, 7, 6, 5, 1],
                [7, 6, 5, 1, 2, 3, 4, 8, 9],
                [2, 3, 1, 8, 9, 4, 5, 7, 6],
                [9, 4, 8, 7, 6, 5, 1, 2, 3],
                [5, 1, 2, 3, 7, 6, 8, 9, 4],
                [3, 8, 9, 4, 1, 2, 7, 6, 5],
                [4, 7, 6, 5, 8, 9, 3, 1, 2]
            ]
        
class SudokuGenerator:
    @staticmethod
    def generate_sudoku(empty_cells = 40):
        grid = [[0] * 9 for _ in range(9)]
        SudokuGenerator._fill(grid)
        SudokuGenerator._remove_cells(grid, empty_cells)
        return grid
    
    @staticmethod
    def _fill(grid):
        nums = list(range(1, 10))
        for row in range(9):
            for col in range(9):
                if grid[row][col] == 0:
                    random.shuffle(nums)
                    for num in nums:
                        if SudokuGenerator._is_valid(grid, row, col, num):
                            grid[row][col] = num
                            if SudokuGenerator._fill(grid):
                                return True
                            grid[row][col] = 0
                    return False
        return True

    @staticmethod
    def _is_valid(grid, row, col, num):

        if num in grid[row]:
            return False

        col_vals = [grid[r][col] for r in range(9)]
        if num in col_vals:
            return False

        box_row = (row // 3) * 3
        box_col = (col // 3) * 3
        for r in range(box_row, box_row + 3):
            for c in range(box_col, box_col + 3):
                if grid[r][c] == num:
                    return False

        return True

    @staticmethod
    def _remove_cells(grid, count):

        removed = 0

        while removed < count:
            row = random.randint(0, 8)
            col = random.randint(0, 8)

            if grid[row][col] != 0:
                grid[row][col] = 0
                removed += 1

    @staticmethod
    def format_grid(grid):

        result = []

        for row in grid:
            formatted_row = [str(cell) if cell != 0 else '.' for cell in row]
            result.append(formatted_row)

        return result