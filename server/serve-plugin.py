#!/usr/bin/env python3
"""Minimal API to serve plugin repo data for AI Team Builder.
Runs on the server alongside nginx. Pulls latest repo on startup.
"""

import json
import os
import subprocess
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

REPOS_DIR = Path("/var/www/ai-team-builder-data/repos")
PORT = 3847

KNOWN_REPOS = {
    "cc-data-science-team": {
        "url": "https://github.com/johannesfritz/cc-data-science-team.git",
        "title": "Data Science Team",
        "description": "Structured document classification, external database matching, and analytical workflows with quality gates.",
        "category": "Analytics",
    },
}

# Plugins served from JSON bundles (for private repos)
BUNDLE_PLUGINS = {
    "iran-monitor": {
        "bundle_path": "/var/www/ai-team-builder-data/iran-monitor-plugin.json",
        "title": "Iran Conflict Monitor",
        "description": "9-phase monitoring cycle: parallel region search, source verification, GTA taxonomy mapping, deduplication, Slack notifications, and Excel export. Demonstrates multi-agent orchestration with 7 parallel searchers.",
        "category": "Monitoring",
        "version": "1.0.0",
    },
}


def pull_repos():
    """Pull latest for all known repos on startup."""
    REPOS_DIR.mkdir(parents=True, exist_ok=True)
    for name, info in KNOWN_REPOS.items():
        repo_path = REPOS_DIR / name
        if repo_path.exists():
            print(f"Pulling {name}...")
            subprocess.run(["git", "-C", str(repo_path), "pull", "--ff-only"],
                           capture_output=True, text=True)
        else:
            print(f"Cloning {name}...")
            subprocess.run(["git", "clone", info["url"], str(repo_path)],
                           capture_output=True, text=True)


def read_plugin(repo_name: str) -> dict:
    """Read a plugin repo and return structured data."""
    repo_path = REPOS_DIR / repo_name

    if not repo_path.exists():
        return {"error": f"Repo {repo_name} not found"}

    info = KNOWN_REPOS.get(repo_name, {})

    # Read plugin.json
    plugin_json_path = repo_path / ".claude-plugin" / "plugin.json"
    manifest = {}
    if plugin_json_path.exists():
        manifest = json.loads(plugin_json_path.read_text())

    # Scan for plugin files (at repo root, not inside .claude-plugin/)
    files = []
    for subdir in ["agents", "rules", "commands", "skills", "protocols", "hooks"]:
        dir_path = repo_path / subdir
        if not dir_path.exists():
            continue
        for file_path in sorted(dir_path.rglob("*")):
            if file_path.is_file() and not file_path.name.startswith("."):
                rel_path = str(file_path.relative_to(repo_path))
                try:
                    content = file_path.read_text(errors="replace")
                except Exception:
                    content = ""
                files.append({"path": rel_path, "content": content})

    return {
        "name": repo_name,
        "title": info.get("title", manifest.get("name", repo_name)),
        "description": info.get("description", manifest.get("description", "")),
        "category": info.get("category", "General"),
        "version": manifest.get("version", "1.0.0"),
        "manifest": manifest,
        "files": files,
        "file_count": len(files),
    }


def read_bundle_plugin(name: str) -> dict:
    """Read a plugin from a JSON bundle file."""
    info = BUNDLE_PLUGINS.get(name, {})
    bundle_path = info.get("bundle_path", "")

    if not os.path.exists(bundle_path):
        return {"error": f"Bundle {name} not found"}

    with open(bundle_path) as f:
        files = json.load(f)

    return {
        "name": name,
        "title": info.get("title", name),
        "description": info.get("description", ""),
        "category": info.get("category", "General"),
        "version": info.get("version", "1.0.0"),
        "manifest": {},
        "files": files,
        "file_count": len(files),
    }


def get_all_plugin_names() -> list:
    """Get all plugin names from repos and bundles."""
    return list(KNOWN_REPOS.keys()) + list(BUNDLE_PLUGINS.keys())


def get_plugin(name: str) -> dict:
    """Get plugin data from either repo or bundle."""
    if name in KNOWN_REPOS:
        return read_plugin(name)
    elif name in BUNDLE_PLUGINS:
        return read_bundle_plugin(name)
    return {"error": f"Plugin {name} not found"}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        if self.path == "/api/plugins":
            # List all available plugins
            plugins = []
            for name in get_all_plugin_names():
                data = get_plugin(name)
                plugins.append({
                    "name": data["name"],
                    "title": data["title"],
                    "description": data["description"],
                    "category": data["category"],
                    "version": data["version"],
                    "file_count": data["file_count"],
                })
            self.wfile.write(json.dumps(plugins).encode())

        elif self.path.startswith("/api/plugins/"):
            plugin_name = self.path.split("/api/plugins/")[1].strip("/")
            data = get_plugin(plugin_name)
            self.wfile.write(json.dumps(data).encode())

        elif self.path == "/api/health":
            self.wfile.write(json.dumps({"status": "ok"}).encode())

        else:
            self.wfile.write(json.dumps({"error": "not found"}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        print(f"[API] {args[0]}")


if __name__ == "__main__":
    pull_repos()
    print(f"AI Team Builder API running on port {PORT}")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
