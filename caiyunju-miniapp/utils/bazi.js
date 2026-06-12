// utils/bazi.js · 招财簿 · 八字排盘引擎（小程序版）
// 从 _cloudfunctions.bak/baziEngine/lib/bazi-core.js 迁移
// 算法逻辑 100% 保持一致，适配小程序 require() 环境

// ============ 基础常量 ============
var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

var GAN_WUXING = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火',
  '戊': '土', '己': '土', '庚': '金', '辛': '金',
  '壬': '水', '癸': '水'
};

var ZHI_WUXING = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木',
  '辰': '土', '巳': '火', '午': '火', '未': '土',
  '申': '金', '酉': '金', '戌': '土', '亥': '水'
};

var GAN_YINYANG = {
  '甲': '阳', '乙': '阴', '丙': '阳', '丁': '阴',
  '戊': '阳', '己': '阴', '庚': '阳', '辛': '阴',
  '壬': '阳', '癸': '阴'
};

var ZHI_CANGGAN = {
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
var MONTH_ZHI = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

// 时辰地支
function getHourZhi(hour) {
  if (hour >= 23 || hour < 1) return '子';
  return ZHI[Math.floor((hour + 1) / 2)];
}

// ============ 精确节气查表（1900-2100）============
var JIEQI_TABLE = {
  1900:[6,4,6,5,6,6,7,8,8,9,8,7],  1901:[6,4,6,5,6,6,8,8,8,9,8,8],  1902:[6,5,6,6,6,7,8,8,8,9,8,8],  1903:[6,5,7,6,7,7,8,9,9,9,8,8],  1904:[7,5,6,5,6,6,7,8,8,9,8,7],  1905:[6,4,6,5,6,6,8,8,8,9,8,8],  1906:[6,5,6,6,6,6,8,8,8,9,8,8],  1907:[6,5,7,6,7,7,8,9,9,9,8,8],  1908:[7,5,6,5,6,6,7,8,8,9,8,7],  1909:[6,4,6,5,6,6,8,8,8,9,8,8],
  1910:[6,5,6,6,6,6,8,8,8,9,8,8], 1911:[6,5,7,6,7,7,8,9,9,9,8,8], 1912:[7,5,6,5,6,6,7,8,8,9,8,7], 1913:[6,4,6,5,6,6,8,8,8,9,8,8], 1914:[6,4,6,5,6,6,8,8,8,9,8,8], 1915:[6,5,6,6,6,7,8,8,9,9,8,8], 1916:[6,5,6,5,6,6,7,8,8,8,8,7], 1917:[6,4,6,5,6,6,8,8,8,9,8,8], 1918:[6,4,6,5,6,6,8,8,8,9,8,8], 1919:[6,5,6,6,6,7,8,8,9,9,8,8],
  1920:[6,5,6,5,6,6,7,8,8,8,8,7], 1921:[6,4,6,5,6,6,8,8,8,9,8,7], 1922:[6,4,6,5,6,6,8,8,8,9,8,8], 1923:[6,5,6,6,6,7,8,8,9,9,8,8], 1924:[6,5,6,5,6,6,7,8,8,8,8,7], 1925:[6,4,6,5,6,6,8,8,8,9,8,7], 1926:[6,4,6,5,6,6,8,8,8,9,8,8], 1927:[6,5,6,6,6,7,8,8,9,9,8,8], 1928:[6,5,6,5,6,6,7,8,8,8,7,7], 1929:[6,4,6,5,6,6,7,8,8,9,8,7],
  1930:[6,4,6,5,6,6,8,8,8,9,8,8], 1931:[6,5,6,6,6,7,8,8,8,9,8,8], 1932:[6,5,6,5,6,6,7,8,8,8,7,7], 1933:[6,4,6,5,6,6,7,8,8,9,8,7], 1934:[6,4,6,5,6,6,8,8,8,9,8,8], 1935:[6,5,6,6,6,6,8,8,8,9,8,8], 1936:[6,5,6,5,6,6,7,8,8,8,7,7], 1937:[6,4,6,5,6,6,7,8,8,9,8,7], 1938:[6,4,6,5,6,6,8,8,8,9,8,8], 1939:[6,5,6,6,6,6,8,8,8,9,8,8],
  1940:[6,5,6,5,6,6,7,8,8,8,7,7], 1941:[6,4,6,5,6,6,7,8,8,9,8,7], 1942:[6,4,6,5,6,6,8,8,8,9,8,8], 1943:[6,5,6,6,6,6,8,8,8,9,8,8], 1944:[6,5,6,5,6,6,7,8,8,8,7,7], 1945:[6,4,6,5,6,6,7,8,8,8,8,7], 1946:[6,4,6,5,6,6,8,8,8,9,8,8], 1947:[6,4,6,5,6,6,8,8,8,9,8,8], 1948:[6,5,5,5,5,6,7,8,8,8,7,7], 1949:[5,4,6,5,6,6,7,8,8,8,8,7],
  1950:[6,4,6,5,6,6,8,8,8,9,8,8], 1951:[6,4,6,5,6,6,8,8,8,9,8,8], 1952:[6,5,5,5,5,6,7,7,8,8,7,7], 1953:[5,4,6,5,6,6,7,8,8,8,8,7], 1954:[6,4,6,5,6,6,8,8,8,9,8,7], 1955:[6,4,6,5,6,6,8,8,8,9,8,8], 1956:[6,5,5,5,5,6,7,7,8,8,7,7], 1957:[5,4,6,5,6,6,7,8,8,8,8,7], 1958:[6,4,6,5,6,6,7,8,8,9,8,7], 1959:[6,4,6,5,6,6,8,8,8,9,8,8],
  1960:[6,5,5,5,5,6,7,7,7,8,7,7], 1961:[5,4,6,5,6,6,7,8,8,8,7,7], 1962:[6,4,6,5,6,6,7,8,8,9,8,7], 1963:[6,4,6,5,6,6,8,8,8,9,8,8], 1964:[6,5,5,5,5,6,7,7,7,8,7,7], 1965:[5,4,6,5,6,6,7,8,8,8,7,7], 1966:[6,4,6,5,6,6,7,8,8,9,8,7], 1967:[6,4,6,5,6,6,8,8,8,9,8,8], 1968:[6,5,5,5,5,5,7,7,7,8,7,7], 1969:[5,4,6,5,6,6,7,8,8,8,7,7],
  1970:[6,4,6,5,6,6,7,8,8,9,8,7], 1971:[6,4,6,5,6,6,8,8,8,9,8,8], 1972:[6,5,5,5,5,5,7,7,7,8,7,7], 1973:[5,4,6,5,5,6,7,8,8,8,7,7], 1974:[6,4,6,5,6,6,7,8,8,9,8,7], 1975:[6,4,6,5,6,6,8,8,8,9,8,8], 1976:[6,5,5,4,5,5,7,7,7,8,7,7], 1977:[5,4,6,5,5,6,7,7,8,8,7,7], 1978:[6,4,6,5,6,6,7,8,8,8,8,7], 1979:[6,4,6,5,6,6,8,8,8,9,8,8],
  1980:[6,5,5,4,5,5,7,7,7,8,7,7], 1981:[5,4,6,5,5,6,7,7,8,8,7,7], 1982:[6,4,6,5,6,6,7,8,8,8,8,7], 1983:[6,4,6,5,6,6,8,8,8,9,8,8], 1984:[6,4,5,4,5,5,7,7,7,8,7,7], 1985:[5,4,5,5,5,6,7,7,8,8,7,7], 1986:[5,4,6,5,6,6,7,8,8,8,8,7], 1987:[6,4,6,5,6,6,8,8,8,9,8,7], 1988:[6,4,5,4,5,5,7,7,7,8,7,7], 1989:[5,4,5,5,5,6,7,7,8,8,7,7],
  1990:[5,4,6,5,6,6,7,8,8,8,7,7], 1991:[6,4,6,5,6,6,7,8,8,9,8,7], 1992:[6,4,5,4,5,5,7,7,7,8,7,7], 1993:[5,4,5,5,5,6,7,7,7,8,7,7], 1994:[5,4,6,5,6,6,7,8,8,8,7,7], 1995:[6,4,6,5,6,6,7,8,8,9,8,7], 1996:[6,4,5,4,5,5,7,7,7,8,7,7], 1997:[5,4,5,5,5,5,7,7,7,8,7,7], 1998:[5,4,6,5,6,6,7,8,8,8,7,7], 1999:[6,4,6,5,6,6,7,8,8,9,8,7],
  2000:[6,4,5,4,5,5,7,7,7,8,7,7], 2001:[5,4,5,5,5,5,7,7,7,8,7,7], 2002:[5,4,6,5,6,6,7,8,8,8,7,7], 2003:[6,4,6,5,6,6,7,8,8,9,8,7], 2004:[6,4,5,4,5,5,7,7,7,8,7,7], 2005:[5,4,5,5,5,5,7,7,7,8,7,7], 2006:[5,4,6,5,5,6,7,7,8,8,7,7], 2007:[6,4,6,5,6,6,7,8,8,9,8,7], 2008:[6,4,5,4,5,5,7,7,7,8,7,7], 2009:[5,4,5,4,5,5,7,7,7,8,7,7],
  2010:[5,4,6,5,5,6,7,7,8,8,7,7], 2011:[6,4,6,5,6,6,7,8,8,8,8,7], 2012:[6,4,5,4,5,5,7,7,7,8,7,7], 2013:[5,4,5,4,5,5,7,7,7,8,7,7], 2014:[5,4,6,5,5,6,7,7,8,8,7,7], 2015:[6,4,6,5,6,6,7,8,8,8,8,7], 2016:[6,4,5,4,5,5,6,7,7,7,8,7,7], 2017:[5,3,5,4,5,5,7,7,7,8,7,7], 2018:[5,4,5,5,5,6,7,7,8,8,7,7], 2019:[5,4,6,5,6,6,7,8,8,8,8,7],
  2020:[6,4,5,4,5,5,6,7,7,8,7,7], 2021:[5,3,5,4,5,5,7,7,7,8,7,7], 2022:[5,4,5,5,5,6,7,7,7,8,7,7], 2023:[5,4,6,5,6,6,7,8,8,8,8,7], 2024:[6,4,5,4,5,5,6,7,7,8,7,6], 2025:[5,3,5,4,5,5,7,7,7,8,7,7], 2026:[5,4,5,5,5,5,7,7,7,8,7,7], 2027:[5,4,6,5,6,6,7,8,8,8,7,7], 2028:[6,4,5,4,5,5,6,7,7,8,7,6], 2029:[5,3,5,4,5,5,7,7,7,8,7,7],
  2030:[5,4,5,5,5,5,7,7,7,8,7,7], 2031:[5,4,6,5,6,6,7,8,8,8,7,7], 2032:[6,4,5,4,5,5,6,7,7,8,7,6], 2033:[5,3,5,4,5,5,7,7,7,8,7,7], 2034:[5,4,5,5,5,5,7,7,7,8,7,7], 2035:[5,4,6,5,5,6,7,7,8,8,7,7], 2036:[6,4,5,4,5,5,6,7,7,8,7,6], 2037:[5,3,5,4,5,5,7,7,7,8,7,7], 2038:[5,4,5,5,5,5,7,7,7,8,7,7], 2039:[5,4,6,5,5,6,7,7,8,8,7,7],
  2040:[6,4,5,4,5,5,6,7,7,8,7,6], 2041:[5,3,5,4,5,5,7,7,7,8,7,7], 2042:[5,4,5,4,5,5,7,7,7,8,7,7], 2043:[5,4,6,5,5,6,7,7,8,8,7,7], 2044:[6,4,5,4,5,5,6,7,7,7,7,6], 2045:[5,3,5,4,5,5,7,7,7,8,7,7], 2046:[5,4,5,4,5,5,7,7,7,8,7,7], 2047:[5,4,6,5,5,6,7,7,8,8,7,7], 2048:[6,4,5,4,5,5,6,7,7,7,7,6], 2049:[5,3,5,4,5,5,6,7,7,8,7,7],
  2050:[5,3,5,4,5,5,7,7,7,8,7,7], 2051:[5,4,5,5,5,6,7,7,7,8,7,7], 2052:[5,4,5,4,5,5,6,7,7,7,7,6], 2053:[5,3,5,4,5,5,6,7,7,8,7,7], 2054:[5,3,5,4,5,5,7,7,7,8,7,7], 2055:[5,4,5,5,5,5,7,7,7,8,7,7], 2056:[5,4,5,4,5,5,6,7,7,7,7,6], 2057:[5,3,5,4,5,5,6,7,7,8,7,6], 2058:[5,3,5,4,5,5,7,7,7,8,7,7], 2059:[5,4,5,5,5,5,7,7,7,8,7,7],
  2060:[5,4,5,4,5,5,6,7,7,7,6,6], 2061:[5,3,5,4,5,5,6,7,7,8,7,6], 2062:[5,3,5,4,5,5,7,7,7,8,7,7], 2063:[5,4,5,5,5,5,7,7,7,8,7,7], 2064:[5,4,5,4,5,5,6,6,7,7,6,6], 2065:[5,3,5,4,5,5,6,7,7,8,7,6], 2066:[5,3,5,4,5,5,7,7,7,8,7,7], 2067:[5,4,5,5,5,5,7,7,7,8,7,7], 2068:[5,4,5,4,4,5,6,6,7,7,6,6], 2069:[5,3,5,4,5,5,6,7,7,8,7,6],
  2070:[5,3,5,4,5,5,7,7,7,8,7,7], 2071:[5,4,5,5,5,5,7,7,7,8,7,7], 2072:[5,4,5,4,4,5,6,6,7,7,6,6], 2073:[5,3,5,4,5,5,6,7,7,7,7,6], 2074:[5,3,5,4,5,5,7,7,7,8,7,7], 2075:[5,4,5,4,5,5,7,7,7,8,7,7], 2076:[5,4,5,4,4,5,6,6,7,7,6,6], 2077:[5,3,5,4,5,5,6,7,7,7,7,6], 2078:[5,3,5,4,5,5,6,7,7,8,7,7], 2079:[5,4,5,4,5,5,7,7,7,8,7,7],
  2080:[5,4,5,4,4,5,6,6,7,7,6,6], 2081:[5,3,5,4,5,5,6,7,7,7,7,6], 2082:[5,3,5,4,5,5,6,7,7,8,7,7], 2083:[5,3,5,4,5,5,7,7,7,8,7,7], 2084:[5,4,4,4,4,4,5,6,6,6,7,6,6], 2085:[4,3,5,4,5,5,6,7,7,7,7,6], 2086:[5,3,5,4,5,5,6,7,7,8,7,7], 2087:[5,3,5,4,5,5,7,7,7,8,7,7], 2088:[5,4,4,4,4,4,4,6,6,6,7,6,6], 2089:[4,3,5,4,5,5,6,7,7,7,7,6],
  2090:[5,3,5,4,5,5,6,7,7,8,7,6], 2091:[5,3,5,4,5,5,7,7,7,8,7,7], 2092:[5,4,4,4,4,4,4,6,6,6,7,6,6], 2093:[4,3,5,4,5,5,6,6,7,7,6,6], 2094:[5,3,5,4,5,5,6,7,7,8,7,6], 2095:[5,3,5,4,5,5,7,7,7,8,7,7], 2096:[5,4,4,4,4,4,4,6,6,6,7,6,6], 2097:[4,3,5,4,5,5,6,6,7,7,6,6], 2098:[5,3,5,4,5,5,6,7,7,8,7,6], 2099:[5,3,5,4,5,5,7,7,7,8,7,7],
  2100:[5,4,5,5,5,5,7,7,7,8,7,7],
};

var JIEQI_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
var JIEQI_MONTHZHI = [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function getJieQiDay(year, jieIdx) {
  var t = JIEQI_TABLE[year];
  if (!t) return null;
  return { month: JIEQI_MONTHS[jieIdx], day: t[jieIdx] };
}

function getLichunDate(year) {
  return getJieQiDay(year, 1);
}

function getMonthIndex(year, month, day) {
  var t = JIEQI_TABLE[year];
  if (!t) return (month + 10) % 12;

  for (var i = 11; i >= 0; i--) {
    var jqMonth = JIEQI_MONTHS[i];
    var jqDay = t[i];
    if (month > jqMonth || (month === jqMonth && day >= jqDay)) {
      return JIEQI_MONTHZHI[i];
    }
  }
  return 10;
}

function gregorianToJD(year, month, day) {
  var a = Math.floor((14 - month) / 12);
  var y = year + 4800 - a;
  var m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

// ============ 四柱计算 ============

function getYearGZ(year, month, day) {
  var y = year;
  var lichun = getLichunDate(year);
  if (lichun && (month < lichun.month || (month === lichun.month && day < lichun.day))) {
    y = year - 1;
  }
  var offset = ((y - 1984) % 60 + 60) % 60;
  return GAN[offset % 10] + ZHI[offset % 12];
}

function getMonthGZ(yearGan, year, month, day) {
  var monthIndex = getMonthIndex(year, month, day);
  var zhi = MONTH_ZHI[monthIndex];

  var wuhu = {
    '甲': '丙', '己': '丙',
    '乙': '戊', '庚': '戊',
    '丙': '庚', '辛': '庚',
    '丁': '壬', '壬': '壬',
    '戊': '甲', '癸': '甲'
  };
  var firstGan = wuhu[yearGan];
  var firstGanIdx = GAN.indexOf(firstGan);
  var gan = GAN[(firstGanIdx + monthIndex) % 10];
  return gan + zhi;
}

function getDayGZ(year, month, day) {
  // 儒略日算法：以 1900-01-01 甲戌日为基准
  // 天干：甲=GAN[0]  地支：戌=ZHI[10]
  // days 为 0 时对应 1900-01-01，需要 offset +10 使地支对齐戌
  var baseJD = gregorianToJD(1900, 1, 1);
  var targetJD = gregorianToJD(year, month, day);
  var days = targetJD - baseJD;
  var offset = (days + 10) % 60;  // +10 = 地支戌的索引（基准日 1900-01-01 为甲戌日）
  return GAN[offset % 10] + ZHI[offset % 12];
}

function getHourGZ(dayGan, hour) {
  var hourZhi = getHourZhi(hour);
  var hourZhiIdx = ZHI.indexOf(hourZhi);

  var wushu = {
    '甲': '甲', '己': '甲',
    '乙': '丙', '庚': '丙',
    '丙': '戊', '辛': '戊',
    '丁': '庚', '壬': '庚',
    '戊': '壬', '癸': '壬'
  };
  var firstGan = wushu[dayGan];
  var firstGanIdx = GAN.indexOf(firstGan);
  var gan = GAN[(firstGanIdx + hourZhiIdx) % 10];
  return gan + hourZhi;
}

// ============ 十神判定 ============
function getShiShen(dayGan, targetGan) {
  var dayWX = GAN_WUXING[dayGan];
  var targetWX = GAN_WUXING[targetGan];
  var dayYY = GAN_YINYANG[dayGan];
  var targetYY = GAN_YINYANG[targetGan];
  var sameYY = dayYY === targetYY;

  var sheng = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  var ke = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };

  var type;
  if (targetWX === dayWX) type = 'same';
  else if (sheng[targetWX] === dayWX) type = 'shengMe';
  else if (sheng[dayWX] === targetWX) type = 'woSheng';
  else if (ke[targetWX] === dayWX) type = 'keMe';
  else if (ke[dayWX] === targetWX) type = 'woKe';

  var mapping = {
    'same_true': '比肩',       'same_false': '劫财',
    'woSheng_true': '食神',     'woSheng_false': '伤官',
    'woKe_true': '偏财',       'woKe_false': '正财',
    'keMe_true': '七杀',       'keMe_false': '正官',
    'shengMe_true': '偏印',     'shengMe_false': '正印'
  };
  return mapping[type + '_' + sameYY];
}

// ============ 五行强弱统计 ============
function analyzeWuxing(bazi) {
  var count = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };

  ['year', 'month', 'day', 'hour'].forEach(function(k) {
    var g = bazi[k][0];
    var z = bazi[k][1];
    count[GAN_WUXING[g]] += 1;
    count[ZHI_WUXING[z]] += 0.8;
    var cangGan = ZHI_CANGGAN[z];
    if (cangGan.length > 1) {
      cangGan.slice(1).forEach(function(cg, i) {
        count[GAN_WUXING[cg]] += 0.3 / (i + 1);
      });
    }
  });

  return count;
}

// ============ 日主旺衰判断 ============
function analyzeDayStrength(bazi) {
  var dayGan = bazi.day[0];
  var dayWX = GAN_WUXING[dayGan];
  var wuxingCount = analyzeWuxing(bazi);

  var monthZhi = bazi.month[1];
  var monthWX = ZHI_WUXING[monthZhi];
  var sheng = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  var deLing = (monthWX === dayWX || sheng[monthWX] === dayWX);

  var helpWX = dayWX;
  var printWX = null;
  for (var k in sheng) {
    if (sheng[k] === dayWX) { printWX = k; break; }
  }
  var helpTotal = wuxingCount[helpWX] + (printWX ? wuxingCount[printWX] : 0);
  var total = 0;
  for (var kk in wuxingCount) { total += wuxingCount[kk]; }
  var helpRatio = helpTotal / total;

  var strength;
  if (helpRatio > 0.5) strength = '身旺';
  else if (helpRatio > 0.35) strength = '身中';
  else strength = '身弱';

  return {
    strength: strength,
    deLing: deLing,
    helpRatio: Math.round(helpRatio * 100),
    wuxingCount: wuxingCount
  };
}

// ============ 财格判定（12 种）============
function analyzeWealthPattern(bazi) {
  var dayGan = bazi.day[0];
  var dayStrength = analyzeDayStrength(bazi);
  var strength = dayStrength.strength;
  var wuxingCount = dayStrength.wuxingCount;

  var dayWX = GAN_WUXING[dayGan];
  var keMap = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
  var keWX = keMap[dayWX];
  var caiTotal = wuxingCount[keWX];

  var allGans = [bazi.year[0], bazi.month[0], bazi.hour[0]];
  var shishens = allGans.map(function(g) { return getShiShen(dayGan, g); });

  var zhiList = [bazi.year[1], bazi.month[1], bazi.day[1], bazi.hour[1]];
  var caiInZhi = zhiList.filter(function(z) { return GAN_WUXING[ZHI_CANGGAN[z][0]] === keWX; }).length;

  var shengMap = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  var woShengWX = shengMap[dayWX];

  var pattern, patternCode, description, strategy;

  if (strength === '身弱' && caiTotal > wuxingCount[dayWX] * 2) {
    pattern = '财多身弱'; patternCode = 'CAI_DUO_SHEN_RUO';
    description = '财旺身弱 · 看得见吃不着'; strategy = '先养身 · 再取财 · 忌合伙 · 忌重仓';
  } else if (strength === '身弱' && caiTotal > 2) {
    pattern = '从财格'; patternCode = 'CONG_CAI';
    description = '身弱全局财 · 反成大富'; strategy = '顺势而为 · 切勿逆天';
  } else if (shishens.indexOf('食神') !== -1 && caiTotal > 0.5) {
    pattern = '食神生财'; patternCode = 'SHI_SHEN_SHENG_CAI';
    description = '才华换钱 · 技能即财路'; strategy = '专注手艺 · 打磨作品 · 不宜投机';
  } else if (shishens.indexOf('伤官') !== -1 && caiTotal > 0.5) {
    pattern = '伤官生财'; patternCode = 'SHANG_GUAN_SHENG_CAI';
    description = '锋芒毕露 · 单干最赚'; strategy = '创业 / IP / 单干 · 不宜打工';
  } else if (shishens.indexOf('正财') !== -1 && strength !== '身弱') {
    pattern = '正财格'; patternCode = 'ZHENG_CAI';
    description = '身旺财旺 · 收入稳定'; strategy = '定投复利 · 忌高杠杆';
  } else if (shishens.indexOf('偏财') !== -1 && strength !== '身弱') {
    pattern = '偏财格'; patternCode = 'PIAN_CAI';
    description = '财星透干 · 大开大合'; strategy = '敢重仓 · 必止损 · 抓趋势';
  } else if (shishens.indexOf('比肩') !== -1 || shishens.indexOf('劫财') !== -1) {
    var jiePangs = shishens.filter(function(s) { return s === '比肩' || s === '劫财'; }).length;
    if (jiePangs >= 2) {
      pattern = '劫财夺财'; patternCode = 'JIE_CAI';
      description = '比劫当权 · 易破财'; strategy = '独立 · 稳健 · 忌合伙';
    } else {
      pattern = '财官双美'; patternCode = 'CAI_GUAN_SHUANG_MEI';
      description = '财官相生 · 走政商路线'; strategy = '管理层 · 高客单 · 不宜纯技术';
    }
  } else if (caiInZhi >= 2 && zhiList.some(function(z) { return ['辰', '戌', '丑', '未'].indexOf(z) !== -1; })) {
    pattern = '财库充盈'; patternCode = 'CAI_KU';
    description = '墓库带财 · 后运强'; strategy = '早年积累 · 中年发力';
  } else if (caiTotal < 0.5) {
    pattern = '财星入墓'; patternCode = 'CAI_RU_MU';
    description = '财星隐 · 需逢冲开库'; strategy = '换环境 · 换行业 · 激活财运';
  } else {
    pattern = '食神生财'; patternCode = 'SHI_SHEN_SHENG_CAI';
    description = '平和命格 · 技能换钱'; strategy = '专注本业 · 稳步积累';
  }

  return {
    pattern: pattern,
    patternCode: patternCode,
    description: description,
    strategy: strategy,
    caiScore: Math.min(Math.round(caiTotal * 10 + caiInZhi * 5), 100),
    dayStrength: strength
  };
}

// ============ 主入口：排八字 ============
/**
 * 排盘主函数
 * @param {Object} input - { year, month, day, hour, gender }
 *   year:   1900-2100（超出范围无节气数据，结果不可靠）
 *   month:  1-12
 *   day:    1-31（不校验月份天数，非闰年 2/29 等由调用方保证）
 *   hour:   0-23
 *   gender: 'M' (男) or 'F' (女)
 * @throws {Error} 参数无效时抛出
 * @returns {Object} 完整八字排盘结果
 */
function paipan(input) {
  // ---- 输入校验 ----
  if (!input || typeof input !== 'object') {
    throw new Error('paipan: input 必须是一个对象，收到: ' + typeof input);
  }

  var year = parseInt(input.year, 10);
  var month = parseInt(input.month, 10);
  var day = parseInt(input.day, 10);
  var hour = parseInt(input.hour, 10);
  var gender = input.gender || 'M';

  if (isNaN(year) || year < 1900 || year > 2100) {
    throw new Error('paipan: year 需在 1900-2100 之间，收到: ' + input.year);
  }
  if (isNaN(month) || month < 1 || month > 12) {
    throw new Error('paipan: month 需在 1-12 之间，收到: ' + input.month);
  }
  if (isNaN(day) || day < 1 || day > 31) {
    throw new Error('paipan: day 需在 1-31 之间，收到: ' + input.day);
  }
  if (isNaN(hour)) {
    hour = 12;  // 时辰未提供时默认午时
  } else if (hour < 0 || hour > 23) {
    throw new Error('paipan: hour 需在 0-23 之间，收到: ' + input.hour);
  }
  if (gender !== 'M' && gender !== 'F') {
    throw new Error('paipan: gender 需为 M 或 F，收到: ' + gender);
  }
  // ---- 校验结束 ----

  var yearGZ = getYearGZ(year, month, day);
  var monthGZ = getMonthGZ(yearGZ[0], year, month, day);
  var dayGZ = getDayGZ(year, month, day);
  var hourGZ = getHourGZ(dayGZ[0], hour);

  var bazi = {
    year: yearGZ,
    month: monthGZ,
    day: dayGZ,
    hour: hourGZ
  };

  var dayGan = dayGZ[0];
  var dayZhi = dayGZ[1];
  var dayStrength = analyzeDayStrength(bazi);
  var wealthPattern = analyzeWealthPattern(bazi);

  var total = 0;
  for (var k in dayStrength.wuxingCount) { total += dayStrength.wuxingCount[k]; }
  var wuxingPct = {};
  for (var kk in dayStrength.wuxingCount) {
    wuxingPct[kk] = Math.round(dayStrength.wuxingCount[kk] / total * 100);
  }

  var ganShishen = {
    year: getShiShen(dayGan, bazi.year[0]),
    month: getShiShen(dayGan, bazi.month[0]),
    day: '日主',
    hour: getShiShen(dayGan, bazi.hour[0])
  };

  // 地支藏干
  var zhiCanggan = {
    year: ZHI_CANGGAN[bazi.year[1]],
    month: ZHI_CANGGAN[bazi.month[1]],
    day: ZHI_CANGGAN[bazi.day[1]],
    hour: ZHI_CANGGAN[bazi.hour[1]]
  };

  return {
    input: { year: year, month: month, day: day, hour: hour, gender: gender },
    bazi: bazi,
    dayGan: dayGan,
    dayZhi: dayZhi,
    dayWuxing: GAN_WUXING[dayGan],
    dayYinYang: GAN_YINYANG[dayGan],
    dayStrength: dayStrength.strength,
    deLing: dayStrength.deLing,
    wuxingCount: dayStrength.wuxingCount,
    wuxingPct: wuxingPct,
    ganShishen: ganShishen,
    zhiCanggan: zhiCanggan,
    wealthPattern: wealthPattern
  };
}

// ============ 模块导出 ============
module.exports = {
  GAN: Object.freeze(GAN),
  ZHI: Object.freeze(ZHI),
  GAN_WUXING: Object.freeze(GAN_WUXING),
  ZHI_WUXING: Object.freeze(ZHI_WUXING),
  GAN_YINYANG: Object.freeze(GAN_YINYANG),
  ZHI_CANGGAN: Object.freeze(ZHI_CANGGAN),
  getHourZhi: getHourZhi,
  getDayGZ: getDayGZ,
  getShiShen: getShiShen,
  paipan: paipan
};
