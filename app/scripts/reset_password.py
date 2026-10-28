import getpass
import os
import sys

from sqlalchemy import func

from core.audit import CRITICAL, record_safe
from core.security import hash_password
from db.session import SessionLocal
from models.admin_user import AdminUser


def main():
    email = (os.getenv("RESET_EMAIL") or input("Account email: ")).strip()
    password = os.getenv("RESET_PASSWORD") or getpass.getpass("New password (min 8 characters): ")

    if len(password) < 8:
        sys.exit("Password must be at least 8 characters.")

    db = SessionLocal()
    try:
        user = db.query(AdminUser).filter(func.lower(AdminUser.email) == email.lower()).first()
        if not user:
            sys.exit(f"No account found for '{email}'.")

        user.hashed_password = hash_password(password)
        db.commit()
        record_safe(
            db, None, None, category=CRITICAL, action="password_reset", resource="auth",
            summary=f"Password for {user.email} was reset from the server",
            actor_email=user.email,
        )
        print(f"Password updated for {user.email}. You can sign in with it now.")
    finally:
        db.close()


if __name__ == "__main__":
    main()