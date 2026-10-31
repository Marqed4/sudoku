from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from PIL import Image
import traceback
from SudokuSolutions import SudokuSolutions
from Hints import Hints
from CreateNewBoard import CreateNewBoard
from ImageToArray import ImageToArray
from Pong import Pong
import sudoku_engine as engine

# Backend uses 2000
# Frontend uses 2001
# Frontend uses 2002

app = Flask(__name__, static_folder = '../frontend/dist', static_url_path='')
CORS(app, origins=["http://localhost:2001",
                    "https://sudoku.marqed.it",
                    "https://sudoku-7qqp.onrender.com"])

@app.route('/')
def serve():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(app.static_folder, path)

# Pull the board out of a request body, validating shape and values.
# Pass originalBoard to work from the unadulterated puzzle, board for the current state.
def board_from_request(data):
    board = data.get('originalBoard', data.get('board'))
    if board is None:
        raise ValueError("No board in request")
    engine.parse_board(board)  # raises ValueError on bad shape or values
    return board

@app.errorhandler(ValueError)
def handle_value_error(e):
    return jsonify({ "error": str(e) }), 400

# Lightweight liveness check, handy for uptime monitors that keep the free tier awake.
@app.route('/api/health', methods = ['GET'])
def health():
    return jsonify({ "status": "ok" })

# <---- Game Logic ---->

# Determine if puzzle is solvable.
@app.route('/api/is_valid_sudoku', methods = ['POST'])
def is_valid_sudoku():
    data = request.get_json()
    if data is None:
        return jsonify({ "error": "No JSON body received" }), 400
    board = board_from_request(data)
    # "is_valid" = no conflicts; "is_solvable" = has a solution.
    return jsonify({ "is_valid": SudokuSolutions.is_valid_sudoku(board),
                     "is_solvable": SudokuSolutions.is_solvable(board) })

# Determine solution to puzzle.
@app.route('/api/solve_sudoku', methods = ['POST'])
def solve_sudoku():
    data = request.get_json()
    if data is None:
        return jsonify({ "error": "No JSON body received" }), 400
    
    board = board_from_request(data)
    result = SudokuSolutions.solve_sudoku(board)
    if result is None:
        return jsonify({ "error": "The current board is not solvable" }), 422
    return jsonify({ "solved_board": result })

@app.route('/api/get_hint', methods = ['POST'])
def get_hint():
    data = request.get_json()
    if data is None:
        return jsonify({ "error": "No JSON body received" }), 400
    
    board = board_from_request(data)
    how_many_hints = data.get('hints', 1)
    if not isinstance(how_many_hints, int) or not 0 <= how_many_hints <= 81:
        return jsonify({ "error": "hints must be an integer from 0 to 81" }), 400

    if not SudokuSolutions.is_solvable(board):
        return jsonify({ "error": "The current board is not solvable" }), 422

    new_board, hint_locations = Hints.get_hint(board, how_many_hints)
    return jsonify({ "board": new_board, "hint_locations": hint_locations })

# <---- New Game ---->

# Generate random sudoku problem.
# Optional ?difficulty=easy|medium|hard (graded by solving technique, unique solution).
@app.route('/api/generate_random_sudoku_puzzle', methods = ['GET'])
def generate_random_sudoku_puzzle():
    difficulty = request.args.get('difficulty', 'medium')
    if difficulty not in engine.CLUE_TARGETS:
        return jsonify({ "error": "difficulty must be easy, medium or hard" }), 400
    array = CreateNewBoard.generate_random_sudoku_puzzle(difficulty)
    return jsonify({ "array": array })

# <---- Test Functions ---->

# Retrieve default unsolved test sudoku problem.
@app.route('/api/give_test_puzzle', methods = ['GET'])
def give_test_puzzle():
    array = CreateNewBoard.give_test_puzzle()
    return jsonify({ "array": array })

# Retrieve default solved test sudoku problem.
@app.route('/api/give_solves_test_puzzle', methods = ['GET'])
def give_solves_test_puzzle():
    array = CreateNewBoard.give_solves_test_puzzle()
    return jsonify({ "array": array })

@app.route('/api/is_board_state_correct', methods = ['POST'])
def is_board_state_correct():
    data = request.get_json()
    if data is None:
        return jsonify({ "error": "No JSON body received" }), 400
    solved_board = data.get('solved_board')
    current_board = data.get('board')
    if solved_board is None or current_board is None:
        return jsonify({ "error": "solved_board and board are required" }), 400
    result = SudokuSolutions.test_correctness(solved_board, current_board )
    return jsonify({ "result": result })

# <---- Image Scanner ---->

# Important note: Whatever is scanned is added to the board permanently. 
# If the user doesn't scan the unadulturated problem and what is added 
# into a cell is ultimately incorrect there is nothing this program can do to solve that.
# It would just be an unsolvable problem. Hense "Validate" returns unsolvable.

# Turn an image object into an array.
@app.route('/api/get_array_from_image', methods = ['POST'])
def get_array_from_image():
    if 'image' not in request.files:
        return jsonify({ "error": "No image received" }), 400
    
    file = request.files['image']
    
    # Try to parse image data complete data pipeline with PIL.
    try:
        image = Image.open(file.stream)
        image.load()
        array = ImageToArray.get_array_from_image(image)
        return jsonify({ "array": array })
    except Exception as e:
        traceback.print_exc()
        return jsonify({ "error": str(e) }), 500
    
# <---- Pong (Secret Game) ---->
 
# Create a fresh pong game state.
@app.route('/api/pong/new_game', methods = ['GET'])
def pong_new_game():
    state = Pong.new_game()
    return jsonify({ "state": state })
 
# Advance pong by one tick.
# Pass back the "state" from the previous response along with the player's move.
# Returns the new state plus whether the ball still exists, who hit it last,
# and whether the player has won.
@app.route('/api/pong/step', methods = ['POST'])
def pong_step():
    data = request.get_json()
    if data is None:
        return jsonify({ "error": "No JSON body received" }), 400
 
    state = data.get('state')
    direction = data.get('direction', 'stay')
 
    if direction not in ('up', 'down', 'stay'):
        return jsonify({ "error": "direction must be up, down or stay" }), 400
 
    if not Pong.is_valid_state(state):
        return jsonify({ "error": "Invalid game state" }), 400
 
    result = Pong.step(state, direction)
    return jsonify({
        "state": result,
        "ball_exists": result["ball_exists"],
        "last_hit": result["last_hit"],
        "player_won": result["player_won"]
    })

# Backending with debug options are running on port 2000.
if __name__ == '__main__':
    app.run(debug=True, port=2000)