"""API smoke tests - run with:  python -m unittest discover -s tests -v
Uses a throw-away database (DB_PATH is set before app.py is imported), so it never touches jobboard.db."""
import os, sys, tempfile, unittest

_tmp = tempfile.mkdtemp()
os.environ["DB_PATH"] = os.path.join(_tmp, "test.db")
os.environ.pop("ADMIN_EMAIL", None); os.environ.pop("ADMIN_PASSWORD", None)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import app  # noqa: E402  (creates the schema and the default admin)

ADMIN = {"email": "admin@jobboard.local", "password": "admin1234"}


def admin_client():
    c = app.test_client()
    assert c.post("/api/auth/login", json=ADMIN).status_code == 200
    return c


class JobBoardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin = admin_client()
        cls.cat = cls.admin.post("/api/categories", json={"name": "Development"}).get_json()["id"]
        cls.cat2 = cls.admin.post("/api/categories", json={"name": "Operations"}).get_json()["id"]
        cls.co = cls.admin.post("/api/companies", json={"name": "Acme"}).get_json()["id"]
        cls.co2 = cls.admin.post("/api/companies", json={"name": "Globex"}).get_json()["id"]
        mk = lambda t, co, ct, loc, cat: cls.admin.post("/api/advertisements", json=dict(
            title=t, short_description="s", company_id=co, contract_type=ct, location=loc, category_id=cat)).get_json()["id"]
        cls.ad1 = mk("Python intern", cls.co, "Internship", "Paris", cls.cat)
        cls.ad2 = mk("Go developer", cls.co, "Full-time", "Lyon", cls.cat2)
        cls.ad3 = mk("Ops apprentice", cls.co2, "Apprenticeship", "Paris", cls.cat2)

    # ---- step 07 / README: the documented admin account works on a fresh install
    def test_documented_admin_can_log_in_and_is_admin(self):
        r = app.test_client().post("/api/auth/login", json=ADMIN)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["role"], "admin")

    def test_wrong_password_is_401(self):
        self.assertEqual(app.test_client().post("/api/auth/login", json={**ADMIN, "password": "nope"}).status_code, 401)

    def test_admin_page_is_protected_and_logout_works(self):
        c = app.test_client()
        self.assertEqual(c.get("/admin").status_code, 302)           # guest -> /login
        c.post("/api/auth/login", json=ADMIN)
        self.assertEqual(c.get("/admin").status_code, 200)
        c.post("/api/auth/logout")
        self.assertEqual(c.get("/admin").status_code, 302)
        self.assertEqual(c.get("/api/auth/me").status_code, 401)

    def test_regular_user_cannot_use_admin_api_or_page(self):
        c = app.test_client()
        self.assertEqual(c.post("/api/auth/register", json=dict(first_name="U", last_name="Ser", email="u1@x.fr", password="password1")).status_code, 201)
        self.assertEqual(c.get("/api/applications").status_code, 403)
        self.assertEqual(c.post("/api/companies", json={"name": "X"}).status_code, 403)
        self.assertEqual(c.get("/admin").status_code, 302)

    def test_register_validation(self):
        c = app.test_client()
        self.assertEqual(c.post("/api/auth/register", json=dict(first_name="A", last_name="B", email="a@b.fr", password="short")).status_code, 400)
        self.assertEqual(c.post("/api/auth/register", json=dict(first_name="A", last_name="B", email="dup@b.fr", password="password1")).status_code, 201)
        self.assertEqual(app.test_client().post("/api/auth/register", json=dict(first_name="A", last_name="B", email="dup@b.fr", password="password1")).status_code, 409)

    # ---- step 04: API
    def test_public_lists_and_detail(self):
        c = app.test_client()
        self.assertEqual(c.get("/api/advertisements").status_code, 200)
        self.assertEqual(c.get("/api/categories").status_code, 200)
        self.assertEqual(c.get("/api/companies").status_code, 200)
        d = c.get(f"/api/advertisements/{self.ad1}").get_json()
        self.assertEqual((d["company_name"], d["category_name"]), ("Acme", "Development"))
        self.assertEqual(c.get("/api/advertisements/99999").status_code, 404)
        self.assertEqual(c.get("/api/nothing").status_code, 404)

    def test_company_ads_route(self):
        c = app.test_client()
        r = c.get(f"/api/companies/{self.co}/ads")
        self.assertEqual(r.status_code, 200)
        self.assertEqual({a["id"] for a in r.get_json()["items"]}, {self.ad1, self.ad2})
        self.assertEqual(c.get(f"/api/companies/{self.co2}/ads?contract_type=Internship").get_json()["total"], 0)
        self.assertEqual(c.get("/api/companies/99999/ads").status_code, 404)

    def test_filters(self):
        c = app.test_client()
        total = lambda qs: c.get("/api/advertisements?" + qs).get_json()["total"]
        self.assertEqual(total("contract_type=Internship"), 1)
        self.assertEqual(total("location=Paris"), 2)
        self.assertEqual(total(f"category_id={self.cat}"), 1)
        self.assertEqual(total("location=Paris&contract_type=Apprenticeship"), 1)
        self.assertEqual(total("q=python&location=Paris"), 1)

    def test_write_validation_codes(self):
        a = self.admin
        self.assertEqual(a.post("/api/companies", json={"name": "Acme"}).status_code, 409)                      # duplicate
        self.assertEqual(a.post("/api/companies", json={}).status_code, 400)                                    # missing name
        self.assertEqual(a.post("/api/advertisements", json=dict(title="t", short_description="s", company_id=9999, category_id=self.cat)).status_code, 400)  # unknown FK
        self.assertEqual(a.post("/api/advertisements", json=dict(title="t", short_description="s", company_id=self.co, category_id=self.cat, contract_type="Nope")).status_code, 400)
        self.assertEqual(a.post("/api/advertisements", json=dict(title="t", short_description="s", company_id=self.co)).status_code, 400)  # no category
        self.assertEqual(a.patch(f"/api/advertisements/{self.ad1}", json={"category_id": None}).status_code, 400)                   # category removed
        self.assertEqual(a.delete(f"/api/categories/{self.cat}").status_code, 409)                                                  # category still used
        r = a.post("/api/categories", json={"name": "Temp"})
        self.assertEqual((r.status_code, r.headers["Location"].startswith("/api/categories/")), (201, True))
        cid = r.get_json()["id"]
        self.assertEqual(a.put(f"/api/categories/{cid}", json={"name": "Temp2"}).get_json()["name"], "Temp2")
        self.assertEqual(a.delete(f"/api/categories/{cid}").status_code, 204)
        self.assertEqual(a.delete(f"/api/categories/{cid}").status_code, 404)

    def test_default_contact_is_the_admin_creating_the_ad(self):
        d = self.admin.get(f"/api/advertisements/{self.ad1}").get_json()
        self.assertEqual(d["contact_name"], "Admin Recruiter")

    # ---- step 05 / 06: applying
    def test_apply_as_guest_then_duplicate_then_admin_status(self):
        c = app.test_client()
        body = dict(first_name="Guest", last_name="One", email="guest1@x.fr", message="Hello")
        r = c.post(f"/api/advertisements/{self.ad2}/applications", json=body)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(c.post(f"/api/advertisements/{self.ad2}/applications", json=body).status_code, 409)
        self.assertEqual(c.post(f"/api/advertisements/{self.ad2}/applications", json={"message": "x"}).status_code, 400)
        self.assertEqual(c.post("/api/advertisements/99999/applications", json=body).status_code, 404)
        app_id = r.get_json()["id"]
        row = self.admin.get(f"/api/applications/{app_id}").get_json()
        self.assertEqual((row["message"], row["status"], row["person_email"]), ("Hello", "pending", "guest1@x.fr"))
        for s in ("reviewed", "accepted", "rejected", "pending"):
            self.assertEqual(self.admin.patch(f"/api/applications/{app_id}", json={"status": s}).get_json()["status"], s)
        self.assertEqual(self.admin.patch(f"/api/applications/{app_id}", json={"status": "weird"}).status_code, 400)

    def test_admin_filters_applications_by_ad_and_status(self):
        c = app.test_client()
        c.post(f"/api/advertisements/{self.ad3}/applications", json=dict(first_name="G", last_name="Two", email="guest2@x.fr", message="m"))
        r = self.admin.get(f"/api/applications?advertisement_id={self.ad3}&status=pending").get_json()
        self.assertEqual(r["total"], 1)
        self.assertEqual(self.admin.get(f"/api/applications?advertisement_id={self.ad3}&status=accepted").get_json()["total"], 0)

    def test_my_applications_and_signup_reuses_guest_record(self):
        c = app.test_client()
        c.post(f"/api/advertisements/{self.ad1}/applications", json=dict(first_name="Lea", last_name="Roy", email="lea@x.fr", message="hi"))
        c.post("/api/auth/register", json=dict(first_name="Lea", last_name="Roy", email="lea@x.fr", password="password1"))
        items = c.get("/api/auth/me/applications").get_json()["items"]
        self.assertEqual([(i["advertisement_id"], i["status"]) for i in items], [(self.ad1, "pending")])
        self.assertEqual(c.post(f"/api/advertisements/{self.ad1}/applications", json={"message": "again"}).status_code, 409)
        self.assertEqual(app.test_client().get("/api/auth/me/applications").status_code, 401)

    def test_delete_company_cascades_to_ads(self):
        co = self.admin.post("/api/companies", json={"name": "Temp Co"}).get_json()["id"]
        ad = self.admin.post("/api/advertisements", json=dict(title="t", short_description="s", company_id=co, category_id=self.cat)).get_json()["id"]
        self.assertEqual(self.admin.delete(f"/api/companies/{co}").status_code, 204)
        self.assertEqual(app.test_client().get(f"/api/advertisements/{ad}").status_code, 404)


if __name__ == "__main__":
    unittest.main()
