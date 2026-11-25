"""One-off cleanup: removes inbox threads that were opened from stray mail (verification codes, receipts, newsletters)
back when the CMS imported mail from anyone. Only threads that came in by email (source = 'email') and that nobody on
staff ever answered are touched. Customers who used the contact form are never touched.

    python -m scripts.purge_stray_mail            # shows what WOULD be removed
    python -m scripts.purge_stray_mail --delete   # removes it
"""
import sys

sys.path.insert(0, ".")

from db.session import SessionLocal  # noqa: E402
from models.submission import ContactReply, ContactSubmission  # noqa: E402


def main() -> None:
    delete = "--delete" in sys.argv
    db = SessionLocal()
    try:
        answered = {r[0] for r in db.query(ContactReply.submission_id).filter(ContactReply.direction != "in").all()}
        threads = db.query(ContactSubmission).filter(ContactSubmission.source == "email").all()
        stray = [t for t in threads if t.id not in answered]
        for t in stray:
            print(f"{'REMOVING' if delete else 'would remove'}: {t.created_at:%Y-%m-%d} | {t.email} | {t.subject}")
        if delete and stray:
            ids = [t.id for t in stray]
            db.query(ContactReply).filter(ContactReply.submission_id.in_(ids)).delete(synchronize_session=False)
            db.query(ContactSubmission).filter(ContactSubmission.id.in_(ids)).delete(synchronize_session=False)
            db.commit()
        print(f"{len(stray)} thread(s) {'removed' if delete else 'found'}.")
        if not delete and stray:
            print("Run again with --delete to remove them.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
