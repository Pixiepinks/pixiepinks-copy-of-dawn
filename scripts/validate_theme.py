#!/usr/bin/env python3
"""Validate PixiePinks theme structure before Shopify deployment."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"{path.relative_to(ROOT)}: invalid JSON ({error})")
        return {}


def section_schema(path: Path) -> dict:
    try:
        source = path.read_text(encoding="utf-8")
    except OSError as error:
        fail(f"{path.relative_to(ROOT)}: cannot read section ({error})")
        return {}

    matches = re.findall(r"{% schema %}\s*(.*?)\s*{% endschema %}", source, re.DOTALL)
    if len(matches) != 1:
        fail(f"{path.relative_to(ROOT)}: expected one schema, found {len(matches)}")
        return {}

    try:
        return json.loads(matches[0])
    except json.JSONDecodeError as error:
        fail(f"{path.relative_to(ROOT)}: invalid schema JSON ({error})")
        return {}


def validate_section(path: Path) -> dict:
    schema = section_schema(path)
    if not schema:
        return schema

    for kind, objects in (
        ("section", [schema]),
        ("block", schema.get("blocks", [])),
        ("preset", schema.get("presets", [])),
    ):
        for item in objects:
            name = item.get("name", "")
            if not name:
                fail(f"{path.relative_to(ROOT)}: {kind} name is missing")
            elif len(name) > 25:
                fail(f"{path.relative_to(ROOT)}: {kind} name exceeds 25 characters: {name!r}")

    settings_groups = [schema.get("settings", [])]
    settings_groups.extend(block.get("settings", []) for block in schema.get("blocks", []))
    for settings in settings_groups:
        setting_ids = [
            setting.get("id")
            for setting in settings
            if setting.get("type") not in {"header", "paragraph"}
        ]
        if None in setting_ids:
            fail(f"{path.relative_to(ROOT)}: setting ID is missing")
        if len(setting_ids) != len(set(setting_ids)):
            fail(f"{path.relative_to(ROOT)}: duplicate setting IDs")

    block_types = {block.get("type") for block in schema.get("blocks", [])}
    for preset in schema.get("presets", []):
        for block in preset.get("blocks", []):
            if block.get("type") not in block_types:
                fail(
                    f"{path.relative_to(ROOT)}: preset references unknown block type "
                    f"{block.get('type')!r}"
                )
    return schema


def validate_section_instance(owner: Path, instance_id: str, instance: dict) -> None:
    section_type = instance.get("type")
    if not section_type:
        fail(f"{owner.relative_to(ROOT)}: {instance_id!r} has no section type")
        return

    section_path = ROOT / "sections" / f"{section_type}.liquid"
    if not section_path.is_file():
        fail(
            f"{owner.relative_to(ROOT)}: {instance_id!r} references missing "
            f"sections/{section_type}.liquid"
        )
        return

    schema = validate_section(section_path)
    allowed_blocks = {block.get("type") for block in schema.get("blocks", [])}
    for block_id, block in instance.get("blocks", {}).items():
        if block.get("type") not in allowed_blocks:
            fail(
                f"{owner.relative_to(ROOT)}: {instance_id}/{block_id} references unknown "
                f"block type {block.get('type')!r}"
            )


def validate_order(owner: Path, document: dict) -> None:
    sections = document.get("sections", {})
    order = document.get("order", [])
    if len(order) != len(set(order)):
        fail(f"{owner.relative_to(ROOT)}: order contains duplicates")
    if set(order) != set(sections):
        fail(f"{owner.relative_to(ROOT)}: order and section IDs do not match")
    for instance_id in order:
        instance = sections.get(instance_id)
        if instance is not None:
            validate_section_instance(owner, instance_id, instance)


def validate_json_template_structure(path: Path, document: dict) -> None:
    """Validate shared JSON-template structure without requiring a complete Dawn checkout."""
    sections = document.get("sections")
    order = document.get("order")
    if not isinstance(sections, dict):
        fail(f"{path.relative_to(ROOT)}: top-level sections must be an object")
        return
    if not isinstance(order, list):
        fail(f"{path.relative_to(ROOT)}: top-level order must be an array")
        return
    if len(order) != len(set(order)):
        fail(f"{path.relative_to(ROOT)}: order contains duplicates")
    if set(order) != set(sections):
        fail(f"{path.relative_to(ROOT)}: order and section IDs do not match")
    for instance_id, instance in sections.items():
        if not isinstance(instance, dict) or not instance.get("type"):
            fail(f"{path.relative_to(ROOT)}: {instance_id!r} has no section type")


def main() -> int:
    required = (
        ROOT / "templates" / "index.json",
        ROOT / "sections" / "header-group.json",
        ROOT / "sections" / "pixiepinks-header.liquid",
        ROOT / "sections" / "footer-group.json",
        ROOT / "sections" / "pixiepinks-footer.liquid",
    )
    forbidden = (
        ROOT / "templates" / "index.liquid",
        ROOT / "sections" / "header-group.liquid",
        ROOT / "sections" / "footer-group.liquid",
    )
    for path in required:
        if not path.is_file():
            fail(f"required file is missing: {path.relative_to(ROOT)}")
    for path in forbidden:
        if path.exists():
            fail(f"obsolete rendering-path file exists: {path.relative_to(ROOT)}")

    index_path = ROOT / "templates" / "index.json"
    if index_path.is_file():
        validate_order(index_path, load_json(index_path))

    for template_path in sorted((ROOT / "templates").glob("*.json")):
        validate_json_template_structure(template_path, load_json(template_path))

    layout_path = ROOT / "layout" / "theme.liquid"
    try:
        layout = layout_path.read_text(encoding="utf-8")
    except OSError as error:
        fail(f"layout/theme.liquid: cannot read layout ({error})")
        layout = ""
    for group_name in re.findall(r"{%\s*sections\s+['\"]([^'\"]+)", layout):
        group_path = ROOT / "sections" / f"{group_name}.json"
        if not group_path.is_file():
            fail(f"layout/theme.liquid references missing section group {group_path.name}")
            continue
        group = load_json(group_path)
        validate_order(group_path, group)

    routing_patterns = {
        "request.page_type": r"\brequest\.page_type\b",
        "template.name": r"\btemplate\.name\b",
        "template comparison": r"\btemplate\s*==",
        "404 template render": r"(?:render|section)\s+['\"][^'\"]*404",
    }
    routing_files = [layout_path]
    routing_files.extend((ROOT / "snippets").glob("*.liquid"))
    for liquid_path in routing_files:
        source = liquid_path.read_text(encoding="utf-8", errors="ignore")
        if liquid_path.name == "meta-tags.liquid":
            source = re.sub(r"\btemplate\.name\b", "", source)
        for label, pattern in routing_patterns.items():
            if re.search(pattern, source):
                fail(
                    f"{liquid_path.relative_to(ROOT)}: review possible routing logic ({label})"
                )

    referenced_assets: set[str] = set()
    for liquid_path in ROOT.rglob("*.liquid"):
        source = liquid_path.read_text(encoding="utf-8", errors="ignore")
        referenced_assets.update(
            re.findall(r"['\"]([^'\"]+\.(?:css|js))['\"]\s*\|\s*asset_url", source)
        )
    for asset in sorted(referenced_assets):
        if not (ROOT / "assets" / asset).is_file():
            fail(f"referenced asset is missing: assets/{asset}")

    if errors:
        print("Theme validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Theme validation passed.")
    print("- templates/index.json is the sole homepage template")
    print("- header and footer section groups resolve exactly once")
    print("- all configured sections and blocks resolve")
    print("- all JSON templates have valid sections/order structure")
    print("- no layout/snippet logic routes the homepage to 404")
    print(f"- all {len(referenced_assets)} referenced CSS/JS assets exist")
    return 0


if __name__ == "__main__":
    sys.exit(main())
