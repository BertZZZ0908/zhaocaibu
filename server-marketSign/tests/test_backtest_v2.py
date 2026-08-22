import json
import tempfile
import unittest
from pathlib import Path

import sys


SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from backtest_v2 import (  # noqa: E402
    adaptive_hold_band,
    build_samples,
    build_shadow_weights,
    calculate_metrics,
    classify_return,
    compound_forward_return,
    infer_market_regime,
    load_records,
)


def master(master_id="trend", verdict="BUY", scores=None):
    return {
        "id": master_id,
        "name": master_id,
        "verdict": verdict,
        "confidence": 0.7,
        "scores": scores or {"buy": 0.7, "hold": 0.2, "sell": 0.1},
    }


def record(index, daily_return, masters=None):
    return {
        "date": f"2026-01-{index + 1:02d}",
        "sh_chg_pct": daily_return,
        "masters": masters or [master()],
    }


class BacktestV2Tests(unittest.TestCase):
    def test_compound_forward_return_uses_exact_trading_horizon(self):
        records = [record(i, value) for i, value in enumerate([0, 1, 2, -1, 3])]
        self.assertAlmostEqual(compound_forward_return(records, 0, 3), 1.9898, places=4)
        self.assertIsNone(compound_forward_return(records, 2, 3))

    def test_adaptive_band_only_uses_information_at_prediction_time(self):
        base = [record(i, 0.2 if i % 2 else -0.2) for i in range(10)]
        original = adaptive_hold_band(base, 4, 5)
        base[8]["sh_chg_pct"] = 9.0
        self.assertEqual(original, adaptive_hold_band(base, 4, 5))

    def test_market_regime_detects_direction(self):
        up = [record(i, 0.5) for i in range(20)]
        down = [record(i, -0.5) for i in range(20)]
        self.assertEqual(infer_market_regime(up, 19), "UP_TREND")
        self.assertEqual(infer_market_regime(down, 19), "DOWN_TREND")

    def test_labels_have_neutral_zone(self):
        self.assertEqual(classify_return(0.3, 0.5), "HOLD")
        self.assertEqual(classify_return(0.8, 0.5), "BUY")
        self.assertEqual(classify_return(-0.8, 0.5), "SELL")

    def test_balanced_accuracy_and_brier_are_reported(self):
        samples = [
            {"actual": "BUY", "prediction": "BUY", "probabilities": {"BUY": .7, "HOLD": .2, "SELL": .1}, "forward_return": 1},
            {"actual": "HOLD", "prediction": "HOLD", "probabilities": {"BUY": .2, "HOLD": .6, "SELL": .2}, "forward_return": 0},
            {"actual": "SELL", "prediction": "HOLD", "probabilities": {"BUY": .1, "HOLD": .6, "SELL": .3}, "forward_return": -1},
        ]
        metrics = calculate_metrics(samples)
        self.assertEqual(metrics["samples"], 3)
        self.assertAlmostEqual(metrics["accuracy"], 2 / 3, places=4)
        self.assertAlmostEqual(metrics["balanced_accuracy"], 2 / 3, places=4)
        self.assertGreater(metrics["brier"], 0)

    def test_mock_records_are_excluded(self):
        records = [record(i, 0.3) for i in range(10)]
        records[0]["data_source"] = "mock · 演示数据"
        samples = build_samples(records, "trend", 3)
        self.assertNotIn(0, [sample["index"] for sample in samples])

    def test_shadow_payload_never_activates_itself(self):
        all_masters = [
            master("trend"), master("fund"), master("value"), master("cycle"),
            master("spec"), master("quant"), master("behavior"), master("retail"),
        ]
        records = [record(i, 0.2 if i % 3 else -0.1, all_masters) for i in range(45)]
        payload = build_shadow_weights(records, min_samples=5)
        self.assertEqual(payload["mode"], "shadow")
        self.assertFalse(payload["activated"])
        self.assertIn("3", payload["horizons"])
        self.assertIn("5", payload["horizons"])
        self.assertIn("20", payload["horizons"])

    def test_load_records_orders_and_filters_by_latest_date(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            for date in ("2026-01-01", "2026-01-10", "2026-01-05"):
                with open(root / f"{date}.json", "w", encoding="utf-8") as handle:
                    json.dump({"date": date, "sh_chg_pct": 0, "masters": []}, handle)
            loaded = load_records(days=7, verdict_dir=root)
            self.assertEqual([item["date"] for item in loaded], ["2026-01-05", "2026-01-10"])


if __name__ == "__main__":
    unittest.main()
