from __future__ import annotations

import json
import time
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urljoin
from urllib.request import Request, urlopen


LINEUP_URL = "https://www.roskilde-festival.dk/en/line-up"
OUTPUT_PATH = Path(__file__).resolve().parents[2] / "output" / "lineup_data.json"
USER_AGENT = "RoskildeWebsiteExplorer/0.2 (+local research project)"


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    return re.sub(r"[\s\u200b\u200c\u200d\ufeff]+", " ", value).strip()


def fetch_html(url: str, timeout: int = 20, retries: int = 3) -> str:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            request = Request(url, headers={"User-Agent": USER_AGENT})
            with urlopen(request, timeout=timeout) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                return response.read().decode(charset, errors="replace")
        except Exception as exc:
            last_error = exc
            time.sleep(0.35 * (attempt + 1))

    assert last_error is not None
    raise last_error


def extract_next_data(html: str) -> dict[str, Any]:
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
    if not match:
        raise ValueError("Could not find __NEXT_DATA__ on page")
    return json.loads(match.group(1))


def first_module_data(next_data: dict[str, Any]) -> dict[str, Any]:
    modules = next_data["props"]["pageProps"]["modules"]
    if not modules:
        raise ValueError("No modules found in page data")
    return modules[0]["data"]


def build_overview_items() -> list[dict[str, Any]]:
    html = fetch_html(LINEUP_URL)
    next_data = extract_next_data(html)
    overview = first_module_data(next_data)
    items = overview.get("items", [])

    built_items = []
    for item in items:
        built_items.append(
            {
                "name": clean_text(item["headline"]),
                "type": item.get("eventCategory") or _category_from_url(item.get("url", "")),
                "url": urljoin(LINEUP_URL, item["url"]),
                "countryCode": clean_text(item.get("superscript")),
                "lineupSceneLabel": clean_text(item.get("text", "").lstrip(", ")),
                "dayFilters": item.get("filterIds", []),
                "newInLineup": bool(item.get("newInLineup")),
            }
        )

    return built_items


def enrich_item(item: dict[str, Any]) -> dict[str, Any]:
    detail_html = fetch_html(item["url"])
    next_data = extract_next_data(detail_html)
    detail = first_module_data(next_data)
    appearances = detail.get("appearences", [])

    normalized_appearances = []
    for appearance in appearances:
        normalized_appearances.append(
            {
                "dateLabel": clean_text(appearance.get("date")),
                "dayId": _day_id_from_date_label(appearance.get("date")),
                "date": appearance.get("startDate"),
                "startTime": appearance.get("startTime"),
                "timeLabel": clean_text(appearance.get("timeOfDay")),
                "stage": clean_text(appearance.get("stage")),
                "showTitle": clean_text(appearance.get("showTitle")) or None,
            }
        )

    normalized_appearances.sort(
        key=lambda appearance: (
            appearance.get("date") or "9999-12-31",
            _sort_time_value(appearance.get("timeLabel")),
            appearance.get("stage") or "",
        )
    )

    primary = normalized_appearances[0] if normalized_appearances else {}

    return {
        **item,
        "type": detail.get("eventCategory") or item["type"],
        "appearances": normalized_appearances,
        "dayId": primary.get("dayId"),
        "dateLabel": primary.get("dateLabel"),
        "date": primary.get("date"),
        "timeLabel": primary.get("timeLabel"),
        "stage": primary.get("stage") or item.get("lineupSceneLabel"),
        "showTitle": primary.get("showTitle"),
        "hasMultipleShows": bool(detail.get("hasMultipleShows")),
        "sortKey": {
            "date": primary.get("date"),
            "time": primary.get("timeLabel"),
            "name": item["name"],
        },
    }


def _sort_time_value(time_label: str | None) -> str:
    if not time_label:
        return "99.99"
    return time_label


def _day_id_from_date_label(date_label: str | None) -> str | None:
    if not date_label:
        return None

    normalized = date_label.lower()
    for day_id, token in (
        ("first-days", "first days"),
        ("wednesday", "wednesday"),
        ("thursday", "thursday"),
        ("friday", "friday"),
        ("saturday", "saturday"),
    ):
        if token in normalized:
            return day_id
    return None


def _category_from_url(url: str) -> str:
    if "/art-activism/" in url:
        return "Art & Activism"
    return "Music"


def write_output(items: list[dict[str, Any]]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": LINEUP_URL,
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "itemCount": len(items),
        "items": items,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")


def main() -> int:
    items = build_overview_items()
    enriched = []
    failed = []

    for index, item in enumerate(items, start=1):
        try:
            enriched.append(enrich_item(item))
        except Exception as exc:
            fallback = {
                **item,
                "appearances": [],
                "dayId": item["dayFilters"][0].lower() if item.get("dayFilters") else None,
                "dateLabel": None,
                "date": None,
                "timeLabel": None,
                "stage": item.get("lineupSceneLabel"),
                "showTitle": None,
                "hasMultipleShows": False,
                "sortKey": {
                    "date": None,
                    "time": None,
                    "name": item["name"],
                },
                "fetchError": str(exc),
            }
            enriched.append(fallback)
            failed.append(item["name"])

        if index % 20 == 0:
            print(f"Processed {index}/{len(items)} acts...")

    enriched.sort(
        key=lambda item: (
            item["sortKey"].get("date") or "9999-12-31",
            _sort_time_value(item["sortKey"].get("time")),
            item["name"].lower(),
        )
    )
    write_output(enriched)
    print(f"Enriched {len(enriched)} line-up entries.")
    if failed:
        print(f"Used fallback data for {len(failed)} acts.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
