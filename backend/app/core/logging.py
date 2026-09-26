"""Log yapilandirmasi. Parola, token ve kisisel veri loglanmaz (KOD_KURALLARI §14)."""

import logging

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


def configure_logging(level: str) -> None:
    logging.basicConfig(level=level.upper(), format=LOG_FORMAT, force=True)
