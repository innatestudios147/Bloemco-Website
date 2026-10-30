#!/usr/bin/env python3
"""Copy every image/font the site loads from the WordPress server into this repo.

The pages currently load their images and fonts from
https://bloem-co.com/wp-content/uploads/... . That only works while WordPress
is still running on bloem-co.com. Run this once BEFORE pointing the domain at
Netlify: it downloads each file to public/wp-content/uploads/<same path> and
rewrites the pages to use /wp-content/uploads/..., so the site no longer
depends on WordPress (and old image links keep working on the new host).

    python3 scripts/localize_assets.py            # download + rewrite
    python3 scripts/localize_assets.py --dry-run  # just list what it would fetch

Files that fail to download are left pointing at WordPress and reported, so
a single broken image never breaks the rest.
"""
import os
import pathlib
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
# Pages, stylesheets, editor settings and the Insights page template.
SCANNED = ("*.html", "*.css", "*.yml", "*.js")
PATTERN = re.compile(r"https?://(?:www\.)?bloem-co\.com(/wp-content/uploads/[^\"'()\s<>`]+)")
USER_AGENT = "Mozilla/5.0 (compatible; bloem-co-site asset copy)"


def local_path(url_path: str) -> str:
    """Same path as on WordPress, minus invisible/non-ASCII characters."""
    decoded = urllib.parse.unquote(url_path)
    cleaned = "".join(
        ch for ch in unicodedata.normalize("NFKD", decoded)
        if ch.isascii() and unicodedata.category(ch) != "Cf"
    )
    return cleaned


def download(url: str, dest: pathlib.Path) -> None:
    parts = urllib.parse.urlsplit(url)
    safe_url = urllib.parse.urlunsplit(
        (parts.scheme.replace("http", "https") if parts.scheme == "http" else parts.scheme,
         parts.netloc, urllib.parse.quote(urllib.parse.unquote(parts.path), safe="/"),
         parts.query, ""))
    req = urllib.request.Request(safe_url, headers={"User-Agent": USER_AGENT})
    last_error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                data = res.read()
            if not data:
                raise ValueError("empty response")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return
        except Exception as exc:  # noqa: BLE001 - report any failure
            last_error = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(last_error)


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    pages = sorted(
        {p for pattern in SCANNED for p in PUBLIC.rglob(pattern)}
        | set((ROOT / "templates").glob("*.html"))
    )
    found = {}
    for page in pages:
        for match in PATTERN.finditer(page.read_text(encoding="utf-8")):
            found[match.group(0)] = match.group(1)

    print(f"Found {len(found)} WordPress-hosted files across {len(pages)} pages.")
    if dry_run:
        for url, path in sorted(found.items()):
            print(f"  {url}\n    -> public{local_path(path)}")
        return 0

    mapping, failed = {}, []
    for url, path in sorted(found.items()):
        rel = local_path(path)
        dest = PUBLIC / rel.lstrip("/")
        try:
            if not dest.exists():
                download(url, dest)
            mapping[url] = rel
            print(f"  ok    {rel}")
        except Exception as exc:  # noqa: BLE001
            failed.append((url, str(exc)))
            print(f"  FAIL  {url}  ({exc})")

    # Longest URLs first so a URL never gets partly replaced by a shorter one.
    ordered = sorted(mapping.items(), key=lambda kv: len(kv[0]), reverse=True)
    for page in pages:
        text = page.read_text(encoding="utf-8")
        new = text
        for url, rel in ordered:
            new = new.replace(url, rel)
        if new != text:
            page.write_text(new, encoding="utf-8")
            print(f"  updated {page.relative_to(ROOT)}")

    summary = [f"Copied {len(mapping)} of {len(found)} files into public/wp-content/uploads/."]
    if failed:
        summary.append(f"{len(failed)} could not be downloaded and still load from WordPress:")
        summary += [f"- {url} ({err})" for url, err in failed]
    print("\n".join(summary))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as fh:
            fh.write("\n".join(summary) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
