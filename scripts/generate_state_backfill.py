#!/usr/bin/env python3
"""Backfill 2020–2024 Utah candidate records from official state sources.

The Lieutenant Governor publishes different formats from cycle to cycle. This
normalizer reads the 2020 canvass workbooks, the text layer of the 2022 voter
information pamphlet, the 2023 special-election filing page, and the 2024
candidate-filing workbook, then appends schema-compatible records to the
existing historical archive.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import tempfile
import unicodedata
import urllib.request
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


SOURCES = {
    "2020_general": "https://vote.utah.gov/wp-content/uploads/2021/02/2020-General-Election-Statewide-Canvass.xlsx",
    "2020_primary": "https://vote.utah.gov/wp-content/uploads/2021/02/2020-Primary-Election-State-Canvass.xlsx",
    "2022_pamphlet": "https://vote.utah.gov/wp-content/uploads/2022/10/2022-VIP.pdf",
    "2023_filings": "https://vote.utah.gov/2023-candidate-filings/",
    "2024_filings": "https://vote.utah.gov/wp-content/uploads/2025/08/CandidateFiling24.xlsx",
}

SOURCE_PAGES = {
    2020: "https://vote.utah.gov/2020-election-records/",
    2022: "https://vote.utah.gov/2022-2023-election-records/",
    2023: SOURCES["2023_filings"],
    2024: "https://vote.utah.gov/2024-candidate-filings/",
}

LAST_UPDATED = {
    2020: "2020-11-23",
    2022: "2022-11-28",
    2023: "2023-11-21",
    2024: "2024-11-25",
}

STATUS_MAP = {
    "Elected": "elected",
    "Election Candidate": "general_election",
    "Primary": "primary_election",
    "Out in Convention": "defeated",
    "Out in General": "defeated",
    "Out in Primary": "defeated",
    "Withdrew": "withdrew",
    "Write-In": "filed",
    "Disqualified": "disqualified",
    "Deceased": "withdrew",
    "Filed": "filed",
}

PARTY_CODES = {
    "CON": "Constitution",
    "DEM": "Democratic",
    "GRN": "Green",
    "IAP": "Independent American",
    "LIB": "Libertarian",
    "REP": "Republican",
    "UNA": "Unaffiliated",
    "UUP": "United Utah",
}


def download(url: str, path: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "ElectionsUtahData/1.0"})
    with urllib.request.urlopen(request) as response:
        path.write_bytes(response.read())


def slug(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")


def display_name(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip().replace('"', "”")
    if not value or not value.upper() == value:
        return value
    keep = {"II", "III", "IV", "Jr.", "Sr.", "JD"}
    words = []
    for word in value.split():
        bare = word.strip("“”.,")
        if bare in keep or re.fullmatch(r"[A-Z]\.?", bare):
            words.append(word)
        else:
            words.append("-".join(part.capitalize() for part in word.split("-")))
    return " ".join(words)


def section_for(office: str) -> str:
    if office.startswith("U.S."):
        return "Federal Offices"
    if office in {"Governor", "Attorney General", "State Auditor", "State Treasurer"}:
        return "State Offices"
    if office.startswith("State Senate"):
        return "State Senate"
    if office.startswith("State House"):
        return "State House"
    if office.startswith("State School Board"):
        return "State School Board"
    if office.startswith(("Judge of", "Justice of")):
        return "State Judicial"
    return "State Offices"


def clean_office(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    value = value.replace("Distirct", "District").replace("Distrct", "District")
    value = value.replace("U. S.", "U.S.").replace("US Senate", "U.S. Senate").replace("US House", "U.S. House")
    value = re.sub(r"U\.S\. House(?:\s*[-–])?\s*(?:District\s*)?(\d+)$", r"U.S. House District \1", value, flags=re.I)
    value = re.sub(r"Utah Senate(?:\s*[-–])?\s*(?:District\s*#?)?(\d+)$", r"State Senate District \1", value, flags=re.I)
    value = re.sub(r"Utah House(?: of Representatives)?(?:\s*[-–])?\s*(?:District\s*[-–#]?\s*)?(\d+)$", r"State House District \1", value, flags=re.I)
    value = re.sub(r"(?:Utah )?State Board of Education(?:\s*[-–])?\s*(?:District\s*#?)?(\d+)$", r"State School Board District \1", value, flags=re.I)
    value = re.sub(r"State School Board\s*[-–]?\s*District\s*(\d+)$", r"State School Board District \1", value, flags=re.I)
    value = re.sub(r"\s+\(Multi[- ]County\)$", "", value, flags=re.I)
    value = re.sub(r"\s+\(2 year term\)$", " (2-Year Term)", value, flags=re.I)
    # 2024 lists the presidential ticket as plain "President"; keep one office across cycles.
    if value == "President":
        value = "U.S. President & Vice President"
    return value


# Offices filed as a ticket: the ballot name covers both the candidate and the running mate.
TICKET_OFFICES = {"U.S. President & Vice President", "Governor & Lieutenant Governor", "Governor"}


def record(
    year: int,
    name: str,
    office: str,
    party: str,
    status: str,
    source_status: str,
    election_type: str,
    *,
    email: str = "",
    website: str = "",
    running_mate: str = "",
) -> dict[str, object]:
    office = clean_office(office)
    # 2020 canvass tickets read "Candidate, Running Mate".
    if office in TICKET_OFFICES and not running_mate and ", " in name:
        name, running_mate = name.split(", ", 1)
    name = display_name(name)
    return {
        "id": slug(name),
        "name": name,
        "runningMate": display_name(running_mate),
        "office": office,
        "party": party.strip(),
        "status": status,
        "sourceStatus": source_status,
        "section": section_for(office),
        "year": year,
        "electionType": election_type,
        "city": "",
        "county": "",
        "state": "UT",
        "source": SOURCE_PAGES[year],
        "lastUpdated": LAST_UPDATED[year],
        "contact": {
            "address": "",
            "phone": "",
            "email": email.strip(),
            "website": website.strip(),
            "facebook": "",
            "twitter": "",
        },
    }


def column_number(reference: str) -> int:
    result = 0
    for char in reference:
        if not char.isalpha():
            break
        result = result * 26 + ord(char.upper()) - 64
    return result


def read_workbook(path: Path) -> dict[str, dict[int, dict[int, str]]]:
    with ZipFile(path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = [
                "".join(node.text or "" for node in item.iter() if node.tag.endswith("}t"))
                for item in root.findall("{*}si")
            ]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}

        sheets: dict[str, dict[int, dict[int, str]]] = {}
        for sheet in workbook.findall(".//{*}sheet"):
            relationship_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = targets[relationship_id].lstrip("/")
            if not target.startswith("xl/"):
                target = "xl/" + target
            sheet_root = ET.fromstring(archive.read(target))
            rows: dict[int, dict[int, str]] = {}
            for row_node in sheet_root.findall(".//{*}sheetData/{*}row"):
                cells: dict[int, str] = {}
                for cell in row_node.findall("{*}c"):
                    value_node = cell.find("{*}v")
                    value = "" if value_node is None else value_node.text or ""
                    if cell.attrib.get("t") == "s" and value:
                        value = shared[int(value)]
                    elif cell.attrib.get("t") == "inlineStr":
                        value = "".join(node.text or "" for node in cell.iter("{*}t"))
                    cells[column_number(cell.attrib["r"])] = value.strip()
                rows[int(row_node.attrib["r"])] = cells
            sheets[sheet.attrib["name"]] = rows
    return sheets


def nearest_heading(headings: dict[int, str], column: int) -> str:
    choices = [key for key, value in headings.items() if key <= column and value]
    return headings[max(choices)] if choices else ""


def parse_ballot_name(value: str) -> tuple[str, str]:
    party = ""
    matches = re.findall(r"\(([^)]+)\)", value)
    for match in reversed(matches):
        code = match.strip().upper()
        if code in PARTY_CODES:
            party = PARTY_CODES[code]
            break
    name = re.sub(r"\s*\((?:CON|DEM|GRN|IAP|LIB|REP|UNA|UUP|WRITE-?IN)\)\s*", " ", value, flags=re.I)
    return display_name(name), party


def parse_2020(general_path: Path, primary_path: Path) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    general = read_workbook(general_path)
    ignored = {"Cover", "Con. Amend.", "Voter Turnout"}
    for sheet_name, rows in general.items():
        if sheet_name in ignored or not rows.get(3):
            continue
        if sheet_name == "Judicial":
            for _, heading in rows.get(1, {}).items():
                heading = re.sub(r"\s+", " ", heading).strip()
                match = re.match(r"(.+?)\s+((?:Supreme Court|Court of Appeals|\d+\w* Dist\w* - (?:Judicial|Juvenile) Court Judge).*)$", heading)
                if not match:
                    continue
                name, court = match.groups()
                office = f"Justice of the {court}" if court.startswith("Supreme") else f"Judge of the {court}"
                results.append(record(2020, name, office, "", "general_election", "Judicial Retention Candidate", "general"))
            continue
        headings = rows.get(1, {})
        for column, candidate in rows.get(3, {}).items():
            if column == 1 or not candidate or candidate.upper() in {"COUNTY", "YES", "NO"}:
                continue
            office = nearest_heading(headings, column)
            if not office:
                continue
            name, party = parse_ballot_name(candidate)
            results.append(record(2020, name, office, party, "general_election", "General Election Candidate", "general"))

    primary = read_workbook(primary_path)
    ignored = {"Front Page", "Total Ballots Cast"}
    for sheet_name, rows in primary.items():
        if sheet_name in ignored or not rows.get(4):
            continue
        headings = rows.get(1, {})
        parties = rows.get(3, {})
        for column, candidate in rows.get(4, {}).items():
            if column == 1 or not candidate:
                continue
            office = nearest_heading(headings, column)
            if not office:
                continue
            party = nearest_heading(parties, column)
            results.append(record(2020, candidate, office, party, "primary_election", "Primary Election Candidate", "primary"))
    return results


PARTY_PATTERN = re.compile(r"\b(?:Republican(?: Party)?|Democratic(?: Party)?|Libertarian(?: Party)?|United Utah(?: Party)?|Constitution(?: Party)?|Independent American(?: Party)?|Write-In|Unaffiliated)\b")


def party_name(value: str) -> str:
    return value.removesuffix(" Party").replace("Write-In", "")


def candidate_segment(lines: list[str], line_index: int, start: int) -> str:
    for previous in range(line_index - 1, max(-1, line_index - 6), -1):
        line = lines[previous]
        segments = [(match.start(), match.group().strip()) for match in re.finditer(r"\S(?:.*?\S)?(?=\s{2,}|$)", line)]
        viable = []
        for position, text in segments:
            text = re.sub(r"^(?:State Senate|State House)\s+", "", text).strip()
            if not text or re.match(r"^(?:District|State |Visit |\d|[A-Z][a-z]+ County)", text):
                continue
            viable.append((abs(position - start), position, text))
        if viable:
            distance, _, text = min(viable)
            if distance <= 14:
                return text
    return ""


def parse_2022(pdf_path: Path) -> list[dict[str, object]]:
    try:
        text = subprocess.check_output(["pdftotext", "-layout", str(pdf_path), "-"], text=True)
    except FileNotFoundError as error:
        raise SystemExit("pdftotext is required to regenerate the 2022 archive") from error

    results: list[dict[str, object]] = []
    for page in text.split("\f"):
        current: tuple[str, str] | None = None
        for block in re.split(r"\n(?:[ \t]*\n){2,}", page):
            district = re.search(r"District\s+(\d+)", block)
            kind = ""
            if "State Senate" in block:
                kind = "State Senate"
            elif "State House" in block:
                kind = "State House"
            elif "State School Board" in block:
                kind = "State School Board"
                if not district:
                    district = re.search(r"^\s*(\d{1,2})\b", block, flags=re.M)
            if kind and district:
                current = (kind, district.group(1))
            if not current or not PARTY_PATTERN.search(block):
                continue
            lines = block.splitlines()
            for index, line in enumerate(lines):
                for affiliation in PARTY_PATTERN.finditer(line):
                    name = candidate_segment(lines, index, affiliation.start())
                    if not name or re.search(r"\b(?:County|Representatives)\b|\bUT\s+\d{5}\b", name):
                        continue
                    office = f"{current[0]} District {current[1]}"
                    results.append(record(2022, name, office, party_name(affiliation.group()), "general_election", "General Election Candidate", "general"))

    # Federal and constitutional-office profile pages are image-based in the
    # pamphlet, so retain their official general-ballot roster explicitly.
    federal = [
        ("Mike Lee", "U.S. Senate", "Republican"), ("Evan McMullin", "U.S. Senate", "Unaffiliated"),
        ("James Arthur Hansen", "U.S. Senate", "Libertarian"), ("Tommy Williams", "U.S. Senate", "Independent American"),
        ("Blake D. Moore", "U.S. House District 1", "Republican"), ("Rick Jones", "U.S. House District 1", "Democratic"),
        ("Adam Welti", "U.S. House District 1", "United Utah"), ("Chris Stewart", "U.S. House District 2", "Republican"),
        ("Nick Mitchell", "U.S. House District 2", "Democratic"), ("Cassie Easley", "U.S. House District 2", "Constitution"),
        ("Jay “JayMac” McFarland", "U.S. House District 2", "United Utah"), ("John Curtis", "U.S. House District 3", "Republican"),
        ("Glenn J. Wright", "U.S. House District 3", "Democratic"), ("Aaron Heineman", "U.S. House District 3", "Independent American"),
        ("Michael Stoddard", "U.S. House District 3", "Libertarian"), ("Daniel Clyde Cummings", "U.S. House District 3", "Constitution"),
        ("Burgess Owens", "U.S. House District 4", "Republican"), ("Darlene McDonald", "U.S. House District 4", "Democratic"),
        ("January Walker", "U.S. House District 4", "United Utah"), ("Marlo M. Oaks", "State Treasurer", "Republican"),
        ("Thomas Alan Horne", "State Treasurer", "United Utah"), ("Joseph Geddes Buchman", "State Treasurer", "Libertarian"),
        ("Warren T. Rogers", "State Treasurer", "Independent American"),
    ]
    results.extend(record(2022, name, office, party, "general_election", "General Election Candidate", "general") for name, office, party in federal)
    return results


def strip_tags(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def parse_2023(page_path: Path) -> list[dict[str, object]]:
    page = page_path.read_text(encoding="utf-8")
    results = []
    for row in re.findall(r"<tr>(.*?)</tr>", page, flags=re.I | re.S):
        cells = [strip_tags(cell) for cell in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, flags=re.I | re.S)]
        if len(cells) != 4 or cells[0] == "Candidate":
            continue
        name, office, party, source_status = cells
        results.append(record(2023, name, office, party, STATUS_MAP[source_status], source_status, "primary" if source_status == "Primary" else "general"))
    return results


def parse_2024(path: Path) -> list[dict[str, object]]:
    workbook = read_workbook(path)
    rows = workbook[next(iter(workbook))]
    results = []
    for row_number, cells in rows.items():
        if row_number == 1 or not cells.get(1):
            continue
        if not cells.get(6):
            judicial = re.match(r"Shall\s+(.+?)\s+be retained in the office of\s+(.+?)\?$", cells[1], flags=re.I)
            if judicial:
                name, office = judicial.groups()
                results.append(record(2024, name, office, "", "elected", cells.get(11, "Elected"), "general"))
            continue
        office = cells[6]
        if cells.get(7):
            office += f" {cells[7]}"
        source_status = cells.get(11, "Filed")
        name, running_mate = cells[1], ""
        # Tickets join both names on the ballot line with no separator; the workbook puts the
        # candidate in First Name and the running mate in Last Name, leaving Middle Name empty.
        first, middle, last = (cells.get(column, "").strip() for column in (2, 3, 4))
        if clean_office(office) in TICKET_OFFICES and " " in first and not middle and f"{first} {last}" == name.strip():
            name, running_mate = first, last
        results.append(record(
            2024, name, office, cells.get(8, ""), STATUS_MAP.get(source_status, "filed"), source_status,
            "primary" if source_status in {"Primary", "Out in Primary"} else "general",
            email=cells.get(9, ""), website=cells.get(10, ""), running_mate=running_mate,
        ))
    return results


def deduplicate(records: list[dict[str, object]]) -> list[dict[str, object]]:
    priority = {"general_election": 4, "elected": 4, "primary_election": 3, "filed": 2, "defeated": 1, "withdrew": 0, "disqualified": 0}
    unique: dict[tuple[object, ...], dict[str, object]] = {}
    for item in records:
        key = (item["year"], slug(str(item["name"])), slug(str(item["office"])), item["party"])
        previous = unique.get(key)
        if previous is None or priority.get(str(item["status"]), 0) > priority.get(str(previous["status"]), 0):
            unique[key] = item
    return sorted(unique.values(), key=lambda item: (int(item["year"]), str(item["name"]), str(item["office"]), str(item["party"])))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, default=Path("src/data/historical-candidates.json"))
    args = parser.parse_args()

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        paths = {name: root / (name + (".html" if name == "2023_filings" else ".pdf" if name == "2022_pamphlet" else ".xlsx")) for name in SOURCES}
        for name, url in SOURCES.items():
            download(url, paths[name])
        additions = [
            *parse_2020(paths["2020_general"], paths["2020_primary"]),
            *parse_2022(paths["2022_pamphlet"]),
            *parse_2023(paths["2023_filings"]),
            *parse_2024(paths["2024_filings"]),
        ]

    existing = json.loads(args.archive.read_text(encoding="utf-8"))
    existing = [item for item in existing if int(item["year"]) not in {2020, 2022, 2023, 2024}]
    output = deduplicate([*existing, *additions])
    args.archive.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts = {year: sum(int(item["year"]) == year for item in output) for year in range(2017, 2025)}
    print(f"Wrote {len(output)} historical filings to {args.archive}: {counts}")


if __name__ == "__main__":
    main()
