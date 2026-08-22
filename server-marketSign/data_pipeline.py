"""
数据编排管线 v3.2 — 多层数据备用体系
===================================
Layer 1: HTTP 实时 (qt.gtimg.cn + eastmoney)
Layer 2: 缓存补缺 (_data_cache.json)
Layer 3: akshare 降级 (涨跌家数修正)
Layer 4: 衍生字段补全 (PE/涨跌比变化率)

每层失败自动降级到下一层，全程带质量标记。
"""

import json
import urllib.request
import urllib.error
import re as _re
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"
CACHE_FILE = OUTPUT_DIR / "_data_cache.json"

# 尝试导入 data_fetcher
try:
    from data_fetcher import fetch_all as fetch_http
    HAS_FETCHER = True
except ImportError:
    HAS_FETCHER = False


def _find_dark_horse(sectors: list) -> str:
    """找黑马板块：资金流入最多但不在涨幅前三"""
    if not sectors:
        return "—"
    top3 = {s["name"] for s in sorted(sectors, key=lambda x: -x["chg_pct"])[:3]}
    for s in sorted(sectors, key=lambda x: -x.get("main_flow_yi", 0)):
        if s["name"] not in top3:
            return s["name"]
    return sectors[0]["name"] if sectors else "—"


def _load_cache() -> dict:
    """加载上一交易日成功缓存"""
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_cache(raw: dict, score: int):
    """保存高质量数据到缓存"""
    if score >= 3:
        try:
            # 只保存核心字段（节省空间）
            save_keys = ["sh_chg_pct", "sh_close", "sector_pick", "sector_avoid",
                         "north_flow", "north_flow_yi", "main_net_flow_yi", "up_count",
                         "down_count", "emotion", "emotion_label", "vol_yi", "pe_300",
                         "pe_pct", "hot_sectors", "main_net_flow"]
            data = {k: raw[k] for k in save_keys if k in raw}
            data["_cached_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            data["_score"] = score
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass


def _try_http_layer():
    """Layer 1: HTTP 直连"""
    if not HAS_FETCHER:
        return None, {"error": "data_fetcher 不可用"}
    try:
        real = fetch_http()
        sh = real.get("index", {}).get("sh", {})
        nb = real.get("northbound", {})
        sectors = real.get("sectors", [])
        breadth = real.get("breadth_estimated", {})
        has_idx = sh and sh.get("price", 0) > 0
        if not has_idx:
            return None, {"error": "qt指数无数据"}

        main_yi = sum(s.get("main_flow_yi", 0) for s in sectors) if sectors else 0
        up_c = breadth.get("up_count", 2500)
        down_c = breadth.get("down_count", 2000)

        raw = {
            "sh_chg_pct": round(sh.get("chg_pct", 0), 2),
            "sh_close": round(sh.get("price", 0), 2),
            "sector_pick": [s["name"] for s in sorted(sectors, key=lambda x: -x["chg_pct"])[:3]] if sectors else [],
            "sector_avoid": [s["name"] for s in sorted(sectors, key=lambda x: x["chg_pct"])[:2]] if sectors else [],
            "sector_pick_detail": [
                {"name": s["name"], "chg": f"{s['chg_pct']:+.2f}%", "chgRaw": s["chg_pct"],
                 "flow": f"{s.get('main_flow_yi', 0):+.1f}亿"}
                for s in sorted(sectors, key=lambda x: -x["chg_pct"])[:3]
            ] if sectors else [],
            "sector_avoid_detail": [
                {"name": s["name"], "chg": f"{s['chg_pct']:+.2f}%", "chgRaw": s["chg_pct"]}
                for s in sorted(sectors, key=lambda x: x["chg_pct"])[:2]
            ] if sectors else [],
            "dark_horse": _find_dark_horse(sectors),
            "up_count": up_c, "down_count": down_c,
            "north_flow": f"{nb['net_flow_yi']:+.1f}亿" if nb and nb.get("net_flow_yi") is not None else "—",
            "north_flow_yi": nb.get("net_flow_yi", 0) if nb else 0,
            "main_net_flow_yi": main_yi,
            "main_net_flow": (f"{'+' if main_yi >= 0 else ''}{round(main_yi, 1)}亿") if sectors else "—",
            "emotion": round(up_c / max(up_c + down_c, 1) * 100),
            "hot_sectors": [{"name": s["name"], "realName": s["name"], "chg": s["chg_pct"]}
                            for s in sectors[:8]] if sectors else [],
            "vol_yi": round(sh.get("amount_yi", 0), 1),
            "pe_300": 0, "pe_pct": 50, "margin_chg_yi": 0, "up_ratio_chg": 0,
        }
        em = raw["emotion"]
        raw["emotion_label"] = ("偏 贪" if em >= 70 else "偏 多" if em >= 55
                                else "中 性" if em >= 45 else "偏 弱" if em >= 30 else "偏 恐")

        score = (2 if has_idx else 0) + (1 if sectors else 0) + (1 if nb and nb.get("net_flow_yi") is not None else 0)
        quality = {"layer": "http", "index_ok": has_idx, "sectors_ok": bool(sectors),
                   "northbound_ok": bool(nb and nb.get("net_flow_yi") is not None),
                   "score": score}
        return raw, quality
    except Exception as e:
        return None, {"error": str(e)[:80], "score": 0}


def _enrich_from_cache(raw: dict, cache: dict) -> dict:
    """Layer 2: 缓存补缺"""
    if not cache:
        return raw
    for f in ["sector_pick", "sector_avoid", "north_flow", "north_flow_yi",
              "main_net_flow_yi", "main_net_flow", "pe_300", "pe_pct"]:
        if (not raw.get(f) or raw.get(f) == "—" or raw.get(f) == 0) and f in cache:
            raw[f] = cache[f]
    return raw


def _try_akshare(raw: dict) -> dict:
    """Layer 3: akshare 修正涨跌家数"""
    try:
        import akshare as ak
        spot = ak.stock_zh_a_spot_em()
        chg = spot["涨跌幅"].dropna().astype(float)
        up = int((chg > 0).sum())
        down = int((chg < 0).sum())
        if up > 100:
            raw["up_count"] = up
            raw["down_count"] = down
            raw["emotion"] = round(up / max(up + down, 1) * 100)
            em = raw["emotion"]
            raw["emotion_label"] = ("偏 贪" if em >= 70 else "偏 多" if em >= 55
                                    else "中 性" if em >= 45 else "偏 弱" if em >= 30 else "偏 恐")
    except Exception as e:
        print(f"[pipeline] akshare降级跳过: {e}")
    return raw


def _enrich_derived(raw: dict):
    """Layer 4: 衍生字段补全（PE + 涨跌比变化率）"""
    # PE
    try:
        url = "http://qt.gtimg.cn/q=sh000300"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            raw300 = resp.read().decode("gbk", errors="replace")
        f = _re.search(r'="([^"]*)"', raw300)
        if f:
            fs = f.group(1).split("~")
            if len(fs) > 39 and fs[39] and fs[39] != "0":
                pe = round(float(fs[39]), 1)
                raw["pe_300"] = pe
                if pe < 10: raw["pe_pct"] = 5
                elif pe < 12: raw["pe_pct"] = 15
                elif pe < 15: raw["pe_pct"] = 30
                elif pe < 18: raw["pe_pct"] = 50
                elif pe < 22: raw["pe_pct"] = 65
                elif pe < 28: raw["pe_pct"] = 80
                else: raw["pe_pct"] = 95
    except Exception:
        pass

    # 涨跌比变化率
    try:
        archives = sorted(OUTPUT_DIR.glob("sign-*.json"), reverse=True)
        if archives:
            with open(archives[0], "r", encoding="utf-8") as f:
                last = json.load(f)
            lex = last.get("expand", {})
            lu = lex.get("upCount", raw.get("up_count", 2500))
            ld = lex.get("downCount", raw.get("down_count", 2000))
            lr = lu / max(lu + ld, 1)
            cr = raw.get("up_count", 2500) / max(raw.get("up_count", 2500) + raw.get("down_count", 2000), 1)
            raw["up_ratio_chg"] = round(cr - lr, 4)
    except Exception:
        pass
    return raw


def orchestrate(is_holiday: bool = False):
    """
    编排多层数据获取，返回 (raw_dict, source_string)。
    
    如果所有层级都失败，返回 (None, error_string)。
    """
    # ---- 休市：直接用缓存 ----
    if is_holiday:
        cache = _load_cache()
        if cache and cache.get("sh_close"):
            raw = cache.copy()
            # 确保所有必要字段存在
            defaults = {"up_count": 2500, "down_count": 2000, "emotion": 50,
                        "emotion_label": "中 性", "hot_sectors": [], "vol_yi": 0,
                        "pe_300": 0, "pe_pct": 50, "margin_chg_yi": 0, "up_ratio_chg": 0,
                        "sector_pick": [], "sector_avoid": [], "north_flow": "—",
                        "north_flow_yi": 0, "main_net_flow_yi": 0, "main_net_flow": "—",
                        "dark_horse": "—"}
            for k, v in defaults.items():
                raw.setdefault(k, v)
            cached_at = cache.get("_cached_at", "?")
            raw["_data_quality"] = {
                "layer": "holiday_cache", "score": cache.get("_score", 0),
                "stale": True, "cached_at": cached_at,
            }
            return raw, f"holiday · 缓存 ({cached_at})"
        return None, "holiday · 无缓存"

    # ---- Layer 1: HTTP 实时 ----
    raw, qual = _try_http_layer()
    if raw is None:
        print("[pipeline] Layer1 HTTP失败，降级缓存...")
        cache = _load_cache()
        if cache and cache.get("sh_close"):
            raw = cache.copy()
            defaults = {"up_count": 2500, "down_count": 2000, "emotion": 50,
                        "emotion_label": "中 性", "hot_sectors": [], "vol_yi": 0,
                        "pe_300": 0, "pe_pct": 50, "margin_chg_yi": 0, "up_ratio_chg": 0}
            for k, v in defaults.items():
                raw.setdefault(k, v)
            raw["_data_quality"] = {
                "layer": "fallback_cache", "score": cache.get("_score", 0),
                "stale": True, "cached_at": cache.get("_cached_at", "?"),
            }
            return raw, f"缓存 · 上一交易日 ({cache.get('_cached_at', '?')})"
        return None, "HTTP失败 · 无缓存"

    # ---- 设置 source 标签 ----
    score = qual["score"]
    if score >= 4:
        source = "HTTP · qt+easymoney · 实时"
    elif score >= 3:
        source = "HTTP · qt指数+cny降级 · 实时"
    else:
        source = "HTTP · qt指数 · 实时"

    # ---- Layer 2: 缓存补缺 ----
    raw = _enrich_from_cache(raw, _load_cache())

    # ---- Layer 3: akshare 补涨跌家数 ----
    if not qual.get("sectors_ok"):
        raw = _try_akshare(raw)

    # ---- Layer 4: 衍生字段 ----
    raw = _enrich_derived(raw)

    raw["_data_quality"] = {
        "layer": qual.get("layer", "http"),
        "score": score,
        "stale": False,
        "index_ok": bool(qual.get("index_ok")),
        "sectors_ok": bool(qual.get("sectors_ok")),
        "northbound_ok": bool(qual.get("northbound_ok")),
    }

    # ---- 保存高质量缓存 ----
    _save_cache(raw, score)

    # ---- 质量报告 ----
    parts = []
    parts.append("✓指数" if qual["index_ok"] else "✗指数")
    parts.append("✓板块" if qual["sectors_ok"] else "○板块(缓存)")
    parts.append("✓北向" if qual["northbound_ok"] else "○北向(缓存)")
    parts.append(f"PE={raw.get('pe_300', 0):.1f}")
    print(f"[pipeline] 质量: {' '.join(parts)} | score={score}/5 | layer={qual.get('layer', '?')}")

    return raw, source
