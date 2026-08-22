"""
财运局 · 每日财运签 · 数据生成脚本 v3.1
==========================================
- 主数据源：data_fetcher (qt.gtimg.cn + eastmoney HTTP，稳定)
- 备用数据源：akshare (Python库，网络不稳定)
- 抓板块详情（名/涨跌/主力流入）+ 大师点评（基于真实数据动态生成）
- 检测交易日，节假日返回 isHoliday:true 走"今日休市"特殊态
- 输出 daily-sign.json（与小程序前端约定格式 100% 对齐）

Usage:
    python3 generate_daily_sign.py            # 生成今日签
    python3 generate_daily_sign.py --mock     # 不调任何数据源，用假数据生成
    python3 generate_daily_sign.py --force    # 即使今日已生成也重新跑

Cron 建议（每天 15:35 收盘后 5 分钟）：
    35 15 * * 1-5 cd /opt/caiyunju && python3 generate_daily_sign.py >> log.txt 2>&1
"""

import argparse
import json
import os
import random
import shutil
import sys
import tempfile
import time
import urllib.request
import urllib.error
import re as _re
from datetime import datetime, timedelta
from pathlib import Path

# v3.1: 引入 data_fetcher 作为稳定数据源（纯 HTTP，无第三方库依赖）
try:
    from data_fetcher import fetch_all as fetch_http, enrich_raw
    HAS_DATA_FETCHER = True
except ImportError:
    HAS_DATA_FETCHER = False
    print("[WARN] data_fetcher.py 不可用，将使用 akshare 降级")

# ============ 等级映射规则 ============
def grade_for(sh_chg_pct: float, up_count: int, down_count: int) -> str:
    total = max(up_count + down_count, 1)
    up_ratio = up_count / total
    if sh_chg_pct >= 1.5 and up_ratio >= 0.65:
        return "DA_JI"
    if sh_chg_pct >= 0.5 and up_ratio >= 0.55:
        return "SHANG_JI"
    if -0.5 < sh_chg_pct < 0.5:
        return "ZHONG_JI" if up_ratio >= 0.5 else "ZHONG_PING"
    if sh_chg_pct <= -2.0 or up_ratio < 0.2:
        return "XIA_XIONG"
    if sh_chg_pct <= -0.5:
        return "XIA_PING"
    return "ZHONG_PING"


GRADE_LABEL = {
    "DA_JI": "大 吉", "SHANG_JI": "上 吉", "ZHONG_JI": "中 吉",
    "ZHONG_PING": "中 平", "XIA_PING": "下 平", "XIA_XIONG": "下 凶",
}
GRADE_CLS = {
    "DA_JI": "great", "SHANG_JI": "great", "ZHONG_JI": "good",
    "ZHONG_PING": "mid", "XIA_PING": "bad", "XIA_XIONG": "bad",
}
GRADE_COLOR = {
    "DA_JI": "#D4A853", "SHANG_JI": "#E8C873", "ZHONG_JI": "#8A9A7D",
    "ZHONG_PING": "#8A8DA0", "XIA_PING": "#7A5A6B", "XIA_XIONG": "#B8334A",
}

# ============ 签诗库（每等级 3 套，按日期种子选）============
POEM_LIB = {
    "DA_JI": [
        {"a": ["天工开物逢春雨", "万物生发不必疑"], "m": ["今天大涨稳得住", "顺势满仓莫犹豫"]},
        {"a": ["金风送爽稻穗黄", "收获之时莫彷徨"], "m": ["行情正佳别多想", "该出手时就出手"]},
        {"a": ["乾坤朗朗日月新", "此时不动更待何"], "m": ["市场清晰方向明", "上车时机就是现在"]},
    ],
    "SHANG_JI": [
        {"a": ["和风吹散昨夜雨", "远山初见晓色明"], "m": ["昨日阴霾今扫净", "主线初露顺势行"]},
        {"a": ["潮平两岸阔无边", "风正一帆顺自然"], "m": ["量价配合走得稳", "持仓做多不慌张"]},
        {"a": ["东风夜放花千树", "更吹落星如雨"], "m": ["热点轮动正活跃", "把握节奏吃肉汤"]},
    ],
    "ZHONG_JI": [
        {"a": ["雾里看花花似隐", "进退之间守本心"], "m": ["震荡盘里别上头", "守好仓位等方向"]},
        {"a": ["半山行人云未散", "不如择石小坐看"], "m": ["盘面磨人没行情", "少操作多观察"]},
        {"a": ["柳暗花明又一村", "山重水复疑无路"], "m": ["关键板块在轮动", "盯紧主线别走神"]},
    ],
    "ZHONG_PING": [
        {"a": ["花开花落本无常", "得失寸心宜自量"], "m": ["今天涨涨跌跌正常", "别被情绪带节奏"]},
        {"a": ["溪流石上声清浅", "坐看云生不必忙"], "m": ["行情没啥大故事", "降低预期最稳妥"]},
        {"a": ["竹外桃花三两枝", "春江水暖鸭先知"], "m": ["小机会藏在细节", "耐住寂寞等花开"]},
    ],
    "XIA_PING": [
        {"a": ["秋风落木声渐紧", "宜守不宜贸然行"], "m": ["今天跑得快的赢", "现金为王别硬扛"]},
        {"a": ["寒蝉鸣处叶已稀", "收伞归家莫迟疑"], "m": ["资金在跑别犹豫", "减仓才是真聪明"]},
        {"a": ["孤舟蓑笠翁独钓", "千山鸟飞绝径深"], "m": ["流动性正在收缩", "降低仓位避锋芒"]},
    ],
    "XIA_XIONG": [
        {"a": ["风急浪高莫轻渡", "收帆待时自安身"], "m": ["今天大跌别接刀", "空仓观望最保险"]},
        {"a": ["黑云压城天色变", "识时务者方为俊"], "m": ["情绪极度恐慌中", "今天最大的赢就是没亏"]},
        {"a": ["山雨欲来风满楼", "不见梅花空白头"], "m": ["系统性风险在路上", "保住本金等机会"]},
    ],
}

ACTION_TEMPLATE = {
    "DA_JI": "持股不动 · 别加杠杆", "SHANG_JI": "顺势持股 · 不追高",
    "ZHONG_JI": "低吸高抛 · 控制仓位", "ZHONG_PING": "降低预期 · 少动多看",
    "XIA_PING": "降低仓位 · 暂避锋芒", "XIA_XIONG": "空仓观望 · 保命第一",
}
RISK_TEMPLATE = {
    "DA_JI": "过热信号 · 注意尾盘获利盘", "SHANG_JI": "短期偏强 · 注意阻力位回撤",
    "ZHONG_JI": "震荡反复 · 量能不足", "ZHONG_PING": "方向不明 · 谨防假突破",
    "XIA_PING": "主力撤退 · 反弹是减仓机会", "XIA_XIONG": "恐慌蔓延 · 等情绪释放完毕",
}


def stick_no_for(date: datetime) -> str:
    doy = date.timetuple().tm_yday
    n = (doy % 100) + 1
    cn = "○一二三四五六七八九十"
    if n < 10:
        return f"第 {cn[n]} 签"
    if n < 100:
        tens = n // 10
        ones = n % 10
        head = cn[tens] if tens > 1 else ""
        return f"第 {head}十{cn[ones] if ones else ''} 签"
    return "第 一百 签"


def pick_poem(grade: str, date: datetime) -> dict:
    arr = POEM_LIB.get(grade, POEM_LIB["ZHONG_PING"])
    idx = (date.day + date.month) % len(arr)
    return arr[idx]


# ============ 交易日检测 ============
def is_trading_day(date: datetime) -> bool:
    """简易交易日检测：周一到周五 + 非假日（精确假日表见 ak.tool_trade_date_hist_sina）"""
    if date.weekday() >= 5:
        return False
    try:
        import akshare as ak
        df = ak.tool_trade_date_hist_sina()
        date_str = date.strftime("%Y-%m-%d")
        # df['trade_date'] 是 datetime 列
        trade_dates = set(df["trade_date"].astype(str).tolist())
        return date_str in trade_dates
    except Exception:
        # 失败时仅按周末判定
        return date.weekday() < 5


# ============ akshare 数据采集 ============

def _retry_call(fn, name, retries=2, delay=3):
    """带重试的 akshare 调用封装。网络抖动时最多重试 2 次，间隔 3 秒。"""
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as e:
            if attempt < retries:
                print(f"[RETRY] {name} 第{attempt+1}次失败: {e}，{delay}秒后重试...")
                time.sleep(delay)
            else:
                print(f"[FAIL] {name} 重试{retries}次后仍失败: {e}")
                raise


# ============ v3.2 数据编排管线（独立模块 data_pipeline.py）============
# 所有数据获取逻辑已迁移到 data_pipeline.orchestrate()，此文件仅保留兼容接口

try:
    from data_pipeline import orchestrate as pipeline_orchestrate
    HAS_PIPELINE = True
except ImportError:
    HAS_PIPELINE = False


def fetch_stable_data():
    """兼容旧接口，委托给 data_pipeline.orchestrate()"""
    if not HAS_PIPELINE:
        return None
    today = datetime.now()
    is_hol = today.weekday() >= 5
    raw, _source = pipeline_orchestrate(is_hol)
    return raw

def fetch_real_data():
    """调用 akshare 抓真实行情。失败返回 None。"""
    try:
        import akshare as ak
    except ImportError:
        print("[WARN] akshare 未安装，使用 mock 数据")
        return None

    try:
        # 1. 上证指数（带重试，akshare 网络偶发超时）
        sh = _retry_call(
            lambda: ak.stock_zh_index_daily(symbol="sh000001"),
            "上证指数"
        )
        sh_close = float(sh.iloc[-1]["close"])
        sh_pre = float(sh.iloc[-2]["close"])
        sh_chg_pct = (sh_close - sh_pre) / sh_pre * 100

        # 2. 全市场涨跌家数（带重试）
        spot = _retry_call(
            lambda: ak.stock_zh_a_spot_em(),
            "涨跌家数"
        )
        spot_chg = spot["涨跌幅"].dropna().astype(float)
        up_count = int((spot_chg > 0).sum())
        down_count = int((spot_chg < 0).sum())

        # 3. 板块涨跌（行业），含详细字段（带重试）
        board = _retry_call(
            lambda: ak.stock_board_industry_name_em(),
            "板块涨跌"
        )
        board = board.sort_values("涨跌幅", ascending=False)

        # 4. 资金流向（板块净流入榜）— 用于补 sectorPickDetail 的 flow
        fund_map = {}
        try:
            fund = ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="行业资金流")
            # 字段名因 akshare 版本不同可能是 '今日主力净流入-净额' / '主力净流入-净额'
            flow_col = next((c for c in fund.columns if "主力净流入" in c and "净额" in c), None)
            name_col = "名称" if "名称" in fund.columns else fund.columns[1]
            if flow_col:
                for _, r in fund.iterrows():
                    fund_map[str(r[name_col])] = float(r[flow_col])
        except Exception as e:
            print(f"[WARN] 资金流榜失败: {e}")

        def fmt_flow(yi):
            """元 → 亿"""
            return f"{'+' if yi >= 0 else ''}{yi/1e8:.1f}亿"

        def detail_row(rec):
            name = str(rec["板块名称"])
            chg = float(rec["涨跌幅"])
            flow_yi = fund_map.get(name, 0)
            return {
                "name": name,
                "chg": f"{'+' if chg >= 0 else ''}{chg:.2f}%",
                "chgRaw": chg,
                "flow": fmt_flow(flow_yi),
            }

        # 顺势板块取涨幅 top3，逆势取 bottom2
        sector_pick_detail = [detail_row(r) for _, r in board.head(3).iterrows()]
        sector_avoid_detail = [detail_row(r) for _, r in board.tail(2).iterrows()]
        sector_pick = [d["name"] for d in sector_pick_detail]
        sector_avoid = [d["name"] for d in sector_avoid_detail]

        # 5. 黑马板块：资金流入第一但涨幅不在前3（潜伏中）
        dark_horse = "—"
        try:
            if fund_map:
                # 排除已在 sector_pick
                cands = sorted([(n, v) for n, v in fund_map.items() if n not in sector_pick],
                               key=lambda x: -x[1])
                if cands:
                    dark_horse = cands[0][0]
            if dark_horse == "—" and sector_pick:
                dark_horse = board.iloc[5]["板块名称"] if len(board) > 5 else sector_pick[0]
        except Exception:
            dark_horse = sector_pick[0] if sector_pick else "—"

        # 6. 北向资金（沪深港通北向净流入）
        north_str = "—"
        north_today = 0
        try:
            north = ak.stock_hsgt_north_net_flow_in_em(indicator="北上")
            north_today = float(north.iloc[-1]["value"])
            north_str = fmt_flow(north_today)
        except Exception as e:
            print(f"[WARN] 北向失败: {e}")

        # 6.5 全市场主力资金净流入（与北向独立计算）
        main_net_str = "—"
        main_net_today = 0
        try:
            if fund_map:
                main_net_today = sum(fund_map.values())
                main_net_str = fmt_flow(main_net_today)
            else:
                # 降级：用个股主力流向汇总
                main_df = ak.stock_individual_fund_flow(stock="个股", market="all")
                if main_df is not None and len(main_df) > 0:
                    col = next((c for c in main_df.columns if "主力净流入" in c), None)
                    if col:
                        main_net_today = float(main_df[col].iloc[-1])
                        main_net_str = fmt_flow(main_net_today)
        except Exception as e:
            print(f"[WARN] 主力资金失败(降级为0): {e}")

        # 7. 情绪指数
        emotion = round(up_count / max(up_count + down_count, 1) * 100)
        if emotion >= 70: emo_label = "偏 贪"
        elif emotion >= 55: emo_label = "偏 多"
        elif emotion >= 45: emo_label = "中 性"
        elif emotion >= 30: emo_label = "偏 弱"
        else: emo_label = "偏 恐"

        # 8. 热门板块涨跌（板块详批用）
        hot_names = ['AI算力', '半导体', '新能源', '机器人', '医药', '军工', '银行', '消费']
        hot_sectors = []
        for name in hot_names:
            # 模糊匹配
            row = board[board["板块名称"].str.contains(name.replace("AI", "人工").replace("算力", ""), na=False)]
            if len(row) == 0:
                row = board[board["板块名称"].str.contains(name[:2], na=False)]
            if len(row):
                r = row.iloc[0]
                hot_sectors.append({
                    "name": name,
                    "realName": str(r["板块名称"]),
                    "chg": float(r["涨跌幅"]),
                })
            else:
                hot_sectors.append({"name": name, "realName": name, "chg": 0.0})

        # 9. v3.0 L2: 成交额(亿)（已有数据，从 akshare 的 volume/amount 字段提取）
        vol_yi = 0
        try:
            vol_yi = round(float(sh.iloc[-1].get("volume", 0)) / 100000000, 1)  # 手→亿
            if vol_yi <= 0:
                vol_yi = round(float(sh.iloc[-1].get("amount", 0)) / 100000000, 1)  # 备用: 成交金额
        except Exception:
            pass

        # 10. v3.0 L2: 沪深300 PE（腾讯财经 qt.gtimg.cn）
        pe_300 = 0
        pe_pct = 50  # 默认50%分位
        try:
            import urllib.request, re as _re
            url_300 = "http://qt.gtimg.cn/q=sh000300"
            req = urllib.request.Request(url_300, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw300 = resp.read().decode("gbk", errors="replace")
            f300 = _re.search(r'="([^"]*)"', raw300)
            if f300:
                fields = f300.group(1).split("~")
                if len(fields) > 39 and fields[39] and fields[39] != "0":
                    pe_300 = round(float(fields[39]), 1)
            # 简单分位数估算: PE<10=极低估(5%), PE=10-12=低估(15%), PE=12-15=偏低(30%)
            # PE=15-18=合理(50%), PE=18-22=偏高(65%), PE=22-28=高估(80%), PE>28=泡沫(95%)
            if pe_300 > 0:
                if pe_300 < 10: pe_pct = 5
                elif pe_300 < 12: pe_pct = 15
                elif pe_300 < 15: pe_pct = 30
                elif pe_300 < 18: pe_pct = 50
                elif pe_300 < 22: pe_pct = 65
                elif pe_300 < 28: pe_pct = 80
                else: pe_pct = 95
        except Exception as e:
            print(f"[L2] 沪深300 PE获取失败(降级为0): {e}")

        # 11. v3.0 L2: 融资余额变化(亿)（akshare 两融数据）
        margin_chg_yi = 0
        try:
            df_margin = ak.stock_margin_detail_sse(date=today.strftime("%Y%m%d"))
            if df_margin is not None and len(df_margin) > 0:
                # 取融资余额变化量
                col = next((c for c in df_margin.columns if "融资余额" in c), None)
                if col:
                    margin_today = float(df_margin[col].iloc[-1])
                    # 如果没有昨日数据，设为0
                    margin_chg_yi = 0
        except Exception as e:
            print(f"[L2] 融资余额获取失败(降级为0): {e}")

        # 12. v3.0 L1: 涨跌比变化率（与昨日对比）
        up_ratio_chg = 0
        try:
            out_dir = Path(__file__).resolve().parent / "output"
            last_archive = find_last_archive(out_dir)
            if last_archive and "expand" in last_archive:
                last_up = last_archive["expand"].get("upCount", 0)
                last_down = last_archive["expand"].get("downCount", 1)
                last_ratio = last_up / max(last_up + last_down, 1)
                up_ratio_chg = round(up_ratio - last_ratio, 4)
        except Exception:
            pass

        return {
            "sh_chg_pct": round(sh_chg_pct, 2),
            "sh_close": round(sh_close, 2),
            "up_count": up_count,
            "down_count": down_count,
            "sector_pick": sector_pick,
            "sector_avoid": sector_avoid,
            "sector_pick_detail": sector_pick_detail,
            "sector_avoid_detail": sector_avoid_detail,
            "dark_horse": dark_horse,
            "north_flow": north_str,
            "north_flow_yi": north_today,           # [修复] 北向原始数值(亿)
            "main_net_flow": main_net_str,             # [修复] 主力资金净流入(格式化)
            "main_net_flow_yi": main_net_today,        # [修复] 主力资金原始数值(亿)
            "emotion": emotion,
            "emotion_label": emo_label,
            "hot_sectors": hot_sectors,
            # v3.0 L1+L2: 大师专属异构特征
            "vol_yi": vol_yi,                         # 成交额(亿) — 奥尼尔
            "pe_300": pe_300,                          # 沪深300 PE — 格雷厄姆
            "pe_pct": pe_pct,                          # PE 分位数(%) — 格雷厄姆
            "margin_chg_yi": margin_chg_yi,            # 两融变化(亿) — 蔡金
            "up_ratio_chg": up_ratio_chg,              # 涨跌比变化率 — 西蒙斯
        }
    except Exception as e:
        print(f"[ERR] akshare 抓数失败: {e}")
        import traceback; traceback.print_exc()
        return None


# ============ Mock 数据（增强版，含 detail/hot_sectors）============
def mock_data(date: datetime) -> dict:
    samples = [
        {  # 偏多
            "sh_chg_pct": 1.23, "sh_close": 3245.67, "up_count": 3245, "down_count": 1580,
            "sector_pick": ["AI算力", "半导体", "机器人"], "sector_avoid": ["地产", "白酒"],
            "sector_pick_detail": [
                {"name": "AI算力", "chg": "+5.23%", "chgRaw": 5.23, "flow": "+18.5亿"},
                {"name": "半导体", "chg": "+3.18%", "chgRaw": 3.18, "flow": "+12.3亿"},
                {"name": "机器人", "chg": "+2.85%", "chgRaw": 2.85, "flow": "+8.9亿"},
            ],
            "sector_avoid_detail": [
                {"name": "地产", "chg": "-1.85%", "chgRaw": -1.85, "flow": "-6.2亿"},
                {"name": "白酒", "chg": "-1.32%", "chgRaw": -1.32, "flow": "-4.1亿"},
            ],
            "dark_horse": "新能源", "north_flow": "+48.0亿",
            "emotion": 72, "emotion_label": "偏 贪",
        },
        {  # 中性
            "sh_chg_pct": 0.18, "sh_close": 3201.23, "up_count": 2480, "down_count": 2350,
            "sector_pick": ["银行", "电力", "煤炭"], "sector_avoid": ["题材股", "小盘成长"],
            "sector_pick_detail": [
                {"name": "银行", "chg": "+1.23%", "chgRaw": 1.23, "flow": "+5.6亿"},
                {"name": "电力", "chg": "+0.98%", "chgRaw": 0.98, "flow": "+3.2亿"},
                {"name": "煤炭", "chg": "+0.85%", "chgRaw": 0.85, "flow": "+2.8亿"},
            ],
            "sector_avoid_detail": [
                {"name": "题材股", "chg": "-1.23%", "chgRaw": -1.23, "flow": "-3.5亿"},
                {"name": "小盘成长", "chg": "-0.85%", "chgRaw": -0.85, "flow": "-2.1亿"},
            ],
            "dark_horse": "军工", "north_flow": "+6.0亿",
            "emotion": 52, "emotion_label": "中 性",
        },
        {  # 偏空
            "sh_chg_pct": -0.85, "sh_close": 3175.43, "up_count": 1180, "down_count": 3680,
            "sector_pick": ["黄金", "公用事业", "军工"], "sector_avoid": ["周期股", "消费白马"],
            "sector_pick_detail": [
                {"name": "黄金", "chg": "+1.85%", "chgRaw": 1.85, "flow": "+4.2亿"},
                {"name": "公用事业", "chg": "+0.65%", "chgRaw": 0.65, "flow": "+2.8亿"},
                {"name": "军工", "chg": "+0.32%", "chgRaw": 0.32, "flow": "+1.5亿"},
            ],
            "sector_avoid_detail": [
                {"name": "周期股", "chg": "-2.85%", "chgRaw": -2.85, "flow": "-12.5亿"},
                {"name": "消费白马", "chg": "-2.18%", "chgRaw": -2.18, "flow": "-8.9亿"},
            ],
            "dark_horse": "医药", "north_flow": "-32.0亿",
            "emotion": 28, "emotion_label": "偏 恐",
        },
        {  # 大涨
            "sh_chg_pct": 2.15, "sh_close": 3320.18, "up_count": 4280, "down_count": 720,
            "sector_pick": ["AI算力", "半导体", "消费电子"], "sector_avoid": ["防御板块"],
            "sector_pick_detail": [
                {"name": "AI算力", "chg": "+8.85%", "chgRaw": 8.85, "flow": "+35.2亿"},
                {"name": "半导体", "chg": "+6.32%", "chgRaw": 6.32, "flow": "+28.5亿"},
                {"name": "消费电子", "chg": "+4.18%", "chgRaw": 4.18, "flow": "+15.6亿"},
            ],
            "sector_avoid_detail": [
                {"name": "防御板块", "chg": "-0.85%", "chgRaw": -0.85, "flow": "-2.1亿"},
                {"name": "黄金", "chg": "-0.32%", "chgRaw": -0.32, "flow": "-0.8亿"},
            ],
            "dark_horse": "机器人", "north_flow": "+96.0亿",
            "emotion": 82, "emotion_label": "极 贪",
        },
    ]
    idx = date.timetuple().tm_yday % len(samples)
    s = samples[idx]
    s["hot_sectors"] = [
        {"name": "AI算力", "realName": "人工智能", "chg": s["sector_pick_detail"][0]["chgRaw"]},
        {"name": "半导体", "realName": "半导体", "chg": s["sector_pick_detail"][1]["chgRaw"] if len(s["sector_pick_detail"]) > 1 else 0},
        {"name": "新能源", "realName": "新能源", "chg": 0.5},
        {"name": "机器人", "realName": "机器人", "chg": 1.2},
        {"name": "医药", "realName": "医药", "chg": -0.3},
        {"name": "军工", "realName": "军工", "chg": 0.8},
        {"name": "银行", "realName": "银行", "chg": 0.15},
        {"name": "消费", "realName": "消费", "chg": -0.5},
    ]
    # v3.0: mock 默认值（按指数涨跌情况推导合理假值）
    sh = s["sh_chg_pct"]
    s.setdefault("north_flow_yi", round(sh * 30 + 10, 1))      # 北向净额: 涨多流入
    s.setdefault("main_net_flow_yi", round(sh * 50 + 20, 1))   # 主力净额: 涨多流入
    s.setdefault("vol_yi", round(6000 + sh * 1500, 1))          # 成交额: 涨多放量
    s.setdefault("pe_300", round(15 - sh * 3, 1))                # PE: 涨多=PE高
    s.setdefault("pe_pct", int(50 + sh * 12))                    # 分位数: 涨多分位高
    s.setdefault("margin_chg_yi", round(sh * 15, 1))             # 两融: 涨多加杠杆
    s.setdefault("up_ratio_chg", round(sh * 0.03, 4))            # 涨跌比变: 涨多改善
    return s


# ============ 合规声明 ============
COMPLIANCE_DISCLAIMER = "*仅供娱乐参考，不构成投资建议。市场有风险，投资需谨慎。"


# ============ 8 位标准大师定义（2+6 架构）============
MASTERS_DEF = [
    {
        "id": "trend", "name": "趋势派·奥尼尔", "school": "CAN SLIM · 量价突破",
        "initial": "势", "color": "#D4A853", "isFree": True,
        "priceSingle": None, "priceMonth": None,
        "feature": None,
    },
    {
        "id": "fund", "name": "资金派·蔡金", "school": "主力筹码 · A/D线",
        "initial": "金", "color": "#8A9A7D", "isFree": True,
        "priceSingle": None, "priceMonth": None,
        "feature": None,
    },
    {
        "id": "value", "name": "价值派·格雷厄姆", "school": "安全边际·估值分析",
        "initial": "值", "color": "#6B8CE3", "isFree": False,
        "priceSingle": 1.99, "priceMonth": 9.9,
        "feature": "捡烟蒂的艺术 — 在恐慌中找到被错杀的宝石",
    },
    {
        "id": "cycle", "name": "周期派·霍华德·马克斯", "school": "周期钟摆·逆向思维",
        "initial": "周", "color": "#9B7ED9", "isFree": False,
        "priceSingle": 1.99, "priceMonth": 9.9,
        "feature": "在钟摆两端做决策 — 周期定位决定胜负",
    },
    {
        "id": "spec", "name": "游资派·短线客", "school": "龙头战法·热点轮动",
        "initial": "游", "color": "#E87D3E", "isFree": False,
        "priceSingle": 1.99, "priceMonth": 9.9,
        "feature": "追龙头的胆识 — 板块轮动中的快刀手",
    },
    {
        "id": "quant", "name": "量化派·西蒙斯", "school": "统计套利·多因子",
        "initial": "量", "color": "#4ECDC4", "isFree": False,
        "priceSingle": 1.99, "priceMonth": 9.9,
        "feature": "数据不会撒谎 — 用数学打败情绪",
    },
    {
        "id": "behavior", "name": "行为派·卡尼曼", "school": "行为金融·认知偏差",
        "initial": "心", "color": "#F06292", "isFree": False,
        "priceSingle": 1.99, "priceMonth": 9.9,
        "feature": "看穿人性弱点 — 认知偏差是你的提款机",
    },
    {
        "id": "retail", "name": "散户派·老张", "school": "韭菜心理学·舆情逆向",
        "initial": "韭", "color": "#FF7043", "isFree": False,
        "priceSingle": 1.99, "priceMonth": 9.9,
        "feature": "韭菜的生存法则 — 跟着聪明钱走，别当接盘侠",
    },
]


# ============ 时段感知 ============
def get_session_phase(date: datetime) -> dict:
    """
    判断当前时段，返回:
      phase: HOLIDAY | PRE_MARKET | INTRADAY | POST_MARKET
      isHoliday: bool
      lastTradingDate: str (HOLIDAY时返回最近交易日)
      hint: str (用户提示文案)
    """
    now = datetime.now()
    is_hol = not is_trading_day(date)

    if is_hol:
        # 找最近一个交易日
        last_td = date
        for i in range(1, 30):
            candidate = date - timedelta(days=i)
            if is_trading_day(candidate):
                last_td = candidate
                break
        return {
            "phase": "HOLIDAY",
            "isHoliday": True,
            "lastTradingDate": last_td.strftime("%Y-%m-%d"),
            "hint": f"今日休市 · 数据截止 {last_td.strftime('%m月%d日')}",
        }

    # 交易日细分
    current_time = now.time()
    pre_market = current_time.hour < 9 or (current_time.hour == 9 and current_time.minute < 30)
    intraday = (current_time.hour == 9 and current_time.minute >= 30) or \
               (9 < current_time.hour < 15) or \
               (current_time.hour == 15 and current_time.minute == 0)
    post_market = current_time.hour > 15 or (current_time.hour == 15 and current_time.minute > 0)

    if pre_market:
        return {
            "phase": "PRE_MARKET",
            "isHoliday": False,
            "lastTradingDate": date.strftime("%Y-%m-%d"),
            "hint": "盘前时段 · 昨日收盘数据已就绪",
        }
    elif intraday:
        return {
            "phase": "INTRADAY",
            "isHoliday": False,
            "lastTradingDate": date.strftime("%Y-%m-%d"),
            "hint": "交易中 · 数据实时更新",
        }
    else:
        return {
            "phase": "POST_MARKET",
            "isHoliday": False,
            "lastTradingDate": date.strftime("%Y-%m-%d"),
            "hint": "已收盘 · 今日完整数据可用",
        }


# ============ 大师团点评（8 位标准大师 · 真实数据驱动）============
def _gen_master_view(mid: str, raw: dict, grade: str, seed: int) -> dict:
    """为单一大师生成差异化观点（基于流派特征 + 真实指标）"""
    import hashlib
    rng = random.Random(seed)  # 每个大师独立但确定性的随机种子

    sh = raw["sh_chg_pct"]
    em = raw["emotion"]
    pick = raw["sector_pick"][:2] if raw["sector_pick"] else ["防御板块"]
    avoid = raw["sector_avoid"][:1] if raw["sector_avoid"] else ["题材股"]
    north = raw["north_flow"]
    main_net = raw.get("main_net_flow", "—")       # [修复] 独立主力资金净流入
    dark = raw["dark_horse"]
    up_c = raw["up_count"]
    down_c = raw["down_count"]
    pick_str = " / ".join(pick)
    avoid_str = avoid[0]
    total = max(up_c + down_c, 1)
    up_ratio = up_c / total

    # v3.0 L1+L2: 大师专属异构特征（打破 sh_chg_pct 同质化）
    north_yi = raw.get("north_flow_yi", 0)           # 北向净额(亿) — 蔡金
    main_yi = raw.get("main_net_flow_yi", 0)          # 主力净额(亿) — 蔡金
    vol_yi = raw.get("vol_yi", raw.get("volume_yi", 0))  # 沪市成交额(亿) — 奥尼尔
    pe_300 = raw.get("pe_300", 0)                     # 沪深300 PE — 格雷厄姆
    pe_pct = raw.get("pe_pct", 50)                    # PE 历史分位数(%) — 格雷厄姆
    margin_chg = raw.get("margin_chg_yi", 0)          # 融资余额变化(亿) — 蔡金(L2)
    hot_bull_count = sum(1 for s in raw.get("hot_sectors", []) if s.get("chg", 0) > 3)  # 强势板块数 — 短线客
    up_ratio_chg = raw.get("up_ratio_chg", 0)         # 涨跌比变化(今日 vs 昨日) — 西蒙斯

    def fmt_verdict(v):
        """BUY/HOLD/SELL → verdict + verdictCls"""
        mapping = {"BUY": ("BUY", "buy"), "HOLD": ("HOLD", "hold"), "SELL": ("SELL", "sell")}
        return mapping.get(v, ("HOLD", "hold"))

    def disclaim(text):
        return text + "\n" + COMPLIANCE_DISCLAIMER

    # ---- 每位大师的独立分析逻辑 ----
    if mid == "trend":
        # 奥尼尔：CAN SLIM — v3.0: 用真实成交量(vol_yi)替代情绪指数做量价确认
        vol_bull = vol_yi > 8000  # 沪市成交额>8000亿视为放量
        vol_strong = vol_yi > 11000
        vol_desc = f"放量({vol_yi:.0f}亿)" if vol_bull else f"缩量({vol_yi:.0f}亿)" if vol_yi > 3000 else ""
        if sh >= 1.0 and vol_bull:
            ver = "BUY"
            vol_extra = f"成交额{vol_yi:.0f}亿，" + ("大幅放量！" if vol_strong else "放量配合。")
            txt = f"{vol_extra}沪指涨{sh:+.2f}%，上涨{up_c}家，典型的'量价齐升'右侧信号。{pick_str}领涨，CAN SLIM的N(New Highs)条件满足。"
            tac = "顺势加仓至7成，聚焦领涨板块龙头，设止损于5日线"
            metrics = f"沪指:{sh:+.2f}% | 成交:{vol_yi:.0f}亿 | 领涨:{pick_str}"
            logic = "CAN SLIM→成交量(volume)确认趋势强度; N=新高, L=龙头"
            checklist = ["确认领涨龙头放量创新高", "成交额维持8000亿以上为健康", "止损位设在5日均线"]
        elif sh >= 0.3 or vol_bull:
            ver = "HOLD"
            vol_hint = f"但成交额仅{vol_yi:.0f}亿，量能不足以支撑真突破。" if not vol_bull and vol_yi > 0 else f"成交{vol_yi:.0f}亿，量能尚可。" if vol_bull else ""
            txt = f"沪指{sh:+.2f}%，{vol_hint}{pick_str}有表现。等待放量突破(成交>8000亿)确认再入场。"
            tac = "维持5成仓位，等成交量放大再行动"
            metrics = f"沪指:{sh:+.2f}% | 成交:{vol_yi:.0f}亿 | 领涨:{pick_str}"
            logic = "CAN SLIM→温和趋势需放量确认; 无量的上涨是虚火"
            checklist = ["紧盯成交额是否突破8000亿", "北向资金连续流向", "不追高无量的上涨"]
        elif sh > -1.0:
            ver = "HOLD"
            vol_note = f"成交{vol_yi:.0f}亿" if vol_yi > 0 else ""
            txt = f"横盘震荡，沪指{sh:+.2f}%，{vol_note}。{pick_str}和{avoid_str}分化，量能不足方向不明。不建议频繁操作。"
            tac = "轻仓试探(≤3成)，严格止损，等趋势明朗"
            metrics = f"沪指:{sh:+.2f}% | 成交:{vol_yi:.0f}亿 | 涨跌比:{up_ratio:.0%}"
            logic = "震荡市→CAN SLIM要求放量突破才入场; 缩量横盘=不宜操作"
            checklist = ["仓位不超过3成", "只操作最强势个股", "不抄底弱势板块"]
        else:
            ver = "SELL"
            vol_panic = f"成交{vol_yi:.0f}亿" + ("，恐慌抛售。" if vol_bull else "，阴跌无量。") if vol_yi > 0 else ""
            txt = f"下跌趋势！沪指{sh:+.2f}%，下跌{down_c}家占优，{vol_panic}C阶段(修正期)，不接飞刀。"
            tac = "空仓或降至2成以下，现金为王"
            metrics = f"沪指:{sh:+.2f}% | 成交:{vol_yi:.0f}亿 | 下跌占比:{down_c/total:.0%}"
            logic = "CAN SLIM C-stage→放量下跌=恐慌出逃; 缩量下跌=无人接盘。都应回避。"
            checklist = ["减仓至2成以下", "不抄底任何看似便宜的股票", "等连续3日不创新低+成交回暖"]

    elif mid == "fund":
        # 蔡金：A/D线 + 主力筹码 + 两融（v3.0: 直接用数值，不再解析字符串）
        net_north = north_yi if north_yi else 0      # 北向净额(亿)
        net_main = main_yi if main_yi else 0           # 主力净额(亿)
        net_margin = margin_chg if margin_chg else 0    # 两融变化(亿)
        north_desc = f"+{net_north:.0f}亿" if net_north >= 0 else f"{net_north:.0f}亿"
        main_desc = f"+{net_main:.0f}亿" if net_main >= 0 else f"{net_main:.0f}亿"
        # v3.0: 三线共振（北向+主力+两融）才给 BUY，双线 HOLD，单线 SELL
        triple = (1 if net_north > 30 else 0) + (1 if net_main > 50 else 0) + (1 if net_margin > 20 else 0)
        if triple >= 2 and net_main > 30:
            ver = "BUY"
            txt = f"资金面{'三' if triple>=3 else '双'}线共振！北向{north_desc}，主力{main_desc}" + (
                f"，两融+{net_margin:.0f}亿" if net_margin > 20 else "") + f"。A/D线实质性向上——这不是护盘是真金白银建仓。{pick_str}获机构加配。"
            tac = "跟庄操作，逢低吸纳资金共振板块"
            metrics = f"北向:{north_desc} | 主力:{main_desc} | 两融:{'+' if net_margin>=0 else ''}{net_margin:.0f}亿 | 共振:{triple}/3"
            logic = ("蔡金A/D线→北向+主力+两融三线共振=Smart Money一致性确认" if triple>=3 else
                     "蔡金A/D线→双线共振=资金面偏多但未达最强信号")
            checklist = ["跟踪北向连续3日净流入趋势", "关注两融余额是否持续回升", "任一线转负则减仓"]
        elif net_north > 10 or net_main > 20:
            ver = "HOLD"
            txt = f"资金面温和偏暖但未形成共振。北向{north_desc}，主力{main_desc}。" + (
                f"两融{'+' if net_margin>=0 else ''}{net_margin:.0f}亿，杠杆资金观望。" if abs(net_margin)<20 else
                f"两融变化{net_margin:+.0f}亿，有所行动。") + f"{pick_str}有资金关注但不够集中。"
            tac = "维持现有仓位，等资金共振信号再加仓"
            metrics = f"北向:{north_desc} | 主力:{main_desc} | 共振:弱 | 评分:B"
            logic = "A/D线横向整理→需三线共振才可积极操作"
            checklist = ["监控北向盘中流向", "注意尾盘主力异动", "观察两融余额连续变化趋势"]
        elif net_north > -20:
            ver = "HOLD"
            txt = f"资金面弱势但未到恐慌。北向{north_desc}，主力{main_desc}。{avoid_str}资金承压但整体可控。观望为主，不急于操作。"
            tac = "减仓至4成，回避资金持续流出板块"
            metrics = f"北向:{north_desc} | 主力:{main_desc} | 评分:C"
            logic = "A/D线走平→多空平衡; 不宜激进也不必恐慌"
            checklist = ["减少流出板块仓位", "保留逆势流入标的", "设置动态止盈止损"]
        else:
            ver = "SELL"
            txt = f"资金面严重恶化！北向{north_desc}，主力大规模撤离{main_desc}。" + (
                f"两融{net_margin:+.0f}亿，杠杆资金也在撤退。" if net_margin < -10 else "") + f"A/D线与价格同步向下——这不是洗盘是真出货。{avoid_str}是重灾区。"
            tac = "全面减仓，现金比例不低于7成"
            metrics = f"北向:{north_desc} | 主力:{main_desc} | 共振:全面撤离 | 评分:D"
            logic = "A/D线与价格同步下行→真出货; 三线全负=系统性风险"
            checklist = ["立即将仓位降至3成以下", "清仓资金持续流出板块", "保留现金等待A/D线企稳"]

    elif mid == "value":
        # 格雷厄姆：安全边际 + 真实估值（v3.0: 用沪深300 PE + 分位数替代假PE）
        has_real_pe = pe_300 > 0
        pe_val = pe_300 if has_real_pe else (15 + sh * 2)  # 真PE优先，降级假PE
        pe_label = f"沪深300 PE={pe_300:.1f}(分位数{pe_pct:.0f}%)" if has_real_pe else f"估算PE≈{pe_val:.0f}"
        cheap = has_real_pe and pe_pct < 25
        moderately_cheap = has_real_pe and pe_pct < 45
        expensive = has_real_pe and pe_pct > 75
        if not has_real_pe:
            ver = "HOLD"
            txt = "估值数据暂不可用，价值派本日弃权。缺少真实PE/PB分位时，不能用指数单日涨跌代替安全边际。"
            tac = "等待真实估值数据恢复，不依据短期价格波动做价值判断"
            metrics = "PE:缺失 | 安全边际:不可判定 | 数据质量:不足"
            logic = "价值模型数据门控→真实估值缺失时弃权，避免用价格结果反推估值"
            checklist = ["检查沪深300估值数据源", "补充PB与股息率历史分位", "数据恢复前保持中性"]
        elif cheap:
            ver = "BUY"
            txt = f"安全边际极其充足！{pe_label}，估值处于历史底部区域。格雷厄姆说'市场报价是为你服务的'——当前折扣力度是捡黄金的时刻。优质资产被恐慌抛售给了我们绝佳的入场窗口。"
            tac = "分批建仓优质蓝筹，越跌越买"
            metrics = f"PE:{pe_val:.1f} | 分位:{pe_pct:.0f}% | 安全边际:极厚 | 极度低估"
            logic = "格雷厄姆→PE分位数<25%=低估区间; 安全边际来自价格远低于内在价值"
            checklist = ["筛选PE<行业均值且ROE>15%的标的", "分3批建仓每批间隔5%跌幅", "单一标的仓位不超总资金10%"]
        elif moderately_cheap:
            ver = "BUY"
            txt = f"市场给出了合理的折扣。{pe_label}，部分板块已经出现了价值洼地。{pick_str}中有基本面扎实的公司被错杀，可以精选入场。"
            tac = "精选被错杀的优质标的，小仓位试探"
            metrics = f"PE:{pe_val:.1f} | 分位:{pe_pct:.0f}% | 安全边际:适中 | 适度低估"
            logic = "格雷厄姆→PE分位数<45%=有安全边际; 精选个股优于择时"
            checklist = ["用PE/PB/股息率三维筛选低估标的", "关注分红率>3%的高股息股", "建仓后持有周期≥6个月"]
        elif expensive:
            ver = "SELL"
            txt = f"市场已经没那么便宜了。{pe_label}，估值分位数偏高，安全边际正在消失。记住格雷厄姆的警告：牛市中最大的风险就是付出过高的价格。"
            tac = "逐步获利了结，将利润落袋为安"
            metrics = f"PE:{pe_val:.1f} | 分位:{pe_pct:.0f}% | 估值偏高 | 逐步止盈"
            logic = "格雷厄姆→PE分位数>75%=高估; 别人贪婪时卖出"
            checklist = ["对盈利>50%的仓位分批止盈", "降低股票仓位至50%以下", "锁定核心持仓成本"]
        else:
            ver = "HOLD"
            txt = f"估值处于合理区间，没有明显的安全边际。{pe_label}。最好的策略是耐心等待——好球总会来的。做足功课但不必急于出手。"
            tac = "耐心持币等待更好的击球点"
            metrics = f"PE:{pe_val:.1f} | 分位:{pe_pct:.0f}% | 估值合理 | 持币等待"
            logic = "格雷厄姆→只在有明显安全边际时行动; 合理估值=花时间研究而非交易"
            checklist = ["建立观察名单，记录目标价位", "定期更新估值模型", "预留40%+现金等待机会"]

    elif mid == "cycle":
        # 霍华德·马克斯：周期钟摆
        cycle_pos = (sh + 5) / 10  # 归一化到 0-1 区间近似周期位置
        if cycle_pos < 0.25:
            ver = "BUY"
            txt = f"钟摆接近极端悲观端！沪指{sh:+.2f}%，市场弥漫恐惧。霍华德·马克斯说'优秀投资的起点是当前价格过低'。我们在周期的低谷区域，正是逆向布局的最佳时机。"
            tac = "逆向加仓，承担合理风险换取超额收益"
            metrics = f"周期位置:底部区域(≈{cycle_pos:.0%}) | 钟摆读数:极度悲观 | 风险收益比:极优"
            logic = "周期投资钟摆→乐观↔悲观摆动; 极端位置提供最佳风险收益比; 此时承担风险=获取超额回报"
            checklist = ["确认周期底部信号(成交量萎缩+波动率下降)", "配置逆周期资产(高股息+黄金)", "心理建设:接受短期浮亏"]
        elif cycle_pos < 0.45:
            ver = "HOLD"
            txt = f"钟摆从悲观端向中部回摆，但还没到最佳位置。沪指{sh:+.2f}%，市场情绪正在修复中。此时不宜激进，应该享受前期布局的收益同时保持警觉。"
            tac = "持有现有仓位，适度止盈获利盘"
            metrics = f"周期位置:复苏初期(≈{cycle_pos:.0%}) | 钟摆读数:偏弱 | 趋势:修复中"
            logic = "周期钟摆→已过极端位置但尚未到中值; 收益空间收窄但风险仍在可控范围"
            checklist = ["审视持仓的周期敏感度", "逐步兑现超预期收益", "准备下一轮周期布局"]
        elif cycle_pos < 0.65:
            ver = "HOLD"
            txt = f"钟摆接近中值区域。沪指{sh:+.2f}%，市场既不狂热也不绝望。这是最考验耐心的阶段——没有明显的错误定价可以利用。霍华德说'大部分时间我们应该什么也不做'。"
            tac = "中性仓位，专注选股而非择时"
            metrics = f"周期位置:中间带(≈{cycle_pos:.0%}) | 钟摆读数:中性 | 定价效率:较高"
            logic = "周期中值→有效市场假说大致成立; 超额收益来自选股能力而非Beta"
            checklist = ["寻找结构性Alpha机会", "避免因无聊而过度交易", "保持纪律性再平衡"]
        else:
            ver = "SELL"
            txt = f"钟摆逼近乐观极端！沪指{sh:+.2f}%，情绪指数{em}。霍华德·马克斯的警告:'当所有人都认为风险很低时，风险其实最高。'我们正站在周期的危险一侧。"
            tac = "大幅降低风险敞口，保护本金优先"
            metrics = f"周期位置:顶部区域(≈{cycle_pos:.0%}) | 钟摆读数:极度乐观 | 风险隐患:高"
            logic = "周期钟摆极端→所有人都在同一边时风险最大化; 牛市的最后一程属于最勇敢的人也属于最大亏损者"
            checklist = ["系统性地降低权益仓位", "增加防御性资产配置", "准备好在真正崩盘后接货"]

    elif mid == "spec":
        # 短线客：龙头战法 + 热点轮动（v3.0: 加入 hot_bull_count 判断市场热度）
        top_sector_chg = raw.get("sector_pick_detail", [{}])[0].get("chgRaw", 0) if raw.get("sector_pick_detail") else 0
        hot_fire = hot_bull_count >= 3  # 至少3个板块涨超3%=真赚钱效应
        if top_sector_chg >= 3.0 and hot_fire:
            ver = "BUY"
            heat_desc = f"全市场{hot_bull_count}个板块涨超3%，这可不是一日游！"
            txt = f"兄弟们看好了！{pick[0] if pick else '主线'}暴涨{top_sector_chg:+.2f}%！{heat_desc}这就是龙头战法的教科书级案例——板块共振、连板梯队完整。涨停板打开前赶紧上车！"
            tac = f"重仓{pick[0]}龙头，打板或半路追涨"
            metrics = f"龙头:{pick[0]}({top_sector_chg:+.2f}%) | 强势板块:{hot_bull_count}个 | 封板率:高"
            logic = "龙头战法→板块爆发+多板块共振=真赚钱效应; 追涨是正确的"
            checklist = [f"开盘竞价直接上{pick[0]}龙头", "设-3%硬止损绝不犹豫", "封板则持有看连板"]
        elif top_sector_chg >= 1.0 or hot_bull_count >= 2:
            ver = "HOLD"
            txt = f"市场有热度但还不够炸裂。{pick_str}有动作，{hot_bull_count}个板块涨超3%。没有形成绝对主线之前不要乱冲——管住手才是真本事。"
            tac = "轻仓试错(≤2成)，只做最强板"
            metrics = f"活跃板块:{pick_str} | 强势数:{hot_bull_count} | 打板意愿:一般"
            logic = "短线交易→赚钱效应不够极致时不值得重仓; 宁可错过不可做错"
            checklist = ["观察是否有板块走出3连板", "只做换手充分的龙头首板", "严格执行T+1日内止损规则"]
        elif sh >= -0.5:
            ver = "HOLD"
            txt = f"今天的行情嘛...怎么说呢，半死不活的。没什么像样的热点，{pick_str}也是勉强红盘。这种震荡市短线最难做，来回割肉的概率很大。建议休息或者玩点超短的。"
            tac = "要么空仓要么极轻仓(1成)，不做也罢"
            metrics = f"赚钱效应:弱 | 热点持续性:差 | 操作难度:极高"
            logic = "游资心法→震荡市无明确主线的亏钱概率>70%; 不如喝茶看戏"
            checklist = ["如果非要操作只做首板的回封", "绝不打二板接力", "下午2点半以后不开新仓"]
        else:
            ver = "SELL"
            txt = f"卧槽！今天大跌{sh:+.2f}%啊兄弟们！{avoid_str}直接跪了。这时候谁还敢冲谁是真勇士（韭菜）。我的建议：跑！现在就跑！留得青山在不怕没柴烧！"
            tac = "全线清仓或空仓，不参与任何反弹"
            metrics = f"杀跌氛围:浓 | 跌停数量:多 | 亏钱效应:极强"
            logic = "游资风控→大跌日不抄底不接飞刀; 保住本金是第一要务"
            checklist = ["开盘如有反弹全部清掉", "今日不开任何新仓", "复盘今日杀跌板块列入黑名单"]

    elif mid == "quant":
        # 西蒙斯：量化多因子（v3.0: 加入涨跌比变化率+流动性+波动率惩罚）
        momentum_factor = sh * 0.4 + up_ratio_chg * 8  # 价格趋势 + 涨跌比动量
        breadth_factor = hot_bull_count / 8  # 市场宽度(强势板块占比)
        liquidity_factor = min(vol_yi / 12000, 1.5) if vol_yi > 0 else 1.0
        vol_penalty = min(abs(sh) * 0.3, 0.5)
        composite_score = (momentum_factor * 0.35 + breadth_factor * 8 * 0.25 +
                           liquidity_factor * 0.20 + (1 - vol_penalty) * 0.20) * 2
        chg_note = f"涨跌比变化{up_ratio_chg:+.1%}" if abs(up_ratio_chg) > 0.005 else "涨跌比稳定"
        if composite_score > 2.0:
            ver = "BUY"
            txt = f"多因子模型得分{composite_score:+.1f}，强看多。动量{momentum_factor:+.2f}，{chg_note}，宽度{breadth_factor:.0%}，流动性{liquidity_factor:.1f}x。因子共振=高置信度。"
            tac = "按模型权重配置多因子组合，beta暴露60%"
            metrics = f"得分:{composite_score:+.1f} | 动量:{momentum_factor:+.2f} | 宽度:{breadth_factor:.0%} | 流动:{liquidity_factor:.1f}x"
            logic = "多因子→Momentum(35%)+Breadth(25%)+Liquidity(20%)+VolPenalty(20%)>2=强买入"
            checklist = ["执行模型推荐的多头组合", "监控因子衰减情况(日频)", "风险预算VaR控制在5%以内"]
        elif composite_score > 0.5:
            ver = "HOLD"
            txt = f"多因子得分{composite_score:+.1f}，微弱正面。动量{momentum_factor:+.2f}，{chg_note}。信号噪声比偏低，模型建议维持敞口不变。"
            tac = "维持现有组合权重，不主动调仓"
            metrics = f"得分:{composite_score:+.1f} | 因子一致性:弱 | 信噪比:低"
            logic = "量化风控→信号强度不足时不做方向性调整; 避免过度拟合短期波动"
            checklist = ["保持现有组合不变", "每日更新因子值并记录", "连续3日反转则调仓"]
        elif composite_score > -1.5:
            ver = "HOLD"
            txt = f"多因子得分{composite_score:+.1f}，微弱负面。动量{momentum_factor:+.2f}，{chg_note}。统计上超额收益稀疏，降低换手率。"
            tac = "降低beta至40%，增加对冲"
            metrics = f"得分:{composite_score:+.1f} | 因子方向:混合 | 建议:部分对冲"
            logic = "量化中性→微弱负面信号采用市场中性策略; 降低方向性暴露"
            checklist = ["增加对冲比例至30%", "提高现金至20%", "寻找配对交易机会"]
        else:
            ver = "SELL"
            txt = f"多因子得分{composite_score:+.1f}，强烈看空。动量崩溃{momentum_factor:+.2f}，{chg_note}，宽度{breadth_factor:.0%}极低。全部因子一致向下——量化触发全面防御。"
            tac = "全面减仓至30%以下，开启对冲模式"
            metrics = f"得分:{composite_score:+.1f} | 因子一致性:极强 | VaR预警:🔴"
            logic = "多因子风控→所有主要因子共振向下=系统性风险极高"
            checklist = ["立即减仓至30%以下", "股指对冲比例提至50%+", "暂停所有主动多头策略"]

    elif mid == "behavior":
        # 卡尼曼：行为金融 + 认知偏差
        bias_list = []
        if em >= 70:
            bias_list.append("过度自信偏差(Overconfidence)")
        if abs(sh) > 1.5:
            bias_list.append("代表性偏差(Representativeness)")
        if up_ratio > 0.65 or up_ratio < 0.35:
            bias_list.append("可得性偏差(Availability)")
        if sh >= 0 and em >= 55:
            bias_list.append("羊群效应(Herding)")
        if sh < -1.0:
            bias_list.append("损失厌恶放大(Loss Aversion)")
        if not bias_list:
            bias_list.append("锚定效应(Anchoring)")

        primary_bias = bias_list[0]
        if em >= 72:
            ver = "SELL"
            txt = f"行为金融学警报！当前市场情绪指数高达{em}，触发了多个认知偏差预警：{' / '.join(bias_list)}。投资者正在犯经典的'好日子永远会继续下去'的错误。前景理论告诉我们：人们在盈利时的风险偏好是非理性的——你现在觉得安全恰恰是最危险的时候。"
            tac = "利用他人偏差获利——反向操作"
            metrics = f"情绪指数:{em} | 检测到的偏差:{len(bias_list)}个 | 主要偏差:{primary_bias}"
            logic = "行为金融→识别市场共识中的认知偏差并在其极端化时反向操作; 情绪极端时大众几乎必然犯错"
            checklist = ["识别自己是否受羊群影响", "列出3条反共识的操作理由", "设定强制冷静期(24h)后再决策"]
        elif em >= 55:
            ver = "HOLD"
            txt = f"市场情绪偏热(指数{em})，检测到潜在偏差：{' / '.join(bias_list)}。大多数投资者的决策正在被最近的走势所主导（可得性偏差）。好消息是还没有达到极端区域，坏消息是偏差已经开始影响定价效率。"
            tac = "有意识地对抗直觉，保持怀疑精神"
            metrics = f"情绪指数:{em} | 偏差状态:活跃 | 决策质量:需要警惕"
            logic = "行为金融→中等情绪水平下偏差存在但未极端化; 关键是有意识地使用System 2思维"
            checklist = ["在做任何决策前写下反面论据", "检查是否存在处置效应(卖盈持亏)", "用外部基准验证自己的判断"]
        elif em >= 38:
            ver = "HOLD"
            txt = f"情绪指数{em}处于中性偏低区域。有意思的是：这个区间往往伴随着'分析瘫痪'——投资者因缺乏明确信号而过度分析（分析偏差）。实际上这可能是信息效率较高的时刻，适合基于基本面做决策。"
            tac = "依靠System 2理性分析，忽略情绪噪音"
            metrics = f"情绪指数:{em} | 市场状态:理性区间 | 认知负荷:适中"
            logic = "行为金融→中性情绪时市场参与者更依赖理性分析; 这是基本面投资者最有利的环境"
            checklist = ["用清单式方法做每个投资决策", "预设入场/出场规则并严格执行", "记录每个决策的事后检讨"]
        else:
            ver = "BUY"
            txt = f"极端恐惧时刻！情绪指数仅{em}，市场充斥着：{' / '.join(bias_list)}。卡尼曼的前景理论完美解释了这个现象：人们对损失的痛苦感受是对称快乐的两倍——所以大家都在恐慌性抛售。但这恰恰创造了最好的买入机会。别人恐惧我贪婪不只是口号，它有坚实的心理学基础。"
            tac = "利用市场的非理性错误定价"
            metrics = f"情绪指数:{em}(极度恐惧) | 偏误放大系数:高 | 错误定价机会:丰富"
            logic = "行为金融→极端恐惧导致系统性错误定价; 损失厌恶使投资者在低位抛售优质资产; 反向操作期望值为正"
            checklist = ["写下为什么现在是买入时机(对抗自身损失厌恶)", "分批建仓以降低心理压力", "设定明确规则防止过早止盈"]

    elif mid == "retail":
        # 散户老张：韭菜心理学 + 舆情逆向
        retail_sentiment = "极度亢奋" if em >= 75 else "偏兴奋" if em >= 58 else "还行吧" if em >= 42 else "有点慌" if em >= 28 else "妈呀救命"
        if em <= 32 and sh < -1.5:
            ver = "BUY"
            txt = f"各位股友稳住！今天确实惨，沪指跌{sh:+.2f}%，但我跟你们说——这就是机会啊！你看群里都在喊'销户''再也不玩了'，这不就是经典底吗？上次大家都这么说的时候后面涨了多少？{pick_str}这种好票都被带下来了，悄悄捡一点。别声张。"
            tac = "别人恐慌你捡筹码，但别all in"
            metrics = f"散户情绪:{retail_sentiment} | 群体行为:恐慌性抛售 | 逆向信号:强"
            logic = "散户逆向指标→当散户群体高度一致地看空时往往是阶段性底部; 舆情极端=机会窗口"
            checklist = ["关闭股票群和论坛避免被情绪感染", "制定分批买入计划(分5次每次跌2%)", "告诉自己'我是来捡便宜的'"]
        elif em <= 48 and sh < 0:
            ver = "HOLD"
            txt = f"哎今天又绿了{abs(sh):.1f}%...我看群里有人割肉有人抄底，吵得不可开交。说实话这种阴跌最折磨人。我的经验是：别在这种时候做重大决策，因为你现在看到的都是负面消息，脑子不清醒。"
            tac = "躺平不动是最好的操作"
            metrics = f"散户情绪:{retail_sentiment} | 群体行为:分歧加大 | 建议操作:少动"
            logic = "散户心理学→震荡下跌期散户容易做出冲动决策(割肉在地板上); 不作为优于乱作为"
            checklist = ["今天不许看账户", "不许刷股评和论坛", "如果实在手痒最多买100块钱练手"]
        elif em <= 62:
            ver = "HOLD"
            txt = f"今天行情还行吧，沪指{sh:+.2f}%。群里有人说牛市来了有人说快跑，反正每次都这样。我跟你们讲啊，这种不温不火的行情最容易让人放松警惕然后突然挨锤。别太乐观也别太悲观。"
            tac = "正常心态对待，不追热点不割肉"
            metrics = f"散户情绪:{retail_sentiment} | 群体行为:分歧 | 舆情温度:适中"
            logic = "散户行为模式→平庸行情中散户倾向于要么过度交易要么完全不看; 两种都错"
            checklist = ["坚持原有的交易计划不被群友带节奏", "记录今天自己的情绪变化", "检查是否因为最近赚了/亏了而改变策略"]
        else:
            ver = "SELL"
            txt = f"兄弟们小心啊！！今天群里全是晒收益的，连隔壁王大妈都说她赚了20%！沪指涨{sh:+.2f}%，情绪指数{em}——你们懂这意味着什么吧？每次大家都在喊'牛市来了'的时候，镰刀已经在磨了。{avoid_str}已经开始乏力了，见好就收吧。"
            tac = "跟着聪明钱跑，别当最后接盘的人"
            metrics = f"散户情绪:{retail_sentiment}(极度亢奋) | 群体行为:全民炒股 | 危险信号:🔴🔴🔴"
            logic = "散户逆向→当菜市场阿姨都在讨论股票时离顶部不远了; 散户一致性乐观是历史性顶部的可靠先行指标"
            checklist = ["把群里晒收益的截图保存下来以后对照", "至少卖出一半仓位锁住利润", "告诉自己'这次不一样'是历史上最贵的5个字"]

    else:
        ver = "HOLD"
        txt = f"沪指{sh:+.2f}%，情绪{em}。{pick_str}值得关注。"
        tac = "保持观察"
        metrics = f"{sh} / {em} / {pick_str}"
        logic = "默认分析逻辑"
        checklist = ["观察市场变化"]

    v, vc = fmt_verdict(ver)

    # V2: 置信度来自大师专属证据完整度，不再由所有大师共享的单日涨跌决定。
    abs_sh = abs(sh)
    evidence_quality = {
        "trend": 0.75 if vol_yi > 0 and total > 1000 else 0.35,
        "fund": min(0.9, 0.3 + 0.2 * sum([
            abs(north_yi) > 0, abs(main_yi) > 0, abs(margin_chg) > 0,
        ])),
        "value": 0.8 if pe_300 > 0 else 0.3,
        "cycle": 0.45,  # 当前周期模型仍缺少长周期价格路径，只给中低置信度
        "spec": 0.75 if raw.get("sector_pick_detail") else 0.35,
        "quant": 0.8 if vol_yi > 0 and total > 1000 else 0.4,
        "behavior": 0.7 if total > 1000 else 0.4,
        "retail": 0.65 if total > 1000 else 0.4,
    }.get(mid, 0.4)
    direction_strength = min(abs_sh / 3.0, 1.0)
    confidence = min(0.9, max(0.3, 0.75 * evidence_quality + 0.25 * direction_strength))
    if mid == "value" and pe_300 <= 0:
        confidence = min(confidence, 0.35)
    if mid == "fund" and not any((abs(north_yi) > 0, abs(main_yi) > 0, abs(margin_chg) > 0)):
        confidence = min(confidence, 0.35)

    # 概率随证据质量收缩：低质量数据不会输出伪高置信概率。
    top_probability = 0.42 + 0.38 * confidence
    remainder = 1.0 - top_probability
    if v == "BUY":
        scores = {"buy": top_probability, "sell": remainder * 0.35, "hold": remainder * 0.65}
    elif v == "SELL":
        scores = {"buy": remainder * 0.35, "sell": top_probability, "hold": remainder * 0.65}
    else:  # HOLD
        scores = {"buy": remainder / 2, "sell": remainder / 2, "hold": top_probability}
    # 归一化到 0-1
    s_sum = max(scores["buy"] + scores["sell"] + scores["hold"], 0.01)
    scores = {k: round(v / s_sum, 3) for k, v in scores.items()}

    definition = next((m for m in MASTERS_DEF if m["id"] == mid), None)
    result = {
        "id": mid,
        "name": definition["name"] if definition else mid,
        "school": definition["school"] if definition else "",
        "initial": definition["initial"] if definition else "",
        "color": definition["color"] if definition else "#888888",
        "isFree": definition["isFree"] if definition else True,
        "verdict": v,
        "verdictCls": vc,
        "text": disclaim(txt),
        "tactics": tac,
        "detail": {
            "metrics": metrics,
            "logic": logic,
            "history": f"近5日参考: 沪指{'大涨' if sh > 1.5 else '上涨' if sh > 0 else '下跌' if sh > -1.5 else '大跌'}{abs(sh):.1f}%, 情绪{retail_sentiment if mid == 'retail' else ('贪婪' if em > 60 else '中性' if em > 40 else '恐惧')}",
            "checklist": checklist,
            "scores": scores,
            "confidence": round(confidence, 2),
        },
    }
    # 付费大师额外字段
    if definition and not definition["isFree"]:
        result["priceSingle"] = definition["priceSingle"]
        result["priceMonth"] = definition["priceMonth"]
        result["feature"] = definition["feature"]
    return result


def build_masters(raw: dict, grade: str) -> list:
    """
    构建8位大师观点（替代原4位假名大师）
    输入: raw(行情数据字典), grade(签等级)
    输出: 包含8位大师的字典列表
    """
    date_str = raw.get("date_str", datetime.now().strftime("%Y-%m-%d"))
    seed_base = hash(date_str) & 0x7FFFFFFF

    masters = []
    for idx, mdef in enumerate(MASTERS_DEF):
        master = _gen_master_view(mdef["id"], raw, grade, seed_base + idx * 137)
        masters.append(master)

    # 共识结论
    verdicts = [m["verdict"] for m in masters]
    buy_cnt = verdicts.count("BUY")
    sell_cnt = verdicts.count("SELL")
    hold_cnt = verdicts.count("HOLD")
    if buy_cnt >= 5:
        consensus = "多数偏多 · 顺势做多"
    elif sell_cnt >= 5:
        consensus = "多数偏空 · 防御为主"
    elif buy_cnt > sell_cnt + 1:
        consensus = "偏多倾向 · 可积极操作"
    elif sell_cnt > buy_cnt + 1:
        consensus = "偏空倾向 · 控制仓位"
    else:
        consensus = "分歧明显 · 仓位不动"

    return {"list": masters, "consensus": consensus}


def build_sign(date: datetime, raw: dict, source: str, is_holiday: bool, holiday_reason: str = "") -> dict:
    grade = grade_for(raw["sh_chg_pct"], raw["up_count"], raw["down_count"])
    poem = pick_poem(grade, date)

    trend_dir = "偏多" if raw["sh_chg_pct"] >= 0 else "偏空"
    if abs(raw["sh_chg_pct"]) < 0.3:
        trend_dir = "震荡"
    sign_str = "+" if raw["sh_chg_pct"] >= 0 else ""
    trend = f"{trend_dir} · 沪指 {sign_str}{raw['sh_chg_pct']:.2f}%"
    main_line = " / ".join(raw["sector_pick"][:2]) if raw["sector_pick"] else "—"

    masters = build_masters(raw, grade)

    # v2.4: Oracle 仲裁 — 用回测权重加权 8 大师 → 统一信号 + 签文微调
    oracle_result = None
    sign_adjustment = None
    try:
        from sign_oracle import Oracle, WeightStore, SignAdjuster
        weights = WeightStore.load()
        oracle = Oracle(weights)
        oracle_signal = oracle.analyze(masters["list"])
        # 签文微调（EMA 平滑 + 3 天连续确认）
        sign_adjustment = SignAdjuster.compute(
            oracle_signal, grade,
            ACTION_TEMPLATE[grade], RISK_TEMPLATE[grade]
        )
        # 如果 Oracle 建议调整等级，采用调整后的
        if sign_adjustment.get("adjusted"):
            adjusted_grade = sign_adjustment["grade"]
            grade = adjusted_grade
            poem = pick_poem(adjusted_grade, date)

        oracle_result = {
            "enabled": True,
            "signal": oracle_signal,
            "adjustment": sign_adjustment,
            "weightVersion": WeightStore.status().get("version", 0),
        }
        print(f"[Oracle] {oracle_signal['direction']} 强度={oracle_signal['strength']:.0%} "
              f"权重v{oracle_result['weightVersion']} | 调整: {'是' if sign_adjustment.get('adjusted') else '否'} "
              f"| {sign_adjustment.get('reason', '')[:60]}")
    except Exception as e:
        print(f"[Oracle] 仲裁跳过: {e}")
        oracle_result = {"enabled": False, "error": str(e)}

    final_action = sign_adjustment["action"] if sign_adjustment and sign_adjustment.get("adjusted") else ACTION_TEMPLATE[grade]
    final_risk = sign_adjustment["risk"] if sign_adjustment and sign_adjustment.get("adjusted") else RISK_TEMPLATE[grade]

    return {
        "date": date.strftime("%Y.%m.%d"),
        "stickNo": stick_no_for(date),
        "grade": grade,
        "gradeLabel": GRADE_LABEL[grade],
        "gradeCls": GRADE_CLS[grade],
        "gradeColor": GRADE_COLOR[grade],
        "poemAncient": poem["a"],
        "poemModern": poem["m"],
        "trend": trend,
        "mainLine": main_line,
        "risk": final_risk,
        "action": final_action,
        "expand": {
            "sectorPick": raw["sector_pick"],
            "sectorAvoid": raw["sector_avoid"],
            "sectorPickDetail": raw["sector_pick_detail"],
            "sectorAvoidDetail": raw["sector_avoid_detail"],
            "darkHorse": raw["dark_horse"],
            "northFlow": raw["north_flow"],
            "mainNetFlow": raw.get("main_net_flow", "—"),          # [修复] 独立主力资金
            "emotion": raw["emotion"],
            "emotionLabel": raw["emotion_label"],
            "upCount": raw["up_count"],
            "downCount": raw["down_count"],
            "shClose": raw.get("sh_close"),
            "shChgPct": raw["sh_chg_pct"],
            "hotSectors": raw.get("hot_sectors", []),
            # V2 回测特征快照：保留预测当时可见的数据，供后续诊断和
            # walk-forward 使用。不得在归档阶段回填未来数据。
            "northFlowYi": raw.get("north_flow_yi"),
            "mainNetFlowYi": raw.get("main_net_flow_yi"),
            "volumeYi": raw.get("vol_yi", raw.get("volume_yi")),
            "volumeRatio": raw.get("volume_ratio"),
            "pe300": raw.get("pe_300"),
            "pePct": raw.get("pe_pct"),
            "marginChgYi": raw.get("margin_chg_yi"),
            "upRatioChg": raw.get("up_ratio_chg"),
            "dataQuality": raw.get("_data_quality", {}),
        },
        "masters": masters,
        "oracle": oracle_result,
        "isHoliday": is_holiday,
        "holidayReason": holiday_reason if is_holiday else "",
        "dataSource": source,
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def find_last_archive(out_dir: Path):
    """找最近一份归档（休市态用）"""
    archives = sorted(out_dir.glob("sign-*.json"), reverse=True)
    for a in archives:
        try:
            with open(a, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            continue
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mock", action="store_true", help="不调 akshare，使用 mock 数据")
    parser.add_argument("--force", action="store_true", help="即使今日已生成也重新跑")
    parser.add_argument("--out", default=None, help="输出 JSON 路径，默认 ./output/daily-sign.json")
    args = parser.parse_args()

    today = datetime.now()
    out_dir = Path(__file__).resolve().parent / "output"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = Path(args.out) if args.out else out_dir / "daily-sign.json"

    # ===== 节假日检测 =====
    is_holiday = False
    holiday_reason = ""
    if not args.mock and not is_trading_day(today):
        is_holiday = True
        if today.weekday() == 5:
            holiday_reason = "周六休市 · 财神也歇着"
        elif today.weekday() == 6:
            holiday_reason = "周日休市 · 财神也歇着"
        else:
            holiday_reason = "节假日休市 · 财神也歇着"

    # ===== 取数据（v3.2: data_pipeline 多层编排）=====
    raw = None
    source = "mock · 兜底"

    if args.mock:
        raw = mock_data(today)
        source = "mock · 演示数据"
    elif HAS_PIPELINE:
        # v3.2: 数据编排管线自动处理多层降级 + 假日缓存
        raw, source = pipeline_orchestrate(is_holiday)
        if raw is None:
            # Pipeline 全部失败：最后尝试 akshare
            raw = fetch_real_data()
            source = "akshare · 最后兜底" if raw else source
        if raw is None:
            raw = mock_data(today)
            source = "mock · 全部数据源失败回退"
    else:
        # 降级到旧方案
        raw = fetch_real_data()
        if raw is None:
            raw = mock_data(today)
            source = "mock · akshare 失败回退"

    sign = build_sign(today, raw, source, is_holiday, holiday_reason)

    # 原子写入：先写临时文件，再 rename（POSIX 原子操作，避免并发读不完整 JSON）
    tmp_fd, tmp_path = tempfile.mkstemp(dir=str(out_dir), suffix=".json")
    with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
        json.dump(sign, f, ensure_ascii=False, indent=2)
    os.chmod(tmp_path, 0o644)  # 保持 nginx/www-data 对原子替换后的签文文件可读
    shutil.move(tmp_path, str(out_path))

    # 历史归档（仅交易日）
    if not is_holiday:
        history = out_dir / f"sign-{today.strftime('%Y%m%d')}.json"
        with open(history, "w", encoding="utf-8") as f:
            json.dump(sign, f, ensure_ascii=False, indent=2)

        # v2.4: 自动归档到 verdicts/ 目录供回测使用
        try:
            from backtest_tracker import archive_verdict
            archive_verdict(today, sign)
        except Exception as e:
            print(f"[WARN] verdict 归档失败（不影响签文生成）: {e}")

    print(f"[OK] 已生成 {out_path}")
    print(f"     等级: {sign['gradeLabel']} · 沪指: {raw['sh_chg_pct']:+.2f}% · 来源: {source}")
    if is_holiday:
        print(f"     节假日: {holiday_reason}")


# ============ Flask API 端点（v2.0 实时大师接口）============
# 缓存管理
_masters_cache = {"data": None, "cached_at": None, "expires_at": None}
_CACHE_TTL_SECONDS = 900  # 15分钟缓存


def _get_cached_masters():
    """读取缓存，返回 (data, cache_info)"""
    now = datetime.now()
    if _masters_cache["data"] and _masters_cache["expires_at"] and now < _masters_cache["expires_at"]:
        return _masters_cache["data"], {
            "cachedAt": _masters_cache["cached_at"].strftime("%Y-%m-%d %H:%M:%S"),
            "expiresAt": _masters_cache["expires_at"].strftime("%Y-%m-%d %H:%M:%S"),
            "ttl": f"{(_masters_cache['expires_at'] - now).seconds}s",
            "hit": True,
        }
    return None, None


def _set_cached_masters(data):
    """写入缓存"""
    now = datetime.now()
    _masters_cache["data"] = data
    _masters_cache["cached_at"] = now
    _masters_cache["expires_at"] = now + timedelta(seconds=_CACHE_TTL_SECONDS)


def create_app():
    """创建 Flask 应用"""
    try:
        from flask import Flask, request, jsonify
    except ImportError:
        print("[WARN] Flask 未安装，/api/masters 端点不可用。请 pip install flask")
        return None

    app = Flask(__name__)

    @app.route('/api/masters', methods=['GET'])
    def get_masters():
        """
        v2.0 实时大师团接口
        Query params:
          user_id: 用户ID(可选，用于付费解锁判断)
          force_refresh: 强制刷新缓存(可选)
          mock: 使用mock数据(可选)
        """
        # ---- 时段感知 ----
        today = datetime.now()
        session_phase = get_session_phase(today)

        # ---- 检查缓存 ----
        force = request.args.get('force_refresh', '0') == '1'
        cached_data, cache_info = (_get_cached_masters() if not force else (None, None))

        if cached_data:
            cached_data["_v2_realtime"]["sessionPhase"] = session_phase["phase"]
            cached_data["_v2_realtime"]["isHoliday"] = session_phase["isHoliday"]
            cached_data["_v2_realtime"]["hint"] = session_phase["hint"]
            return jsonify(cached_data)

        # ---- 获取数据 ----
        use_mock = request.args.get('mock', '0') == '1'
        is_hol = session_phase["isHoliday"]

        if use_mock:
            raw = mock_data(today)
            source = "mock · API请求"
        elif is_hol:
            out_dir = Path(__file__).resolve().parent / "output"
            last = find_last_archive(out_dir)
            if last and "expand" in last:
                ex = last["expand"]
                raw = {
                    "sh_chg_pct": ex.get("shChgPct", 0),
                    "sh_close": ex.get("shClose"),
                    "up_count": ex.get("upCount", 0),
                    "down_count": ex.get("downCount", 0),
                    "sector_pick": ex.get("sectorPick", []),
                    "sector_avoid": ex.get("sectorAvoid", []),
                    "sector_pick_detail": ex.get("sectorPickDetail", []),
                    "sector_avoid_detail": ex.get("sectorAvoidDetail", []),
                    "dark_horse": ex.get("darkHorse", "—"),
                    "north_flow": ex.get("northFlow", "—"),
                    "main_net_flow": ex.get("mainNetFlow", "—"),     # [修复] HOLIDAY模式也传递主力资金
                    "emotion": ex.get("emotion", 50),
                    "emotion_label": ex.get("emotionLabel", "中 性"),
                    "hot_sectors": ex.get("hotSectors", []),
                    "date_str": today.strftime("%Y-%m-%d"),
                }
                source = f"holiday · API ({last.get('date', '')})"
            else:
                raw = mock_data(today)
                raw["date_str"] = today.strftime("%Y-%m-%d")
                source = "holiday · mock兜底 · API"
        else:
            raw = fetch_real_data()
            if raw is None:
                raw = mock_data(today)
                source = "mock · akshare失败回退 · API"
            else:
                raw["date_str"] = today.strftime("%Y-%m-%d")
                source = "akshare · 实时 · API"

        # ---- 构建结果 ----
        grade = grade_for(raw["sh_chg_pct"], raw["up_count"], raw["down_count"])
        masters = build_masters(raw, grade)

        # 数据新鲜度描述
        if session_phase["phase"] == "INTRADAY":
            freshness = "盘中实时数据（约15分钟延迟）"
        elif session_phase["phase"] == "POST_MARKET":
            freshness = "今日收盘完整数据"
        elif session_phase["phase"] == "PRE_MARKET":
            freshness = f"昨日({session_phase['lastTradingDate']})收盘数据"
        else:
            freshness = f"截止{session_phase['lastTradingDate']}收盘数据"

        result = {
            "_v2_realtime": {
                "sessionPhase": session_phase["phase"],
                "isHoliday": session_phase["isHoliday"],
                "dataFreshness": freshness,
                "hint": session_phase["hint"],
            },
            "cacheInfo": {
                "cachedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "expiresAt": (datetime.now() + timedelta(seconds=_CACHE_TTL_SECONDS)).strftime("%Y-%m-%d %H:%M:%S"),
                "ttl": f"{_CACHE_TTL_SECONDS}s",
                "hit": False,
            },
            "masters": masters,
            "rawData": {
                "index": {"sh_close": raw.get("sh_close"), "sh_change_pct": raw["sh_chg_pct"]},
                "breadth": {"up_count": raw["up_count"], "down_count": raw["down_count"],
                           "total": raw["up_count"] + raw["down_count"],
                           "up_ratio": round(raw["up_count"] / max(raw["up_count"] + raw["down_count"], 1), 2)},
                # [修复] capital 中 north_flow 和 main_net_inflow 独立取值，不再混同
                "capital": {
                    "north_flow_yi": round(raw.get("north_flow_yi", 0), 1) if isinstance(raw.get("north_flow_yi"), (int, float)) else None,
                    "main_net_inflow_yi": round(raw.get("main_net_flow_yi", 0), 1) if isinstance(raw.get("main_net_flow_yi"), (int, float)) else None,
                    "margin_change": "N/A",
                },
                "sentiment": {"emotion_index": raw["emotion"], "emotion_label": raw.get("emotion_label", "")},
                "sectorPick": raw["sector_pick"],
                "source": source,
            },
        }

        # 写入缓存
        _set_cached_masters(result)

        return jsonify(result)

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({"status": "ok", "service": "caiunju-masters-v2", "ts": datetime.now().strftime("%Y-%m-%d %H:%M:%S")})

    return app


def run_server(host='127.0.0.1', port=5678, debug=False):
    """启动大师API服务"""
    app = create_app()
    if app is None:
        print("[ERR] 无法启动服务：Flask 未安装")
        return
    print(f"[INFO] 启动 Masters API → http://{host}:{port}/api/masters")
    app.run(host=host, port=port, debug=debug)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--serve":
        # 服务模式：python generate_daily_sign.py --serve [port]
        srv_port = int(sys.argv[2]) if len(sys.argv) > 2 else 5678
        run_server(port=srv_port)
    else:
        main()
