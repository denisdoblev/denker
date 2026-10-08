from __future__ import annotations

import unittest

from sdd.context.evals.evaluate_context import summarize


class EvaluateContextTest(unittest.TestCase):
    def test_gates_use_recall_precision_contracts_quality_and_savings(self) -> None:
        result = {
            "local_assisted": {
                "status": "ok",
                "selected_files": ["required.py", "support.py"],
                "required_recall": 1.0,
                "precision": 1.0,
                "irrelevant_files": [],
                "critical_omissions": [],
                "contract_violations": [],
            }
        }
        paired = [
            {
                "kind": "analysis" if index < 3 else "repair",
                "direct_quality": 95,
                "local_quality": 94,
                "direct_input_tokens": 1000,
                "local_input_tokens": 500,
                "correct": True,
            }
            for index in range(4)
        ]
        summary = summarize([result], paired)
        self.assertEqual("promising", summary["verdict"])
        self.assertFalse(summary["automatic_default_promotion"])

        fallback = {
            "local_assisted": {
                "status": "fallback_required",
                "selected_files": [],
                "required_recall": 0.0,
                "precision": 0.0,
                "irrelevant_files": [],
                "critical_omissions": ["required.py"],
                "contract_violations": [],
            }
        }
        summary = summarize([fallback], paired)
        self.assertFalse(summary["gates"]["required_recall_at_least_95_percent_each_case"])
        self.assertFalse(summary["gates"]["aggregate_precision_at_least_90_percent"])
        self.assertEqual("rejected", summary["verdict"])


if __name__ == "__main__":
    unittest.main()
