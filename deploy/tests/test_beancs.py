import copy
import unittest
from unittest.mock import Mock, patch
import io

from deploy.beancs import BeanCS, DeliveryError, deliver, smoke_test, validate_inputs, wait_for_run

CONFIG = {"site_url": "https://example.test", "environment_id": "production", "delivery_target_id": "cluster",
          "artifact_connection_id": "registry", "components": {
              name: {"id": name, "repository": "reboot-earth-proj/" + name} for name in ("backend", "frontend")}}
DIGESTS = {name: "sha256:" + value * 64 for name, value in (("backend", "a"), ("frontend", "b"))}


class FakeBeanCS:
    def __init__(self):
        self.calls = []
        self.no_previous = False

    def request(self, path, method="GET", payload=None):
        self.calls.append((path, method, copy.deepcopy(payload)))
        if path.startswith("/deployment-runs?"):
            return {"data": [{"status": "succeeded", "release_id": "old-" + name,
                              "delivery_target_id": "cluster"} for name in ("backend", "frontend")]}
        if path.startswith("/releases?"):
            name = "backend" if "component_id=backend" in path else "frontend"
            return {"data": [] if self.no_previous else [{"id": "old-" + name, "status": "succeeded",
                    "delivery_target_id": "cluster", "runtime_config_revision": "runtime-" + name,
                    "secret_bindings": {"keep": "unchanged"}}]}
        if path == "/artifacts/resolve":
            return {"id": payload["repository"], "digest": payload["digest"]}
        if path == "/releases":
            return {"id": "new-" + payload["component_id"]}
        if path == "/deployment-runs":
            return {"deployment_run": {"id": payload["release_id"]}}
        if path.endswith("/rollback"):
            return {"deployment_run": {"id": payload["target_release_id"]}}
        raise AssertionError(path)


class DeliveryTests(unittest.TestCase):
    def test_success_resolves_both_and_preserves_runtime(self):
        client, waiter = FakeBeanCS(), Mock()
        result = deliver(client, CONFIG, DIGESTS, "c" * 40, "v1", "run:1", verify=lambda _: {"trees": 64295}, waiter=waiter)
        self.assertEqual(result["revision"], "c" * 40)
        self.assertEqual([c.args[1] for c in waiter.call_args_list], ["new-backend", "new-frontend"])
        writes = [(p, body) for p, method, body in client.calls if method == "POST"]
        self.assertEqual([p for p, _ in writes[:2]], ["/artifacts/resolve"] * 2)
        for path, body in writes:
            if path == "/releases":
                self.assertEqual(body["runtime_config_revision"], "runtime-" + body["component_id"])
                self.assertEqual(body["secret_bindings"], {"keep": "unchanged"})
                self.assertNotIn("runtime_config", body)
            if path == "/artifacts/resolve":
                self.assertNotIn("tag", body)
        self.assertFalse(any("runtime/resources" in path or "uploads" in path for path, _, _ in client.calls))

    def test_failed_frontend_rolls_back_both_in_reverse_order(self):
        client = FakeBeanCS()
        def waiter(_, id_):
            if id_ == "new-frontend":
                raise DeliveryError("bad frontend")
        with self.assertRaisesRegex(DeliveryError, "previous releases restored"):
            deliver(client, CONFIG, DIGESTS, "c" * 40, "v1", "run:1", verify=Mock(), waiter=waiter)
        rollbacks = [payload["target_release_id"] for path, _, payload in client.calls if path.endswith("/rollback")]
        self.assertEqual(rollbacks, ["old-frontend", "old-backend"])

    def test_smoke_failure_rolls_back(self):
        client = FakeBeanCS()
        with self.assertRaisesRegex(DeliveryError, "unhealthy"):
            deliver(client, CONFIG, DIGESTS, "c" * 40, "v1", "run:1", verify=Mock(side_effect=DeliveryError("unhealthy")), waiter=Mock())
        self.assertEqual(sum(path.endswith("/rollback") for path, _, _ in client.calls), 2)

    def test_next_release_uses_actual_rollback_target_not_newest_release(self):
        client = FakeBeanCS()
        original = client.request
        def request(path, method="GET", payload=None):
            result = original(path, method, payload)
            if path.startswith("/releases?"):
                newer = dict(result["data"][0], id="newer-but-rolled-back", runtime_config_revision="wrong-runtime")
                result["data"].insert(0, newer)
            return result
        client.request = request
        deliver(client, CONFIG, DIGESTS, "c" * 40, "v1", "run:1", verify=Mock(), waiter=Mock())
        for path, _, body in client.calls:
            if path == "/releases":
                self.assertNotEqual(body["runtime_config_revision"], "wrong-runtime")

    def test_smoke_probe_identifies_itself_and_never_sends_deploy_token(self):
        counts = b'{"rows":[{"role":"ofo_reader","trees":64295,"plots":287,"missions":687}]}'
        with patch("deploy.beancs.urllib.request.urlopen") as open_:
            responses = []
            for body in [b"", b"", b"", counts, b'{"configured":true,"provider":"openai"}']:
                response = Mock()
                response.status = 200
                response.read = io.BytesIO(body).read
                response.__enter__ = Mock(return_value=response)
                response.__exit__ = Mock(return_value=False)
                responses.append(response)
            open_.side_effect = responses
            smoke_test("https://example.test")
        for call in open_.call_args_list:
            self.assertEqual(call.args[0].get_header("User-agent"), "RebootEarth-GitHubActions/1")
            self.assertIsNone(call.args[0].get_header("Authorization"))

    def test_missing_previous_release_makes_no_writes(self):
        client = FakeBeanCS(); client.no_previous = True
        with self.assertRaisesRegex(DeliveryError, "unprotected"):
            deliver(client, CONFIG, DIGESTS, "c" * 40, "v1", "run:1", verify=Mock(), waiter=Mock())
        self.assertTrue(all(method == "GET" for _, method, _ in client.calls))

    def test_reject_mutable_tag_instead_of_digest(self):
        with self.assertRaisesRegex(DeliveryError, "immutable"):
            validate_inputs({"backend": "latest", "frontend": DIGESTS["frontend"]}, "c" * 40, "v1")

    def test_reject_unencrypted_or_credentialed_api_url(self):
        for url in ("http://example.test", "https://user:secret@example.test", "https://example.test?key=x"):
            with self.subTest(url=url), self.assertRaises(DeliveryError):
                BeanCS(url, "test-only")

    def test_wait_failed_run_and_timeout(self):
        client = Mock(); client.request.return_value = {"status": "failed", "error_message": "bad image"}
        with self.assertRaisesRegex(DeliveryError, "bad image"):
            wait_for_run(client, "run", sleep=lambda _: None)
        ticks = iter([0, 2])
        with self.assertRaisesRegex(DeliveryError, "Timed out"):
            wait_for_run(client, "run", timeout=1, clock=lambda: next(ticks), sleep=lambda _: None)


if __name__ == "__main__":
    unittest.main()
