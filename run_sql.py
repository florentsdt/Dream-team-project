"""Run a .sql file against a SQLite database and print the result of every SELECT.
Usage: python run_sql.py queries.sql [database.db]      (default database: demo.db, created from schema.sql if needed)"""
import os, sqlite3, sys

BASE = os.path.dirname(os.path.abspath(__file__))
sql_file = sys.argv[1] if len(sys.argv) > 1 else "queries.sql"
db_file = sys.argv[2] if len(sys.argv) > 2 else "demo.db"

con = sqlite3.connect(db_file)
with open(os.path.join(BASE, "schema.sql"), encoding="utf-8") as f:
    con.executescript(f.read())

buf = ""
with open(sql_file, encoding="utf-8") as f:
    for line in f:
        buf += line
        if not sqlite3.complete_statement(buf):
            continue
        stmt, buf = buf.strip(), ""
        cur = con.execute(stmt)
        if cur.description:  # a SELECT: print it as a small table
            head = [d[0] for d in cur.description]
            rows = [["" if v is None else str(v) for v in r] for r in cur.fetchall()]
            widths = [max(len(h), *(len(r[i]) for r in rows)) if rows else len(h) for i, h in enumerate(head)]
            title = next(l for l in stmt.splitlines() if l.strip() and not l.lstrip().startswith("--"))
            print("\n" + title.strip()[:70] + " ...")
            print(" | ".join(h.ljust(w) for h, w in zip(head, widths)))
            print("-+-".join("-" * w for w in widths))
            for r in rows:
                print(" | ".join(v.ljust(w) for v, w in zip(r, widths)))
con.commit()
con.close()
print(f"\nDone: {sql_file} executed on {db_file}.")
