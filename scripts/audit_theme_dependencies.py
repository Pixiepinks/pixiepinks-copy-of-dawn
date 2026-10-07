#!/usr/bin/env python3
"""Audit native theme dependencies, including customer templates and section groups."""

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def audit(root=ROOT):
    errors = []
    counts = {"json_files": 0, "section_instances": 0, "liquid_files": 0,
              "snippet_references": 0, "asset_references": 0}
    schemas = {}
    for path in root.rglob("*.json"):
        if ".git" in path.parts or "node_modules" in path.parts:
            continue
        counts["json_files"] += 1
        try:
            source = re.sub(r"^\s*/\*.*?\*/", "", path.read_text(), count=1, flags=re.S)
            data = json.loads(source)
        except (ValueError, OSError) as exc:
            errors.append(f"{path.relative_to(root)}: {exc}")
            continue
        if path.parts[-2] != "sections" and "templates" not in path.relative_to(root).parts:
            continue
        sections = data.get("sections", {})
        order = data.get("order", [])
        if len(order) != len(set(order)) or set(order) != set(sections):
            errors.append(f"{path.relative_to(root)}: section order mismatch")
        for name, instance in sections.items():
            counts["section_instances"] += 1
            section = root / "sections" / f"{instance.get('type')}.liquid"
            if not section.is_file():
                errors.append(f"{path.relative_to(root)}: {name} needs {section.name}")
                continue
            schemas.setdefault(section, section.read_text())
            match = re.search(r"{%[-]?\s*schema\s*[-]?%}(.*?){%[-]?\s*endschema\s*[-]?%}", schemas[section], re.S)
            # Static sections such as Dawn's main-404 can omit a schema.
            schema = json.loads(match[1]) if match else {}
            block_types = {block["type"] for block in schema.get("blocks", [])}
            for block_id, block in instance.get("blocks", {}).items():
                kind = block.get("type", "")
                if kind not in block_types and not ("@app" in block_types and kind.startswith("shopify://apps/")):
                    errors.append(f"{path.relative_to(root)}: {name}/{block_id} has unsupported block {kind}")
            if "block_order" in instance:
                blocks = instance.get("blocks", {})
                block_order = instance["block_order"]
                if len(block_order) != len(set(block_order)) or set(block_order) != set(blocks):
                    errors.append(f"{path.relative_to(root)}: {name} block order mismatch")

    for path in root.rglob("*.liquid"):
        if ".git" in path.parts or "node_modules" in path.parts:
            continue
        counts["liquid_files"] += 1
        source = re.sub(r"{%[-]?\s*(comment|doc)\s*[-]?%}.*?{%[-]?\s*end\1\s*[-]?%}", "", path.read_text(), flags=re.S)
        for kind, name in re.findall(r"\b(render|section|sections)\s+['\"]([^'\"]+)['\"]", source):
            directory, suffix = ("snippets", ".liquid") if kind == "render" else ("sections", ".json" if kind == "sections" else ".liquid")
            counts["snippet_references"] += kind == "render"
            if not (root / directory / (name + suffix)).is_file():
                errors.append(f"{path.relative_to(root)}: missing {directory}/{name}{suffix}")
        for name in re.findall(r"['\"]([^'\"]+)['\"]\s*\|\s*(?:asset_url|inline_asset_content)\b", source):
            counts["asset_references"] += 1
            if not (root / "assets" / name).is_file():
                errors.append(f"{path.relative_to(root)}: missing assets/{name}")
        for match in re.finditer(r"{%[-]?\s*schema\s*[-]?%}(.*?){%[-]?\s*endschema\s*[-]?%}", source, re.S):
            try:
                json.loads(match[1])
            except ValueError as exc:
                errors.append(f"{path.relative_to(root)}: invalid schema JSON: {exc}")
    return counts, errors


if __name__ == "__main__":
    counts, errors = audit()
    print(json.dumps({"counts": counts, "errors": errors}, indent=2))
    raise SystemExit(bool(errors))
