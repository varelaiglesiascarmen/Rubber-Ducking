import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import looks_like_code


def test_valid_ts_code():
    assert looks_like_code('@Component({ selector: "app-x" }) class X {}')


def test_valid_python_code():
    assert looks_like_code('def foo():\n    return 1')


def test_valid_js_with_import():
    assert looks_like_code('import React from "react";')


def test_valid_code_from_comments_only():
    assert looks_like_code('// just a comment\nconst x = 1;')


def test_gibberish_short():
    assert not looks_like_code('hfijs')


def test_gibberish_long_without_syntax():
    assert not looks_like_code('esto no es codigo es un texto largo sin sintaxis alguna')


def test_empty_and_whitespace():
    assert not looks_like_code('   ')
    assert not looks_like_code('')