#!/usr/bin/env python3
"""Normalize the original Elections Utah 2017–2019 candidate datasets."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def clean_url(value: str) -> str:
    return (value or "").replace("https: //", "https://").replace("http: //", "http://")


def clean_city(value: object) -> str:
    city = str(value or "").strip()
    return {"St George": "St. George"}.get(city, city)


def clean_office(year: int, row: dict[str, object]) -> str:
    raw = str(row.get("body") if year == 2017 else row.get("office") or "").strip()
    raw = raw.replace("US Congressional", "U.S. House")
    raw = re.sub(r"\s+\(Multi County\)", "", raw)
    raw = re.sub(r"\s+\(2 year term\)", " (2-Year Term)", raw, flags=re.I)
    raw = re.sub(r"^(U\.S\. House|State Senate|State House|State School Board) (\d+)", r"\1 District \2", raw)

    city = clean_city(row.get("city"))
    if year == 2017 and city and not raw.startswith("U.S. House"):
        return f"{city} {raw}"
    if year == 2019 and city and raw == "City Council":
        return f"{city} City Council"
    return raw


def section_for(office: str) -> str:
    if office.startswith("U.S."):
        return "Federal Offices"
    if office.startswith("State Senate"):
        return "State Senate"
    if office.startswith("State House"):
        return "State House"
    if office.startswith("State School Board"):
        return "State School Board"
    return "Municipal Offices"


def title_status(value: str) -> str:
    return (value or "filed").replace("_", " ").replace("-", " ").title()


def normalize(year: int, row: dict[str, object]) -> dict[str, object]:
    office = clean_office(year, row)
    raw_status = str(row.get("candidate_status") or "filed")
    status = "filed" if raw_status == "write-in" else raw_status
    if status not in {"filed", "defeated", "disqualified", "elected", "general_election", "primary_election", "withdrew"}:
        status = "filed"
    party = str(row.get("party") or "").strip()
    city = clean_city(row.get("city"))
    county = str(row.get("county") or "").strip()
    county = {"Washingotn": "Washington"}.get(county, county)
    return {
        "sourceId": str(row.get("id") or ""),
        "name": str(row.get("name") or "").strip(),
        "office": office,
        "party": party,
        "status": status,
        "sourceStatus": title_status(raw_status),
        "section": section_for(office),
        "year": year,
        "electionType": str(row.get("election_type") or ("general" if year == 2019 else "primary")),
        "city": city,
        "county": county,
        "state": str(row.get("state") or "UT"),
        "source": clean_url(str(row.get("source") or "")),
        "lastUpdated": str(row.get("last_updated") or ""),
        "contact": {
            "address": str(row.get("address") or ""),
            "phone": str(row.get("phone") or row.get("phone_number") or ""),
            "email": str(row.get("email") or row.get("email_address") or ""),
            "website": clean_url(str(row.get("website") or "")),
            "facebook": clean_url(str(row.get("facebook") or "")),
            "twitter": clean_url(str(row.get("twitter") or "")),
        },
    }


def merge_value(primary: object, secondary: object) -> object:
    if isinstance(primary, dict) and isinstance(secondary, dict):
        return {key: merge_value(primary.get(key), secondary.get(key)) for key in primary.keys() | secondary.keys()}
    return primary if primary not in (None, "") else secondary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--2017", dest="file_2017", type=Path, required=True)
    parser.add_argument("--2018", dest="file_2018", type=Path, required=True)
    parser.add_argument("--2019", dest="file_2019", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("src/data/historical-candidates.json"))
    args = parser.parse_args()

    records: list[dict[str, object]] = []
    for year, path in ((2017, args.file_2017), (2018, args.file_2018), (2019, args.file_2019)):
        source_rows = json.loads(path.read_text(encoding="utf-8"))
        records.extend(normalize(year, row) for row in source_rows)

    # The 2018 source contains one duplicate Jacquelyn Orton row: one record has
    # biographical detail while the other has filing status. Merge only exact
    # same-year/name/office/place/party identities; distinct races are retained.
    deduplicated: dict[tuple[object, ...], dict[str, object]] = {}
    for record in records:
        key = tuple(record[field] for field in ("year", "name", "office", "city", "county", "party"))
        if key in deduplicated:
            deduplicated[key] = merge_value(deduplicated[key], record)  # type: ignore[assignment]
        else:
            deduplicated[key] = record

    output = sorted(deduplicated.values(), key=lambda row: (int(row["year"]), str(row["name"]), str(row["office"])))
    if len(output) != 592:
        raise SystemExit(f"Expected 592 normalized historical filings, found {len(output)}")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(output)} historical filings in {args.output}")


if __name__ == "__main__":
    main()
