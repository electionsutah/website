#!/usr/bin/env python3
"""Generate Elections Utah 2026 candidate listings from the official XLSX.

The workbook is parsed with the Python standard library so the refresh process
does not depend on Excel, LibreOffice, or a third-party Python package.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


SOURCE_URL = "https://vote.utah.gov/2026-candidate-filings/"
SOURCE_FILE_URL = (
    "https://vote.utah.gov/wp-content/uploads/2026/06/Candidate-Filing-2026.xlsx"
)
LAST_UPDATED = "2026-07-20"
XML_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

STATUS_MAP = {
    "Election Candidate": "general_election",
    "Out in Convention": "defeated",
    "Out in Primary": "defeated",
    "Withdrew": "withdrew",
    "Primary": "primary_election",
    "Disqualified": "disqualified",
    "Filed": "filed",
    # The published schema has no deceased value. A deceased candidate is no
    # longer participating, so withdrew is the nearest allowed state.
    "Deceased": "withdrew",
}


def read_rows(workbook: Path) -> list[tuple[int, dict[str, str]]]:
    with ZipFile(workbook) as archive:
        shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        shared = [
            "".join(node.text or "" for node in item.iter(f"{{{XML_NS['m']}}}t"))
            for item in shared_root.findall("m:si", XML_NS)
        ]
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))

    rows: list[tuple[int, dict[str, str]]] = []
    for row in sheet.findall(".//m:sheetData/m:row", XML_NS):
        cells: dict[str, str] = {}
        for cell in row.findall("m:c", XML_NS):
            column = "".join(char for char in cell.attrib["r"] if char.isalpha())
            value_node = cell.find("m:v", XML_NS)
            value = "" if value_node is None else (value_node.text or "")
            if cell.attrib.get("t") == "s" and value:
                value = shared[int(value)]
            cells[column] = value.strip()
        rows.append((int(row.attrib["r"]), cells))
    return rows


def title_word(word: str) -> str:
    if not word:
        return word
    left = ""
    right = ""
    while word and word[0] in '\"“(':
        left += word[0]
        word = word[1:]
    while word and word[-1] in '\"”)':
        right = word[-1] + right
        word = word[:-1]
    if word in {"CJ", "JR", "II", "III", "IV"} or len(word) == 1:
        result = word
    elif re.fullmatch(r"[A-Z]\.", word):
        result = word
    elif word.startswith("MC") and len(word) > 3:
        result = "Mc" + word[2:].title()
    elif word.startswith("MAC") and len(word) > 4:
        result = "Mac" + word[3:].title()
    else:
        result = "-".join(
            "’".join(part.capitalize() for part in hyphen_part.split("’"))
            for hyphen_part in word.replace("'", "’").split("-")
        )
    return left.replace('"', "“") + result + right.replace('"', "”")


def display_name(raw: str) -> str:
    return " ".join(title_word(word) for word in raw.split())


def split_name(full_name: str) -> tuple[str, str]:
    parts = full_name.split()
    if len(parts) == 1:
        return parts[0], ""
    return " ".join(parts[:-1]), parts[-1]


def slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def parse_judicial_question(question: str) -> tuple[str, str]:
    match = re.match(r"Shall (.+?) be retained in the office of (.+?)\?$", question)
    if not match:
        raise ValueError(f"Unrecognized judicial retention question: {question}")
    return display_name(match.group(1)), match.group(2)


def election_type(source_status: str) -> str:
    if source_status in {"Election Candidate", "Filed"}:
        return "general"
    return "primary"


def build_records(rows: list[tuple[int, dict[str, str]]]) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    section = ""
    section_names = {
        "Federal Offices",
        "State Senate",
        "State House",
        "State School Board",
        "State Judicial",
    }

    for row_number, cells in rows:
        if cells.get("A") in section_names:
            section = cells["A"]
            continue
        if set(cells) == {"A", "B", "C", "D"} and cells["A"] != "Candidate":
            raw_name = cells["A"]
            full_name = display_name(raw_name)
            first_names, last_names = split_name(full_name)
            source_status = cells["D"]
            records.append(
                {
                    "full_name": full_name,
                    "first_names": first_names,
                    "last_names": last_names,
                    "section": section,
                    "source_row": row_number,
                    "source_status": source_status,
                    "2026_election": {
                        "election_type": election_type(source_status),
                        "office": cells["B"],
                        "candidate_status": STATUS_MAP[source_status],
                        "party": cells["C"],
                        "source": SOURCE_URL,
                    },
                    "last_updated": LAST_UPDATED,
                }
            )
        elif section == "State Judicial" and set(cells) == {"A", "B"} and cells["A"] != "Judicial Retention":
            full_name, office = parse_judicial_question(cells["A"])
            first_names, last_names = split_name(full_name)
            records.append(
                {
                    "full_name": full_name,
                    "first_names": first_names,
                    "last_names": last_names,
                    "section": section,
                    "source_row": row_number,
                    "source_status": cells["B"],
                    "2026_election": {
                        "election_type": "general",
                        "incumbent": "yes",
                        "office": office,
                        "candidate_status": "general_election",
                        "party": "",
                        "source": SOURCE_URL,
                    },
                    "last_updated": LAST_UPDATED,
                }
            )

    base_ids = Counter(slug(str(record["full_name"])) for record in records)
    used_ids: Counter[str] = Counter()
    for record in records:
        base_id = slug(str(record["full_name"]))
        candidate_id = base_id
        if base_ids[base_id] > 1:
            office = str(record["2026_election"]["office"])  # type: ignore[index]
            candidate_id = f"{base_id}-{slug(office)}"
        used_ids[candidate_id] += 1
        if used_ids[candidate_id] > 1:
            status = slug(str(record["source_status"]))
            party = slug(str(record["2026_election"]["party"]))  # type: ignore[index]
            candidate_id = f"{candidate_id}-{party or status}"
        record["id"] = candidate_id

    return records


def yaml_quote(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def render_yaml(records: list[dict[str, object]]) -> str:
    lines = [
        "# Elections Utah 2026 candidate listings",
        f"# Source: {SOURCE_URL}",
        f"# Source workbook: {SOURCE_FILE_URL}",
        f"# Source last updated: {LAST_UPDATED}",
        "#",
        "# Status mapping into the published schema:",
        "#   Election Candidate -> general_election",
        "#   Primary -> primary_election",
        "#   Out in Convention / Out in Primary -> defeated",
        "#   Deceased -> withdrew (the schema has no deceased status)",
    ]
    for record in records:
        election = record["2026_election"]
        assert isinstance(election, dict)
        lines.extend(
            [
                "-",
                f"  id: {yaml_quote(record['id'])}",
                f"  full_name: {yaml_quote(record['full_name'])}",
                f"  first_names: {yaml_quote(record['first_names'])}",
                f"  last_names: {yaml_quote(record['last_names'])}",
                "  2026_election:",
                f"    election_type: {yaml_quote(election['election_type'])}",
            ]
        )
        if election.get("incumbent"):
            lines.append(f"    incumbent: {yaml_quote(election['incumbent'])}")
        lines.extend(
            [
                f"    office: {yaml_quote(election['office'])}",
                f"    candidate_status: {yaml_quote(election['candidate_status'])}",
                f"    party: {yaml_quote(election['party'])}",
                f"    source: {yaml_quote(election['source'])}",
                f"  last_updated: {yaml_quote(record['last_updated'])}",
            ]
        )
    return "\n".join(lines) + "\n"


def render_json(records: list[dict[str, object]]) -> str:
    public_records = []
    for record in records:
        election = record["2026_election"]
        assert isinstance(election, dict)
        public_records.append(
            {
                "id": record["id"],
                "name": record["full_name"],
                "office": election["office"],
                "party": election["party"],
                "status": election["candidate_status"],
                "sourceStatus": record["source_status"],
                "section": record["section"],
            }
        )
    return json.dumps(public_records, ensure_ascii=False, indent=2) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--yaml", type=Path, default=Path("src/data/2026-candidates.yml"))
    parser.add_argument("--json", type=Path, default=Path("src/data/2026-candidates.json"))
    args = parser.parse_args()

    records = build_records(read_rows(args.workbook))
    if len(records) != 396:
        raise SystemExit(f"Expected 396 listings, found {len(records)}")
    if len({record["id"] for record in records}) != len(records):
        raise SystemExit("Generated IDs are not unique")

    args.yaml.parent.mkdir(parents=True, exist_ok=True)
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.yaml.write_text(render_yaml(records), encoding="utf-8")
    args.json.write_text(render_json(records), encoding="utf-8")
    print(f"Generated {len(records)} listings in {args.yaml} and {args.json}")


if __name__ == "__main__":
    main()
