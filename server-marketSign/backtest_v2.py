"""
大师回测评估 V2
================

目标：
1. 按大师擅长周期分别评估 3/5/20 个交易日表现；
2. 使用预测时点之前的波动率生成自适应 HOLD 标签；
3. 使用带隔离期的 walk-forward 样本外评估，避免重叠标签泄漏；
4. 输出准确率、平衡准确率、Brier 分数、混淆矩阵和简单信号收益；
5. 只生成影子权重，不直接覆盖线上 master_weights.json。

本模块只使用 Python 标准库，便于直接部署到服务器 cron。
"""

import argparse
import json
import math
import statistics
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"
VERDICT_DIR = OUTPUT_DIR / "verdicts"
SHADOW_WEIGHT_FILE = OUTPUT_DIR / "master_weights_shadow.json"

CLASS_LABELS = ("BUY", "HOLD", "SELL")
MASTER_HORIZONS = {
    "trend": 5,
    "fund": 5,
    "value": 20,
    "cycle": 20,
    "spec": 3,
    "quant": 5,
    "behavior": 3,
    "retail": 3,
}
MASTER_NAMES = {
    "trend": "趋势派·奥尼尔",
    "fund": "资金派·蔡金",
    "value": "价值派·格雷厄姆",
    "cycle": "周期派·霍华德·马克斯",
    "spec": "游资派·短线客",
    "quant": "量化派·西蒙斯",
    "behavior": "行为派·卡尼曼",
    "retail": "散户派·老张",
}


def _safe_float(value, default: float = 0.0) -> float:
    try:
        result = float(value)
        return result if math.isfinite(result) else default
    except (TypeError, ValueError):
        return default


def load_records(days: int = 730, verdict_dir: Path = VERDICT_DIR) -> List[dict]:
    """按日期加载最近 days 个自然日归档，不创建目录、不修改历史数据。"""
    if not verdict_dir.exists():
        return []
    files = sorted(verdict_dir.glob("*.json"))
    records = []
    for path in files:
        try:
            with open(path, "r", encoding="utf-8") as handle:
                record = json.load(handle)
            if record.get("date"):
                records.append(record)
        except (OSError, json.JSONDecodeError):
            continue
    records.sort(key=lambda item: item["date"])
    if days <= 0 or not records:
        return records
    latest = datetime.strptime(records[-1]["date"], "%Y-%m-%d")
    return [
        record for record in records
        if (latest - datetime.strptime(record["date"], "%Y-%m-%d")).days < days
    ]


def compound_forward_return(records: List[dict], index: int, horizon: int) -> Optional[float]:
    """计算预测日之后 horizon 个交易记录的复利累计涨跌幅。"""
    if horizon < 1 or index < 0 or index + horizon >= len(records):
        return None
    factor = 1.0
    for record in records[index + 1:index + horizon + 1]:
        value = record.get("sh_chg_pct")
        if value is None:
            return None
        daily_return = _safe_float(value, default=float("nan"))
        if not math.isfinite(daily_return):
            return None
        factor *= 1 + daily_return / 100
    return round((factor - 1) * 100, 6)


def realized_volatility(records: List[dict], index: int, lookback: int = 20) -> float:
    """只使用预测时点及此前收益计算日波动率，避免未来数据泄漏。"""
    start = max(0, index - lookback + 1)
    values = [_safe_float(item.get("sh_chg_pct")) for item in records[start:index + 1]]
    if len(values) < 2:
        return 0.8
    return max(statistics.pstdev(values), 0.2)


def adaptive_hold_band(records: List[dict], index: int, horizon: int) -> float:
    """波动率越高、预测周期越长，HOLD 的合理震荡区间越宽。"""
    band = 0.65 * realized_volatility(records, index) * math.sqrt(horizon)
    return round(max(0.35, min(band, 4.0)), 4)


def classify_return(forward_return: float, hold_band: float) -> str:
    if forward_return > hold_band:
        return "BUY"
    if forward_return < -hold_band:
        return "SELL"
    return "HOLD"


def infer_market_regime(records: List[dict], index: int, lookback: int = 20) -> str:
    """用预测时点之前的价格路径识别上涨、下跌、高波震荡或低波震荡。"""
    start = max(0, index - lookback + 1)
    history = [_safe_float(item.get("sh_chg_pct")) for item in records[start:index + 1]]
    if len(history) < 5:
        return "UNKNOWN"

    trend_window = history[-min(10, len(history)):]
    trend_factor = 1.0
    for daily_return in trend_window:
        trend_factor *= 1 + daily_return / 100
    trend_return = (trend_factor - 1) * 100
    volatility = max(statistics.pstdev(history), 0.2)
    trend_threshold = max(1.0, 0.75 * volatility * math.sqrt(len(trend_window)))

    if trend_return > trend_threshold:
        return "UP_TREND"
    if trend_return < -trend_threshold:
        return "DOWN_TREND"
    if volatility >= 1.35:
        return "HIGH_VOL_RANGE"
    return "LOW_VOL_RANGE"


def _master_from_record(record: dict, master_id: str) -> Optional[dict]:
    for master in record.get("masters", []):
        if master.get("id") == master_id:
            return master
    return None


def _probabilities(master: dict) -> Dict[str, float]:
    raw = master.get("scores") or master.get("detail", {}).get("scores", {})
    probs = {
        "BUY": max(0.0, _safe_float(raw.get("buy"))),
        "HOLD": max(0.0, _safe_float(raw.get("hold"))),
        "SELL": max(0.0, _safe_float(raw.get("sell"))),
    }
    total = sum(probs.values())
    if total <= 0:
        verdict = master.get("verdict", "HOLD")
        probs = {label: (0.7 if label == verdict else 0.15) for label in CLASS_LABELS}
        total = 1.0
    return {label: probs[label] / total for label in CLASS_LABELS}


def _prediction(master: dict) -> str:
    verdict = str(master.get("verdict", "HOLD")).upper()
    return verdict if verdict in CLASS_LABELS else "HOLD"


def record_is_eligible(record: dict) -> bool:
    """明确的 mock/休市/低质量缓存不进入新评估；旧归档因无质量字段继续兼容。"""
    source = str(record.get("data_source", "")).lower()
    quality = record.get("data_quality") or {}
    if any(token in source for token in ("mock", "holiday")):
        return False
    if quality and quality.get("score") is not None and _safe_float(quality.get("score")) < 2:
        return False
    return True


def build_samples(records: List[dict], master_id: str, horizon: Optional[int] = None) -> List[dict]:
    horizon = horizon or MASTER_HORIZONS[master_id]
    samples = []
    for index, record in enumerate(records):
        if not record_is_eligible(record):
            continue
        master = _master_from_record(record, master_id)
        if not master:
            continue
        forward_return = compound_forward_return(records, index, horizon)
        if forward_return is None:
            continue
        hold_band = adaptive_hold_band(records, index, horizon)
        samples.append({
            "index": index,
            "target_index": index + horizon,
            "date": record["date"],
            "master_id": master_id,
            "horizon": horizon,
            "regime": infer_market_regime(records, index),
            "prediction": _prediction(master),
            "probabilities": _probabilities(master),
            "actual": classify_return(forward_return, hold_band),
            "forward_return": forward_return,
            "hold_band": hold_band,
        })
    return samples


def _confusion(samples: Iterable[dict]) -> Dict[str, Dict[str, int]]:
    matrix = {actual: {predicted: 0 for predicted in CLASS_LABELS} for actual in CLASS_LABELS}
    for sample in samples:
        matrix[sample["actual"]][sample["prediction"]] += 1
    return matrix


def calculate_metrics(samples: List[dict]) -> dict:
    if not samples:
        return {
            "samples": 0, "accuracy": 0.0, "balanced_accuracy": 0.0,
            "brier": 1.0, "mean_signal_return": 0.0,
            "confusion": _confusion([]), "class_support": {},
        }

    matrix = _confusion(samples)
    correct = sum(1 for item in samples if item["prediction"] == item["actual"])
    recalls = []
    support = {}
    for label in CLASS_LABELS:
        label_total = sum(matrix[label].values())
        support[label] = label_total
        if label_total:
            recalls.append(matrix[label][label] / label_total)

    brier_total = 0.0
    signal_returns = []
    positions = {"BUY": 1.0, "HOLD": 0.0, "SELL": -1.0}
    for item in samples:
        brier_total += sum(
            (item["probabilities"][label] - (1.0 if item["actual"] == label else 0.0)) ** 2
            for label in CLASS_LABELS
        ) / len(CLASS_LABELS)
        signal_returns.append(positions[item["prediction"]] * item["forward_return"])

    return {
        "samples": len(samples),
        "accuracy": round(correct / len(samples), 4),
        "balanced_accuracy": round(sum(recalls) / max(len(recalls), 1), 4),
        "brier": round(brier_total / len(samples), 4),
        "mean_signal_return": round(sum(signal_returns) / len(signal_returns), 4),
        "confusion": matrix,
        "class_support": support,
    }


def baseline_metrics(samples: List[dict], verdict: str = "HOLD") -> dict:
    baseline = []
    for item in samples:
        clone = dict(item)
        clone["prediction"] = verdict
        clone["probabilities"] = {
            label: (1.0 if label == verdict else 0.0) for label in CLASS_LABELS
        }
        baseline.append(clone)
    return calculate_metrics(baseline)


def _paired_agreement(samples_by_master: Dict[str, List[dict]], master_id: str) -> float:
    own = {sample["date"]: sample["prediction"] for sample in samples_by_master.get(master_id, [])}
    agreements = []
    for other_id, other_samples in samples_by_master.items():
        if other_id == master_id:
            continue
        other = {sample["date"]: sample["prediction"] for sample in other_samples}
        common = own.keys() & other.keys()
        if common:
            agreements.append(sum(own[date] == other[date] for date in common) / len(common))
    return sum(agreements) / len(agreements) if agreements else 0.0


def weight_from_metrics(metrics: dict, agreement: float = 0.0, min_samples: int = 20) -> float:
    """平衡准确率与概率质量共同定权，小样本收缩并惩罚高度同质化预测。"""
    count = metrics.get("samples", 0)
    if count <= 0:
        return 1.0
    quality = 0.7 * metrics["balanced_accuracy"] + 0.3 * (1 - metrics["brier"])
    shrinkage = min(count / max(min_samples, 1), 1.0)
    raw_weight = 1.0 + (quality - 0.5) * 1.5 * shrinkage
    diversity_penalty = max(0.0, agreement - 0.75) * 0.6
    return round(max(0.5, min(1.5, raw_weight - diversity_penalty)), 3)


def _aggregate_prediction(masters: List[Tuple[dict, float]]) -> Tuple[str, Dict[str, float]]:
    totals = {label: 0.0 for label in CLASS_LABELS}
    total_weight = 0.0
    for master, weight in masters:
        probs = _probabilities(master)
        confidence = max(0.3, min(_safe_float(master.get("confidence"), 0.5), 1.0))
        effective = weight * (0.4 + 0.6 * confidence)
        total_weight += effective
        for label in CLASS_LABELS:
            totals[label] += probs[label] * effective
    if total_weight <= 0:
        return "HOLD", {"BUY": 0.2, "HOLD": 0.6, "SELL": 0.2}
    probs = {label: totals[label] / total_weight for label in CLASS_LABELS}
    ordered = sorted(probs.items(), key=lambda pair: pair[1], reverse=True)
    prediction = ordered[0][0] if ordered[0][1] - ordered[1][1] >= 0.08 else "HOLD"
    return prediction, probs


def walk_forward_report(records: List[dict], min_train: int = 20) -> dict:
    """带 horizon 隔离期的 expanding walk-forward；所有权重只从已成熟旧标签计算。"""
    groups = defaultdict(list)
    for master_id, horizon in MASTER_HORIZONS.items():
        groups[horizon].append(master_id)

    report = {}
    for horizon, master_ids in sorted(groups.items()):
        all_samples = {mid: build_samples(records, mid, horizon) for mid in master_ids}
        sample_lookup = {
            mid: {sample["index"]: sample for sample in samples}
            for mid, samples in all_samples.items()
        }
        ensemble_samples = []

        for index, record in enumerate(records):
            forward_return = compound_forward_return(records, index, horizon)
            if forward_return is None or not record_is_eligible(record):
                continue

            # embargo=horizon：训练标签结束日还要早于当前预测日 horizon 天。
            cutoff = index - horizon
            train_by_master = {
                mid: [sample for sample in all_samples[mid] if sample["target_index"] <= cutoff]
                for mid in master_ids
            }
            if any(len(samples) < min_train for samples in train_by_master.values()):
                continue

            current_regime = infer_market_regime(records, index)
            weighted_masters = []
            for mid in master_ids:
                current_master = _master_from_record(record, mid)
                if not current_master or index not in sample_lookup[mid]:
                    continue
                global_metrics = calculate_metrics(train_by_master[mid])
                regime_samples = [
                    sample for sample in train_by_master[mid]
                    if sample["regime"] == current_regime
                ]
                selected_metrics = (
                    calculate_metrics(regime_samples)
                    if len(regime_samples) >= max(8, min_train // 2)
                    else global_metrics
                )
                agreement = _paired_agreement(train_by_master, mid)
                weighted_masters.append((current_master, weight_from_metrics(selected_metrics, agreement)))

            if len(weighted_masters) != len(master_ids):
                continue
            prediction, probs = _aggregate_prediction(weighted_masters)
            hold_band = adaptive_hold_band(records, index, horizon)
            ensemble_samples.append({
                "index": index,
                "date": record["date"],
                "horizon": horizon,
                "regime": current_regime,
                "prediction": prediction,
                "probabilities": probs,
                "actual": classify_return(forward_return, hold_band),
                "forward_return": forward_return,
                "hold_band": hold_band,
            })

        metrics = calculate_metrics(ensemble_samples)
        report[str(horizon)] = {
            "masters": master_ids,
            "embargo_days": horizon,
            "min_train": min_train,
            "metrics": metrics,
            "always_hold_baseline": baseline_metrics(ensemble_samples),
        }
    return report


def evaluate(records: List[dict], min_train: int = 20) -> dict:
    masters = {}
    horizon_samples = defaultdict(list)
    for master_id, horizon in MASTER_HORIZONS.items():
        samples = build_samples(records, master_id, horizon)
        metrics = calculate_metrics(samples)
        masters[master_id] = {
            "name": MASTER_NAMES[master_id],
            "horizon": horizon,
            "metrics": metrics,
            "by_regime": {
                regime: calculate_metrics([s for s in samples if s["regime"] == regime])
                for regime in ("UP_TREND", "DOWN_TREND", "HIGH_VOL_RANGE", "LOW_VOL_RANGE")
            },
        }
        horizon_samples[horizon].extend(samples)

    baselines = {
        str(horizon): baseline_metrics(samples)
        for horizon, samples in sorted(horizon_samples.items())
    }
    return {
        "schema_version": 2,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "record_count": len(records),
        "masters": masters,
        "always_hold_baselines": baselines,
        "walk_forward": walk_forward_report(records, min_train=min_train),
    }


def build_shadow_weights(records: List[dict], min_samples: int = 20) -> dict:
    groups = defaultdict(list)
    for master_id, horizon in MASTER_HORIZONS.items():
        groups[horizon].append(master_id)

    horizons = {}
    for horizon, master_ids in sorted(groups.items()):
        samples_by_master = {
            mid: build_samples(records, mid, horizon) for mid in master_ids
        }
        global_weights = {}
        regime_weights = defaultdict(dict)
        metrics_summary = {}
        for mid in master_ids:
            samples = samples_by_master[mid]
            metrics = calculate_metrics(samples)
            agreement = _paired_agreement(samples_by_master, mid)
            global_weights[mid] = weight_from_metrics(metrics, agreement, min_samples)
            metrics_summary[mid] = {
                "samples": metrics["samples"],
                "balanced_accuracy": metrics["balanced_accuracy"],
                "brier": metrics["brier"],
                "agreement": round(agreement, 4),
            }
            for regime in ("UP_TREND", "DOWN_TREND", "HIGH_VOL_RANGE", "LOW_VOL_RANGE"):
                regime_samples = [sample for sample in samples if sample["regime"] == regime]
                if len(regime_samples) >= max(8, min_samples // 2):
                    regime_metrics = calculate_metrics(regime_samples)
                    regime_weights[regime][mid] = weight_from_metrics(
                        regime_metrics, agreement, min_samples
                    )
                else:
                    regime_weights[regime][mid] = global_weights[mid]
        horizons[str(horizon)] = {
            "masters": master_ids,
            "global_weights": global_weights,
            "regime_weights": dict(regime_weights),
            "metrics": metrics_summary,
        }

    return {
        "schema_version": 1,
        "mode": "shadow",
        "activated": False,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "record_count": len(records),
        "minimum_samples": min_samples,
        "horizons": horizons,
        "walk_forward": walk_forward_report(records, min_train=min_samples),
        "notice": "影子权重仅用于观察，不会被线上 Oracle 自动加载。",
    }


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    tmp.replace(path)


def print_summary(report: dict) -> None:
    print("\n=== 大师评估 V2：多周期 + 波动自适应标签 ===\n")
    print(f"归档记录: {report['record_count']}")
    print(f"{'大师':<20} {'周期':>4} {'样本':>6} {'准确率':>8} {'平衡准确率':>10} {'Brier':>8}")
    print("-" * 68)
    ordered = sorted(
        report["masters"].items(),
        key=lambda pair: pair[1]["metrics"]["balanced_accuracy"],
        reverse=True,
    )
    for _, item in ordered:
        metrics = item["metrics"]
        print(
            f"{item['name']:<20} {item['horizon']:>4} {metrics['samples']:>6} "
            f"{metrics['accuracy']:>7.1%} {metrics['balanced_accuracy']:>9.1%} "
            f"{metrics['brier']:>8.3f}"
        )

    print("\nWalk-forward 样本外集成:")
    for horizon, item in report["walk_forward"].items():
        metrics = item["metrics"]
        baseline = item["always_hold_baseline"]
        print(
            f"  {horizon}日: 样本={metrics['samples']} 平衡准确率={metrics['balanced_accuracy']:.1%} "
            f"HOLD基准={baseline['balanced_accuracy']:.1%} 隔离={item['embargo_days']}日"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="大师回测评估 V2")
    parser.add_argument("command", choices=("evaluate", "shadow-update"))
    parser.add_argument("--days", type=int, default=730)
    parser.add_argument("--min-train", type=int, default=20)
    parser.add_argument("--output", default="")
    args = parser.parse_args()

    records = load_records(args.days)
    if not records:
        raise SystemExit("[V2] 没有可用归档")

    if args.command == "evaluate":
        report = evaluate(records, min_train=args.min_train)
        print_summary(report)
        if args.output:
            save_json(Path(args.output), report)
            print(f"\n[V2] 报告已保存: {args.output}")
        return

    shadow = build_shadow_weights(records, min_samples=args.min_train)
    target = Path(args.output) if args.output else SHADOW_WEIGHT_FILE
    save_json(target, shadow)
    print(f"[V2] 影子权重已保存: {target}")
    print(f"[V2] 记录数: {len(records)}；线上权重未修改")


if __name__ == "__main__":
    main()
