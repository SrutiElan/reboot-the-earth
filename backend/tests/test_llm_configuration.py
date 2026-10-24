"""No-network checks for direct OpenAI and Chat Completions relay configuration."""
import asyncio
import os
import unittest
from unittest.mock import patch

import assistant
import uploads


class LlmConfigurationTests(unittest.TestCase):
    def test_openai_relay_settings(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "", "OPENAI_API_KEY": "test-only", "OPENAI_BASE_URL": "http://relay:8103/v1"}):
            settings = assistant.llm_settings()
        self.assertEqual(settings["provider"], "openai")
        self.assertEqual(settings["base_url"], "http://relay:8103/v1")

    def test_gemini_keeps_its_own_endpoint(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-only", "OPENAI_BASE_URL": "http://relay:8103/v1"}):
            settings = assistant.llm_settings()
        self.assertEqual(settings["provider"], "gemini")
        self.assertEqual(settings["base_url"], assistant.GEMINI_BASE_URL)

    def test_assistant_can_disable_responses_api(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "", "OPENAI_API_KEY": "test-only", "OPENAI_BASE_URL": "http://relay:8103/v1", "OPENAI_USE_RESPONSES_API": "false"}), patch.object(assistant, "ChatOpenAI", side_effect=RuntimeError("constructor intercepted")) as model:
            with self.assertRaisesRegex(RuntimeError, "constructor intercepted"):
                assistant.build_chains("test schema")
        self.assertFalse(model.call_args.kwargs["use_responses_api"])
        self.assertEqual(model.call_args.kwargs["base_url"], "http://relay:8103/v1")

    def test_upload_review_uses_the_same_relay(self):
        with patch.dict(os.environ, {"OPENAI_BASE_URL": "http://relay:8103/v1", "OPENAI_USE_RESPONSES_API": "false"}), patch.object(uploads, "ChatOpenAI", side_effect=RuntimeError("constructor intercepted")) as model:
            with self.assertRaisesRegex(RuntimeError, "constructor intercepted"):
                asyncio.run(uploads.review_with_ai({}))
        self.assertFalse(model.call_args.kwargs["use_responses_api"])
        self.assertEqual(model.call_args.kwargs["base_url"], "http://relay:8103/v1")
