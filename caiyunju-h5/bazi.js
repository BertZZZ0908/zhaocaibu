// utils/bazi.js —— 财运局 · 八字排盘引擎（纯前端实现）
// 版本：v2.0 · 精确节气查表 + 儒略日排盘
// 算法说明：采用公历→干支换算 + 1900-2100精确节气表 + 十神/财格判定

// ============ 基础常量 ============
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 天干五行
const GAN_WUXING = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火',
  '戊': '土', '己': '土', '庚': '金', '辛': '金',
  '壬': '水', '癸': '水'
};

// 地支五行
const ZHI_WUXING = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木',
  '辰': '土', '巳': '火', '午': '火', '未': '土',
  '申': '金', '酉': '金', '戌': '土', '亥': '水'
};

// 天干阴阳
const GAN_YINYANG = {
  '甲': '阳', '乙': '阴', '丙': '阳', '丁': '阴',
  '戊': '阳', '己': '阴', '庚': '阳', '辛': '阴',
  '壬': '阳', '癸': '阴'
};

// 地支藏干（本气+中气+余气）
const ZHI_CANGGAN = {
  '子': ['癸'],
  '丑': ['己', '癸', '辛'],
  '寅': ['甲', '丙', '戊'],
  '卯': ['乙'],
  '辰': ['戊', '乙', '癸'],
  '巳': ['丙', '庚', '戊'],
  '午': ['丁', '己'],
  '未': ['己', '丁', '乙'],
  '申': ['庚', '壬', '戊'],
  '酉': ['辛'],
  '戌': ['戊', '辛', '丁'],
  '亥': ['壬', '甲']
};

// 月份地支（立春起寅月）
const MONTH_ZHI = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

// 时辰地支
function getHourZhi(hour) {
  // 23:00-00:59 子, 1:00-2:59 丑, ... 21:00-22:59 亥
  if (hour >= 23 || hour < 1) return '子';
  return ZHI[Math.floor((hour + 1) / 2)];
}

// ============ 精确节气查表（1900-2100）============
// 12个月柱分界"节"：小寒、立春、惊蛰、清明、立夏、芒种、小暑、立秋、白露、寒露、立冬、大雪
// 对应月支：丑→寅→卯→辰→巳→午→未→申→酉→戌→亥→子
// 格式: JIEQI_TABLE[year] = [小寒日, 立春日, 惊蛰日, 清明日, 立夏日, 芒种日, 小暑日, 立秋日, 白露日, 寒露日, 立冬日, 大雪日]
// 月份固定: 小寒1月, 立春2月, 惊蛰3月, 清明4月, 立夏5月, 芒种6月, 小暑7月, 立秋8月, 白露9月, 寒露10月, 立冬11月, 大雪12月
// 数据来源: lunarcalendar库 + ephem天文库交叉验证
const JIEQI_TABLE = {
  1900:[6,4,6,5,6,6,7,8,8,9,8,7],  1901:[6,4,6,5,6,6,8,8,8,9,8,8],  1902:[6,5,6,6,6,7,8,8,8,9,8,8],  1903:[6,5,7,6,7,7,8,9,9,9,8,8],  1904:[7,5,6,5,6,6,7,8,8,9,8,7],  1905:[6,4,6,5,6,6,8,8,8,9,8,8],  1906:[6,5,6,6,6,6,8,8,8,9,8,8],  1907:[6,5,7,6,7,7,8,9,9,9,8,8],  1908:[7,5,6,5,6,6,7,8,8,9,8,7],  1909:[6,4,6,5,6,6,8,8,8,9,8,8],
  1910:[6,5,6,6,6,6,8,8,8,9,8,8],  1911:[6,5,7,6,7,7,8,9,9,9,8,8],  1912:[7,5,6,5,6,6,7,8,8,9,8,7],  1913:[6,4,6,5,6,6,8,8,8,9,8,8],  1914:[6,4,6,5,6,6,8,8,8,9,8,8],  1915:[6,5,6,6,6,7,8,8,9,9,8,8],  1916:[6,5,6,5,6,6,7,8,8,8,8,7],  1917:[6,4,6,5,6,6,8,8,8,9,8,8],  1918:[6,4,6,5,6,6,8,8,8,9,8,8],  1919:[6,5,6,6,6,7,8,8,9,9,8,8],
  1920:[6,5,6,5,6,6,7,8,8,8,8,7],  1921:[6,4,6,5,6,6,8,8,8,9,8,7],  1922:[6,4,6,5,6,6,8,8,8,9,8,8],  1923:[6,5,6,6,6,7,8,8,9,9,8,8],  1924:[6,5,6,5,6,6,7,8,8,8,8,7],  1925:[6,4,6,5,6,6,8,8,8,9,8,7],  1926:[6,4,6,5,6,6,8,8,8,9,8,8],  1927:[6,5,6,6,6,7,8,8,9,9,8,8],  1928:[6,5,6,5,6,6,7,8,8,8,7,7],  1929:[6,4,6,5,6,6,7,8,8,9,8,7],
  1930:[6,4,6,5,6,6,8,8,8,9,8,8],  1931:[6,5,6,6,6,7,8,8,8,9,8,8],  1932:[6,5,6,5,6,6,7,8,8,8,7,7],  1933:[6,4,6,5,6,6,7,8,8,9,8,7],  1934:[6,4,6,5,6,6,8,8,8,9,8,8],  1935:[6,5,6,6,6,6,8,8,8,9,8,8],  1936:[6,5,6,5,6,6,7,8,8,8,7,7],  1937:[6,4,6,5,6,6,7,8,8,9,8,7],  1938:[6,4,6,5,6,6,8,8,8,9,8,8],  1939:[6,5,6,6,6,6,8,8,8,9,8,8],
  1940:[6,5,6,5,6,6,7,8,8,8,7,7],  1941:[6,4,6,5,6,6,7,8,8,9,8,7],  1942:[6,4,6,5,6,6,8,8,8,9,8,8],  1943:[6,5,6,6,6,6,8,8,8,9,8,8],  1944:[6,5,6,5,6,6,7,8,8,8,7,7],  1945:[6,4,6,5,6,6,7,8,8,8,8,7],  1946:[6,4,6,5,6,6,8,8,8,9,8,8],  1947:[6,4,6,5,6,6,8,8,8,9,8,8],  1948:[6,5,5,5,5,6,7,8,8,8,7,7],  1949:[5,4,6,5,6,6,7,8,8,8,8,7],
  1950:[6,4,6,5,6,6,8,8,8,9,8,8],  1951:[6,4,6,5,6,6,8,8,8,9,8,8],  1952:[6,5,5,5,5,6,7,7,8,8,7,7],  1953:[5,4,6,5,6,6,7,8,8,8,8,7],  1954:[6,4,6,5,6,6,8,8,8,9,8,7],  1955:[6,4,6,5,6,6,8,8,8,9,8,8],  1956:[6,5,5,5,5,6,7,7,8,8,7,7],  1957:[5,4,6,5,6,6,7,8,8,8,8,7],  1958:[6,4,6,5,6,6,7,8,8,9,8,7],  1959:[6,4,6,5,6,6,8,8,8,9,8,8],
  1960:[6,5,5,5,5,6,7,7,7,8,7,7],  1961:[5,4,6,5,6,6,7,8,8,8,7,7],  1962:[6,4,6,5,6,6,7,8,8,9,8,7],  1963:[6,4,6,5,6,6,8,8,8,9,8,8],  1964:[6,5,5,5,5,6,7,7,7,8,7,7],  1965:[5,4,6,5,6,6,7,8,8,8,7,7],  1966:[6,4,6,5,6,6,7,8,8,9,8,7],  1967:[6,4,6,5,6,6,8,8,8,9,8,8],  1968:[6,5,5,5,5,5,7,7,7,8,7,7],  1969:[5,4,6,5,6,6,7,8,8,8,7,7],
  1970:[6,4,6,5,6,6,7,8,8,9,8,7],  1971:[6,4,6,5,6,6,8,8,8,9,8,8],  1972:[6,5,5,5,5,5,7,7,7,8,7,7],  1973:[5,4,6,5,5,6,7,8,8,8,7,7],  1974:[6,4,6,5,6,6,7,8,8,9,8,7],  1975:[6,4,6,5,6,6,8,8,8,9,8,8],  1976:[6,5,5,4,5,5,7,7,7,8,7,7],  1977:[5,4,6,5,5,6,7,7,8,8,7,7],  1978:[6,4,6,5,6,6,7,8,8,8,8,7],  1979:[6,4,6,5,6,6,8,8,8,9,8,8],
  1980:[6,5,5,4,5,5,7,7,7,8,7,7],  1981:[5,4,6,5,5,6,7,7,8,8,7,7],  1982:[6,4,6,5,6,6,7,8,8,8,8,7],  1983:[6,4,6,5,6,6,8,8,8,9,8,8],  1984:[6,4,5,4,5,5,7,7,7,8,7,7],  1985:[5,4,5,5,5,6,7,7,8,8,7,7],  1986:[5,4,6,5,6,6,7,8,8,8,8,7],  1987:[6,4,6,5,6,6,8,8,8,9,8,7],  1988:[6,4,5,4,5,5,7,7,7,8,7,7],  1989:[5,4,5,5,5,6,7,7,8,8,7,7],
  1990:[5,4,6,5,6,6,7,8,8,8,7,7],  1991:[6,4,6,5,6,6,7,8,8,9,8,7],  1992:[6,4,5,4,5,5,7,7,7,8,7,7],  1993:[5,4,5,5,5,6,7,7,7,8,7,7],  1994:[5,4,6,5,6,6,7,8,8,8,7,7],  1995:[6,4,6,5,6,6,7,8,8,9,8,7],  1996:[6,4,5,4,5,5,7,7,7,8,7,7],  1997:[5,4,5,5,5,5,7,7,7,8,7,7],  1998:[5,4,6,5,6,6,7,8,8,8,7,7],  1999:[6,4,6,5,6,6,7,8,8,9,8,7],
  2000:[6,4,5,4,5,5,7,7,7,8,7,7],  2001:[5,4,5,5,5,5,7,7,7,8,7,7],  2002:[5,4,6,5,6,6,7,8,8,8,7,7],  2003:[6,4,6,5,6,6,7,8,8,9,8,7],  2004:[6,4,5,4,5,5,7,7,7,8,7,7],  2005:[5,4,5,5,5,5,7,7,7,8,7,7],  2006:[5,4,6,5,5,6,7,7,8,8,7,7],  2007:[6,4,6,5,6,6,7,8,8,9,8,7],  2008:[6,4,5,4,5,5,7,7,7,8,7,7],  2009:[5,4,5,4,5,5,7,7,7,8,7,7],
  2010:[5,4,6,5,5,6,7,7,8,8,7,7],  2011:[6,4,6,5,6,6,7,8,8,8,8,7],  2012:[6,4,5,4,5,5,7,7,7,8,7,7],  2013:[5,4,5,4,5,5,7,7,7,8,7,7],  2014:[5,4,6,5,5,6,7,7,8,8,7,7],  2015:[6,4,6,5,6,6,7,8,8,8,8,7],  2016:[6,4,5,4,5,5,7,7,7,8,7,7],  2017:[5,3,5,4,5,5,7,7,7,8,7,7],  2018:[5,4,5,5,5,6,7,7,8,8,7,7],  2019:[5,4,6,5,6,6,7,8,8,8,8,7],
  2020:[6,4,5,4,5,5,6,7,7,8,7,7],  2021:[5,3,5,4,5,5,7,7,7,8,7,7],  2022:[5,4,5,5,5,6,7,7,7,8,7,7],  2023:[5,4,6,5,6,6,7,8,8,8,8,7],  2024:[6,4,5,4,5,5,6,7,7,8,7,6],  2025:[5,3,5,4,5,5,7,7,7,8,7,7],  2026:[5,4,5,5,5,5,7,7,7,8,7,7],  2027:[5,4,6,5,6,6,7,8,8,8,7,7],  2028:[6,4,5,4,5,5,6,7,7,8,7,6],  2029:[5,3,5,4,5,5,7,7,7,8,7,7],
  2030:[5,4,5,5,5,5,7,7,7,8,7,7],  2031:[5,4,6,5,6,6,7,8,8,8,7,7],  2032:[6,4,5,4,5,5,6,7,7,8,7,6],  2033:[5,3,5,4,5,5,7,7,7,8,7,7],  2034:[5,4,5,5,5,5,7,7,7,8,7,7],  2035:[5,4,6,5,5,6,7,7,8,8,7,7],  2036:[6,4,5,4,5,5,6,7,7,8,7,6],  2037:[5,3,5,4,5,5,7,7,7,8,7,7],  2038:[5,4,5,5,5,5,7,7,7,8,7,7],  2039:[5,4,6,5,5,6,7,7,8,8,7,7],
  2040:[6,4,5,4,5,5,6,7,7,8,7,6],  2041:[5,3,5,4,5,5,7,7,7,8,7,7],  2042:[5,4,5,4,5,5,7,7,7,8,7,7],  2043:[5,4,6,5,5,6,7,7,8,8,7,7],  2044:[6,4,5,4,5,5,6,7,7,7,7,6],  2045:[5,3,5,4,5,5,7,7,7,8,7,7],  2046:[5,4,5,4,5,5,7,7,7,8,7,7],  2047:[5,4,6,5,5,6,7,7,8,8,7,7],  2048:[6,4,5,4,5,5,6,7,7,7,7,6],  2049:[5,3,5,4,5,5,6,7,7,8,7,7],
  2050:[5,3,5,4,5,5,7,7,7,8,7,7],  2051:[5,4,5,5,5,6,7,7,7,8,7,7],  2052:[5,4,5,4,5,5,6,7,7,7,7,6],  2053:[5,3,5,4,5,5,6,7,7,8,7,7],  2054:[5,3,5,4,5,5,7,7,7,8,7,7],  2055:[5,4,5,5,5,5,7,7,7,8,7,7],  2056:[5,4,5,4,5,5,6,7,7,7,7,6],  2057:[5,3,5,4,5,5,6,7,7,8,7,6],  2058:[5,3,5,4,5,5,7,7,7,8,7,7],  2059:[5,4,5,5,5,5,7,7,7,8,7,7],
  2060:[5,4,5,4,5,5,6,7,7,7,6,6],  2061:[5,3,5,4,5,5,6,7,7,8,7,6],  2062:[5,3,5,4,5,5,7,7,7,8,7,7],  2063:[5,4,5,5,5,5,7,7,7,8,7,7],  2064:[5,4,5,4,5,5,6,7,7,7,6,6],  2065:[5,3,5,4,5,5,6,7,7,8,7,6],  2066:[5,3,5,4,5,5,7,7,7,8,7,7],  2067:[5,4,5,5,5,5,7,7,7,8,7,7],  2068:[5,4,5,4,4,5,6,6,7,7,6,6],  2069:[5,3,5,4,5,5,6,7,7,8,7,6],
  2070:[5,3,5,4,5,5,7,7,7,8,7,7],  2071:[5,4,5,5,5,5,7,7,7,8,7,7],  2072:[5,4,5,4,4,5,6,6,7,7,6,6],  2073:[5,3,5,4,5,5,6,7,7,7,7,6],  2074:[5,3,5,4,5,5,7,7,7,8,7,7],  2075:[5,4,5,4,5,5,7,7,7,8,7,7],  2076:[5,4,5,4,4,5,6,6,7,7,6,6],  2077:[5,3,5,4,5,5,6,7,7,7,7,6],  2078:[5,3,5,4,5,5,6,7,7,8,7,7],  2079:[5,4,5,4,5,5,7,7,7,8,7,7],
  2080:[5,4,5,4,4,5,6,6,7,7,6,6],  2081:[5,3,5,4,5,5,6,7,7,7,7,6],  2082:[5,3,5,4,5,5,6,7,7,8,7,7],  2083:[5,3,5,4,5,5,7,7,7,8,7,7],  2084:[5,4,4,4,4,5,6,6,6,7,6,6],  2085:[4,3,5,4,5,5,6,7,7,7,7,6],  2086:[5,3,5,4,5,5,6,7,7,8,7,7],  2087:[5,3,5,4,5,5,7,7,7,8,7,7],  2088:[5,4,4,4,4,4,6,6,6,7,6,6],  2089:[4,3,5,4,5,5,6,7,7,7,7,6],
  2090:[5,3,5,4,5,5,6,7,7,8,7,6],  2091:[5,3,5,4,5,5,7,7,7,8,7,7],  2092:[5,4,4,4,4,4,6,6,6,7,6,6],  2093:[4,3,5,4,5,5,6,7,7,7,6,6],  2094:[5,3,5,4,5,5,6,7,7,8,7,6],  2095:[5,3,5,4,5,5,7,7,7,8,7,7],  2096:[5,4,4,4,4,4,6,6,6,7,6,6],  2097:[4,3,5,4,5,5,6,6,7,7,6,6],  2098:[5,3,5,4,5,5,6,7,7,8,7,6],  2099:[5,3,5,4,5,5,7,7,7,8,7,7],
  2100:[5,4,5,5,5,5,7,7,7,8,7,7],
};

// 节气月份映射（与JIEQI_TABLE数组下标对应）
const JIEQI_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // 小寒1月, 立春2月, ..., 大雪12月
// 节气名（调试用）
const JIEQI_NAMES = ['小寒', '立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪'];
// 节气→月支映射: 小寒→丑(11), 立春→寅(0), 惊蛰→卯(1), ..., 大雪→子(10)
const JIEQI_MONTHZHI = [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// 获取某年某节的日期（查表法）
function getJieQiDay(year, jieIdx) {
  const t = JIEQI_TABLE[year];
  if (!t) return null;
  return { month: JIEQI_MONTHS[jieIdx], day: t[jieIdx], name: JIEQI_NAMES[jieIdx] };
}

// 获取立春日期（年柱分界）
function getLichunDate(year) {
  return getJieQiDay(year, 1); // idx=1 → 立春
}

// 根据公历日期判断月支index (0=寅月, 1=卯月, ...11=丑月)
function getMonthIndex(year, month, day) {
  const t = JIEQI_TABLE[year];
  if (!t) return (month + 10) % 12; // 超出查表范围，粗算

  // 从后往前找：找到最后一个 节气日期 <= 当前日期 的节气
  for (let i = 11; i >= 0; i--) {
    const jqMonth = JIEQI_MONTHS[i];
    const jqDay = t[i];
    if (month > jqMonth || (month === jqMonth && day >= jqDay)) {
      return JIEQI_MONTHZHI[i];
    }
  }
  // 1月小寒之前 → 属于上一年的子月（上一年大雪之后）
  return 10; // 子月
}

// 儒略日计算（纯数学，无时区问题）
function gregorianToJD(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

// ============ 四柱计算 ============

// 年柱：以立春为界（精确查表）
function getYearGZ(year, month, day) {
  let y = year;
  const lichun = getLichunDate(year);
  if (lichun && (month < lichun.month || (month === lichun.month && day < lichun.day))) {
    y = year - 1;
  }
  // 甲子年为 1984
  const offset = ((y - 1984) % 60 + 60) % 60;
  return GAN[offset % 10] + ZHI[offset % 12];
}

// 月柱：五虎遁口诀 —— 甲己之年丙作首，乙庚之岁戊为头，丙辛必定从庚起，丁壬壬位顺行流，戊癸之年甲寅头
function getMonthGZ(yearGan, year, month, day) {
  // 用精确节气判定月支
  let monthIndex = getMonthIndex(year, month, day);
  // monthIndex 0=寅, 1=卯, ... 11=丑
  const zhi = MONTH_ZHI[monthIndex];

  // 月干推算：以年干起月
  const wuhu = {
    '甲': '丙', '己': '丙',
    '乙': '戊', '庚': '戊',
    '丙': '庚', '辛': '庚',
    '丁': '壬', '壬': '壬',
    '戊': '甲', '癸': '甲'
  };
  const firstGan = wuhu[yearGan];
  const firstGanIdx = GAN.indexOf(firstGan);
  const gan = GAN[(firstGanIdx + monthIndex) % 10];
  return gan + zhi;
}

// 日柱：采用儒略日换算（纯数学计算，无时区偏差）
function getDayGZ(year, month, day) {
  // 基准日 1900-01-01 的儒略日
  const baseJD = gregorianToJD(1900, 1, 1);
  const targetJD = gregorianToJD(year, month, day);
  const days = targetJD - baseJD;
  // 1900-01-01 是甲戌日，干支序号 = 10
  const offset = (days + 10) % 60;
  return GAN[offset % 10] + ZHI[offset % 12];
}

// 时柱：五鼠遁口诀 —— 甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途
function getHourGZ(dayGan, hour) {
  const hourZhi = getHourZhi(hour);
  const hourZhiIdx = ZHI.indexOf(hourZhi);

  const wushu = {
    '甲': '甲', '己': '甲',
    '乙': '丙', '庚': '丙',
    '丙': '戊', '辛': '戊',
    '丁': '庚', '壬': '庚',
    '戊': '壬', '癸': '壬'
  };
  const firstGan = wushu[dayGan];
  const firstGanIdx = GAN.indexOf(firstGan);
  const gan = GAN[(firstGanIdx + hourZhiIdx) % 10];
  return gan + hourZhi;
}

// ============ 十神判定 ============
// 以日干为主，判断其他天干/地支的"十神"关系
// 十神：比肩、劫财、食神、伤官、偏财、正财、七杀、正官、偏印、正印

function getShiShen(dayGan, targetGan) {
  const relations = {
    // key = 日干_目标干
    // 同五行同阴阳 = 比肩；同五行异阴阳 = 劫财
    // 我生之同阴阳 = 食神；我生之异阴阳 = 伤官
    // 我克之同阴阳 = 偏财；我克之异阴阳 = 正财
    // 克我之同阴阳 = 七杀；克我之异阴阳 = 正官
    // 生我之同阴阳 = 偏印；生我之异阴阳 = 正印
  };

  const dayWX = GAN_WUXING[dayGan];
  const targetWX = GAN_WUXING[targetGan];
  const dayYY = GAN_YINYANG[dayGan];
  const targetYY = GAN_YINYANG[targetGan];
  const sameYY = dayYY === targetYY;

  // 五行生克关系表：key=日主五行 value={targetWX: relationType}
  // relationType: same(同我) shengMe(生我) woSheng(我生) keMe(克我) woKe(我克)
  const sheng = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' }; // 我生之
  const ke = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };    // 我克之

  let type;
  if (targetWX === dayWX) type = 'same';
  else if (sheng[targetWX] === dayWX) type = 'shengMe';  // target 生我
  else if (sheng[dayWX] === targetWX) type = 'woSheng';  // 我生 target
  else if (ke[targetWX] === dayWX) type = 'keMe';        // target 克我
  else if (ke[dayWX] === targetWX) type = 'woKe';        // 我克 target

  const mapping = {
    'same_true': '比肩',
    'same_false': '劫财',
    'woSheng_true': '食神',
    'woSheng_false': '伤官',
    'woKe_true': '偏财',
    'woKe_false': '正财',
    'keMe_true': '七杀',
    'keMe_false': '正官',
    'shengMe_true': '偏印',
    'shengMe_false': '正印'
  };
  return mapping[`${type}_${sameYY}`];
}

// ============ 五行强弱统计 ============
function analyzeWuxing(bazi) {
  // bazi: { year:'甲子', month:'丙寅', day:'丁卯', hour:'庚子' }
  const count = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };

  ['year', 'month', 'day', 'hour'].forEach(k => {
    const [g, z] = [bazi[k][0], bazi[k][1]];
    count[GAN_WUXING[g]] += 1;
    count[ZHI_WUXING[z]] += 0.8;
    // 地支藏干
    const cangGan = ZHI_CANGGAN[z];
    if (cangGan.length > 1) {
      cangGan.slice(1).forEach((cg, i) => {
        count[GAN_WUXING[cg]] += 0.3 / (i + 1);
      });
    }
  });

  return count;
}

// ============ 日主旺衰判断 ============
function analyzeDayStrength(bazi) {
  const dayGan = bazi.day[0];
  const dayWX = GAN_WUXING[dayGan];
  const wuxingCount = analyzeWuxing(bazi);

  // 得令：月支五行是否生/同日主
  const monthZhi = bazi.month[1];
  const monthWX = ZHI_WUXING[monthZhi];
  const sheng = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  const deLing = (monthWX === dayWX || sheng[monthWX] === dayWX);

  // 比较"帮我"五行 vs "克我、泄我、耗我"五行
  const helpWX = dayWX;
  const printWX = Object.keys(sheng).find(k => sheng[k] === dayWX); // 生我的
  const helpTotal = wuxingCount[helpWX] + (printWX ? wuxingCount[printWX] : 0);
  const total = Object.values(wuxingCount).reduce((a, b) => a + b, 0);
  const helpRatio = helpTotal / total;

  let strength;
  if (helpRatio > 0.5) strength = '身旺';
  else if (helpRatio > 0.35) strength = '身中';
  else strength = '身弱';

  return {
    strength,
    deLing,
    helpRatio: Math.round(helpRatio * 100),
    wuxingCount
  };
}

// ============ 财格判定 ============
// 12 种财富命格
function analyzeWealthPattern(bazi) {
  const dayGan = bazi.day[0];
  const { strength, wuxingCount } = analyzeDayStrength(bazi);

  // 找出八字中的"财星"（我克之）
  const dayWX = GAN_WUXING[dayGan];
  const keWX = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' }[dayWX];
  const caiTotal = wuxingCount[keWX];

  // 找其他重要十神
  const allGans = [bazi.year[0], bazi.month[0], bazi.hour[0]];
  const shishens = allGans.map(g => getShiShen(dayGan, g));

  // 地支藏干中的财星
  const zhiList = [bazi.year[1], bazi.month[1], bazi.day[1], bazi.hour[1]];
  const caiInZhi = zhiList.filter(z => GAN_WUXING[ZHI_CANGGAN[z][0]] === keWX).length;

  // 食伤（我生之）
  const woShengWX = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' }[dayWX];
  const shiShangTotal = wuxingCount[woShengWX];

  // 判断命格
  let pattern, patternCode, description, strategy;

  if (strength === '身弱' && caiTotal > wuxingCount[dayWX] * 2) {
    pattern = '财多身弱';
    patternCode = 'CAI_DUO_SHEN_RUO';
    description = '财旺身弱 · 看得见吃不着';
    strategy = '先养身 · 再取财 · 忌合伙 · 忌重仓';
  } else if (strength === '身弱' && caiTotal > 2) {
    pattern = '从财格';
    patternCode = 'CONG_CAI';
    description = '身弱全局财 · 反成大富';
    strategy = '顺势而为 · 切勿逆天';
  } else if (shishens.includes('食神') && caiTotal > 0.5) {
    pattern = '食神生财';
    patternCode = 'SHI_SHEN_SHENG_CAI';
    description = '才华换钱 · 技能即财路';
    strategy = '专注手艺 · 打磨作品 · 不宜投机';
  } else if (shishens.includes('伤官') && caiTotal > 0.5) {
    pattern = '伤官生财';
    patternCode = 'SHANG_GUAN_SHENG_CAI';
    description = '锋芒毕露 · 单干最赚';
    strategy = '创业 / IP / 单干 · 不宜打工';
  } else if (shishens.includes('正财') && strength !== '身弱') {
    pattern = '正财格';
    patternCode = 'ZHENG_CAI';
    description = '身旺财旺 · 收入稳定';
    strategy = '定投复利 · 忌高杠杆';
  } else if (shishens.includes('偏财') && strength !== '身弱') {
    pattern = '偏财格';
    patternCode = 'PIAN_CAI';
    description = '财星透干 · 大开大合';
    strategy = '敢重仓 · 必止损 · 抓趋势';
  } else if (shishens.includes('比肩') || shishens.includes('劫财')) {
    const jiePangs = shishens.filter(s => s === '比肩' || s === '劫财').length;
    if (jiePangs >= 2) {
      pattern = '劫财夺财';
      patternCode = 'JIE_CAI';
      description = '比劫当权 · 易破财';
      strategy = '独立 · 稳健 · 忌合伙';
    } else {
      pattern = '财官双美';
      patternCode = 'CAI_GUAN_SHUANG_MEI';
      description = '财官相生 · 走政商路线';
      strategy = '管理层 · 高客单 · 不宜纯技术';
    }
  } else if (caiInZhi >= 2 && zhiList.some(z => ['辰', '戌', '丑', '未'].includes(z))) {
    pattern = '财库充盈';
    patternCode = 'CAI_KU';
    description = '墓库带财 · 后运强';
    strategy = '早年积累 · 中年发力';
  } else if (caiTotal < 0.5) {
    pattern = '财星入墓';
    patternCode = 'CAI_RU_MU';
    description = '财星隐 · 需逢冲开库';
    strategy = '换环境 · 换行业 · 激活财运';
  } else {
    pattern = '食神生财';
    patternCode = 'SHI_SHEN_SHENG_CAI';
    description = '平和命格 · 技能换钱';
    strategy = '专注本业 · 稳步积累';
  }

  return {
    pattern,
    patternCode,
    description,
    strategy,
    caiScore: Math.min(Math.round(caiTotal * 10 + caiInZhi * 5), 100),
    dayStrength: strength
  };
}

// ============ 主入口：排八字 ============
function paipan({ year, month, day, hour, gender = 'M' }) {
  const yearGZ = getYearGZ(year, month, day);
  const monthGZ = getMonthGZ(yearGZ[0], year, month, day);
  const dayGZ = getDayGZ(year, month, day);
  const hourGZ = getHourGZ(dayGZ[0], hour);

  const bazi = {
    year: yearGZ,
    month: monthGZ,
    day: dayGZ,
    hour: hourGZ
  };

  const dayGan = dayGZ[0];
  const dayStrength = analyzeDayStrength(bazi);
  const wealthPattern = analyzeWealthPattern(bazi);

  // 五行分布百分比
  const total = Object.values(dayStrength.wuxingCount).reduce((a, b) => a + b, 0);
  const wuxingPct = {};
  Object.keys(dayStrength.wuxingCount).forEach(k => {
    wuxingPct[k] = Math.round(dayStrength.wuxingCount[k] / total * 100);
  });

  // 天干十神映射
  const ganShishen = {
    year: getShiShen(dayGan, bazi.year[0]),
    month: getShiShen(dayGan, bazi.month[0]),
    day: '日主',
    hour: getShiShen(dayGan, bazi.hour[0])
  };

  return {
    input: { year, month, day, hour, gender },
    bazi,
    dayGan,
    dayWuxing: GAN_WUXING[dayGan],
    dayYinYang: GAN_YINYANG[dayGan],
    dayStrength: dayStrength.strength,
    deLing: dayStrength.deLing,
    wuxingCount: dayStrength.wuxingCount,
    wuxingPct,
    ganShishen,
    wealthPattern
  };
}

// ============ 今日财运速解（¥0.99 产品核心）============
function getTodayLuck(paipanResult) {
  const today = new Date();
  const todayDayGZ = getDayGZ(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const todayDayGan = todayDayGZ[0];
  const todayDayZhi = todayDayGZ[1];

  const dayGan = paipanResult.dayGan;
  const dayWX = GAN_WUXING[dayGan];
  const todayWX = GAN_WUXING[todayDayGan];
  const shishen = getShiShen(dayGan, todayDayGan);

  // 基础分 50，根据十神加减
  const scoreMap = {
    '正财': 18, '偏财': 22, '食神': 15, '伤官': 8,
    '正官': 10, '七杀': 5, '正印': 12, '偏印': 6,
    '比肩': 0, '劫财': -10
  };
  let score = 50 + (scoreMap[shishen] || 0);

  // 日主旺衰对应加减
  if (paipanResult.dayStrength === '身旺') {
    if (['正财', '偏财', '食神', '伤官'].includes(shishen)) score += 10;
    if (['比肩', '劫财', '正印', '偏印'].includes(shishen)) score -= 5;
  } else if (paipanResult.dayStrength === '身弱') {
    if (['比肩', '劫财', '正印', '偏印'].includes(shishen)) score += 10;
    if (['正官', '七杀', '正财', '偏财'].includes(shishen)) score -= 8;
  }

  // 冲克地支
  const chongMap = {
    '子': '午', '午': '子', '丑': '未', '未': '丑',
    '寅': '申', '申': '寅', '卯': '酉', '酉': '卯',
    '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳'
  };
  const dayZhi = paipanResult.bazi.day[1];
  const chongFlag = chongMap[dayZhi] === todayDayZhi;
  if (chongFlag) score -= 12;

  score = Math.max(20, Math.min(95, score));

  // 宜忌
  let yiList, jiList;
  if (score >= 75) {
    yiList = ['大胆出手', '洽谈合作', '投资决策', '主动出击'];
    jiList = ['过度消耗', '与人口角'];
  } else if (score >= 55) {
    yiList = ['按计划执行', '学习充电', '小额尝试'];
    jiList = ['重大决策', '加仓追涨'];
  } else if (score >= 40) {
    yiList = ['守成观望', '整理资料', '反思复盘'];
    jiList = ['冲动消费', '跟风投资', '借贷'];
  } else {
    yiList = ['静观其变', '闭门整理'];
    jiList = ['任何大动作', '签约下单', '重要谈判'];
  }

  let oneLine;
  if (chongFlag) {
    oneLine = `今日日支冲本命 · ${shishen}临身。凡事退半步，祸从口出。`;
  } else if (score >= 75) {
    oneLine = `${shishen}当令，${todayDayGan}${todayDayZhi}日配你命格极佳。该出手时就出手。`;
  } else if (score >= 55) {
    oneLine = `${shishen}临日，小有作为之象。按部就班，稳中求进。`;
  } else {
    oneLine = `${shishen}耗身，今日宜守不宜攻。小心踩雷。`;
  }

  return {
    date: today.toISOString().slice(0, 10),
    todayGZ: todayDayGZ,
    todayShishen: shishen,
    score,
    level: score >= 75 ? '大吉' : score >= 55 ? '中吉' : score >= 40 ? '平' : '小凶',
    yiList,
    jiList,
    oneLine,
    chongFlag
  };
}

// ============ 财格速查（¥9.9 产品核心）============
function getQuickCheck(paipanResult) {
  const wp = paipanResult.wealthPattern;

  // 每种命格 5 条短建议（每条 ≤ 14 字，突出重点）
  const advMap = {
    'ZHENG_CAI': [
      '职业 · 大厂 / 公务员',
      '投资 · 定投指数 忌短炒',
      '配置 · 六成固收 三成股',
      '人脉 · 链接上级与前辈',
      '忌 · 赌性重仓 · 借贷加杠杆'
    ],
    'PIAN_CAI': [
      '职业 · 销售 / 创业 / IP',
      '投资 · 敢重仓 必设止损',
      '配置 · 四成股 两成进取',
      '人脉 · 广结四海 · 多应酬',
      '忌 · 拖延 · 小富即安'
    ],
    'SHI_SHEN_SHENG_CAI': [
      '职业 · 技术 / 创作 / 博主',
      '投资 · 投自己 > 投股票',
      '配置 · 技能课程 · 设备',
      '人脉 · 同行切磋 · 建 IP',
      '忌 · 贪快 · 盲目跟风'
    ],
    'SHANG_GUAN_SHENG_CAI': [
      '职业 · 设计 / 自媒体 / 品牌',
      '投资 · 敢反共识 · 押非主流',
      '配置 · 工作室 · 设备',
      '人脉 · 少而精 · 找同频',
      '忌 · 按部就班 · 给人打工'
    ],
    'CAI_GUAN_SHUANG_MEI': [
      '职业 · 管理层 / 政商',
      '投资 · 稳健偏进取',
      '配置 · 全资产类别',
      '人脉 · 向上链接',
      '忌 · 单打独斗 · 不修人情'
    ],
    'CAI_KU': [
      '职业 · 教育 / 金融 / 传统',
      '投资 · 长期持有 · 资产型',
      '配置 · 不动产 + 基金 + 保险',
      '人脉 · 稳定 · 长期 · 深度',
      '忌 · 求快 · 频繁换跑道'
    ],
    'CAI_DUO_SHEN_RUO': [
      '职业 · 辅助型 · 莫做主导',
      '投资 · 极度保守 · 先求不败',
      '配置 · 八成固收 · 两成现金',
      '人脉 · 多结贵人与导师',
      '忌 · 一夜暴富幻想 · 合伙借贷'
    ],
    'JIE_CAI': [
      '职业 · 独立岗位 · 单人业务',
      '投资 · 小仓位 · 硬止损',
      '配置 · 现金为主 · 少碰股',
      '人脉 · 君子之交淡如水',
      '忌 · 合伙 · 集资 · 代操盘'
    ],
    'CAI_RU_MU': [
      '职业 · 敢换行业 / 换城市',
      '投资 · 跳出舒适区',
      '配置 · 保持灵活 · 多现金',
      '人脉 · 跨界结交',
      '忌 · 原地踏步 · 抱残守缺'
    ],
    'CONG_CAI': [
      '职业 · 顺势 · 大趋势小人物',
      '投资 · 跟随大势 · 不逆天',
      '配置 · 指数 ETF + 黄金',
      '人脉 · 追随强者 · 借势',
      '忌 · 自作主张 · 逆势加仓'
    ]
  };
  const advices = advMap[wp.patternCode] || advMap['SHI_SHEN_SHENG_CAI'];

  return {
    pattern: wp.pattern,
    patternCode: wp.patternCode,
    description: wp.description,
    strategy: wp.strategy,
    caiScore: wp.caiScore,
    dayStrength: wp.dayStrength,
    advices
  };
}

// ============ 深度报告（¥29.9 产品核心）============
function getDeepReport(paipanResult) {
  const quickCheck = getQuickCheck(paipanResult);
  const wp = paipanResult.wealthPattern;

  // 财运时间轴（每 10 年一段大运 · 简化）
  const birthYear = paipanResult.input.year;
  const currentYear = new Date().getFullYear();
  const timeline = [];
  for (let i = 0; i < 6; i++) {
    const startAge = i * 10 + 8;
    const startYear = birthYear + startAge;
    let label, score;
    if (wp.patternCode === 'ZHENG_CAI') {
      score = [55, 65, 80, 85, 78, 70][i];
    } else if (wp.patternCode === 'PIAN_CAI') {
      score = [60, 75, 90, 82, 70, 68][i];
    } else if (wp.patternCode === 'CAI_KU') {
      score = [45, 55, 65, 80, 92, 85][i];
    } else if (wp.patternCode === 'JIE_CAI') {
      score = [55, 50, 60, 70, 75, 72][i];
    } else {
      score = [55, 68, 78, 80, 75, 70][i];
    }
    timeline.push({
      ageRange: `${startAge}-${startAge + 9}岁`,
      yearRange: `${startYear}-${startYear + 9}`,
      score,
      label: score >= 80 ? '黄金期' : score >= 65 ? '上升期' : score >= 50 ? '平稳期' : '蛰伏期'
    });
  }

  // 破财点（常见三种）
  const breakPoints = [];
  if (wp.patternCode === 'JIE_CAI' || wp.patternCode === 'CAI_DUO_SHEN_RUO') {
    breakPoints.push({ type: '合伙', advice: '避开任何形式的合伙与集资' });
    breakPoints.push({ type: '炒股', advice: '仓位不宜超过总资产 20%' });
  } else {
    breakPoints.push({ type: '冲动消费', advice: '重大支出设 24h 冷静期' });
  }
  breakPoints.push({ type: '贷款', advice: '慎用消费贷 · 远离高息借贷' });

  // 贵人月（简化）
  const guirenMonth = wp.patternCode === 'ZHENG_CAI' ? [3, 6, 9] :
                     wp.patternCode === 'PIAN_CAI' ? [1, 5, 11] : [2, 7, 10];

  return {
    ...quickCheck,
    bazi: paipanResult.bazi,
    dayGan: paipanResult.dayGan,
    dayWuxing: paipanResult.dayWuxing,
    wuxingPct: paipanResult.wuxingPct,
    ganShishen: paipanResult.ganShishen,
    timeline,
    breakPoints,
    guirenMonth,
    longAnalysis: generateLongAnalysis(paipanResult, wp)
  };
}

function generateLongAnalysis(paipanResult, wp) {
  const dayGan = paipanResult.dayGan;
  const dayWX = paipanResult.dayWuxing;
  const ds = paipanResult.dayStrength;

  // 五段式长文
  return [
    {
      title: '【命格综述】',
      text: `日主${dayGan}，${dayWX}命${paipanResult.dayYinYang}干，${ds}之象。命格定为"${wp.pattern}"。${wp.description}`
    },
    {
      title: '【天赋财路】',
      text: wp.strategy + ' 这不是禁锢你的"命定"，而是你最省力的路径——顺着这条路走，事半功倍；逆着走，事倍功半。'
    },
    {
      title: '【财星分析】',
      text: `你八字中的财星分布：${wp.caiScore}/100。${wp.caiScore >= 70 ? '财气旺盛，只要方法对，钱会找你。' : wp.caiScore >= 40 ? '财气中等，稳扎稳打，不求一夜暴富。' : '财气偏弱，需靠技能、贵人、时机激活。'}`
    },
    {
      title: '【破财警示】',
      text: '每个命格都有其"阿喀琉斯之踵"。你这个命格要特别提防：' + (wp.patternCode === 'JIE_CAI' ? '合伙、借贷、股票重仓。' : wp.patternCode === 'CAI_DUO_SHEN_RUO' ? '一夜暴富幻想、超出能力的投资。' : '冲动消费、过度杠杆。')
    },
    {
      title: '【行动建议】',
      text: '命理不是宿命。知道自己的命格，不是为了认命，而是为了选择最省力的路径。以下 30 天你可以做的：① 审视你的资产配置是否与命格匹配 ② 远离命格中标明的"破财点" ③ 在"黄金期"到来前做好准备。'
    }
  ];
}

// ============ 投机炒股适配度（免费卖点）============
// 输出 0-100 分 + 等级 + 理由 + 建议板块
function getSpeculationFit(paipanResult) {
  const wp = paipanResult.wealthPattern;
  const code = wp.patternCode;
  const strength = paipanResult.dayStrength;
  const dayWX = paipanResult.dayWuxing;

  // 各命格基础分 + 等级
  const base = {
    'PIAN_CAI':            { score: 88, level: 'S', verdict: '极适合', tag: '偏财格 · 抓趋势命' },
    'CONG_CAI':            { score: 85, level: 'S', verdict: '极适合', tag: '从财格 · 顺势大富' },
    'SHANG_GUAN_SHENG_CAI':{ score: 78, level: 'A', verdict: '较适合', tag: '伤官生财 · 敢赌有边界' },
    'SHI_SHEN_SHENG_CAI':  { score: 52, level: 'C', verdict: '慎入',   tag: '食神生财 · 靠技能胜于投机' },
    'ZHENG_CAI':           { score: 38, level: 'D', verdict: '不建议', tag: '正财格 · 固收复利优先' },
    'CAI_GUAN_SHUANG_MEI': { score: 46, level: 'C', verdict: '慎入',   tag: '财官双美 · 稳健为本' },
    'CAI_KU':              { score: 60, level: 'B', verdict: '中等',   tag: '财库格 · 长线逢冲开库' },
    'CAI_RU_MU':           { score: 55, level: 'B', verdict: '中等',   tag: '财星入墓 · 主动换仓激活' },
    'CAI_DUO_SHEN_RUO':    { score: 22, level: 'F', verdict: '劝退',   tag: '财多身弱 · 看得见吃不着' },
    'JIE_CAI':             { score: 18, level: 'F', verdict: '劝退',   tag: '劫财夺财 · 越炒越亏' },
  };
  const b = base[code] || { score: 50, level: 'C', verdict: '中等', tag: wp.pattern };

  // 身弱再扣分（扛不住波动）
  let score = b.score;
  if (strength === '身弱' && !['CONG_CAI'].includes(code)) score -= 8;
  if (strength === '身旺') score += 4;
  score = Math.max(10, Math.min(96, score));

  // 推荐板块（按日主五行）
  const sectorMap = {
    '木': ['农林牧渔', '医药生物', '纺织服装', '新能源车'],
    '火': ['电力设备', '电子半导体', '传媒', '化工'],
    '土': ['房地产', '建材', '黄金珠宝', '基建'],
    '金': ['银行证券', '有色金属', '机械制造', '军工'],
    '水': ['物流航运', '饮料', '渔业水产', '云计算'],
  };
  const likeSectors = sectorMap[dayWX] || [];

  // 一句核心总结（粗体大字） + 3 条短 bullet
  let headline = '';
  let bullets = [];
  if (score >= 80) {
    headline = '你是天生的交易者';
    bullets = [
      '敢重仓 · 必设止损',
      '拒绝拿小盈当大赚',
      '可上量化 / 日内',
    ];
  } else if (score >= 60) {
    headline = '顺势能赚 · 不要满仓';
    bullets = [
      '等信号 · 不追高',
      '仓位 40-60 最舒服',
      '远离杠杆类工具',
    ];
  } else if (score >= 40) {
    headline = '你更适合被动投资';
    bullets = [
      '指数 ETF 定投为主',
      '禁用次日短线交易',
      '本业复利 > 股票波段',
    ];
  } else {
    headline = '炒股是你命里的破财门';
    bullets = [
      '买进即顶 · 卖出即底',
      '只买指数 · 不碰个股',
      '本业 ROI 高 10 倍',
    ];
  }

  return {
    score,
    level: b.level,
    verdict: b.verdict,
    tag: b.tag,
    headline,
    bullets,
    sectors: likeSectors,
    pattern: wp.pattern,
  };
}

// ============ 今日签筒抽签（免费）============
// 基于今日天干地支 + 用户八字生成一支签，签文+宜忌+一句话+签号
const FORTUNE_STICKS = [
  { no: '第  一  签', name: '大吉 · 天时地利', grade: 'DA_JI',  min: 85 },
  { no: '第  二  签', name: '上吉 · 风顺水涨', grade: 'SHANG_JI', min: 75 },
  { no: '第  三  签', name: '中吉 · 按部就班', grade: 'ZHONG_JI', min: 60 },
  { no: '第  四  签', name: '中平 · 守成观望', grade: 'ZHONG_PING', min: 45 },
  { no: '第  五  签', name: '下平 · 退避三舍', grade: 'XIA_PING', min: 30 },
  { no: '第  六  签', name: '下凶 · 静养待时', grade: 'XIA_XIONG', min: 0 },
];

const STICK_POEMS = {
  'DA_JI': [
    '金龙腾海聚财星，紫气东来贵自迎。\n今日开仓逢大势，乾坤手内一盘清。',
    '春风得意马蹄轻，一日看尽长安春。\n财帛宫中三喜至，此时不发待何时。',
  ],
  'SHANG_JI': [
    '云开月朗见青天，小舟放入顺风帆。\n路遇贵人携手行，先守后攻得满栈。',
    '桃李花开次第红，枝头挂满玉玲珑。\n稳中求进应时机，巧遇良缘利自通。',
  ],
  'ZHONG_JI': [
    '按部就班终有成，不慌不忙任西东。\n莫嫌今日收成小，滴水成河积寸功。',
    '青山依旧白云间，静待风来燕始还。\n此时进退皆由己，半缘人事半缘天。',
  ],
  'ZHONG_PING': [
    '日中不决莫勉强，云深雾锁路难看。\n守得本心清静处，自有明月照窗前。',
    '船到江心莫慌张，风平浪静自能还。\n今朝但守三分稳，他日方能十分宽。',
  ],
  'XIA_PING': [
    '前路未明莫轻行，山高水远路难平。\n收拾心绪静心坐，明日重装再出征。',
    '阴云密布遮北斗，暂歇征蹄养锐骁。\n此时出手皆是错，闭门读书胜挥刀。',
  ],
  'XIA_XIONG': [
    '乌云压顶雷声隐，风起浪涌舟难行。\n今日凡事皆宜避，退守一隅保安宁。',
    '险滩暗礁藏水下，贸然行船恐翻船。\n今朝听劝闭门坐，明月仍照你前川。',
  ],
};

function getFortuneStick(paipanResult) {
  const t = getTodayLuck(paipanResult);  // 复用已有分数
  const score = t.score;

  // 用 score 选签档
  const stick = FORTUNE_STICKS.find(s => score >= s.min) || FORTUNE_STICKS[FORTUNE_STICKS.length - 1];

  // 用今天日干支做稳定 seed 选具体签文
  const today = new Date();
  const seed = (today.getFullYear() * 372 + (today.getMonth() + 1) * 31 + today.getDate()) % 2;
  const poem = STICK_POEMS[stick.grade][seed];

  // 签号：年干支 + 日干支前缀
  const reportNo = 'SIG-' + (Date.now() % 100000).toString(36).toUpperCase();

  // 当日板块推荐 & 规避（按 日主五行 + 今日天干五行 + 签评分）
  const sectorPool = {
    '木': ['新能源车', '医药生物', '农林牧渔', '纺织服装', '造纸'],
    '火': ['电力设备', '电子半导体', '传媒', '化工', '光伏'],
    '土': ['房地产', '建材', '黄金珠宝', '基建', '水泥'],
    '金': ['银行证券', '有色金属', '机械制造', '军工', '汽车零配件'],
    '水': ['物流航运', '饮料', '水产渔业', '云计算', '通信'],
  };
  const todayDayGan = t.todayGZ[0];
  const todayWX = GAN_WUXING[todayDayGan];
  const dayWX = paipanResult.dayWuxing;
  // 相生板块（今日天干五行的生/同行）
  const shengTo = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  const favorWX = shengTo[dayWX];       // 日主所生 = 食伤/财星方向
  const avoidWX = shengTo[todayWX];     // 今日天干所生（泄日主）

  let sectorPick, sectorAvoid;
  if (score >= 75) {
    // 大吉/上吉：推荐本命财星方向前 3
    sectorPick = (sectorPool[favorWX] || []).slice(0, 3);
    sectorAvoid = (sectorPool[avoidWX === dayWX ? 'water' : avoidWX] || sectorPool['土']).slice(0, 1);
  } else if (score >= 55) {
    // 中吉：推荐与今日天干相同五行（顺应天时）
    sectorPick = (sectorPool[todayWX] || []).slice(0, 3);
    sectorAvoid = (sectorPool[avoidWX] || sectorPool['火']).slice(0, 1);
  } else if (score >= 40) {
    // 中平：保守，只给 2 个大类避险
    sectorPick = ['指数ETF(沪深300)', '黄金ETF'];
    sectorAvoid = (sectorPool[avoidWX] || sectorPool['木']).slice(0, 2);
  } else {
    // 下平/下凶：清仓信号
    sectorPick = ['现金', '债券ETF'];
    sectorAvoid = (sectorPool[todayWX] || sectorPool['火']).slice(0, 3);
  }

  // 板块建议一句话
  let sectorAdvice;
  if (score >= 75) {
    sectorAdvice = `今日 ${todayDayGan}${t.todayGZ[1]}日 · 财星当令，宜顺势加仓`;
  } else if (score >= 55) {
    sectorAdvice = `${todayWX}性板块有轮动机会 · 小仓位试探`;
  } else if (score >= 40) {
    sectorAdvice = `今日宜守不宜攻 · 只做宽基 ETF`;
  } else {
    sectorAdvice = `签示回避 · 建议空仓或只留现金`;
  }

  return {
    date: t.date,
    todayGZ: t.todayGZ,
    stickNo: stick.no,
    stickName: stick.name,
    grade: stick.grade,
    poem,
    score,
    yiList: t.yiList,
    jiList: t.jiList,
    oneLine: t.oneLine,
    todayShishen: t.todayShishen,
    chongFlag: t.chongFlag,
    reportNo,
    // 新增：今日板块
    sectorPick,
    sectorAvoid,
    sectorAdvice,
    todayWX,
  };
}

// ============ 双环境导出（小程序 CommonJS + 浏览器全局）============
const __BAZI_EXPORTS = {
  GAN, ZHI, GAN_WUXING, ZHI_WUXING,
  paipan,
  getTodayLuck,
  getQuickCheck,
  getDeepReport,
  getSpeculationFit,
  getFortuneStick,
  getDayGZ,
  getShiShen
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = __BAZI_EXPORTS;
}
if (typeof window !== 'undefined') {
  window.Bazi = __BAZI_EXPORTS;
}
