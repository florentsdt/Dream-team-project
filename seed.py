"""Fill the database through the API itself (step 04). Usage: python seed.py
Creates categories, companies, recruiters, advertisements, a test user account and a few sample applications."""
import io
from contextlib import redirect_stdout
from app import app, ADMIN_EMAIL, ADMIN_PASSWORD

TEST_USER = dict(first_name="Test", last_name="User", email="user@jobboard.local", password="user12345")

c = app.test_client()
assert c.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).status_code == 200
if c.get("/api/companies?per_page=1").get_json()["total"]:
    raise SystemExit("Database already contains data - nothing to do.")

companies = [
    dict(name="Nimbus Cloud", website="https://example.com/nimbus", location="Paris", description="Cloud infrastructure for European start-ups."),
    dict(name="Pixelforge Studio", website="https://example.com/pixelforge", location="Lyon", description="Indie game studio building cozy strategy games."),
    dict(name="Greenbyte", website="https://example.com/greenbyte", location="Remote", description="Carbon-footprint analytics for logistics companies."),
    dict(name="Orbit Bank", website="https://example.com/orbit", location="Lille", description="Neo-bank with 2M customers."),
    dict(name="Lumen Health", website="https://example.com/lumen", location="Bordeaux", description="Medical imaging software used in 300 hospitals."),
]
cid = {co["name"]: c.post("/api/companies", json=co).get_json()["id"] for co in companies}

categories = ["Development", "DevOps & Cloud", "Data & AI", "Security", "Mobile"]
cat = {n: c.post("/api/categories", json={"name": n}).get_json()["id"] for n in categories}

# Recruiters: people without a password, used as the "contact" of some ads (the rest default to the admin)
recruiters = {
    "Nimbus Cloud": dict(first_name="Camille", last_name="Durand", email="camille.durand@example.com", phone="+33 1 00 00 00 01"),
    "Pixelforge Studio": dict(first_name="Lucas", last_name="Martin", email="lucas.martin@example.com", phone="+33 4 00 00 00 02"),
}
rid = {co: c.post("/api/people", json=r).get_json()["id"] for co, r in recruiters.items()}

ads = [
 ("Nimbus Cloud", "Backend Developer Intern (Python)", "Join the API team and ship real features in your first week.",
  "You will work on our Flask/PostgreSQL services, write tests, review pull requests and take part in on-call shadowing.\nYou are in your 4th or 5th year, comfortable with Python and Git, and curious about distributed systems.",
  "EUR 1,300 / month", "Paris (2 remote days)", "Full-time, 6 months", "Internship"),
 ("Nimbus Cloud", "DevOps Apprentice", "Automate deployments and learn Kubernetes with a friendly platform team.",
  "Alternance contract (2 weeks company / 1 week school). You will maintain CI pipelines, write Terraform modules and monitor clusters.",
  "EUR 1,500 / month", "Paris", "35h / week, 24 months", "Apprenticeship"),
 ("Pixelforge Studio", "Gameplay Programmer (C++)", "Make combat feel great in our next unannounced title.",
  "Implement gameplay systems in C++, collaborate with designers, profile and optimise on console. 2+ years of experience with a game engine required.",
  "EUR 42-50k / year", "Lyon", "Full-time, permanent", "Full-time"),
 ("Pixelforge Studio", "Front-end Developer (part-time)", "Build our community website and launcher UI, 3 days a week.",
  "TypeScript + React. You will own the player-facing website and help with the in-game launcher.",
  "EUR 24 / hour", "Lyon or remote", "21h / week", "Part-time"),
 ("Greenbyte", "Full-stack Developer", "Turn shipping data into dashboards that help reduce CO2.",
  "Node.js, React and SQL. You will design APIs, build charts and talk directly to customers to shape the product.",
  "EUR 45-55k / year", "Remote (France)", "Full-time, permanent", "Full-time"),
 ("Orbit Bank", "Security Engineer Intern", "Test our mobile app and APIs the way an attacker would.",
  "Pentesting, threat modelling and secure-code reviews alongside our AppSec team. Knowledge of OWASP Top 10 expected.",
  "EUR 1,400 / month", "Lille", "Full-time, 6 months", "Internship"),
 ("Orbit Bank", "Freelance Mobile Developer (Flutter)", "Three-month mission to rebuild our onboarding flow.",
  "Rebuild the KYC onboarding screens in Flutter with the design team. Remote-friendly, 3 months renewable.",
  "EUR 450 / day", "Remote", "3 months, full-time", "Freelance"),
 ("Lumen Health", "Machine Learning Engineer", "Help radiologists spot anomalies faster with computer vision.",
  "Train and deploy segmentation models with PyTorch, collaborate with clinicians, and maintain our MLOps pipeline.",
  "EUR 50-62k / year", "Bordeaux", "Full-time, permanent", "Full-time"),
]
ad_category = ["Development", "DevOps & Cloud", "Development", "Development", "Development", "Security", "Mobile", "Data & AI"]
ad_id = []
for (co, title, short, full, wage, loc, wt, ct), cname in zip(ads, ad_category):
    body = dict(title=title, short_description=short, full_description=full, wage=wage, location=loc,
                working_time=wt, contract_type=ct, company_id=cid[co], category_id=cat[cname])
    if co in rid:
        body["contact_id"] = rid[co]
    r = c.post("/api/advertisements", json=body)
    assert r.status_code == 201, r.get_json()
    ad_id.append(r.get_json()["id"])

# Test account (role "user") + a few applications so the admin screens are not empty
assert c.post("/api/people", json=dict(TEST_USER, role="user")).status_code == 201

guest = app.test_client()
user = app.test_client()
assert user.post("/api/auth/login", json={"email": TEST_USER["email"], "password": TEST_USER["password"]}).status_code == 200
samples = [
    (guest, ad_id[0], dict(first_name="Alice", last_name="Moreau", email="alice.moreau@example.com", phone="06 00 00 00 03",
                           message="Hello! I am in my 5th year, I built a Flask API for my last project and would love to join your team."), "reviewed"),
    (guest, ad_id[0], dict(first_name="Karim", last_name="Benali", email="karim.benali@example.com",
                           message="Python and Git are part of my daily work. Available from January."), "pending"),
    (guest, ad_id[5], dict(first_name="Julie", last_name="Garnier", email="julie.garnier@example.com",
                           message="I finished the OWASP Juice Shop challenges and play CTFs every month."), "accepted"),
    (user, ad_id[2], dict(message="Five years of C++ in Unreal Engine, two shipped titles. Portfolio on request."), "pending"),
]
with redirect_stdout(io.StringIO()):  # the simulated emails would flood the console
    results = [(cl.post(f"/api/advertisements/{a}/applications", json=body), st) for cl, a, body, st in samples]
for r, st in results:
    assert r.status_code == 201, r.get_json()
    if st != "pending":
        assert c.patch(f"/api/applications/{r.get_json()['id']}", json={"status": st}).status_code == 200

print(f"Seeded {len(categories)} categories, {len(companies)} companies, {len(ads)} advertisements, {len(samples)} applications.")
print(f"Admin account: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
print(f"Test user    : {TEST_USER['email']} / {TEST_USER['password']}")
