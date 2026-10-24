"""Immutable, sequential BeanCS delivery. Never changes database resources/secrets."""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


class DeliveryError(RuntimeError):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward the deployment credential to a login page/other host.
        return None


class BeanCS:
    def __init__(self, base_url: str, token: str):
        url = urllib.parse.urlsplit(base_url)
        if url.scheme != "https" or not url.netloc or url.username or url.query or url.fragment:
            raise DeliveryError("BEANCS_API_URL must be an HTTPS URL without embedded credentials")
        if not token:
            raise DeliveryError("BEANCS_API_KEY is required")
        self.base = base_url.rstrip("/") + "/v2"
        self.token = token
        self.opener = urllib.request.build_opener(NoRedirect)

    def request(self, path: str, method: str = "GET", payload: dict | None = None):
        if not path.startswith("/") or path.startswith("//"):
            raise DeliveryError("Invalid API path")
        for attempt in range(4):
            request = urllib.request.Request(
                self.base + path,
                data=json.dumps(payload).encode() if payload is not None else None,
                method=method,
                headers={"Authorization": "Bearer " + self.token,
                         "Content-Type": "application/json", "User-Agent": "RebootEarth-GitHubActions/1"},
            )
            try:
                with self.opener.open(request, timeout=30) as response:
                    raw = response.read()
                    return json.loads(raw) if raw else {}
            except urllib.error.HTTPError as error:
                # These POST operations use persisted idempotency keys or digest
                # identities, so retrying a lost response cannot redeploy twice.
                if error.code in {429, 502, 503, 504} and attempt < 3:
                    time.sleep(2 ** (attempt + 1))
                    continue
                detail = error.read().decode("utf-8", "replace").replace(self.token, "[redacted]")
                raise DeliveryError(f"BeanCS {method} {path}: HTTP {error.code}: {detail[:800]}") from None
            except (urllib.error.URLError, TimeoutError) as error:
                if attempt == 3:
                    raise DeliveryError(f"BeanCS request unavailable: {type(error).__name__}") from None
                time.sleep(2 ** (attempt + 1))
        raise DeliveryError("BeanCS retry limit exceeded")


def validate_inputs(digests: dict[str, str], revision: str, tag: str):
    if set(digests) != {"backend", "frontend"}:
        raise DeliveryError("Exactly the backend and frontend artifacts are required")
    if not re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", revision):
        raise DeliveryError("Source revision must be a full Git commit hash")
    if not tag or len(tag) > 256 or any(ord(c) < 32 for c in tag):
        raise DeliveryError("A valid source tag is required")
    if any(not re.fullmatch(r"sha256:[0-9a-f]{64}", value) for value in digests.values()):
        raise DeliveryError("Only immutable sha256 image digests may be deployed")


def wait_for_run(client, run_id: str, timeout: int = 420, *, clock=time.monotonic, sleep=time.sleep):
    deadline, previous = clock() + timeout, None
    while clock() < deadline:
        run = client.request("/deployment-runs/" + run_id)
        status = run["status"]
        if status != previous:
            print(f"Deployment {run_id}: {status}", flush=True)
            previous = status
        if status == "succeeded":
            return run
        if status in {"failed", "cancelled", "canceled", "timed_out"}:
            raise DeliveryError(f"Deployment {run_id} {status}: {run.get('error_message') or 'see BeanCS logs'}")
        sleep(5)
    raise DeliveryError(f"Timed out waiting for deployment {run_id}")


def smoke_test(site_url: str):
    """No model calls, synthetic imports or writes to the production database."""
    headers = {"User-Agent": "RebootEarth-GitHubActions/1"}
    for path in ("/data/catalog", "/data/sql", "/data/upload"):
        request = urllib.request.Request(site_url + path, headers=headers)
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status != 200:
                raise DeliveryError("Public page unavailable: " + path)
    sql = ("SELECT current_user AS role, (SELECT count(*) FROM ofo_trees) AS trees, "
           "(SELECT count(*) FROM ofo_plots) AS plots, "
           "(SELECT count(*) FROM ofo_drone_missions) AS missions")
    request = urllib.request.Request(site_url + "/api/sql/query", method="POST",
                                     data=json.dumps({"sql": sql}).encode(),
                                     headers={**headers, "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        row = json.load(response)["rows"][0]
    if row["role"] != "ofo_reader" or row["trees"] < 64295 or row["plots"] < 287 or row["missions"] < 687:
        raise DeliveryError("Production data/read-only role verification failed")
    request = urllib.request.Request(site_url + "/api/assistant/status", headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        status = json.load(response)
    if not status.get("configured") or status.get("provider") != "openai":
        raise DeliveryError("The server-side OpenAI configuration is unavailable")
    print("HTTPS, SQL data and OpenAI configuration verified; no model quota consumed.", flush=True)
    return row


def deliver(client, config: dict, digests: dict[str, str], revision: str, tag: str,
            delivery_key: str, *, verify=smoke_test, waiter=wait_for_run):
    validate_inputs(digests, revision, tag)
    # Snapshot both last-good releases before the first mutation. Preserve their
    # runtime revisions, secret bindings, namespace, ports and storage settings.
    previous = {}
    runs = client.request("/deployment-runs?status=succeeded&limit=200")["data"]
    for name in ("backend", "frontend"):
        component = config["components"][name]
        query = urllib.parse.urlencode({"component_id": component["id"],
                                        "environment_id": config["environment_id"], "limit": 200})
        releases = client.request("/releases?" + query)["data"]
        by_id = {r["id"]: r for r in releases}
        # A rollback redeploys an OLDER release. Its new successful run, not
        # release creation order, identifies the image actually in production.
        good = next((by_id[run["release_id"]] for run in runs
                     if run["status"] == "succeeded" and run["release_id"] in by_id
                     and run["delivery_target_id"] == config["delivery_target_id"]), None)
        if not good:
            raise DeliveryError(f"No successful {name} release found; refusing an unprotected initial deployment")
        previous[name] = good
    # Resolve BOTH artifacts before changing either workload.
    artifacts = {}
    for name in ("backend", "frontend"):
        artifacts[name] = client.request("/artifacts/resolve", "POST", {
            "connection_id": config["artifact_connection_id"],
            "repository": config["components"][name]["repository"],
            "repository_name": "reboot-earth-" + name,
            "digest": digests[name], "source_revision": revision,
        })
        if artifacts[name]["digest"] != digests[name]:
            raise DeliveryError("Resolved artifact digest mismatch")
    attempted, records = [], {}
    try:
        for name in ("backend", "frontend"):
            old = previous[name]
            release = client.request("/releases", "POST", {
                "component_id": config["components"][name]["id"],
                "environment_id": config["environment_id"],
                "artifact_id": artifacts[name]["id"],
                "delivery_target_id": config["delivery_target_id"],
                "runtime_config_revision": old["runtime_config_revision"],
                "secret_bindings": old.get("secret_bindings") or {},
                "network_bindings": old.get("network_bindings") or {},
                "promotion_key": delivery_key + ":" + name,
            })
            # Include unknown-outcome dispatches in rollback handling.
            attempted.append((name, release["id"]))
            # BeanCS's native Kubernetes adapter waits only two minutes. A
            # first image download may take longer. Reapply the SAME immutable
            # release (without restarting its pod) at most twice; never retry
            # arbitrary configuration/authentication errors or unknown outcomes.
            for attempt in range(3):
                suffix = "" if attempt == 0 else ":retry:" + str(attempt)
                run = client.request("/deployment-runs", "POST", {
                    "release_id": release["id"],
                    "idempotency_key": delivery_key + ":" + name + suffix,
                })["deployment_run"]
                try:
                    waiter(client, run["id"])
                    break
                except DeliveryError as error:
                    if attempt == 2 or "deployment rollout timeout" not in str(error):
                        raise
                    print(f"Retrying {name} rollout after BeanCS's short readiness window "
                          f"({attempt + 1}/2); image digest and release unchanged", flush=True)
            records[name] = {"release_id": release["id"], "deployment_run_id": run["id"],
                             "digest": digests[name]}
        counts = verify(config["site_url"])
    except Exception as cause:
        failures = []
        for name, current in reversed(attempted):
            if current == previous[name]["id"]:
                continue
            try:
                print("Rolling back " + name + " to its previous successful release", flush=True)
                run = client.request("/releases/" + current + "/rollback", "POST", {
                    "target_release_id": previous[name]["id"],
                    "idempotency_key": delivery_key + ":rollback:" + name,
                })["deployment_run"]
                waiter(client, run["id"])
            except Exception as error:
                failures.append(name + ": " + str(error))
        detail = "; rollback failures: " + "; ".join(failures) if failures else "; previous releases restored"
        raise DeliveryError(str(cause) + detail) from cause
    return {"tag": tag, "revision": revision, "components": records, "data_counts": counts}


def main():
    if not os.environ.get("GITHUB_REF", "").startswith("refs/tags/"):
        raise DeliveryError("Production delivery is allowed only for a tag ref")
    config = json.loads(Path(__file__).with_name("production.json").read_text())
    client = BeanCS(os.environ["BEANCS_API_URL"], os.environ["BEANCS_API_KEY"])
    key = "github:" + os.environ["GITHUB_RUN_ID"] + ":" + os.environ["GITHUB_RUN_ATTEMPT"]
    result = deliver(client, config, {"backend": os.environ["BACKEND_DIGEST"],
                                    "frontend": os.environ["FRONTEND_DIGEST"]},
                     os.environ["SOURCE_REVISION"], os.environ["SOURCE_TAG"], key)
    print(json.dumps(result, indent=2), flush=True)
    if path := os.environ.get("GITHUB_STEP_SUMMARY"):
        # Generated workflow artifact, not a source-file rewrite.
        with open(path, "a", encoding="utf-8") as summary:
            summary.write("## Production release\n\nTag: `" + result["tag"].replace("`", "") +
                          "`\n\nCommit: `" + result["revision"] + "`\n\n")
            summary.write("[Open Reboot Earth](" + config["site_url"] + "/data/catalog)\n\n")
            for name, record in result["components"].items():
                summary.write("- " + name + ": release `" + record["release_id"] +
                              "`, digest `" + record["digest"] + "`\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Production delivery failed: " + str(error), file=sys.stderr)
        sys.exit(1)
