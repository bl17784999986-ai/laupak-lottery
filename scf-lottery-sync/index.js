'use strict';

/**
 * 腾讯云云函数 (SCF) — 体彩 & 福彩全彩种实时开奖同步服务
 * 运行环境：Node.js 18.15+ (内置原生 fetch，零第三方依赖)
 * 覆盖彩种：双色球(ssq)、福彩3D(fc3d)、七乐彩(qlc)、大乐透(dlt)、七星彩(qxc)、排列三(pl3)、排列五(pl5)
 */

const HEADERS_TC = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  'Referer': 'https://static.sporttery.cn/',
  'Origin': 'https://static.sporttery.cn'
};

const HEADERS_FC = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  'Referer': 'https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/',
  'Accept': 'application/json, text/javascript, */*; q=0.01'
};

function nextIssueStr(issue) {
  const n = parseInt(issue, 10);
  return Number.isNaN(n) ? `${issue}_next` : String(n + 1);
}

async function fetchSporttery(gameNo, key, mainCount, subCount) {
  const url = `https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=${gameNo}&provinceId=0&pageSize=30&isVerify=1&pageNo=1`;
  const resp = await fetch(url, { headers: HEADERS_TC });
  if (!resp.ok) throw new Error(`TC ${key} HTTP ${resp.status}`);
  const json = await resp.json();
  const list = (json && json.value && json.value.list) || [];
  if (!list.length) throw new Error(`TC ${key} empty list`);

  const history = list.map(item => {
    const nums = String(item.lotteryDrawResult || '').trim().split(/\s+/).map(Number);
    return {
      issue: String(item.lotteryDrawNum),
      date: String(item.lotteryDrawTime || '').slice(0, 10),
      main: nums.slice(0, mainCount),
      sub: subCount > 0 ? nums.slice(mainCount, mainCount + subCount) : []
    };
  });

  const latest = list[0];
  return {
    nextIssue: nextIssueStr(latest.lotteryDrawNum),
    jackpot: latest.poolBalanceAfterdraw ? `${latest.poolBalanceAfterdraw} 元` : '固定设奖',
    history
  };
}

async function fetchCwl(name, key) {
  const url = `https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=${name}&issueCount=30&issueStart=&issueEnd=&dayStart=&dayEnd=&pageNo=1&pageSize=30&week=&systemType=PC`;
  const resp = await fetch(url, { headers: HEADERS_FC });
  if (!resp.ok) throw new Error(`FC ${key} HTTP ${resp.status}`);
  const json = await resp.json();
  const list = (json && json.result) || [];
  if (!list.length) throw new Error(`FC ${key} empty list`);

  const history = list.map(item => {
    const main = String(item.red || '').split(',').filter(Boolean).map(Number);
    const sub = item.blue ? String(item.blue).split(',').filter(Boolean).map(Number) : [];
    return {
      issue: String(item.code),
      date: String(item.date || '').slice(0, 10),
      main,
      sub
    };
  });

  const latest = list[0];
  return {
    nextIssue: nextIssueStr(latest.code),
    jackpot: latest.poolmoney ? `${Number(latest.poolmoney).toLocaleString('en-US')} 元` : '固定设奖',
    history
  };
}

exports.main_handler = async (event, context) => {
  const corsHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event && event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const tasks = {
    ssq: () => fetchCwl('ssq', 'ssq'),
    fc3d: () => fetchCwl('3d', 'fc3d'),
    qlc: () => fetchCwl('qlc', 'qlc'),
    dlt: () => fetchSporttery('85', 'dlt', 5, 2),
    qxc: () => fetchSporttery('04', 'qxc', 6, 1),
    pl3: () => fetchSporttery('35', 'pl3', 3, 0),
    pl5: () => fetchSporttery('350133', 'pl5', 5, 0)
  };

  const lotteries = {};
  const errors = {};

  await Promise.all(
    Object.entries(tasks).map(async ([id, fn]) => {
      try {
        lotteries[id] = await fn();
      } catch (err) {
        errors[id] = err.message;
      }
    })
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      updatedAt: new Date().toISOString(),
      source: 'tencent-scf-official-sync',
      lotteries,
      errors
    })
  };
};
