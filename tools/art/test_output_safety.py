"""Regression tests for non-destructive art output generation.

Run from the repository root with:
    python -m unittest tools.art.test_output_safety
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from tools.art.finalize import process as finalize_character
from tools.art.tile_finalize import finalize_tile


class ExclusiveOutputTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "source.png"
        Image.new("RGBA", (12, 12), (180, 110, 70, 255)).save(self.source)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _character_args(self, prefix: Path) -> tuple[Path, Path, tuple[int, int], Path]:
        palette = self.root / "palette.json"
        palette.write_text(json.dumps({"anchors": {"outline": "#3b2418"}}), encoding="utf-8")
        return self.source, prefix, (8, 8), palette

    def _assert_refuses_overwrite(self, writer, args: tuple[object, ...], target: Path) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        sentinel = b"preserve this approved output\x00\xff"
        target.write_bytes(sentinel)
        with self.assertRaises(FileExistsError):
            writer(*args)
        self.assertEqual(target.read_bytes(), sentinel)

    def test_character_finalizer_creates_png_and_refuses_existing_output(self) -> None:
        prefix = self.root / "characters" / "sample"
        args = self._character_args(prefix)
        target = prefix.with_name(prefix.name + "-2x.png")

        finalize_character(*args)
        with Image.open(target) as result:
            self.assertEqual(result.size, (16, 16))
            self.assertEqual(result.mode, "RGBA")

        self._assert_refuses_overwrite(finalize_character, args, target)

    def test_tile_finalizer_creates_png_and_refuses_existing_output(self) -> None:
        prefix = self.root / "tiles" / "sample"
        args = (self.source, prefix, False, True)
        target = prefix.with_name(prefix.name + "-2x.png")

        finalize_tile(*args)
        with Image.open(target) as result:
            self.assertEqual(result.size, (128, 128))
            self.assertEqual(result.mode, "RGBA")

        self._assert_refuses_overwrite(finalize_tile, args, target)


if __name__ == "__main__":
    unittest.main()
