#!/usr/bin/env python3
"""Link filing records to the most specific official document for each candidate.

Person pages link every filing to a source. Wherever possible that source is
the candidate's own declaration of candidacy (or withdrawal), not an index page:

* 2023, 2024, 2026 - the live candidate-filing pages link each name to its PDF.
* 2018, 2020, 2022 - the filing pages for these cycles are gone, but the Wayback
  Machine kept snapshots of the state's candidate API, which carries each
  candidate's document URL. Documents still on vote.utah.gov link there;
  documents that only survive in the Wayback Machine link to the capture.
* 2017 special congressional election - archived declarations, matched by name.
* 2017 and 2019 municipal filings - the city and county pages recorded by the
  original Elections Utah archive have been taken down, so they link to the
  Wayback Machine capture nearest the record's date.
* 2020 judicial retention - the judge's evaluation page in the official voter
  information pamphlet (requires Poppler's ``pdftotext``).

The output maps a record key to its document URL. Records without a better
document are left out and keep the source already in the dataset.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path


FILING_PAGES = {
    2023: "https://vote.utah.gov/2023-candidate-filings/",
    2024: "https://vote.utah.gov/2024-candidate-filings/",
    2026: "https://vote.utah.gov/2026-candidate-filings/",
}

CANDIDATE_API = "https://electionservice.utah.gov/Election/GetCurrentCandidates"

# Wayback captures of CANDIDATE_API, oldest first so later snapshots win.
# Earlier snapshots still list candidates who withdrew before the final one.
API_SNAPSHOTS = {
    2018: [
        ("20180910162013", CANDIDATE_API + "?callback=jQuery152027049787569550654_1536596410862&jsonp=ProcessCandidates&_=1536596413080"),
        ("20190228162001", CANDIDATE_API),
    ],
    2020: [
        ("20200817074710", CANDIDATE_API + "?callback=jQuery1520970341758456805_1597650429910&jsonp=ProcessCandidates&_=1597650429964"),
        ("20210228162424", CANDIDATE_API),
    ],
    2022: [
        ("20220614153046", CANDIDATE_API + "?callback=jQuery15206868527091906722_1602871335052&jsonp=ProcessCandidates&_=1602871335058"),
        ("20221109203617", CANDIDATE_API),
    ],
}

# Wayback URL prefixes holding the documents the API snapshots point to.
ARCHIVE_PREFIXES = {
    2017: ["elections.utah.gov/Media/Default/2017%20Election/Declarations%20of%20Candidacy/"],
    2018: ["elections.utah.gov/Media/Default/2018%20Election/"],
    2020: [
        "elections.utah.gov/Media/Default/2020%20Election/",
        *(f"voteinfo.utah.gov/wp-content/uploads/sites/42/{year}/" for year in (2019, 2020)),
    ],
    2022: [f"voteinfo.utah.gov/wp-content/uploads/sites/42/{year}/" for year in (2021, 2022)],
}

# Dead municipal sources whose capture lives under a slightly different URL.
CAPTURE_ALIASES = {
    "https://afcity.org/DocumentCenter/View/11405/Voter-Information-Pamphlet": "https://afcity.org/DocumentCenter/View/11405/Voter-Information-Pamphlet?bidId=",
}

PAMPHLETS = {2020: "https://vote.utah.gov/wp-content/uploads/2021/03/Utah-VIP-2020-General-FIN.pdf"}

# vote.utah.gov sits behind Cloudflare, which rejects requests without
# ordinary browser headers.
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/pdf,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"
CACHE = Path(tempfile.gettempdir()) / "elections-utah-documents"


def request(url: str, method: str = "GET") -> tuple[int, bytes]:
    """Fetch with an on-disk cache and patient retries; both hosts rate-limit."""
    cache_file = CACHE / f"{method}-{hashlib.sha256(url.encode()).hexdigest()}"
    if cache_file.exists():
        status, _, body = cache_file.read_bytes().partition(b"\n")
        return int(status), body
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS, method=method), timeout=120) as response:
                status, body = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, body = error.code, b""
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            status, body = 0, b""
        if status in (0, 429) or status >= 500:
            time.sleep(min(10 * 2**attempt, 120))
            continue
        break
    if status not in (0, 429) and status < 500:
        CACHE.mkdir(exist_ok=True)
        cache_file.write_bytes(f"{status}\n".encode() + body)
    return status, body


def fetch(url: str) -> str:
    status, body = request(url)
    if status != 200:
        raise RuntimeError(f"{url} returned HTTP {status}")
    return body.decode("utf-8")


def key_part(value: str) -> str:
    """Mirror of documentKeyPart() in src/lib/entities.ts."""
    return re.sub(r"[^a-z0-9]", "", value.lower())


def record_key(year: int, row: dict[str, object]) -> str:
    return "|".join([str(year), *(key_part(str(row[field])) for field in ("name", "office", "party", "sourceStatus"))])


def url_key(url: str) -> str:
    """Compare URLs regardless of scheme, www, percent-encoding, or case."""
    url = urllib.parse.unquote(urllib.parse.unquote(url)).lower()
    return re.sub(r"^(https?://)?(www\.)?", "", url).rstrip("/")


def wayback(timestamp: str, url: str) -> str:
    return f"https://web.archive.org/web/{timestamp}/{url}"


def cdx(url: str, prefix: bool = False) -> list[tuple[str, str]]:
    """Successful Wayback captures (timestamp, original URL) of a URL or prefix."""
    query = urllib.parse.urlencode({
        "url": url + ("*" if prefix else ""),
        "output": "json",
        "fl": "timestamp,original",
        "filter": "statuscode:200",
        **({"collapse": "urlkey"} if prefix else {}),
    }, safe="*:/%")
    status, body = request(f"https://web.archive.org/cdx/search/cdx?{query}")
    rows = json.loads(body or b"[]") if status == 200 else []
    return [(row[0], row[1]) for row in rows[1:]]


def cell_text(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def page_rows(page: str) -> list[dict[str, str]]:
    rows = []
    for row in re.findall(r"<tr>(.*?)</tr>", page, re.S):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        link = re.search(r'href="([^"]+\.pdf)"', cells[0], re.I) if cells else None
        if len(cells) < 4 or not link:
            continue
        name, office, party, status = (cell_text(cell) for cell in cells[:4])
        rows.append({"names": [name], "office": office, "party": party, "sourceStatus": status, "url": link.group(1)})
    return rows


def match(record: dict[str, object], candidates: list[dict[str, str]]) -> str | None:
    """Narrow same-name rows by office, district, party, then status until one remains."""
    district = re.findall(r"\d+", str(record["office"]))
    tests = [
        lambda row: key_part(row["office"]) == key_part(str(record["office"])),
        lambda row: re.findall(r"\d+", row["office"]) == district,
        lambda row: key_part(row["party"]) == key_part(str(record["party"])),
        lambda row: key_part(row["sourceStatus"]) == key_part(str(record["sourceStatus"])),
    ]
    for test in tests:
        if len({row["url"] for row in candidates}) <= 1:
            break
        candidates = [row for row in candidates if test(row)] or candidates
    urls = {row["url"] for row in candidates}
    return urls.pop() if len(urls) == 1 else None


def index_rows(rows: list[dict[str, str]]) -> tuple[dict[str, list[dict[str, str]]], dict[str, list[dict[str, str]]]]:
    """Index rows by every full-name spelling and by surname for a looser second pass."""
    by_name: dict[str, list[dict[str, str]]] = defaultdict(list)
    by_surname: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        for name in {key_part(name) for name in row["names"] if name}:
            by_name[name].append(row)
        by_surname[key_part(row["surname"]) if row.get("surname") else ""].append(row)
    return by_name, by_surname


def find(record: dict[str, object], by_name, by_surname) -> str | None:
    name = str(record["name"]).split(",")[0].strip(" -")
    found = match(record, by_name.get(key_part(str(record["name"]).strip(" -")), []) or by_name.get(key_part(name), []))
    if found:
        return found
    # Nicknames and middle names vary between sources ("Jay “JayMac” McFarland"
    # vs. "JAYMAC MCFARLAND"), so fall back to surname within the same district.
    words = re.findall(r"[A-Za-z'’.-]+", name)
    surname = key_part(words[-1]) if words else ""
    district = re.findall(r"\d+", str(record["office"]))
    if not surname or not district:
        return None
    # Allow one source to add letters to the surname ("McNeil" vs. "McNeill").
    candidates = [
        row
        for key, rows in by_surname.items()
        if len(key) >= 4 and (key.startswith(surname) or surname.startswith(key))
        for row in rows
        if re.findall(r"\d+", row["office"]) == district
    ]
    return match(record, candidates) if candidates else None


def api_rows(year: int, archived: dict[str, str]) -> list[dict[str, str]]:
    rows: dict[tuple[str, str], dict[str, str]] = {}
    for timestamp, url in API_SNAPSHOTS[year]:
        body = fetch(f"https://web.archive.org/web/{timestamp}id_/{url}")
        payload = json.loads(re.sub(r"^[^({]*\(|\);?\s*$", "", body.strip()))
        for row in (row for value in payload.values() if isinstance(value, list) for row in value):
            if not row.get("Url"):
                continue
            document = resolve(urllib.parse.urljoin("https://elections.utah.gov/", row["Url"]), archived)
            if not document:
                continue
            parts = [row.get(part) for part in ("First", "Middle", "Last", "Suffix")]
            office = row["RaceName"] + (f" {row['District']}" if row.get("District") and str(row["District"]) not in row["RaceName"] else "")
            rows[(row["BallotName"] or "", office)] = {
                "names": [row["BallotName"] or "", " ".join(filter(None, parts)), " ".join(filter(None, [parts[0], parts[2]]))],
                "surname": (row.get("Last") or "").split()[-1] if row.get("Last") else "",
                "office": office,
                "party": row.get("Party") or "",
                "sourceStatus": row.get("Status") or "",
                "url": document,
            }
    return list(rows.values())


def resolve(url: str, archived: dict[str, str]) -> str | None:
    """Prefer the live official copy, then the Wayback capture."""
    # voteinfo.utah.gov was folded into vote.utah.gov, which kept some uploads.
    live = re.sub(r"^https?://voteinfo\.utah\.gov/wp-content/uploads/sites/42/", "https://vote.utah.gov/wp-content/uploads/", url)
    if live != url and request(live, "HEAD")[0] == 200:
        return live
    return archived.get(url_key(url))


def archived_documents(year: int) -> dict[str, str]:
    captures: dict[str, str] = {}
    for prefix in ARCHIVE_PREFIXES.get(year, []):
        for timestamp, original in cdx(prefix, prefix=True):
            captures.setdefault(url_key(original), wayback(timestamp, original))
    return captures


def special_election_rows(archived: dict[str, str]) -> list[dict[str, str]]:
    """2017 declarations are named "<Candidate> Declaration.pdf"."""
    rows = []
    for key, url in archived.items():
        file_name = key.rsplit("/", 1)[-1].removesuffix(".pdf")
        name = re.sub(r"\s+(declaration|withdrawal|withdraw)$", "", file_name)
        rows.append({"names": [name], "surname": name.split()[-1], "office": "", "party": "", "sourceStatus": "", "url": url})
    return rows


def nearby_captures(url: str, date: str, limit: int = 6) -> list[tuple[str, str]]:
    """Captures within a year of a record's date, closest first."""
    target = datetime.strptime(date, "%Y-%m-%d")
    distance = lambda capture: abs(datetime.strptime(capture[0][:8], "%Y%m%d") - target).days
    captures = sorted(cdx(CAPTURE_ALIASES.get(url, url)), key=distance)
    # Same-day captures are near-duplicates; keep one per day.
    by_day = {capture[0][:8]: capture for capture in reversed(captures) if distance(capture) <= 366}
    return sorted(by_day.values(), key=distance)[:limit]


def capture_text(timestamp: str, original: str) -> str:
    """Searchable text of a capture, so a link is only kept if it names the candidate."""
    status, body = request(f"https://web.archive.org/web/{timestamp}id_/{original}")
    if status != 200:
        return ""
    if body.startswith(b"%PDF"):
        with tempfile.NamedTemporaryFile(suffix=".pdf") as pdf:
            pdf.write(body)
            pdf.flush()
            return key_part(subprocess.run(["pdftotext", pdf.name, "-"], capture_output=True, text=True).stdout)
    return key_part(html.unescape(re.sub(r"<[^>]+>", " ", body.decode("utf-8", "replace"))))


def pamphlet_pages(url: str) -> list[str]:
    status, body = request(url)
    if status != 200:
        raise RuntimeError(f"{url} returned HTTP {status}")
    with tempfile.NamedTemporaryFile(suffix=".pdf") as pdf:
        pdf.write(body)
        pdf.flush()
        text = subprocess.run(["pdftotext", "-layout", pdf.name, "-"], check=True, capture_output=True, text=True).stdout
    return [key_part(page) for page in text.split("\f")]


def judge_page(record: dict[str, object], pages: list[str], url: str) -> str | None:
    name = key_part(str(record["name"]).strip(" -"))
    hits = [number for number, page in enumerate(pages, start=1) if name in page]
    return f"{url}#page={hits[0]}" if len(hits) == 1 else None


def is_judge(record: dict[str, object]) -> bool:
    return bool(re.match(r"(Judge|Justice) of", str(record["office"])))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--output", type=Path, default=DATA / "candidate-documents.json")
    args = parser.parse_args()

    historical = json.loads((DATA / "historical-candidates.json").read_text())
    current = json.loads((DATA / "2026-candidates.json").read_text())
    records_by_year: dict[int, list[dict[str, object]]] = defaultdict(list)
    for row in historical:
        records_by_year[int(row["year"])].append(row)
    records_by_year[2026].extend(current)

    documents: dict[str, str] = {}

    def link(year: int, finder, label: str) -> None:
        records = records_by_year[year]
        unmatched = []
        for record in records:
            document = finder(record)
            if document:
                documents[record_key(year, record)] = document
            else:
                unmatched.append(f"{record['name']} ({record['office']})")
        print(f"{year}: linked {len(records) - len(unmatched)} of {len(records)} records to {label}")
        for item in unmatched:
            print(f"  kept existing source: {item}")

    for year, url in FILING_PAGES.items():
        indexes = index_rows(page_rows(fetch(url)))
        link(year, lambda record: find(record, *indexes), "candidate PDFs")

    pamphlets = {year: pamphlet_pages(url) for year, url in PAMPHLETS.items()}
    for year in API_SNAPSHOTS:
        indexes = index_rows(api_rows(year, archived_documents(year)))
        pages = pamphlets.get(year)

        def finder(record, indexes=indexes, pages=pages, year=year):
            if is_judge(record):
                return judge_page(record, pages, PAMPHLETS[year]) if pages else None
            return find(record, *indexes)

        link(year, finder, "candidate filings")

    special = index_rows(special_election_rows(archived_documents(2017)))
    captures: dict[tuple[str, str], list[tuple[str, str]]] = {}

    def municipal(record: dict[str, object]) -> str | None:
        if str(record["section"]) == "Federal Offices":
            return find(record, *special)
        source = str(record["source"])
        if not source or "facebook.com" in source:
            return None
        if (source, str(record["lastUpdated"])) not in captures:
            captures[(source, str(record["lastUpdated"]))] = nearby_captures(source, str(record["lastUpdated"]))
        surname = key_part(re.findall(r"[A-Za-z'’.-]+", str(record["name"]))[-1])
        for capture in captures[(source, str(record["lastUpdated"]))]:
            if surname in capture_text(*capture):
                return wayback(*capture)
        return None

    for year in (2017, 2019):
        link(year, municipal, "archived filings")

    args.output.write_text(json.dumps(dict(sorted(documents.items())), indent=2) + "\n")
    print(f"Wrote {len(documents)} document links to {args.output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
