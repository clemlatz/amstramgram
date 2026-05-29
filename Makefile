PYTHON := .venv/bin/python
PIP    := .venv/bin/pip

.PHONY: install test start dev import

install:
	python3 -m venv .venv
	$(PIP) install -r api/requirements.txt

test:
	$(PYTHON) -m pytest tests/ -v

start:
	$(PYTHON) -m api

dev:
	$(PYTHON) -m api & npm --prefix frontend run dev & wait

import:
	$(PYTHON) import_media.py
