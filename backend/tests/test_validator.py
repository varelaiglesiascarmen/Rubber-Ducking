from agents.validator import compute_diff


class TestComputeDiff:
    def test_identical_code(self):
        code = "const x = 1;\n"
        diff = compute_diff(code, code)
        assert diff == ""

    def test_different_code(self):
        original = "const x = 1;\n"
        refactored = "const x = signal(1);\n"
        diff = compute_diff(original, refactored)
        assert "+" in diff or "-" in diff