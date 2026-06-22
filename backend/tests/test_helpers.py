from core.helpers import safe_code_block


class TestSafeCodeBlock:
    def test_escapes_curly_braces(self):
        result = safe_code_block("ts", "{{ var }}")
        assert "{{{{ var }}}}" in result

    def test_preserves_normal_code(self):
        result = safe_code_block("ts", "const x = 1;")
        assert "const x = 1;" in result
        assert result.startswith("```ts")
        assert result.endswith("```")

    def test_truncates_long_code(self):
        long = "a" * 10000
        result = safe_code_block("ts", long, max_len=100)
        assert len(result) < len(long)

    def test_empty_code(self):
        result = safe_code_block("ts", "")
        assert "```ts\n\n```" == result

    def test_different_labels(self):
        py = safe_code_block("python", "print(1)")
        js = safe_code_block("javascript", "console.log(1)")
        assert "```python" in py
        assert "```javascript" in js