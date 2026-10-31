import os
import time

from app.services import backup_service


def test_db_file_path_resolves_sqlite_url(monkeypatch):
    monkeypatch.setattr(backup_service.settings, "DATABASE_URL", "sqlite:///./bd_portal.db")
    path = backup_service._db_file_path()
    assert path is not None
    assert path.endswith("bd_portal.db")


def test_db_file_path_none_for_non_sqlite(monkeypatch):
    monkeypatch.setattr(
        backup_service.settings, "DATABASE_URL", "postgresql://user:pass@host/db"
    )
    assert backup_service._db_file_path() is None


def test_run_backup_skips_when_db_missing(tmp_path, monkeypatch):
    missing_db = tmp_path / "nope.db"
    monkeypatch.setattr(backup_service, "_db_file_path", lambda: str(missing_db))
    monkeypatch.setattr(backup_service, "BACKUP_DIR", str(tmp_path / "backups"))

    assert backup_service.run_backup() is None


def test_run_backup_creates_file_and_rotates(tmp_path, monkeypatch):
    db_file = tmp_path / "bd_portal.db"
    db_file.write_bytes(b"fake sqlite content")
    backup_dir = tmp_path / "backups"

    monkeypatch.setattr(backup_service, "_db_file_path", lambda: str(db_file))
    monkeypatch.setattr(backup_service, "BACKUP_DIR", str(backup_dir))
    monkeypatch.setattr(backup_service, "MAX_BACKUPS", 2)

    dest1 = backup_service.run_backup()
    assert dest1 is not None
    assert os.path.exists(dest1)

    # Force a distinct timestamp and a newer mtime so the next backup isn't skipped.
    time.sleep(1.1)
    db_file.write_bytes(b"fake sqlite content v2")
    dest2 = backup_service.run_backup()
    assert dest2 is not None
    assert dest2 != dest1

    time.sleep(1.1)
    db_file.write_bytes(b"fake sqlite content v3")
    dest3 = backup_service.run_backup()
    assert dest3 is not None

    remaining = sorted(
        f for f in os.listdir(backup_dir) if f.startswith("bd_portal_") and f.endswith(".db")
    )
    assert len(remaining) == 2  # MAX_BACKUPS rotation pruned the oldest


def test_run_backup_skipped_when_db_unchanged(tmp_path, monkeypatch):
    db_file = tmp_path / "bd_portal.db"
    db_file.write_bytes(b"fake sqlite content")
    backup_dir = tmp_path / "backups"

    monkeypatch.setattr(backup_service, "_db_file_path", lambda: str(db_file))
    monkeypatch.setattr(backup_service, "BACKUP_DIR", str(backup_dir))

    dest1 = backup_service.run_backup()
    assert dest1 is not None

    # No change to db_file's mtime -- a second run should be a no-op.
    dest2 = backup_service.run_backup()
    assert dest2 is None
