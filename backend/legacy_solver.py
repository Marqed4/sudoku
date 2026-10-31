from typing import List

# Board is 2d matrix
class SudokuSolutions:
    @staticmethod
    def is_valid_sudoku(board: List[List[str]]) -> bool:
        
        # Check rows
        for row in board:
            seen = set()
            for num in row:
                if num == '.':
                    continue
                if num in seen:
                    return False
                seen.add(num)
        
        # Check columns
        col = 0
        while col < 9:
            seen = set()
            row = 0
            while row < 9:
                num = board[row][col]
                if num != '.':
                    if num in seen:
                        return False
                    seen.add(num)
                row += 1
            col += 1
        
        # Check 3x3 boxes
        box_row = 0
        while box_row < 3:
            box_col = 0
            while box_col < 3:
                seen = set()
                i = 0
                while i < 3:
                    j = 0
                    while j < 3:
                        num = board[box_row * 3 + i][box_col * 3 + j]
                        if num != '.':
                            if num in seen:
                                return False
                            seen.add(num)
                        j += 1
                    i += 1
                box_col += 1
            box_row += 1
        
        return True
    
    @staticmethod
    def solve_sudoku(board: List[List[str]]) -> List:
        
        # Find next empty cell
        row = 0
        while row < 9:
            col = 0
            while col < 9:
                if board[row][col] == '.':
                    
                    # Try each number 1-9
                    num = 1
                    while num <= 9:
                        board[row][col] = str(num)
                        
                        if SudokuSolutions.is_valid_sudoku(board):
                            result = SudokuSolutions.solve_sudoku(board)
                            if result != None:
                                return result
                        
                        board[row][col] = '.'
                        num += 1
                    
                    return None
                col += 1
            row += 1
        
        return board
    
    @staticmethod
    def test_correctness(board: List[List[str]], other_board: List[List[str]]) -> bool:
        
        # If any cells are blank, represented by '.' 
        # user solution is automatically incomplete/wrong.
        
        # Comapre solved problem to user input.
        return board == SudokuSolutions.solve_sudoku(other_board)