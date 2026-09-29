"""Landing page. Slice 2: search form posts to /search (live)."""

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.data.resources import CATEGORIES, valid_resources

templates = Jinja2Templates(directory="app/templates")
router = APIRouter()


@router.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "role": "Python Backend Developer",
            "location": "Hyderabad",
            "experience": "Fresher",
            "search_available": True,
        },
    )


@router.get("/tools", response_class=HTMLResponse)
def tools(request: Request):
    return templates.TemplateResponse(
        request,
        "tools.html",
        {"resources": valid_resources(), "categories": list(CATEGORIES)},
    )
