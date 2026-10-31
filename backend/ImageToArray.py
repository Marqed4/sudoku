from google.genai import types
from dotenv import load_dotenv
from typing import List
from google import genai
from pathlib import Path
from PIL import Image
import json
import sudoku_engine as engine
import os

class ImageToArray:
    MODEL = "gemini-2.5-flash"

    # puzzle_img is a PIL Image sent to Gemini with a text prompt.
    # Returns a validated 9x9 board of '.' / '1'-'9' strings.
    @staticmethod
    def get_array_from_image(puzzle_img: Image.Image) -> List[List[str]]:
        
        # .env lives next to this file (Path(__file__) itself is a file, not a directory).
        env_path = Path(__file__).parent / ".env"
        load_dotenv(dotenv_path = env_path)
        
        api_key = os.getenv("GEMINI_API_KEY")
        client = genai.Client(api_key = api_key)

        image = puzzle_img
        
        # Directions TL;DR Scan sudoku puzzle, return 9x9 JSON array.
        prompt = ("Scan this sudoku puzzle and return ONLY a 9x9 JSON array."
        "Use '.' for empty cells. No explanation,"
        "no markdown, just the raw JSON array.")
        
        response = client.models.generate_content(
            # Supports: png, jpeg, webp, heic, heif
            # Preferably using gemini 1.5, anything that
            # uses the least amount of tokens.
            
            # For some reason 2.0 never works, use gemini-2.5-flash-
            model    = ImageToArray.MODEL,
            contents = [prompt, image],
            config   = types.GenerateContentConfig(
                response_mime_type = "application/json"
            )
        )
        
        # Print Gemini's response.
        raw = response.text
        print("RAW RESPONSE:", repr(raw))
        
        # Strip markdown fences if the model adds them anyway, then validate
        # shape and values so a bad scan fails here instead of deep in the solver.
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        array = json.loads(cleaned)
        return engine.to_board(engine.parse_board(array))