import os
import shutil

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def cleanup():
    db_file = os.path.join(backend_dir, "test_e2e.db")
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
            print("Removed test_e2e.db")
        except OSError:
            pass
    evidence_dir = os.path.join(backend_dir, "storage", "test_evidence")
    if os.path.exists(evidence_dir):
        try:
            shutil.rmtree(evidence_dir)
            print("Cleaned up storage/test_evidence")
        except OSError:
            pass


if __name__ == "__main__":
    cleanup()
