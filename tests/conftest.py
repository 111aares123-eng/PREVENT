"""
Shared pytest configuration.
Must run before any backend module is imported, so the settings object picks this up.
Points the test suite at its own SQLite file, so running pytest never wipes or re-dates
the demo database (prevent.db).
"""
import os

os.environ["DATABASE_URL"] = "sqlite:///./prevent_test.db"
