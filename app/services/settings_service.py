from sqlalchemy.orm import Session
from ..models import SystemSettings


def get_setting(db: Session, key: str, default=None):
    row = db.query(SystemSettings).filter_by(key=key).first()
    return row.value if row else default


def set_setting(db: Session, key: str, value: str):
    row = db.query(SystemSettings).filter_by(key=key).first()
    if row:
        row.value = value
    else:
        db.add(SystemSettings(key=key, value=value))
    db.commit()


def get_all_settings(db: Session):
    return {r.key: r.value for r in db.query(SystemSettings).all()}
