#!/usr/bin/env python3
"""Gera manifest.json automaticamente a partir de scripts/*.js.

Campos suportados no início de cada módulo:
// @central-id identificador
// @central-name Nome legível
// @central-version 1.0.0
// @central-match https://exemplo.com/*    (repetível)
// @central-enabled true
"""

from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
HEADER = re.compile(r"^\s*//\s*@central-([a-z-]+)\s+(.+?)\s*$")
ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")


def metadata(text):
    result = {}
    for line in text.splitlines():
        match = HEADER.match(line)
        if match:
            key, value = match.groups()
            result.setdefault(key, []).append(value)
    return result


def main():
    entries = []
    for file in sorted(SCRIPTS.glob("*.js")):
        code = file.read_bytes()
        meta = metadata(code.decode("utf-8"))

        def one(key, default=None):
            values = meta.get(key, [])
            if len(values) > 1:
                raise ValueError(f"{file.name}: campo @central-{key} repetido")
            return values[0] if values else default

        script_id = one("id", file.stem)
        if not ID.fullmatch(script_id):
            raise ValueError(f"{file.name}: identificador inválido: {script_id}")
        patterns = meta.get("match", [])
        if not patterns or not all(p.startswith(("https://", "http://")) for p in patterns):
            raise ValueError(f"{file.name}: precisa de ao menos um @central-match http(s)://...")
        enabled = one("enabled", "true").lower()
        if enabled not in ("true", "false"):
            raise ValueError(f"{file.name}: @central-enabled deve ser true ou false")
        entries.append({
            "id": script_id,
            "name": one("name", script_id),
            "version": one("version", "1.0.0"),
            "file": "scripts/" + file.name,
            "sha256": hashlib.sha256(code).hexdigest(),
            "matches": patterns,
            "enabled": enabled == "true",
        })

    ids = [entry["id"] for entry in entries]
    if len(ids) != len(set(ids)):
        raise ValueError("Dois scripts têm o mesmo @central-id")
    result = {"schema": 1, "scripts": entries}
    out = ROOT / "manifest.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Catálogo gerado: {len(entries)} script(s) -> {out.name}")


if __name__ == "__main__":
    main()
