PYTHON := .venv/bin/python

test:
	$(PYTHON) -m pytest tests/ -v

.PHONY: test

start:
	python3 -m venv .venv
	source .venv/bin/activate   
	pip install -r api/requirements.txt
	python -m api

