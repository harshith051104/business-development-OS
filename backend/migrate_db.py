import sqlite3
import os

MIGRATIONS = [
    ("organizations", "owner_id", "INTEGER"),
    ("contacts", "owner_id", "INTEGER"),
    ("campaigns", "owner_id", "INTEGER"),
    ("meetings", "owner_id", "INTEGER"),
    ("followups", "owner_id", "INTEGER"),
]

for db_path in ["bd_portal.db", "sql_app.db"]:
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        for table, col, col_type in MIGRATIONS:
            try:
                cursor.execute(f"PRAGMA table_info({table})")
                cols = [row[1] for row in cursor.fetchall()]
                if cols and col not in cols:
                    print(f"Adding {col} to {db_path} {table} table...")
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
                    conn.commit()
                    print(f"Successfully added {col} to {table}")
                else:
                    print(f"{col} already exists or table {table} not found in {db_path}")
            except Exception as e:
                print(f"Error with {table}.{col} in {db_path}: {e}")
        conn.close()
