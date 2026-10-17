"""Job Board back end: Flask + SQLite. REST API (step 04), auth (step 06), page routes."""
import os, re, sqlite3, smtplib
from email.message import EmailMessage
from flask import Flask, request, jsonify, session, g, send_from_directory, redirect, abort
from werkzeug.exceptions import HTTPException
from werkzeug.security import generate_password_hash, check_password_hash

BASE = os.path.dirname(os.path.abspath(__file__))
PAGES = os.path.join(BASE, "pages")
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE, "jobboard.db"))
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@jobboard.local").strip().lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin1234")
if len(ADMIN_PASSWORD) < 8:  # same rule as registration: refuse to start with a weak admin password
    raise SystemExit("ADMIN_PASSWORD must be at least 8 characters.")

import mimetypes
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/javascript", ".js")

app = Flask(__name__, static_folder="static")
app.config.update(SECRET_KEY=os.environ.get("SECRET_KEY", "dev-only-change-me"),
                  SESSION_COOKIE_SAMESITE="Lax", SESSION_COOKIE_HTTPONLY=True)

# ---------- database ----------
def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db

@app.teardown_appcontext
def close_db(_):
    conn = g.pop("db", None)
    if conn:
        conn.close()

def guess_months(text):
    """Contract length in months found in a free text such as '6 months' or '2 ans' (None when there is none)."""
    m = re.search(r"(\d+)\s*(mois|months?|ans?|years?)\b", text or "", re.I)
    if not m:
        return None
    n = int(m.group(1)) * (12 if m.group(2).lower() in ("an", "ans", "year", "years") else 1)
    return n or None

def init_db():
    """Create / upgrade the schema, then make sure the documented admin account exists."""
    con = sqlite3.connect(DB_PATH)
    # Migration: databases created before the `categories` table existed lack advertisements.category_id.
    cols = [r[1] for r in con.execute("PRAGMA table_info(advertisements)")]
    if cols and "category_id" not in cols:
        con.execute("ALTER TABLE advertisements ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL")
    # Migration: databases created before the duration filter lack advertisements.duration_months (filled from working_time).
    if cols and "duration_months" not in cols:
        con.execute("ALTER TABLE advertisements ADD COLUMN duration_months INTEGER CHECK (duration_months IS NULL OR duration_months > 0)")
        for ad_id, wt in con.execute("SELECT id, working_time FROM advertisements").fetchall():
            if guess_months(wt):
                con.execute("UPDATE advertisements SET duration_months = ? WHERE id = ?", (guess_months(wt), ad_id))
    with open(os.path.join(BASE, "schema.sql"), encoding="utf-8") as f:
        con.executescript(f.read())
    # The account written in the README (ADMIN_EMAIL / ADMIN_PASSWORD) must always work on a fresh install.
    # An existing admin keeps their password: it is only set when the account is missing or has no login yet.
    row = con.execute("SELECT id, role, password_hash FROM people WHERE email = ?", (ADMIN_EMAIL,)).fetchone()
    if not row:
        con.execute("INSERT INTO people (first_name,last_name,email,password_hash,role) VALUES ('Admin','Recruiter',?,?,'admin')",
                    (ADMIN_EMAIL, generate_password_hash(ADMIN_PASSWORD)))
    elif row[1] != "admin" or not row[2]:
        con.execute("UPDATE people SET role='admin', password_hash=? WHERE id=?", (generate_password_hash(ADMIN_PASSWORD), row[0]))
    con.commit()
    con.close()

def run(sql, args=()):
    """Execute a write; translate constraint errors into clean API errors."""
    try:
        cur = db().execute(sql, args)
        db().commit()
        return cur
    except sqlite3.IntegrityError as e:
        db().rollback()
        msg = str(e)
        if "UNIQUE" in msg:
            abort(409, "This record already exists (duplicate value).")
        if "FOREIGN KEY" in msg and sql.startswith("DELETE"):
            abort(409, "Cannot delete: other records still use it (e.g. a category that still has offers).")
        if "FOREIGN KEY" in msg:
            abort(400, "Unknown reference: the company, contact, category, advertisement or person does not exist.")
        if "NOT NULL" in msg:
            abort(400, "A required field cannot be empty.")
        if "CHECK" in msg:
            abort(400, "Invalid value for a restricted field (contract_type, status, role or email_sent).")
        abort(400, "Invalid value: " + msg)

# ---------- resource definitions ----------
# fields = writable columns; cols/frm = what the API returns; read = who can GET
TABLES = {
    "companies": dict(
        fields=["name", "website", "location", "description"], required=["name"], read="public",
        cols="t.*", frm="companies t", search=["t.name", "t.location"], filters={}),
    "categories": dict(
        fields=["name"], required=["name"], read="public",
        cols="t.*, (SELECT COUNT(*) FROM advertisements x WHERE x.category_id = t.id) AS ads_count",
        frm="categories t", search=["t.name"], filters={}),
    "people": dict(
        fields=["first_name", "last_name", "email", "phone", "role"], required=["first_name", "last_name", "email"], read="admin",
        cols="t.id,t.first_name,t.last_name,t.email,t.phone,t.role,t.created_at,(t.password_hash IS NOT NULL) AS has_account",
        frm="people t", search=["t.first_name", "t.last_name", "t.email"], filters={"role": ("t.role", "eq")}),
    "advertisements": dict(
        fields=["title", "short_description", "full_description", "wage", "location", "working_time", "duration_months",
                "contract_type", "company_id", "contact_id", "category_id"],
        required=["title", "short_description", "company_id", "category_id"], read="public",
        cols="t.*, c.name AS company_name, c.website AS company_website, TRIM(p.first_name || ' ' || p.last_name) AS contact_name, "
             "k.name AS category_name",
        frm="advertisements t JOIN companies c ON c.id = t.company_id LEFT JOIN people p ON p.id = t.contact_id "
            "LEFT JOIN categories k ON k.id = t.category_id",
        search=["t.title", "t.short_description", "t.location", "c.name"],
        # ?contract_type=Internship&location=Paris&category_id=2&company_id=1  (combined with AND, and with ?q=)
        filters={"contract_type": ("t.contract_type", "eq"), "location": ("t.location", "like"),
                 "category_id": ("t.category_id", "eq"), "company_id": ("t.company_id", "eq"),
                 # ?min_duration=4&max_duration=6 (months) and ?date_from=2026-10-01 (published on or after that day)
                 "min_duration": ("t.duration_months", "gte"), "max_duration": ("t.duration_months", "lte"),
                 "date_from": ("t.created_at", "from_date")}),
    "applications": dict(
        fields=["advertisement_id", "person_id", "message", "status", "email_sent"],
        required=["advertisement_id", "person_id", "message"], read="admin",
        cols="t.*, a.title AS ad_title, TRIM(p.first_name || ' ' || p.last_name) AS person_name, p.email AS person_email, "
             "p.phone AS person_phone",
        frm="applications t JOIN advertisements a ON a.id = t.advertisement_id JOIN people p ON p.id = t.person_id",
        search=["a.title", "p.email", "p.last_name", "t.message"],
        # ?advertisement_id=3&status=pending
        filters={"advertisement_id": ("t.advertisement_id", "eq"), "status": ("t.status", "eq"), "person_id": ("t.person_id", "eq")}),
}

def tbl(name):
    if name not in TABLES:
        abort(404, "Unknown resource.")
    return TABLES[name]

def body():
    d = request.get_json(silent=True)
    if not isinstance(d, dict):
        abort(400, "Expected a JSON object body.")
    return d

def intarg(name, default, lo, hi):
    try:
        return min(max(int(request.args.get(name, default)), lo), hi)
    except ValueError:
        return default

def fetch(table, rid):
    t = TABLES[table]
    r = db().execute(f"SELECT {t['cols']} FROM {t['frm']} WHERE t.id = ?", (rid,)).fetchone()
    return dict(r) if r else None

# ---------- auth helpers ----------
def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    return db().execute("SELECT * FROM people WHERE id = ?", (uid,)).fetchone()

def admin_only():
    u = current_user()
    if not u:
        abort(401, "Please log in.")
    if u["role"] != "admin":
        abort(403, "Administrators only.")
    return u

def user_json(u):
    return {k: u[k] for k in ("id", "first_name", "last_name", "email", "phone", "role")}

def check_password(pw):
    if not isinstance(pw, str) or len(pw) < 8:
        abort(400, "Password must be at least 8 characters.")
    return generate_password_hash(pw)

# ---------- generic CRUD (admin writes) ----------
def paginated(table, fixed=None):
    """Shared list logic: ?q= full-text-ish search, per-table ?filters, ?page= / ?per_page=. `fixed` = extra {column: value}."""
    t = tbl(table)
    page, per = intarg("page", 1, 1, 10**6), intarg("per_page", 10, 1, 100)
    conds, args = [], []
    q = (request.args.get("q") or "").strip()
    if q:
        conds.append("(" + " OR ".join(f"{c} LIKE ?" for c in t["search"]) + ")")
        args += [f"%{q}%"] * len(t["search"])
    for param, (col, mode) in t["filters"].items():
        v = (request.args.get(param) or "").strip()
        if not v:
            continue
        if mode == "like":
            conds.append(f"{col} LIKE ?")
            args.append(f"%{v}%")
        elif mode in ("gte", "lte"):
            try:
                n = int(v)
            except ValueError:
                abort(400, f"{param} must be a whole number.")
            conds.append(f"{col} {'>=' if mode == 'gte' else '<='} ?")
            args.append(n)
        elif mode == "from_date":
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
                abort(400, f"{param} must look like YYYY-MM-DD.")
            conds.append(f"date({col}) >= ?")
            args.append(v)
        else:
            conds.append(f"{col} = ?")
            args.append(v)
    for col, v in (fixed or {}).items():
        conds.append(f"{col} = ?")
        args.append(v)
    where = ("WHERE " + " AND ".join(conds)) if conds else ""
    total = db().execute(f"SELECT COUNT(*) FROM {t['frm']} {where}", args).fetchone()[0]
    rows = db().execute(f"SELECT {t['cols']} FROM {t['frm']} {where} ORDER BY t.id DESC LIMIT ? OFFSET ?",
                        args + [per, (page - 1) * per]).fetchall()
    return jsonify(items=[dict(r) for r in rows], total=total, page=page, per_page=per, pages=max(1, -(-total // per)))

@app.get("/api/<table>")
def list_rows(table):
    if tbl(table)["read"] == "admin":
        admin_only()
    return paginated(table)

@app.get("/api/companies/<int:cid>/ads")
def company_ads(cid):
    """All advertisements of one company (public). Same filters / pagination as GET /api/advertisements."""
    if not fetch("companies", cid):
        abort(404, "Company not found.")
    return paginated("advertisements", {"t.company_id": cid})

@app.get("/api/<table>/<int:rid>")
def get_row(table, rid):
    t = tbl(table)
    if t["read"] == "admin":
        admin_only()
    row = fetch(table, rid)
    if not row:
        abort(404, "Not found.")
    return jsonify(row)

def clean(t, data):
    out = {}
    for k in t["fields"]:
        if k in data:
            v = data[k]
            out[k] = (v.strip() or None) if isinstance(v, str) else v
    if out.get("duration_months") is not None:
        try:
            out["duration_months"] = int(out["duration_months"])
        except (TypeError, ValueError):
            abort(400, "Duration must be a whole number of months.")
    return out

@app.post("/api/<table>")
def create_row(table):
    t = tbl(table)
    u = admin_only()
    data = body()
    row = clean(t, data)
    if table == "advertisements":
        if row.get("contact_id") is None:  # not given (or sent empty): the admin creating the ad is the contact
            row["contact_id"] = u["id"]
        if row.get("duration_months") is None:  # not given: deduced from working_time ("6 months" -> 6)
            row["duration_months"] = guess_months(row.get("working_time"))
    if table == "people":
        row["email"] = (row.get("email") or "").lower() or None
        if data.get("password"):
            row["password_hash"] = check_password(data["password"])
    missing = [k for k in t["required"] if row.get(k) is None]
    if missing:
        abort(400, "Missing required field(s): " + ", ".join(missing))
    cur = run(f"INSERT INTO {table} ({','.join(row)}) VALUES ({','.join('?' * len(row))})", list(row.values()))
    return jsonify(fetch(table, cur.lastrowid)), 201, {"Location": f"/api/{table}/{cur.lastrowid}"}

@app.route("/api/<table>/<int:rid>", methods=["PUT", "PATCH"])
def update_row(table, rid):
    t = tbl(table)
    u = admin_only()
    data = body()
    if not fetch(table, rid):
        abort(404, "Not found.")
    row = clean(t, data)
    if table == "people":
        if row.get("email"):
            row["email"] = row["email"].lower()
        if data.get("password"):
            row["password_hash"] = check_password(data["password"])
        if rid == u["id"] and row.get("role", "admin") != "admin":
            abort(400, "You cannot remove your own admin role.")
    if not row:
        abort(400, "Nothing to update.")
    run(f"UPDATE {table} SET {','.join(k + '=?' for k in row)} WHERE id = ?", list(row.values()) + [rid])
    return jsonify(fetch(table, rid))

@app.delete("/api/<table>/<int:rid>")
def delete_row(table, rid):
    tbl(table)
    u = admin_only()
    if table == "people" and rid == u["id"]:
        abort(400, "You cannot delete your own account.")
    if not fetch(table, rid):
        abort(404, "Not found.")
    run(f"DELETE FROM {table} WHERE id = ?", (rid,))
    return "", 204

# ---------- applying (step 05): public, nested under the ad ----------
def notify(ad, applicant, message):
    """Email the ad owner. Without SMTP_HOST the mail is printed to the console (simulated)."""
    to = ad["contact_email"] or ADMIN_EMAIL
    msg = EmailMessage()
    msg["Subject"] = f"New application: {ad['title']}"
    msg["From"] = os.environ.get("MAIL_FROM", "jobboard@localhost")
    msg["To"] = to
    msg["Reply-To"] = applicant["email"]
    msg.set_content(f"{applicant['first_name']} {applicant['last_name']} <{applicant['email']}> "
                    f"{applicant['phone'] or ''}\n\n{message}")
    host = os.environ.get("SMTP_HOST")
    if not host:
        print(f"\n[mail simulated] To: {to}\n{msg['Subject']}\n{msg.get_content()}\n", flush=True)
        return 1
    try:
        with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", 587))) as s:
            s.starttls()
            if os.environ.get("SMTP_USER"):
                s.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
            s.send_message(msg)
        return 1
    except Exception as e:
        print("[mail failed]", e, flush=True)
        return 0

@app.post("/api/advertisements/<int:ad_id>/applications")
def apply(ad_id):
    ad = db().execute("SELECT a.id, a.title, p.email AS contact_email FROM advertisements a "
                      "LEFT JOIN people p ON p.id = a.contact_id WHERE a.id = ?", (ad_id,)).fetchone()
    if not ad:
        abort(404, "This offer no longer exists.")
    d = body()
    message = (d.get("message") or "").strip()
    if not message:
        abort(400, "Please write a message to the recruiter.")
    person = current_user()
    if not person:
        f = {k: (d.get(k) or "").strip() for k in ("first_name", "last_name", "email", "phone")}
        f["email"] = f["email"].lower()
        if not (f["first_name"] and f["last_name"] and "@" in f["email"]):
            abort(400, "First name, last name and a valid email are required.")
        person = db().execute("SELECT * FROM people WHERE email = ?", (f["email"],)).fetchone()
        if not person:
            cur = run("INSERT INTO people (first_name,last_name,email,phone) VALUES (?,?,?,?)",
                      (f["first_name"], f["last_name"], f["email"], f["phone"] or None))
            person = db().execute("SELECT * FROM people WHERE id = ?", (cur.lastrowid,)).fetchone()
    if db().execute("SELECT 1 FROM applications WHERE advertisement_id=? AND person_id=?", (ad_id, person["id"])).fetchone():
        abort(409, "You already applied to this offer.")
    cur = run("INSERT INTO applications (advertisement_id, person_id, message) VALUES (?,?,?)", (ad_id, person["id"], message))
    sent = notify(ad, person, message)
    run("UPDATE applications SET email_sent = ? WHERE id = ?", (sent, cur.lastrowid))
    return jsonify(id=cur.lastrowid, email_sent=sent), 201

# ---------- authentication (step 06) ----------
@app.post("/api/auth/register")
def api_register():
    d = body()
    f = {k: (d.get(k) or "").strip() for k in ("first_name", "last_name", "email", "phone")}
    f["email"] = f["email"].lower()
    if not (f["first_name"] and f["last_name"] and "@" in f["email"]):
        abort(400, "First name, last name and a valid email are required.")
    pw_hash = check_password(d.get("password"))
    ex = db().execute("SELECT id, password_hash FROM people WHERE email = ?", (f["email"],)).fetchone()
    if ex and ex["password_hash"]:
        abort(409, "An account with this email already exists.")
    if ex:  # guest who applied before: attach an account to the existing record
        run("UPDATE people SET first_name=?, last_name=?, phone=?, password_hash=? WHERE id=?",
            (f["first_name"], f["last_name"], f["phone"] or None, pw_hash, ex["id"]))
        uid = ex["id"]
    else:
        uid = run("INSERT INTO people (first_name,last_name,email,phone,password_hash) VALUES (?,?,?,?,?)",
                  (f["first_name"], f["last_name"], f["email"], f["phone"] or None, pw_hash)).lastrowid
    session.clear()
    session["user_id"] = uid
    return jsonify(user_json(current_user())), 201

@app.post("/api/auth/login")
def api_login():
    d = body()
    u = db().execute("SELECT * FROM people WHERE email = ?", ((d.get("email") or "").strip().lower(),)).fetchone()
    if not u or not u["password_hash"] or not check_password_hash(u["password_hash"], d.get("password") or ""):
        abort(401, "Wrong email or password.")
    session.clear()
    session["user_id"] = u["id"]
    return jsonify(user_json(u))

@app.post("/api/auth/logout")
def api_logout():
    session.clear()
    return "", 204

@app.get("/api/auth/me")
def api_me():
    u = current_user()
    if not u:
        abort(401, "Not logged in.")
    return jsonify(user_json(u))

@app.get("/api/auth/me/applications")
def api_my_applications():
    """Applications of the logged-in user (lets the front end show "already applied" and the status)."""
    u = current_user()
    if not u:
        abort(401, "Not logged in.")
    rows = db().execute("SELECT t.id, t.advertisement_id, t.status, t.created_at, a.title AS ad_title, c.name AS company_name "
                        "FROM applications t JOIN advertisements a ON a.id = t.advertisement_id JOIN companies c ON c.id = a.company_id "
                        "WHERE t.person_id = ? ORDER BY t.id DESC", (u["id"],)).fetchall()
    return jsonify(items=[dict(r) for r in rows])

@app.put("/api/auth/me")
def api_update_me():
    u = current_user()
    if not u:
        abort(401, "Not logged in.")
    d = body()
    row = {k: (d[k] or "").strip() or None for k in ("first_name", "last_name", "email", "phone") if k in d}
    if row.get("email"):
        row["email"] = row["email"].lower()
    for k in ("first_name", "last_name", "email"):
        if k in row and row[k] is None:
            abort(400, f"{k} cannot be empty.")
    if d.get("password"):
        row["password_hash"] = check_password(d["password"])
    if row:
        run(f"UPDATE people SET {','.join(k + '=?' for k in row)} WHERE id = ?", list(row.values()) + [u["id"]])
    return jsonify(user_json(current_user()))

# ---------- pages ----------
for _name in ("login", "register", "account"):
    app.add_url_rule(f"/{_name}", f"page_{_name}", lambda n=_name: send_from_directory(PAGES, n + ".html"))

@app.get("/")
def page_index():
    return send_from_directory(PAGES, "index.html")

@app.get("/admin")
def page_admin():
    u = current_user()
    if not u or u["role"] != "admin":
        return redirect("/login")
    resp = send_from_directory(PAGES, "admin.html")
    resp.headers["Cache-Control"] = "no-store"  # never show the admin page from the browser cache after logout
    return resp

@app.errorhandler(HTTPException)
def json_errors(e):
    if request.path.startswith("/api/"):
        return jsonify(error=e.description), e.code
    if e.code == 404:
        return send_from_directory(PAGES, "404.html"), 404
    return e

init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)    