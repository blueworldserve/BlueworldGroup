"""
Makes sure the pages whose layout lives in the code (About, Business, Career, Blog, Contact)
also exist as CMS pages, so their top banner (title, text, photo and mobile photo) can be
edited under Pages in the CMS.

Safe to run on every start: it only creates a page that is missing and never touches one that exists.
Until a photo is set in the CMS, the website keeps showing the photo it already uses.
"""
from db.session import SessionLocal
from models.page import Page, PageStatus

HERO_PAGES: list[dict] = [
    {
        "slug": "about",
        "eyebrow": "About us",
        "title": "A cosmetics house built in Lagos, for the world",
        "description": "10 years of formulating, filling and shipping personal care from Nigeria - with the same rule on day one and today: make it properly or do not ship it.",
    },
    {
        "slug": "business",
        "eyebrow": "Business",
        "title": "Five brands, one factory floor",
        "description": "Each division owns its own chemistry, packaging and audience — all produced, tested and filled at our Obadore, Igando, Lagos manufacturing Company.",
    },
    {
        "slug": "career",
        "eyebrow": "Career",
        "title": "Work where the product is actually made",
        "description": "We hire chemists, machine operators, QA analysts and commercial people who care about doing manufacturing properly.",
    },
    {
        "slug": "blog",
        "eyebrow": "Blog",
        "title": "Notes from the lab and the line",
        "description": "Formulation science, quality standards and company news — written by the people doing the work.",
    },
    {
        "slug": "contact",
        "eyebrow": "Contact",
        "title": "Talk to the people who make it",
        "description": "Distribution, private label, contract manufacturing or export — send us the detail and the right desk will answer.",
    },
]


def seed_page_heroes() -> None:
    db = SessionLocal()
    try:
        for p in HERO_PAGES:
            if db.query(Page).filter(Page.slug == p["slug"]).first():
                continue
            db.add(Page(**p, status=PageStatus.published))
            print(f"created page '{p['slug']}'")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_page_heroes()