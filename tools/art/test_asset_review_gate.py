"""Unit tests for the opt-in asset review gate; standard library only."""

from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from tools.art.asset_review_gate import GateError, integrate_candidate


class AssetReviewGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.candidate = self.root / "candidate.png"
        self.candidate_bytes = b"exact candidate image bytes\x00\xff"
        self.candidate.write_bytes(self.candidate_bytes)
        self.approval = self.root / "approval.json"
        self.destination = self.root / "integrated.png"
        self.record = {
            "asset_key": "pet.cat",
            "sha256": hashlib.sha256(self.candidate_bytes).hexdigest(),
            "decision": "approved",
            "approver": "human",
            "approved_at": "2026-10-24",
        }
        self.write_approval()

    def tearDown(self) -> None:
        self.temp.cleanup()

    def write_approval(self, **overrides: str) -> None:
        record = {**self.record, **overrides}
        self.approval.write_text(json.dumps(record), encoding="utf-8")

    def assert_rejected_without_output(self, approval: Path | None = None, key: str = "pet.cat") -> None:
        with self.assertRaises(GateError):
            integrate_candidate(approval, key, self.candidate, self.destination)
        self.assertFalse(self.destination.exists())
        self.assertFalse(Path(f"{self.destination}.provenance.json").exists())

    def test_missing_approval_fails_closed(self) -> None:
        with self.assertRaisesRegex(GateError, "必須提供") as caught:
            integrate_candidate(None, "pet.cat", self.candidate, self.destination)
        self.assertEqual(caught.exception.reason, "approval_missing")
        self.assert_rejected_without_output(None)

    def test_rejected_decision_fails_closed(self) -> None:
        self.write_approval(decision="rejected")
        with self.assertRaises(GateError) as caught:
            integrate_candidate(self.approval, "pet.cat", self.candidate, self.destination)
        self.assertEqual(caught.exception.reason, "approval_rejected")
        self.assertFalse(self.destination.exists())

    def test_wrong_asset_key_fails_closed(self) -> None:
        with self.assertRaises(GateError) as caught:
            integrate_candidate(self.approval, "pet.marsupial", self.candidate, self.destination)
        self.assertEqual(caught.exception.reason, "asset_key_mismatch")
        self.assertFalse(self.destination.exists())

    def test_sha256_mismatch_fails_closed(self) -> None:
        self.write_approval(sha256="0" * 64)
        with self.assertRaises(GateError) as caught:
            integrate_candidate(self.approval, "pet.cat", self.candidate, self.destination)
        self.assertEqual(caught.exception.reason, "sha256_mismatch")
        self.assertFalse(self.destination.exists())

    def test_exact_approved_hash_installs_identical_bytes_and_traceable_provenance(self) -> None:
        result = integrate_candidate(self.approval, "pet.cat", self.candidate, self.destination)
        self.assertEqual(self.destination.read_bytes(), self.candidate_bytes)
        provenance_path = Path(f"{self.destination}.provenance.json")
        provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
        self.assertEqual(result["sha256"], self.record["sha256"])
        self.assertEqual(provenance["asset_key"], "pet.cat")
        self.assertEqual(provenance["sha256"], hashlib.sha256(self.destination.read_bytes()).hexdigest())
        self.assertEqual(provenance["decision"], "approved")
        self.assertEqual(provenance["approver"], "human")
        self.assertEqual(provenance["approved_at"], "2026-10-24")
        self.assertEqual(provenance["approval_record_sha256"], hashlib.sha256(self.approval.read_bytes()).hexdigest())
        self.assertEqual(provenance["candidate_filename"], self.candidate.name)
        self.assertEqual(provenance["integrated_filename"], self.destination.name)
        self.assertRegex(provenance["integrated_at"], r"^\d{4}-\d{2}-\d{2}T.*Z$")

    def test_existing_destination_bytes_are_never_changed(self) -> None:
        sentinel = b"approved output must remain untouched"
        self.destination.write_bytes(sentinel)
        with self.assertRaises(GateError) as caught:
            integrate_candidate(self.approval, "pet.cat", self.candidate, self.destination)
        self.assertEqual(caught.exception.reason, "destination_exists")
        self.assertEqual(self.destination.read_bytes(), sentinel)
        self.assertFalse(Path(f"{self.destination}.provenance.json").exists())

    def test_existing_provenance_is_never_changed(self) -> None:
        sentinel = b"existing provenance"
        provenance = Path(f"{self.destination}.provenance.json")
        provenance.write_bytes(sentinel)
        with self.assertRaises(GateError) as caught:
            integrate_candidate(self.approval, "pet.cat", self.candidate, self.destination)
        self.assertEqual(caught.exception.reason, "provenance_exists")
        self.assertEqual(provenance.read_bytes(), sentinel)
        self.assertFalse(self.destination.exists())

    def test_malformed_or_ambiguous_approval_fails_closed(self) -> None:
        self.approval.write_text(
            '{"asset_key":"pet.cat","asset_key":"pet.marsupial"}', encoding="utf-8"
        )
        with self.assertRaises(GateError) as caught:
            integrate_candidate(self.approval, "pet.cat", self.candidate, self.destination)
        self.assertEqual(caught.exception.reason, "approval_invalid")
        self.assertFalse(self.destination.exists())


if __name__ == "__main__":
    unittest.main()
