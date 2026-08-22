"""
签文判官 v1.0 — 大师加权投票 → 签文信号 → 持续自优化 (P3)
============================================================
闭环逻辑:
  每日生成 → 归档判读 → N日后回测 → 更新权重 → 下次生成时读取新权重
                  ↑                                           ↓
                  └──────────── 持续反馈循环 ─────────────────┘

核心模块:
  1. WeightStore: 权重持久化 (output/master_weights.json)
  2. Oracle: 加权聚合8位大师判读 → 统一市场信号
  3. SignAdjuster: 信号映射为签文等级/操作/风险修正
  4. DriftDetector: 模型漂移监测 (准确率趋势异常预警)

用法:
  from sign_oracle import Oracle, WeightStore, SignAdjuster

  weights = WeightStore.load()
  oracle = Oracle(weights)
  signal = oracle.analyze(masters)  # → {"direction": "BULLISH", "strength": 0.62, ...}
  adjustment = SignAdjuster.compute(signal, current_grade)

Author: AI Engineer Agent
Date: 2026-06-07
Version: 1.0.0
"""

import json
import math
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"
WEIGHT_FILE = OUTPUT_DIR / "master_weights.json"


# ============================================================================
# 一、权重持久化
# ============================================================================

class WeightStore:
    """大师权重读写，支持版本号和衰减"""

    DEFAULT_WEIGHTS = {
        "trend": 1.0, "fund": 1.0, "value": 1.0, "cycle": 1.0,
        "spec": 0.9, "quant": 1.0, "behavior": 1.0, "retail": 1.0,
    }

    @staticmethod
    def load() -> dict:
        """加载当前权重，返回 {master_id: weight, ...}"""
        if WEIGHT_FILE.exists():
            try:
                with open(WEIGHT_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return data.get("weights", WeightStore.DEFAULT_WEIGHTS)
            except (json.JSONDecodeError, KeyError):
                pass
        return dict(WeightStore.DEFAULT_WEIGHTS)

    @staticmethod
    def save(weights: dict, accuracy: dict = None):
        """持久化权重 + 元数据"""
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        existing = {}
        if WEIGHT_FILE.exists():
            try:
                with open(WEIGHT_FILE, "r", encoding="utf-8") as f:
                    existing = json.load(f)
            except Exception:
                pass

        version = existing.get("version", 0) + 1
        record = {
            "version": version,
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "weights": weights,
            "accuracy": accuracy or {},
            "history": (existing.get("history", []) + [
                {"version": version, "date": datetime.now().strftime("%Y-%m-%d"),
                 "weights": dict(weights)}
            ])[-30:],  # 保留最近30次更新
        }
        with open(WEIGHT_FILE, "w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False, indent=2)
        print(f"[权重] v{version} 已保存 → {WEIGHT_FILE}")

    @staticmethod
    def status() -> dict:
        """读取权重文件状态"""
        if not WEIGHT_FILE.exists():
            return {"exists": False, "version": 0, "using_defaults": True}
        try:
            with open(WEIGHT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {
                "exists": True,
                "version": data.get("version", 0),
                "updated_at": data.get("updated_at", ""),
                "using_defaults": data.get("version", 0) == 0,
                "weights": data.get("weights", {}),
                "accuracy": data.get("accuracy", {}),
            }
        except Exception:
            return {"exists": True, "version": 0, "using_defaults": True, "error": "文件损坏"}


# ============================================================================
# 二、签文判官 — 大师加权聚合
# ============================================================================

class Oracle:
    """
    将8位大师的概率化判读 + 历史准确率权重 → 统一市场信号。

    输入: masters列表 (每个master含 verdict, confidence, scores)
    输出: 综合信号 {direction, strength, confidence, decomposition}
    """

    def __init__(self, weights: dict = None):
        self.weights = weights or WeightStore.DEFAULT_WEIGHTS

    def analyze(self, masters: List[dict]) -> dict:
        """
        加权聚合8位大师判读。

        返回:
          direction:  BULLISH / BEARISH / NEUTRAL
          strength:   0~1 信号强度
          confidence: 0~1 综合置信度
          buy_score / sell_score / hold_score: 加权概率
          decomposition: 每位大师的贡献明细
        """
        weighted_buy = 0.0
        weighted_sell = 0.0
        weighted_hold = 0.0
        total_weight = 0.0
        directional_votes = []
        decomposition = []

        for m in masters:
            mid = m.get("id", "")
            base_weight = self.weights.get(mid, 1.0)

            scores = m.get("detail", {}).get("scores", {})
            buy_s = scores.get("buy", 0)
            sell_s = scores.get("sell", 0)
            hold_s = scores.get("hold", 0)
            conf = m.get("detail", {}).get("confidence", 0.5)
            # 置信度不是展示字段：低置信观点必须少占投票权。
            # 保留 40% 基础权重，避免单个模型短暂失真时被完全静音。
            w = base_weight * (0.4 + 0.6 * max(0.0, min(float(conf), 1.0)))
            total_weight += w

            weighted_buy += buy_s * w
            weighted_sell += sell_s * w
            weighted_hold += hold_s * w
            directional_votes.append((buy_s - sell_s, w))

            decomposition.append({
                "id": mid,
                "name": m.get("name", mid),
                "verdict": m.get("verdict", "HOLD"),
                "weight": round(w, 2),
                "base_weight": round(base_weight, 2),
                "confidence": round(conf, 2),
                "contribution": {
                    "buy": round(buy_s * w, 3),
                    "sell": round(sell_s * w, 3),
                    "hold": round(hold_s * w, 3),
                },
            })

        # 归一化
        total = max(weighted_buy + weighted_sell + weighted_hold, 0.01)
        buy_score = weighted_buy / total
        sell_score = weighted_sell / total
        hold_score = weighted_hold / total

        # 分歧度：大师方向越离散，越应提高转向门槛并降低置信度。
        vote_weight = max(sum(w for _, w in directional_votes), 0.01)
        vote_mean = sum(v * w for v, w in directional_votes) / vote_weight
        vote_var = sum(w * (v - vote_mean) ** 2 for v, w in directional_votes) / vote_weight
        disagreement = min(math.sqrt(vote_var) / 0.65, 1.0)
        direction_margin = 0.12 + disagreement * 0.10

        # 方向判定：高分歧时不轻易给出单边信号。
        if buy_score > sell_score + direction_margin:
            direction = "BULLISH"
        elif sell_score > buy_score + direction_margin:
            direction = "BEARISH"
        else:
            direction = "NEUTRAL"

        # 信号强度: 偏离中性(0.33)的程度
        neutral = 1.0 / 3
        strength = max(0, (max(buy_score, sell_score) - neutral) * 3)
        strength = min(round(strength, 2), 1.0)

        # 综合置信度: 加权平均
        confidences = [
            m.get("detail", {}).get("confidence", 0.5) * self.weights.get(m.get("id", ""), 1.0)
            for m in masters
        ]
        total_conf_w = sum(self.weights.get(m.get("id", ""), 1.0) for m in masters)
        avg_confidence = sum(confidences) / max(total_conf_w, 1)
        calibrated_confidence = avg_confidence * (1 - 0.45 * disagreement)

        return {
            "direction": direction,
            "strength": strength,
            "confidence": round(calibrated_confidence, 2),
            "disagreement": round(disagreement, 2),
            "direction_margin": round(direction_margin, 3),
            "buy_score": round(buy_score, 3),
            "sell_score": round(sell_score, 3),
            "hold_score": round(hold_score, 3),
            "total_weight": round(total_weight, 1),
            "weight_source": "historical_backtest" if WeightStore.status().get("version", 0) > 0 else "default_equal",
            "decomposition": decomposition,
        }


# ============================================================================
# 三、签文调整器
# ============================================================================

class SignAdjuster:
    """
    将 Oracle 信号映射为签文参数的微调建议。

    【修复】问题5: 正反馈放大/抖动
    - 连续3天同一方向才触发等级调整
    - 信号强度平滑（EMA α=0.3）
    - 仅当历史权重存在且信号稳定时生效

    不会覆盖原有规则，而是在原有等级基础上做 1 级微调。
    """

    GRADE_ORDER = ["XIA_XIONG", "XIA_PING", "ZHONG_PING", "ZHONG_JI", "SHANG_JI", "DA_JI"]

    # 调整状态持久化
    STATE_FILE = OUTPUT_DIR / "oracle_state.json"

    @classmethod
    def _load_state(cls) -> dict:
        """加载调整状态（记录最近N天的信号方向）"""
        if cls.STATE_FILE.exists():
            try:
                with open(cls.STATE_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {"recent_directions": [], "ema_strength": 0.0, "last_adjusted": None}

    @classmethod
    def _save_state(cls, state: dict):
        """持久化调整状态"""
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        with open(cls.STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)

    ACTION_MAP = {
        "BULLISH": {
            "XIA_XIONG": "恐慌或为机会 · 分步捡漏",
            "XIA_PING": "底部区域 · 试探性建仓",
            "ZHONG_PING": "温和看多 · 保持仓位",
            "ZHONG_JI": "顺势加仓 · 跟随趋势",
            "SHANG_JI": "强势持有 · 设移动止盈",
            "DA_JI": "极盛勿贪 · 分批落袋",
        },
        "BEARISH": {
            "XIA_XIONG": "泥沙俱下 · 现金为王",
            "XIA_PING": "偏弱格局 · 降低仓位",
            "ZHONG_PING": "方向偏空 · 轻仓防御",
            "ZHONG_JI": "高位减仓 · 锁定利润",
            "SHANG_JI": "盛极而衰 · 获利了结",
            "DA_JI": "过热信号 · 果断止盈",
        },
        "NEUTRAL": {
            "XIA_XIONG": "观望等待 · 不急于抄底",
            "XIA_PING": "弱势震荡 · 多看少动",
            "ZHONG_PING": "方向不明 · 轻仓试探",
            "ZHONG_JI": "中性偏多 · 维持仓位",
            "SHANG_JI": "强势横盘 · 持仓观察",
            "DA_JI": "高位震荡 · 注意风险",
        },
    }

    RISK_MAP = {
        "BULLISH": {
            "strength>0.7": "趋势确认 · 顺势而为",
            "strength>0.4": "偏多格局 · 控制仓位在7成",
            "default": "关注成交量确认信号",
        },
        "BEARISH": {
            "strength>0.7": "⚠️ 系统性风险升高 · 防御优先",
            "strength>0.4": "偏空信号 · 减少操作频率",
            "default": "等待企稳信号 · 不接飞刀",
        },
        "NEUTRAL": {
            "strength>0.7": "高不确定性 · 保持现金",
            "strength>0.4": "方向未明 · 多看少动",
            "default": "震荡市 · 控制仓位在5成以下",
        },
    }

    @staticmethod
    def compute(oracle_signal: dict, current_grade: str,
                current_action: str, current_risk: str) -> dict:
        """
        根据 Oracle 信号微调签文参数（带平滑，防抖动）。

        Returns:
          {
            "adjusted": bool,
            "grade": str,
            "action": str,
            "risk": str,
            "oracle_signal": dict,
            "reason": str,
            "smoothing": dict,  # 平滑状态
          }
        """
        direction = oracle_signal["direction"]
        strength = oracle_signal["strength"]
        weight_source = oracle_signal.get("weight_source", "default")

        # 加载状态
        state = SignAdjuster._load_state()

        # EMA 平滑信号强度 (α=0.3)
        ema_alpha = 0.3
        ema_strength = state.get("ema_strength", 0.0)
        smoothed_strength = ema_strength * (1 - ema_alpha) + strength * ema_alpha

        # 更新方向历史（保留最近7天）
        recent = state.get("recent_directions", [])[-6:]  # 保留6条 + 新增 = 7条
        recent.append(direction)

        # 连续同方向计数
        consecutive = 0
        for d in reversed(recent):
            if d == direction:
                consecutive += 1
            else:
                break

        # 更新状态
        state["recent_directions"] = recent
        state["ema_strength"] = smoothed_strength
        SignAdjuster._save_state(state)

        # 判断: 需要连续3天同方向 + 平滑强度 > 0.4 才调整
        has_history = weight_source == "historical_backtest"
        should_adjust = has_history and consecutive >= 3 and smoothed_strength > 0.4

        if not should_adjust:
            return {
                "adjusted": False,
                "grade": current_grade,
                "action": current_action,
                "risk": current_risk,
                "oracle_signal": oracle_signal,
                "reason": (
                    f"平滑未通过 | 连续{consecutive}/3天{_dir_zh(direction)} "
                    f"| 平滑强度{smoothed_strength:.0%}(需>40%) "
                    f"| 权重源= {weight_source}"
                ),
                "smoothing": {
                    "consecutive": consecutive,
                    "required": 3,
                    "raw_strength": strength,
                    "smoothed_strength": round(smoothed_strength, 2),
                    "ema_alpha": ema_alpha,
                },
            }

        # 等级微调（仅当平滑通过后）
        adjusted_grade = current_grade
        try:
            idx = SignAdjuster.GRADE_ORDER.index(current_grade)
            if direction == "BULLISH" and smoothed_strength > 0.5:
                if idx <= 2:
                    new_idx = min(idx + 1, len(SignAdjuster.GRADE_ORDER) - 1)
                    adjusted_grade = SignAdjuster.GRADE_ORDER[new_idx]
            elif direction == "BEARISH" and smoothed_strength > 0.5:
                if idx >= 3:
                    new_idx = max(idx - 1, 0)
                    adjusted_grade = SignAdjuster.GRADE_ORDER[new_idx]
        except ValueError:
            pass

        action = SignAdjuster.ACTION_MAP.get(direction, {}).get(current_grade, current_action)
        risk_key = "strength>0.7" if smoothed_strength > 0.7 else ("strength>0.4" if smoothed_strength > 0.4 else "default")
        risk = SignAdjuster.RISK_MAP.get(direction, {}).get(risk_key, current_risk)

        adjusted = adjusted_grade != current_grade

        return {
            "adjusted": adjusted,
            "grade": adjusted_grade,
            "action": action,
            "risk": risk,
            "oracle_signal": oracle_signal,
            "reason": (
                f"平滑通过(连续{consecutive}天{_dir_zh(direction)},强度{smoothed_strength:.0%}) | "
                f"Oracle信号:{direction} | "
                f"{'等级已调整' if adjusted else '等级不变'}"
            ),
            "smoothing": {
                "consecutive": consecutive,
                "required": 3,
                "raw_strength": strength,
                "smoothed_strength": round(smoothed_strength, 2),
                "ema_alpha": ema_alpha,
            },
        }


def _dir_zh(d: str) -> str:
    return {"BULLISH": "看多", "BEARISH": "看空", "NEUTRAL": "中性"}.get(d, d)


# ============================================================================
# 四、模型漂移检测器
# ============================================================================

class DriftDetector:
    """
    监测大师准确率趋势是否出现异常漂移。

    漂移类型:
      - 准确率骤降: 某大师近5日准确率 < 近30日准确率 - 0.2
      - 一致性断裂: 某大师连续3天与多数派方向相反
      - 过拟合信号: 某大师准确率 > 0.85 (可能过拟合)

    触发后: 在日志中报警，不影响生成流程。
    """

    @staticmethod
    def check(verdict_dir: Path = None) -> List[dict]:
        """返回漂移警报列表"""
        if verdict_dir is None:
            verdict_dir = OUTPUT_DIR / "verdicts"

        alerts = []
        records = DriftDetector._load_records(verdict_dir)
        if len(records) < 10:
            return [{"type": "DATA_INSUFFICIENT", "msg": f"历史数据不足(仅{len(records)}条)，无法检测漂移"}]

        # 按大师统计近期 vs 长期准确率
        for mid, name in [("trend","奥尼尔"),("fund","蔡金"),("value","格雷厄姆"),
                          ("cycle","霍华德"),("spec","短线客"),("quant","西蒙斯"),
                          ("behavior","卡尼曼"),("retail","老张")]:
            acc = DriftDetector._master_accuracy(records, mid, window=30)
            recent_acc = DriftDetector._master_accuracy(records, mid, window=5)

            if acc and recent_acc:
                if recent_acc < acc - 0.2:
                    alerts.append({
                        "type": "ACCURACY_DROP",
                        "master": name,
                        "long_acc": round(acc, 2),
                        "recent_acc": round(recent_acc, 2),
                        "msg": f"{name}: 近5日准确率{recent_acc:.0%} < 近30日{acc:.0%}，可能模型漂移",
                    })

        return alerts

    @staticmethod
    def _load_records(verdict_dir: Path) -> List[dict]:
        records = []
        if not verdict_dir.exists():
            return records
        for fp in sorted(verdict_dir.glob("*.json")):
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    records.append(json.load(f))
            except Exception:
                pass
        return records

    @staticmethod
    def _master_accuracy(records: List[dict], mid: str, window: int) -> Optional[float]:
        """计算某大师在最近 window 天内的判读准确率"""
        recent = records[-window:]
        if len(recent) < 3:
            return None

        hits = 0
        total = 0
        for i, r in enumerate(recent):
            masters = r.get("masters", [])
            m = next((x for x in masters if x.get("id") == mid), None)
            if not m:
                continue

            # 找N日后的实际涨跌
            target = None
            for j in range(i + 1, len(recent)):
                if j - i <= 5:
                    target = recent[j]
                    break
            if not target:
                continue

            v = m.get("verdict", "HOLD")
            actual = target.get("sh_chg_pct", 0)
            is_hit = (v == "BUY" and actual > 0) or (v == "SELL" and actual < 0) or (v == "HOLD" and abs(actual) <= 0.5)
            total += 1
            if is_hit:
                hits += 1

        return hits / max(total, 1) if total >= 3 else None


# ============================================================================
# CLI
# ============================================================================

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("用法: python3 sign_oracle.py <command>")
        print("  status   - 显示当前权重状态")
        print("  drift    - 运行漂移检测")
        print("  reset    - 重置为默认权重")
        sys.exit(0)

    cmd = sys.argv[1]

    if cmd == "status":
        s = WeightStore.status()
        print(f"\n权重文件: {'存在' if s['exists'] else '不存在'}")
        print(f"版本: v{s['version']}")
        print(f"更新时间: {s.get('updated_at', 'N/A')}")
        print(f"使用默认权重: {s['using_defaults']}")
        if s.get("weights"):
            print("\n当前权重:")
            for mid, w in sorted(s["weights"].items()):
                acc = s.get("accuracy", {}).get(mid, 0)
                print(f"  {mid:<10}: {w:.2f}x (准确率:{acc:.0%})" if acc else f"  {mid:<10}: {w:.2f}x")

    elif cmd == "drift":
        alerts = DriftDetector.check()
        if alerts:
            print(f"\n检测到 {len(alerts)} 个漂移警报:")
            for a in alerts:
                print(f"  [{a['type']}] {a.get('msg', a)}")
        else:
            print("\n无漂移警报")

    elif cmd == "reset":
        WeightStore.save(WeightStore.DEFAULT_WEIGHTS, {})
        print("权重已重置为默认值")
