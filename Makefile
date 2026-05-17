PYTHON := .venv/bin/python
PIP    := .venv/bin/pip

.PHONY: install test start

install:
	python3 -m venv .venv
	$(PIP) install -r api/requirements.txt

test:
	$(PYTHON) -m pytest tests/ -v

start:
	$(PYTHON) -m api
