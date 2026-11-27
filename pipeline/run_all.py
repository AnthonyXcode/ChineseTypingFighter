"""Run the whole pipeline: scrape -> clean -> segment -> annotate -> grade -> export -> validate -> report.

Usage:  .venv/bin/python -I -B pipeline/run_all.py   (from the project root)
(scrape only downloads chapters missing from data/raw/.)
"""
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # noqa: E402
sys.dont_write_bytecode = True
import scrape, clean, segment, annotate, grade, export, validate, report  # noqa: E401

for stage in (scrape, clean, segment, annotate, grade, export, validate, report):
    stage.main()
