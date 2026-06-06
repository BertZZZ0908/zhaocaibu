/**
 * 数据库 Schema 定义 · 招财簿小程序
 *
 * 集合（Collections）说明：
 *   1. users        — 用户信息
 *   2. bazi_records  — 排盘历史记录
 *   3. orders       — 支付订单
 *   4. daily_signs  — 每日签名数据
 *   5. reports      — 报告存档
 *
 * 索引策略：
 *   - 所有查询字段建立索引，确保性能
 *   - 复合查询使用复合索引
 */

const collections = {
  users: {
    description: '用户信息表',
    fields: {
      _id:            { type: 'string', desc: '自增主键' },
      openId:         { type: 'string', desc: '微信 OpenID', unique: true, required: true },
      unionId:        { type: 'string', desc: '微信 UnionID' },
      nickname:       { type: 'string', desc: '昵称' },
      avatarUrl:      { type: 'string', desc: '头像 URL' },
      gender:         { type: 'number', desc: '性别 0/1/2', default: 0 },
      defaultProfile: {
        type: 'object',
        desc: '默认生辰',
        properties: {
          birthDate:  { type: 'string', format: 'YYYY-MM-DD' },
          birthHour:  { type: 'number', range: [0, 23] },
          gender:     { type: 'number' }
        }
      },
      entitlements:   {
        type: 'object',
        desc: '权益状态',
        properties: {
          l1: { type: 'object', props: { purchased: 'boolean', expireAt: 'date' } },
          l2: { type: 'object', props: { purchased: 'boolean', expireAt: 'date' } },
          l3: { type: 'object', props: { purchased: 'boolean', expireAt: 'date' } }
        }
      },
      createdAt:      { type: 'date', desc: '注册时间' },
      updatedAt:      { type: 'date', desc: '更新时间' },
      lastLoginAt:    { type: 'date', desc: '最后登录时间' }
    },
    indexes: [
      { name: 'idx_openId', fields: [{ field: 'openId', direction: 'asc' }], unique: true }
    ],
    permissions: {
      read: true,
      write: 'doc.openId == openId || false'
    }
  },

  bazi_records: {
    description: '八字排盘历史记录',
    fields: {
      _id:            { type: 'string', desc: '自增主键' },
      openId:         { type: 'string', desc: '所属用户 OpenID', required: true },
      name:           { type: 'string', desc: '姓名/备注名' },
      gender:         { type: 'number', desc: '性别', required: true },
      birthDate:      { type: 'string', format: 'YYYY-MM-DD', required: true },
      birthHour:      { type: 'number', range: [0, 23], required: true },
      result:         { type: 'object', desc: '排盘结果缓存（JSON）' },
      isDefault:      { type: 'boolean', default: false, desc: '是否为默认生辰' },
      createdAt:      { type: 'date' }
    },
    indexes: [
      { name: 'idx_user_time', fields: [
        { field: 'openId', direction: 'asc' },
        { field: 'createdAt', direction: 'desc' }
      ]}
    ],
    permissions: {
      read: 'doc.openId == openId',
      write: 'doc.openId == openId'
    }
  },

  orders: {
    description: '支付订单表',
    fields: {
      _id:            { type: 'string', desc: '自增主键' },
      openId:         { type: 'string', required: true },
      orderId:        { type: 'string', desc: '商户订单号', required: true },
      transactionId:  { type: 'string', desc: '微信支付交易号' },
      productType:    { type: 'enum', values: ['l1','l2','l3'], required: true },
      productName:    { type: 'string', required: true },
      productPrice:   { type: 'number', desc: '价格(分)', required: true },
      status:         { type: 'enum', values: ['pending','paid','failed','refunded'], default: 'pending' },
      payTime:        { type: 'date' },
      callbackRaw:    { type: 'object', desc: '回调原始数据（审计用）' },
      createdAt:      { type: 'date' }
    },
    indexes: [
      { name: 'idx_order_id', fields: [{ field: 'orderId', direction: 'asc' }], unique: true },
      { name: 'idx_user_status', fields: [
        { field: 'openId', direction: 'asc' },
        { field: 'status', direction: 'asc' }
      ]}
    ],
    permissions: {
      read: 'doc.openId == openId',
      write: false // 仅云函数可写
    }
  },

  daily_signs: {
    description: '每日签名数据',
    fields: {
      _id:            { type: 'string', desc: '日期作为主键 YYYY-MM-DD', required: true, unique: true },
      date:           { type: 'string', format: 'YYYY-MM-DD', required: true },
      signContent:    { type: 'object', desc: '签文内容' },
      fortune:        { type: 'object', desc: '运势信息' },
      marketInsight:  { type: 'object', desc: '市场洞察' },
      createdAt:      { type: 'date' }
    },
    indexes: [
      { name: 'idx_date', fields: [{ field: 'date', direction: 'desc' }], unique: true }
    ],
    permissions: {
      read: true,     // 公开可读
      write: false     // 仅云函数/定时任务可写
    }
  },

  reports: {
    description: '报告存档',
    fields: {
      _id:            { type: 'string', desc: '自增主键' },
      userId:         { type: 'string', desc: '用户 ID', required: true },
      type:           { type: 'enum', values: ['deep','quick','today'] },
      content:        { type: 'object', desc: '报告完整内容' },
      createdAt:      { type: 'date' }
    },
    indexes: [
      { name: 'idx_user_report', fields: [
        { field: 'userId', direction: 'asc' },
        { field: 'createdAt', direction: 'desc' }
      ]}
    ]
  }
};

module.exports = { collections };

// ==================== 初始化脚本 ====================
// 在 CloudBase 控制台或通过 MCP 执行此脚本来初始化数据库

/*
async function initDatabase(cloud) {
  const db = cloud.database();

  for (const [name, config] of Object.entries(collections)) {
    console.log(`\n📦 创建集合: ${name}`);
    console.log(`   描述: ${config.description}`);

    try {
      // CloudBase 会自动创建集合（首次写入时）
      // 这里仅做验证和日志输出
      const count = await db.collection(name).count();
      console.log(`   当前文档数: ${count.total}`);
    } catch (e) {
      console.log(`   集合尚未存在（将在首次写入时自动创建）`);
    }

    if (config.indexes && config.indexes.length > 0) {
      console.log(`   索引:`);
      for (const idx of config.indexes) {
        console.log(`     - ${idx.name}: ${idx.fields.map(f => f.field).join(', ')}`);
      }
    }
  }

  console.log('\n✅ 数据库 Schema 准备完成');
}
*/
