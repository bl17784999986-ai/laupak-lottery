#!/usr/bin/env python3
"""
体彩与福彩全彩种本地仓库数据同步脚本 (Python 3 零第三方依赖)
支持手动运行或由 GitHub Actions 定时触发，更新 data/lottery_data.json。
"""
import json
import os
import urllib.request
from datetime import datetime, timezone

HEADERS_TC = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://static.sporttery.cn/",
    "Origin": "https://static.sporttery.cn",
}
HEADERS_FC = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/",
}


def fetch_json(url: str, headers: dict, timeout: int = 15):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def next_issue(issue: str) -> str:
    try:
        return str(int(issue) + 1)
    except ValueError:
        return f"{issue}_next"


def fetch_sporttery(game_no: str, main_count: int, sub_count: int):
    url = (
        f"https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry"
        f"?gameNo={game_no}&provinceId=0&pageSize=30&isVerify=1&pageNo=1"
    )
    data = fetch_json(url, HEADERS_TC)
    items = (data.get("value") or {}).get("list") or []
    if not items:
        raise RuntimeError(f"Empty list for gameNo={game_no}")
    history = []
    for it in items:
        nums = [int(x) for x in str(it.get("lotteryDrawResult", "")).split()]
        history.append({
            "issue": str(it.get("lotteryDrawNum")),
            "date": str(it.get("lotteryDrawTime", ""))[:10],
            "main": nums[:main_count],
            "sub": nums[main_count:main_count + sub_count] if sub_count else [],
        })
    latest = items[0]
    pool = latest.get("poolBalanceAfterdraw")
    return {
        "nextIssue": next_issue(str(latest.get("lotteryDrawNum"))),
        "jackpot": f"{pool} 元" if pool else "固定设奖",
        "history": history,
    }


def fetch_cwl(name: str):
    url = (
        f"https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice"
        f"?name={name}&issueCount=30&pageNo=1&pageSize=30&systemType=PC"
    )
    data = fetch_json(url, HEADERS_FC)
    items = data.get("result") or []
    if not items:
        raise RuntimeError(f"Empty list for cwl name={name}")
    history = []
    for it in items:
        main = [int(x) for x in str(it.get("red", "")).split(",") if x.strip()]
        blue_raw = str(it.get("blue", "")).strip()
        sub = [int(x) for x in blue_raw.split(",") if x.strip()] if blue_raw else []
        history.append({
            "issue": str(it.get("code")),
            "date": str(it.get("date", ""))[:10],
            "main": main,
            "sub": sub,
        })
    latest = items[0]
    pool = latest.get("poolmoney")
    return {
        "nextIssue": next_issue(str(latest.get("code"))),
        "jackpot": f"{int(float(pool)):,} 元" if pool else "固定设奖",
        "history": history,
    }


def main():
    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "lottery_data.json")
    existing = {}
    if os.path.exists(out_path):
        try:
            with open(out_path, "r", encoding="utf-8") as f:
                existing = json.load(f).get("lotteries", {})
        except Exception:
            existing = {}

    jobs = {
        "ssq": lambda: fetch_cwl("ssq"),
        "fc3d": lambda: fetch_cwl("3d"),
        "qlc": lambda: fetch_cwl("qlc"),
        "dlt": lambda: fetch_sporttery("85", 5, 2),
        "qxc": lambda: fetch_sporttery("04", 6, 1),
        "pl3": lambda: fetch_sporttery("35", 3, 0),
        "pl5": lambda: fetch_sporttery("350133", 5, 0),
    }

    lotteries = dict(existing)
    errors = {}
    for key, fn in jobs.items():
        try:
            lotteries[key] = fn()
            print(f"[OK] {key} -> nextIssue={lotteries[key]['nextIssue']}")
        except Exception as e:
            errors[key] = str(e)
            print(f"[WARN] {key} failed: {e}")

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "github-actions-local-sync",
        "lotteries": lotteries,
        "errors": errors,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"Saved {out_path}")


if __name__ == "__main__":
    main()
