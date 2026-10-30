from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from PIL import Image
import traceback
from SudokuSolutions import SudokuSolutions
from Hints import Hints
from CreateNewBoard import CreateNewBoard
from ImageToArray import ImageToArray
from Pong import Pong

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

# <---- Game Logic ---->

# Determine if puzzle is solvable.
@app.route('/api/is_valid_sudoku', methods = ['POST'])
def is_valid_sudoku():
    data = request.get_json()
    if data is None:
        return jsonify({ "error": "No JSON body received" }), 400
    board = data['originalBoard']
    result = SudokuSolutions.is_valid_sudoku(board)
    return jsonify({ "is_valid": result })

# Determine solution to puzzle.
@app.route('/api/solve_sudoku', methods = ['POST'])
def solve_sudoku():
    data = request.get_json()
    if data is None:
        return jsonify({ "error": "No JSON body received" }), 400
    
    board = []
    
    # Pass original board when retrieving unadulturated board
    # Pass localstate/local storage board when retrieving unadulturated board
    try:
        board = data['originalBoard']
    except KeyError:
        board = data['board']
        
    result = SudokuSolutions.solve_sudoku(board)
    return jsonify({ "solved_board": result })

@app.route('/api/get_hint', methods = ['POST'])
def get_hint():
    data = request.get_json()
    if data is None:
        return jsonify({ "error": "No JSON body received" }), 400
    
    board = []
    how_many_hints = data.get('hints', 1)
    
    # Pass original board when retrieving unadulturated board
    # Pass localstate/local storage board when retrieving unadulturated board
    try:
        board = data['originalBoard']
    except KeyError:
        board = data['board']
        
    if not SudokuSolutions.is_valid_sudoku(board):
        return jsonify({ "error": "The current board is not solvable" }), 400
    
    # result stores the tujple that is the result of calling get_hint.
    result = Hints.get_hint(board, how_many_hints)
    return jsonify({ "board" : result[0], "hint_locations": result[1]})

# <---- New Game ---->

# Generate random sudoku problem.
@app.route('/api/generate_random_sudoku_puzzle', methods = ['GET'])
def generate_random_sudoku_puzzle():
    array = CreateNewBoard.generate_ranodom_sudoku_puzzle()
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
    solved_board = data['solved_board']
    current_board = data['board']
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