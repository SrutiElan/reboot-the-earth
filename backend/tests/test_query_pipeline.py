"""Integration checks against the imported local PostGIS database.

No OpenAI calls in the default suite. RUN_LIVE_AI_TEST=1 additionally checks
real model repair after an intentionally injected first-query typo.
"""
import json
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import assistant
from main import app
from sql_service import QueryError, execute_query, validate_sql


class QueryPipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_context = TestClient(app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_context.__exit__(None, None, None)
        assistant.engine.dispose()

    def test_read_only_ast(self):
        for sql in ["DELETE FROM ofo_trees", "SELECT 1; SELECT 2", "WITH x AS (DELETE FROM ofo_trees RETURNING *) SELECT * FROM x", "SELECT * INTO test_copy FROM ofo_trees", "SELECT pg_read_file('/etc/passwd')", "SELECT * FROM pg_catalog.pg_authid", "SELECT set_config('statement_timeout', '0', true)"]:
            with self.subTest(sql=sql), self.assertRaises(QueryError):
                validate_sql(sql)
        self.assertTrue(validate_sql("SELECT 'delete; update' AS note /* SELECT only */"))

    def test_real_postgis_and_role(self):
        result = execute_query("SELECT current_user AS role, COUNT(*) AS trees FROM ofo_trees")
        self.assertEqual(result["rows"][0]["role"], "ofo_reader")
        self.assertGreater(result["rows"][0]["trees"], 0)
        spatial = execute_query("SELECT plot_id FROM ofo_trees WHERE height <= 10 AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(-120.1862197, 39.40647418),4326)::geography,100)")
        self.assertGreater(spatial["row_count"], 0)
        self.assertTrue(all(r["plot_id"] == "0014" for r in spatial["rows"]))
        self.assertEqual(execute_query("SELECT COUNT(*) AS count FROM ofo_trees WHERE height < 0")["rows"][0]["count"], 0)

    def test_limit_types_and_duplicate_columns(self):
        limited = execute_query("SELECT plot_id FROM ofo_trees", max_rows=2)
        self.assertEqual(limited["row_count"], 2)
        self.assertTrue(limited["truncated"])
        row = execute_query("SELECT 1 AS x, 2 AS x, ARRAY[1, 2] AS values, 'NaN'::float8 AS missing")["rows"][0]
        self.assertEqual(row["x"], 1)
        self.assertEqual(row["x_2"], 2)
        self.assertEqual(row["values"], [1, 2])
        self.assertIsNone(row["missing"])

    def test_catalog_and_downloads(self):
        body = self.client.get("/api/catalog").json()
        ids = {d["id"] for d in body["datasets"]}
        self.assertEqual(len(ids), len(body["datasets"]))
        for dataset in body["datasets"]:
            self.assertTrue(set(dataset["overlaps"]).issubset(ids))
        response = self.client.get("/api/catalog/datasets/ground-0014/files/trees.csv")
        self.assertEqual(response.status_code, 200)
        self.assertIn("plot_id", response.text)
        bundle = self.client.get("/api/catalog/datasets/ground-0014/download")
        self.assertEqual(bundle.content[:2], b"PK")
        self.assertEqual(self.client.get("/api/catalog/datasets/ground-invalid/download").status_code, 404)

    def stream_events(self, question):
        response = self.client.post("/api/assistant/query", json={"question": question})
        self.assertEqual(response.status_code, 200)
        return [json.loads(line) for line in response.text.splitlines() if line]

    def test_error_is_fed_back_and_repaired(self):
        class Planner:
            calls = 0
            async def ainvoke(inner, inputs):
                inner.calls += 1
                if inner.calls == 1:
                    return assistant.QueryPlan(sql="SELECT nonexistent_height FROM ofo_trees LIMIT 1", explanation="Query")
                self.assertIn("nonexistent_height", inputs["attempts"])
                self.assertIn("does not exist", inputs["attempts"])
                return assistant.QueryPlan(sql="SELECT COUNT(*) AS tree_count FROM ofo_trees", explanation="Query")
        class Reviewer:
            async def ainvoke(inner, inputs):
                self.assertGreater(json.loads(inputs["result"])["rows"][0]["tree_count"], 0)
                return assistant.Review(decision="usable", feedback="", answer="Verified count", follow=[])
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-only"}), patch.object(assistant, "build_chains", return_value=(Planner(), Reviewer())):
            events = self.stream_events("How many trees?")
        final = events[-1]["answer"]
        self.assertEqual(final["status"], "usable")
        self.assertEqual(len(final["attempts"]), 2)
        self.assertIn("error", final["attempts"][0])

    def test_empty_data_retries_then_reports_empty(self):
        class Planner:
            async def ainvoke(inner, inputs):
                return assistant.QueryPlan(sql="SELECT plot_id FROM ofo_trees WHERE height < 0", explanation="Query")
        class Reviewer:
            async def ainvoke(inner, inputs):
                return assistant.Review(decision="empty", feedback="No matching records", answer="No matching records", follow=[])
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-only"}), patch.object(assistant, "build_chains", return_value=(Planner(), Reviewer())):
            events = self.stream_events("Trees with negative measured heights")
        self.assertEqual(events[-1]["answer"]["status"], "empty")
        self.assertEqual(len(events[-1]["answer"]["attempts"]), 2)
        self.assertEqual(events[-1]["answer"]["data"]["rows"], [])

    def test_retry_limit(self):
        class Planner:
            async def ainvoke(inner, inputs):
                return assistant.QueryPlan(sql="SELECT nonexistent_height FROM ofo_trees", explanation="Query")
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-only", "AI_MAX_ATTEMPTS": "3"}), patch.object(assistant, "build_chains", return_value=(Planner(), None)):
            events = self.stream_events("Query")
        self.assertEqual(events[-1]["answer"]["status"], "failed")
        self.assertEqual(len(events[-1]["answer"]["attempts"]), 3)

    @unittest.skipUnless(os.getenv("RUN_LIVE_AI_TEST") == "1", "Optional real OpenAI repair check")
    def test_live_model_repairs_database_error(self):
        original = assistant.build_chains
        def chains(schema):
            real_planner, reviewer = original(schema)
            class FirstQueryTypo:
                calls = 0
                async def ainvoke(inner, inputs):
                    inner.calls += 1
                    if inner.calls == 1:
                        return assistant.QueryPlan(sql="SELECT COUNT(nonexistent_tree_id) AS tree_count FROM ofo_trees", explanation="Initial query")
                    return await real_planner.ainvoke(inputs)
            return FirstQueryTypo(), reviewer
        with patch.object(assistant, "build_chains", side_effect=chains):
            events = self.stream_events("数据库里共有多少条树木记录？返回总数。")
        final = events[-1]["answer"]
        self.assertEqual(final["status"], "usable")
        self.assertGreaterEqual(len(final["attempts"]), 2)
        self.assertIn("error", final["attempts"][0])


if __name__ == "__main__":
    unittest.main()
