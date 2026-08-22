"""
回测追踪系统 v1.0 — 大师判读存档 + N日回测 + 准确率跟踪 (P2-7)
============================================================
核心功能:
  1. 每日归档: 将大师判读与行情快照存入 output/verdicts/YYYY-MM-DD.json
  2. CLI回测: 对比历史判读与实际N日涨跌
  3. 准确率: 计算 BUY/SELL/HOLD 的命中率
  4. 权重校准建议: 根据历史表现输出大师权重调整

用法:
  python3 backtest_tracker.py archive  # 归档今日判读
  python3 backtest_tracker.py backtest --days 5   # 回测近30天内5日判读准确率
  python3 backtest_tracker.py stats                # 显示各大师统计
  python3 backtest_tracker.py weights              # 输出动态权重建议

Author: AI Engineer Agent
Date: 2026-06-07
Version: 1.0.0
"""

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"
VERDICT_DIR = OUTPUT_DIR / "verdicts"

# 仅当前线上 8 位大师参与统计和权重训练。历史版本遗留的试验大师不能
# 混入样本，否则会扭曲集体准确率与后续投票权重。
CANONICAL_MASTER_IDS = {
    "trend", "fund", "value", "cycle", "spec", "quant", "behavior", "retail",
}
DEFAULT_WINDOW_DAYS = 90
DEFAULT_FORWARD_DAYS = 5
HOLD_BAND_PER_DAY = 0.5


def ensure_dir():
    VERDICT_DIR.mkdir(parents=True, exist_ok=True)


def archive_verdict(date: datetime, sign_data: dict):
    """
    归档每日大师判读到 output/verdicts/YYYY-MM-DD.json
    包含: 行情快照 + 8位大师判读 + 签文等级
    """
    ensure_dir()

    masters = sign_data.get("masters", {}).get("list", [])
    expand = sign_data.get("expand", {})
    nt = sign_data.get("nationalTeam", {})

    record = {
        "date": date.strftime("%Y-%m-%d"),
        "sh_chg_pct": expand.get("shChgPct", 0),
        "sh_close": expand.get("shClose"),
        "emotion": expand.get("emotion", 50),
        "emotion_label": expand.get("emotionLabel", ""),
        "up_count": expand.get("upCount", 0),
        "down_count": expand.get("downCount", 0),
        "grade": sign_data.get("grade", ""),
        "grade_label": sign_data.get("gradeLabel", ""),
        "consensus": sign_data.get("masters", {}).get("consensus", ""),
        "nt_phase": nt.get("phase", "") if nt.get("enabled") else "",
        "masters": [
            {
                "id": m.get("id", ""),
                "name": m.get("name", ""),
                "verdict": m.get("verdict", "HOLD"),
                "tactics": m.get("tactics", ""),
                "confidence": m.get("detail", {}).get("confidence", 0.5),
                "scores": m.get("detail", {}).get("scores", {}),
            }
            for m in masters
        ],
    }

    fp = VERDICT_DIR / f"{date.strftime('%Y-%m-%d')}.json"
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    print(f"[归档] {record['date']} → {fp}")
    return record


def load_verdicts(days: int = 30) -> List[dict]:
    """加载最近N天的判读归档"""
    ensure_dir()
    records = []
    today = datetime.now()
    for i in range(days):
        d = today - timedelta(days=i)
        fp = VERDICT_DIR / f"{d.strftime('%Y-%m-%d')}.json"
        if fp.exists():
            with open(fp, "r", encoding="utf-8") as f:
                records.append(json.load(f))
    records.sort(key=lambda r: r["date"])
    return records


def compute_forward_return(records: List[dict], forward_days: int = 5) -> List[dict]:
    """
    为每条记录计算 forward_days 日后的实际涨跌
    记录格式增强: forward_sh_chg, hit_B, hit_S, hit_H
    """
    if forward_days < 1:
        raise ValueError("forward_days 必须大于 0")

    enhanced = []
    for i, r in enumerate(records):
        r = dict(r)
        target_idx = i + forward_days
        if target_idx < len(records):
            # sh_chg_pct 是每日涨跌幅，N 日回测应使用随后 N 个交易日的
            # 复利累计收益，而不是错误地拿下一交易日的单日涨跌代替。
            cumulative_factor = 1.0
            try:
                for day in records[i + 1:target_idx + 1]:
                    cumulative_factor *= 1 + float(day.get("sh_chg_pct", 0)) / 100
            except (TypeError, ValueError):
                r["forward_sh_chg"] = None
                r["forward_days"] = None
                enhanced.append(r)
                continue
            r["forward_sh_chg"] = round((cumulative_factor - 1) * 100, 4)
            r["forward_days"] = forward_days
        else:
            r["forward_sh_chg"] = None
            r["forward_days"] = None
        enhanced.append(r)
    return enhanced


def is_hit(verdict: str, forward_return: float, forward_days: int) -> bool:
    """统一回测命中定义；震荡阈值随持有期按平方根缩放。"""
    if verdict == "BUY":
        return forward_return > 0
    if verdict == "SELL":
        return forward_return < 0
    if verdict == "HOLD":
        return abs(forward_return) <= HOLD_BAND_PER_DAY * (forward_days ** 0.5)
    return False


def backtest(days: int = DEFAULT_WINDOW_DAYS, forward_days: int = DEFAULT_FORWARD_DAYS):
    """
    回测: 对比大师判读与实际N日涨跌
    BUY命中 → N日累计收益为正; SELL命中 → N日累计收益为负;
    HOLD命中 → N日累计收益绝对值不超过随期限缩放的震荡阈值
    """
    records = load_verdicts(days)
    if len(records) < forward_days + 3:
        print(f"[回测] 历史记录不足(需要≥{forward_days+3}，当前{len(records)})")
        return

    enhanced = compute_forward_return(records, forward_days)
    valid = [r for r in enhanced if r["forward_sh_chg"] is not None]

    if not valid:
        print("[回测] 无法配对任何记录")
        return

    # 每个大师统计
    master_stats = {}
    for r in valid:
        for m in r["masters"]:
            mid = m["id"]
            if mid not in CANONICAL_MASTER_IDS:
                continue
            if mid not in master_stats:
                master_stats[mid] = {"total": 0, "hit": 0, "name": m["name"]}
            v = m["verdict"]
            actual = r["forward_sh_chg"]

            hit = is_hit(v, actual, r["forward_days"])

            master_stats[mid]["total"] += 1
            if hit:
                master_stats[mid]["hit"] += 1

    print(f"\n=== 回测报告 (近{days}日，前瞻{forward_days}个交易日累计收益，{len(valid)}条有效) ===\n")
    print(f"{'大师':<16} {'命中':>5} {'总数':>5} {'准确率':>8} {'评级':>6}")
    print("-" * 48)

    for mid, stats in sorted(master_stats.items(),
                              key=lambda x: x[1]["hit"] / max(x[1]["total"], 1),
                              reverse=True):
        acc = stats["hit"] / max(stats["total"], 1)
        grade = "⭐优秀" if acc > 0.65 else "👍良好" if acc > 0.50 else "👎待改进" if acc > 0.40 else "⚠️反向"
        print(f"{stats['name']:<16} {stats['hit']:>5} {stats['total']:>5} {acc:>7.0%} {grade:>6}")

    # 集体准确率
    all_total = sum(s["total"] for s in master_stats.values())
    all_hit = sum(s["hit"] for s in master_stats.values())
    print(f"\n集体: {all_hit}/{all_total} = {all_hit/max(all_total,1):.0%}")

    return master_stats


def stats():
    """显示各大师历史统计数据"""
    records = load_verdicts(90)
    if not records:
        print("[统计] 无历史记录")
        return

    master_stats = {}
    for r in records:
        for m in r["masters"]:
            mid = m["id"]
            if mid not in CANONICAL_MASTER_IDS:
                continue
            if mid not in master_stats:
                master_stats[mid] = {"name": m["name"], "BUY": 0, "SELL": 0, "HOLD": 0, "total": 0}
            v = m["verdict"]
            master_stats[mid][v] = master_stats[mid].get(v, 0) + 1
            master_stats[mid]["total"] += 1

    print(f"\n=== 大师判读分布 (近{len(records)}日) ===\n")
    print(f"{'大师':<16} {'BUY':>6} {'SELL':>6} {'HOLD':>6} {'总数':>6} {'倾向':>8}")
    print("-" * 52)
    for mid, s in master_stats.items():
        b = s["BUY"] / max(s["total"], 1)
        se = s["SELL"] / max(s["total"], 1)
        bias = "偏多" if b > 0.4 else "偏空" if se > 0.4 else "中性"
        print(f"{s['name']:<16} {s['BUY']:>6} {s['SELL']:>6} {s['HOLD']:>6} {s['total']:>6} {bias:>8}")


def compute_dynamic_weights(days: int = DEFAULT_WINDOW_DAYS, forward_days: int = DEFAULT_FORWARD_DAYS, auto_save: bool = False,
                             holdout_days: int = 1) -> dict:
    """
    基于回测结果计算动态权重建议（滚动窗口，消除前瞻偏差）

    Args:
        days: 回测窗口天数
        forward_days: 前瞻天数（5日判读对应5日涨跌）
        auto_save: 是否自动持久化到 master_weights.json
        holdout_days: 排除最近N天不参与权重训练（默认1=排除今天）

    【修复】问题1: 回测前瞻偏差
    - 权重计算排除最近 holdout_days 天的数据
    - 这些天的数据用作"验证集"而非"训练集"
    - 只有历史数据参与权重训练，避免用未来信息预测过去
    """
    records = load_verdicts(days)
    if len(records) < forward_days + holdout_days + 3:
        print(f"[权重] 历史记录不足(需要≥{forward_days+holdout_days+3}，当前{len(records)})，使用默认权重")
        return None

    # 分割: 训练集 (排除最近 holdout_days 天)
    train_records = records[:-holdout_days] if holdout_days > 0 and len(records) > holdout_days else records
    holdout_records = records[-holdout_days:] if holdout_days > 0 else []

    if len(train_records) < forward_days + 3:
        print(f"[权重] 训练集不足(需要≥{forward_days+3}，当前{len(train_records)})，使用默认权重")
        return None

    enhanced = compute_forward_return(train_records, forward_days)
    valid = [r for r in enhanced if r["forward_sh_chg"] is not None]
    if len(valid) < 3:
        print("[权重] 有效回测记录不足，使用默认权重")
        return None

    # 在验证集上评估预测质量（不要用训练集自评）
    if holdout_records and len(holdout_records) >= 1:
        holdout_enhanced = compute_forward_return(holdout_records, forward_days)
        valid_holdout = [r for r in holdout_enhanced if r["forward_sh_chg"] is not None]
        if valid_holdout:
            print(f"[权重] 滚动窗口: 训练{len(valid)}条 | 验证{len(valid_holdout)}条 (排除近{holdout_days}天)")

    master_stats = {}
    for r in valid:
        for m in r["masters"]:
            mid = m["id"]
            if mid not in CANONICAL_MASTER_IDS:
                continue
            if mid not in master_stats:
                master_stats[mid] = {"total": 0, "hit": 0, "name": m["name"]}
            v, actual = m["verdict"], r["forward_sh_chg"]
            hit = is_hit(v, actual, r["forward_days"])
            master_stats[mid]["total"] += 1
            if hit:
                master_stats[mid]["hit"] += 1

    weights = {}
    accuracy = {}
    for mid, s in master_stats.items():
        acc = s["hit"] / max(s["total"], 1)
        accuracy[mid] = round(acc, 3)
        # 准确率 → 权重: 贝叶斯收缩 (对样本少的给回归均值0.8)
        shrinkage = min(s["total"] / 20, 1.0)  # 少于20次判读时向1.0收缩
        raw_w = (acc / 0.5)
        w = 1.0 + (raw_w - 1.0) * shrinkage  # 贝叶斯收缩
        w = max(0.3, min(2.5, round(w, 2)))
        weights[mid] = w

    print(f"\n=== 动态权重 (滚动窗口:训练{len(valid)}条,前瞻{forward_days}日,排除近{holdout_days}天) ===\n")
    print(f"{'大师':<16} {'准确率':>8} {'判读数':>6} {'建议权重':>8} {'收缩':>6}")
    print("-" * 52)
    for mid, w in sorted(weights.items(), key=lambda x: x, reverse=True):
        acc = accuracy.get(mid, 0)
        n = master_stats[mid]["total"]
        shrink = "是" if n < 20 else "否"
        print(f"{master_stats[mid]['name']:<16} {acc:>7.0%} {n:>6} {w:>8.2f}x {'收缩' if n < 20 else '':>6}")

    # 自动持久化
    if auto_save:
        from sign_oracle import WeightStore
        WeightStore.save(weights, accuracy)
        print(f"\n[权重] 已自动保存到 output/master_weights.json")

    return weights


# ============================================================================
# CLI
# ============================================================================

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    cmd = sys.argv[1]

    if cmd == "archive":
        # 从最新的 daily-sign.json 归档
        sign_fp = OUTPUT_DIR / "daily-sign.json"
        if not sign_fp.exists():
            print("[归档] daily-sign.json 不存在，请先生成")
            sys.exit(1)
        with open(sign_fp, "r", encoding="utf-8") as f:
            sign_data = json.load(f)
        archive_verdict(datetime.now(), sign_data)

    elif cmd == "backtest":
        days = DEFAULT_WINDOW_DAYS
        forward = DEFAULT_FORWARD_DAYS
        for i, arg in enumerate(sys.argv):
            if arg == "--days" and i + 1 < len(sys.argv):
                days = int(sys.argv[i + 1])
            if arg == "--forward" and i + 1 < len(sys.argv):
                forward = int(sys.argv[i + 1])
        backtest(days, forward)

    elif cmd == "stats":
        stats()

    elif cmd == "weights":
        days = DEFAULT_WINDOW_DAYS
        forward = DEFAULT_FORWARD_DAYS
        for i, arg in enumerate(sys.argv):
            if arg == "--days" and i + 1 < len(sys.argv):
                days = int(sys.argv[i + 1])
            if arg == "--forward" and i + 1 < len(sys.argv):
                forward = int(sys.argv[i + 1])
        compute_dynamic_weights(days, forward)

    elif cmd == "update":
        # 回测 + 自动保存权重 (核心命令: 持续自优化的关键)
        days = DEFAULT_WINDOW_DAYS
        forward = DEFAULT_FORWARD_DAYS
        for i, arg in enumerate(sys.argv):
            if arg == "--days" and i + 1 < len(sys.argv):
                days = int(sys.argv[i + 1])
            if arg == "--forward" and i + 1 < len(sys.argv):
                forward = int(sys.argv[i + 1])
        compute_dynamic_weights(days, forward, auto_save=True)

    else:
        print(f"未知命令: {cmd}")
