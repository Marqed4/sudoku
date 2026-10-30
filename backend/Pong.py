import random
from typing import Optional

class Pong:

    # Board is SIZE x SIZE. Must match SIZE in Pong.jsx on the frontend.
    SIZE = 27
    PADDLE_SIZE = 3
    WIN_SCORE = 5

    # Chance (0 to 1) the computer reacts on a given tick. Lower is easier.
    COMPUTER_REACTION = 20

    # <---- New Game ---->

    # Create a fresh game state.
    @staticmethod
    def new_game() -> dict:
        top = (Pong.SIZE - Pong.PADDLE_SIZE) // 2
        state = {
            "player_top": top,
            "computer_top": top,
            "player_score": 0,
            "computer_score": 0,
            "game_over": False,
            "player_won": False,
        }
        return Pong.serve(state, random.choice([-1, 1]))

    # Put a new ball in the middle of the board.
    # direction: -1 sends it toward the player, 1 toward the computer.
    @staticmethod
    def serve(state: dict, direction: int) -> dict:
        state["ball_row"] = Pong.SIZE // 2
        state["ball_col"] = Pong.SIZE // 2
        state["dr"] = random.choice([-1, 1])
        state["dc"] = direction
        state["ball_exists"] = True
        state["last_hit"] = None
        state["paddle_hit"] = False
        return state

    # <---- Game Logic ---->

    # Advance the game by one tick.
    # direction is the player's move: "up", "down" or "stay".
    @staticmethod
    def step(state: dict, direction: str) -> dict:
        # Work on a copy so the caller's state is never changed.
        state = dict(state)

        # Nothing left to move once someone has won.
        if state["game_over"]:
            return state

        # The last ball is gone, so serve a new one toward whoever just missed.
        # A missed ball is left on column 0 (player missed) or the last column (computer missed).
        if not state["ball_exists"]:
            serve_direction = -1 if state["ball_col"] == 0 else 1
            return Pong.serve(state, serve_direction)

        state["paddle_hit"] = False
        Pong.move_player(state, direction)
        Pong.move_computer(state)
        Pong.move_ball(state)
        Pong.check_winner(state)
        return state

    # Move the player's paddle one cell, staying inside the board.
    @staticmethod
    def move_player(state: dict, direction: str) -> None:
        if direction == "up" and state["player_top"] > 0:
            state["player_top"] -= 1
        elif direction == "down" and state["player_top"] < Pong.SIZE - Pong.PADDLE_SIZE:
            state["player_top"] += 1

    # Move the computer's paddle toward the ball.
    # It skips some ticks on purpose so it can be beaten.
    @staticmethod
    def move_computer(state: dict) -> None:
        if random.random() > Pong.COMPUTER_REACTION:
            return

        center = state["computer_top"] + Pong.PADDLE_SIZE // 2
        if state["ball_row"] < center and state["computer_top"] > 0:
            state["computer_top"] -= 1
        elif state["ball_row"] > center and state["computer_top"] < Pong.SIZE - Pong.PADDLE_SIZE:
            state["computer_top"] += 1

    # How does the ball meet the paddle that starts at paddle_top?
    # "face": the ball lands on one of the paddle's cells.
    # "edge": the ball lands on the cell just above the top or just below the
    #         bottom while moving toward the paddle, so it clips the corner.
    # None: a miss.
    @staticmethod
    def paddle_contact(paddle_top: int, ball_row: int, dr: int) -> Optional[str]:
        if paddle_top <= ball_row < paddle_top + Pong.PADDLE_SIZE:
            return "face"
        if ball_row == paddle_top - 1 and dr == 1:
            return "edge"
        if ball_row == paddle_top + Pong.PADDLE_SIZE and dr == -1:
            return "edge"
        return None

    # Send the ball back the way it came. An edge hit also flips the vertical
    # direction, so the ball glances off the corner.
    @staticmethod
    def bounce_off_paddle(state: dict, contact: str, new_dc: int, hitter: str) -> None:
        state["dc"] = new_dc
        if contact == "edge":
            state["dr"] = -state["dr"]
        state["last_hit"] = hitter
        state["paddle_hit"] = True

    # Move the ball one cell and handle walls, paddles and misses.
    @staticmethod
    def move_ball(state: dict) -> None:
        # Bounce off the top and bottom walls.
        if not 0 <= state["ball_row"] + state["dr"] < Pong.SIZE:
            state["dr"] = -state["dr"]
        state["ball_row"] += state["dr"]

        next_col = state["ball_col"] + state["dc"]

        # Ball reached the player's side.
        if next_col <= 0:
            contact = Pong.paddle_contact(state["player_top"], state["ball_row"], state["dr"])
            if contact:
                Pong.bounce_off_paddle(state, contact, 1, "player")
            else:
                # Player missed, so the ball no longer exists and the computer scores.
                state["computer_score"] += 1
                state["ball_exists"] = False
                state["ball_col"] = 0
                return

        # Ball reached the computer's side.
        elif next_col >= Pong.SIZE - 1:
            contact = Pong.paddle_contact(state["computer_top"], state["ball_row"], state["dr"])
            if contact:
                Pong.bounce_off_paddle(state, contact, -1, "computer")
            else:
                # Computer missed, so the ball no longer exists and the player scores.
                state["player_score"] += 1
                state["ball_exists"] = False
                state["ball_col"] = Pong.SIZE - 1
                return

        state["ball_col"] += state["dc"]

    # End the game once someone reaches WIN_SCORE.
    @staticmethod
    def check_winner(state: dict) -> None:
        if state["player_score"] >= Pong.WIN_SCORE:
            state["game_over"] = True
            state["player_won"] = True
        elif state["computer_score"] >= Pong.WIN_SCORE:
            state["game_over"] = True
            state["player_won"] = False

    # <---- Validation ---->

    # Make sure a state sent from the frontend has everything step() needs.
    @staticmethod
    def is_valid_state(state: Optional[dict]) -> bool:
        if not isinstance(state, dict):
            return False

        required = ["player_top", "computer_top", "player_score", "computer_score",
                    "ball_row", "ball_col", "dr", "dc", "ball_exists",
                    "last_hit", "paddle_hit", "game_over", "player_won"]
        if any(key not in state for key in required):
            return False

        max_top = Pong.SIZE - Pong.PADDLE_SIZE
        return (0 <= state["player_top"] <= max_top
                and 0 <= state["computer_top"] <= max_top
                and 0 <= state["ball_row"] < Pong.SIZE
                and 0 <= state["ball_col"] < Pong.SIZE
                and state["dr"] in (-1, 1)
                and state["dc"] in (-1, 1)
                and state["last_hit"] in (None, "player", "computer"))