"""Opt-in exact-human-approval gate for integrating one reviewed art candidate.

This tool does not generate art, update content/assets.json, or infer visual
quality. It copies candidate bytes only when a human-authored JSON record says
"approved" for the exact asset key and SHA-256. The destination is created
exclusively and its adjacent ``<destination>.provenance.json`` records the
approval and content hashes.

Approval record schema (all fields required; extra fields are rejected)::

    {
      "asset_key": "pet.cat",
      "sha256": "<64 lowercase hexadecimal characters>",
      "decision": "approved",
      "approver": "human",
      "approved_at": "2026-10-24"
    }

The image and provenance are each installed with an exclusive hard link from
temporary files on the destination filesystem. Provenance is linked first, so
an installed image is never left without its provenance. If the process is
interrupted between the two links, an orphan provenance sidecar may remain;
there is no image at that destination, and an operator must inspect/remove the
orphan before retrying. Filesystems without hard-link support fail closed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any


class GateError(Exception):
    """A stable, fail-closed approval or integration error."""

    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason


def _read_regular_file(path: Path, label: str) -> bytes:
    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        fd = os.open(path, flags)
    except FileNotFoundError as exc:
        raise GateError(f"{label}_missing", f"{label} 檔案不存在：{path}") from exc
    except OSError as exc:
        raise GateError(f"{label}_unreadable", f"無法安全讀取 {label} 檔案：{path}") from exc

    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise GateError(f"{label}_not_regular", f"{label} 必須是一般檔案：{path}")
        chunks: list[bytes] = []
        while True:
            chunk = os.read(fd, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        return b"".join(chunks)
    finally:
        os.close(fd)


def _unique_json_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"重複欄位：{key}")
        result[key] = value
    return result


def _parse_approval(raw: bytes) -> dict[str, str]:
    try:
        record = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_json_object)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise GateError("approval_invalid", f"核准紀錄不是有效 JSON：{exc}") from exc
    required = {"asset_key", "sha256", "decision", "approver", "approved_at"}
    if not isinstance(record, dict) or set(record) != required:
        raise GateError("approval_invalid", f"核准紀錄欄位必須恰為：{', '.join(sorted(required))}")
    if any(not isinstance(record[key], str) or not record[key].strip() for key in required):
        raise GateError("approval_invalid", "核准紀錄的所有欄位都必須是非空字串")
    if record["decision"] != "approved":
        if record["decision"] == "rejected":
            raise GateError("approval_rejected", "人工核准紀錄的決定是 rejected")
        raise GateError("approval_invalid", "decision 只能是 approved 或 rejected")
    if not re.fullmatch(r"[0-9a-f]{64}", record["sha256"]):
        raise GateError("approval_invalid", "sha256 必須是 64 位小寫十六進位 SHA-256")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", record["approved_at"]):
        raise GateError("approval_invalid", "approved_at 必須使用 ISO YYYY-MM-DD 日期")
    try:
        date.fromisoformat(record["approved_at"])
    except ValueError as exc:
        raise GateError("approval_invalid", "approved_at 必須使用 ISO YYYY-MM-DD 日期") from exc
    return record


def _write_temp(parent: Path, prefix: str, data: bytes) -> Path:
    fd, name = tempfile.mkstemp(prefix=prefix, dir=parent)
    path = Path(name)
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
    except BaseException:
        try:
            path.unlink()
        except FileNotFoundError:
            pass
        raise
    return path


def _remove_owned_link(link: Path, temporary: Path) -> bool:
    """Remove a sidecar only if it is still the hard link created by this run."""
    try:
        if os.path.samefile(link, temporary):
            link.unlink()
            return True
    except FileNotFoundError:
        return True
    except OSError:
        return False
    return False


def _sync_directory(path: Path) -> None:
    flags = os.O_RDONLY
    if hasattr(os, "O_DIRECTORY"):
        flags |= os.O_DIRECTORY
    fd = os.open(path, flags)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def integrate_candidate(
    approval_path: Path | None,
    asset_key: str,
    candidate_path: Path,
    destination_path: Path,
) -> dict[str, str]:
    """Verify a human approval and install the exact bytes with provenance."""
    if approval_path is None:
        raise GateError("approval_missing", "必須提供人工核准紀錄")
    if not isinstance(asset_key, str) or not asset_key.strip():
        raise GateError("asset_key_invalid", "asset key 不可為空")

    approval_bytes = _read_regular_file(approval_path, "approval")
    record = _parse_approval(approval_bytes)
    if record["asset_key"] != asset_key:
        raise GateError("asset_key_mismatch", "核准紀錄的 asset_key 與指定 key 不同")

    candidate_bytes = _read_regular_file(candidate_path, "candidate")
    candidate_hash = hashlib.sha256(candidate_bytes).hexdigest()
    if record["sha256"] != candidate_hash:
        raise GateError("sha256_mismatch", "核准紀錄的 SHA-256 與候選檔案不同")

    try:
        parent = destination_path.parent.resolve(strict=True)
    except OSError as exc:
        raise GateError("destination_parent_unavailable", "目的地父目錄必須已存在且可解析") from exc
    if not parent.is_dir() or destination_path.name in {"", ".", ".."}:
        raise GateError("destination_invalid", "目的地必須是既有目錄中的檔案路徑")
    destination = parent / destination_path.name
    provenance = Path(f"{destination}.provenance.json")
    if os.path.lexists(destination):
        raise GateError("destination_exists", f"目的地已存在，拒絕覆寫：{destination}")
    if os.path.lexists(provenance):
        raise GateError("provenance_exists", f"provenance 已存在，拒絕覆寫：{provenance}")

    provenance_record = {
        "schema_version": 1,
        "asset_key": asset_key,
        "sha256": candidate_hash,
        "candidate_filename": candidate_path.name,
        "integrated_filename": destination.name,
        "decision": record["decision"],
        "approver": record["approver"],
        "approved_at": record["approved_at"],
        "approval_record_sha256": hashlib.sha256(approval_bytes).hexdigest(),
        "integrated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }
    provenance_bytes = (json.dumps(provenance_record, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")
    asset_temp: Path | None = None
    provenance_temp: Path | None = None
    provenance_linked = False
    try:
        asset_temp = _write_temp(parent, ".asset-review-candidate-", candidate_bytes)
        provenance_temp = _write_temp(parent, ".asset-review-provenance-", provenance_bytes)
        # Hard links provide atomic, no-clobber creation on the same filesystem.
        os.link(provenance_temp, provenance)
        provenance_linked = True
        try:
            os.link(asset_temp, destination)
        except OSError as exc:
            removed = _remove_owned_link(provenance, provenance_temp)
            detail = "" if removed else f"；孤立 provenance 留在 {provenance}，需人工檢視"
            if isinstance(exc, FileExistsError):
                raise GateError("destination_exists", f"目的地已存在，拒絕覆寫：{destination}{detail}") from exc
            raise GateError("destination_write_failed", f"無法以 exclusive hard link 安裝候選；檔案系統可能不支援 hard link{detail}") from exc
        _sync_directory(parent)
    except FileExistsError as exc:
        if provenance_linked and provenance_temp is not None:
            _remove_owned_link(provenance, provenance_temp)
        if os.path.lexists(provenance):
            raise GateError("provenance_exists", f"provenance 已存在，拒絕覆寫：{provenance}") from exc
        raise GateError("destination_exists", f"目的地或 provenance 已存在，拒絕覆寫：{destination}") from exc
    except OSError as exc:
        if provenance_linked and provenance_temp is not None and not os.path.lexists(destination):
            removed = _remove_owned_link(provenance, provenance_temp)
            detail = "" if removed else f"；孤立 provenance 留在 {provenance}，需人工檢視"
            raise GateError(
                "integration_write_failed",
                f"無法安全完成 exclusive hard-link 整合{detail}；檔案系統可能不支援 hard link",
            ) from exc
        if os.path.lexists(destination) and os.path.lexists(provenance):
            raise GateError(
                "integration_sync_failed",
                f"素材與 provenance 均已建立，但無法確認目錄同步完成；請檢查 {destination} 與 {provenance}",
            ) from exc
        raise GateError("integration_write_failed", "無法安全完成素材與 provenance 寫入") from exc
    finally:
        for temporary in (asset_temp, provenance_temp):
            if temporary is not None:
                try:
                    temporary.unlink()
                except FileNotFoundError:
                    pass

    return {
        "asset_key": asset_key,
        "sha256": candidate_hash,
        "destination": str(destination),
        "provenance": str(provenance),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--approval", type=Path, required=True, help="人類簽核 JSON 紀錄")
    parser.add_argument("--asset-key", required=True, help="例如 pet.cat")
    parser.add_argument("--candidate", type=Path, required=True, help="候選 PNG 檔案")
    parser.add_argument("--destination", type=Path, required=True, help="新輸出 PNG 路徑；不得已存在")
    args = parser.parse_args()
    try:
        result = integrate_candidate(args.approval, args.asset_key, args.candidate, args.destination)
    except GateError as exc:
        parser.exit(2, f"拒絕 [{exc.reason}]：{exc}\n")
    print(json.dumps({"status": "integrated", **result}, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
