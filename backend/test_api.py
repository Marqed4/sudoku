import unittest

from Main import app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_health(self):
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json(), {"status": "ok"})

    def test_generate_rejects_bad_difficulty(self):
        r = self.client.get("/api/generate_random_sudoku_puzzle?difficulty=nope")
        self.assertEqual(r.status_code, 400)

    def test_malformed_board_is_400(self):
        r = self.client.post("/api/solve_sudoku", json={"board": [[1, 2]]})
        self.assertEqual(r.status_code, 400)

    def test_unsolvable_board_is_422(self):
        b = [["."] * 9 for _ in range(9)]
        b[0][:8] = list("12345678")
        b[1][8] = "9"
        r = self.client.post("/api/solve_sudoku", json={"board": b})
        self.assertEqual(r.status_code, 422)

    def test_generate_then_solve_round_trip(self):
        puzzle = self.client.get("/api/generate_random_sudoku_puzzle?difficulty=easy").get_json()["array"]
        r = self.client.post("/api/solve_sudoku", json={"originalBoard": puzzle})
        self.assertEqual(r.status_code, 200)


if __name__ == "__main__":
    unittest.main()
