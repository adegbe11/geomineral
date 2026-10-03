"""Operator-only role assignment; no client can choose its role."""
import argparse
from sqlalchemy import select
from geomineral.db import SessionLocal, User

parser = argparse.ArgumentParser()
parser.add_argument('email')
args = parser.parse_args()
with SessionLocal() as db:
    user = db.scalar(select(User).where(User.email == args.email.strip().lower()))
    if not user:
        raise SystemExit('Register the account first.')
    user.is_admin = True
    db.commit()
    print('Administrator role assigned to the specified account.')
