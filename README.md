# Cardory

一款面向朋友和熟人的私人纪念卡抽取微信小程序。管理员使用已获授权的人物照片制作卡牌，普通用户通过每日签到获得抽卡次数，抽取并收集卡牌。

## ✨ 功能特性

### 普通用户功能
- 🔐 **微信静默登录** - 无需授权昵称或头像，自动识别用户身份
- 📅 **每日签到** - 每日手动签到获得 1 次抽卡机会，可永久累计
- 🎴 **抽卡系统** - 支持单抽和十连抽，四档稀有度 (N/R/SR/SSR)
- 📚 **卡册收集** - 查看已收集卡牌和全图鉴（未获得显示灰色剪影）
- 🎯 **保底机制** - 最高稀有度保底计数，提升抽取体验

### 管理员功能
- 🎨 **卡牌管理** - 上传图片、创建/编辑卡牌、配置稀有度和权重
- ⚙️ **规则配置** - 自定义稀有度名称、概率和保底次数
- 📋 **上下架管理** - 支持常驻卡、限定卡及到期自动下架
- 🔍 **安全检测** - 图片内容安全检测和肖像授权确认
- 📝 **操作日志** - 完整记录管理员操作历史

## 🛠️ 技术栈

- **前端**: 原生微信小程序 (WXML / WXSS / JavaScript)
- **后端**: 微信云函数 (Node.js >= 18)
- **数据库**: 微信云数据库
- **存储**: 微信云存储
- **测试**: Node.js 内置 `node:test` 与 `assert` 框架
- **SDK**: wx-server-sdk@3.0.1

## 📁 项目结构

```
cardory/
├── miniprogram/                 # 小程序前端代码
│   ├── app.js                   # 应用入口
│   ├── app.json                 # 应用配置
│   ├── app.wxss                # 全局样式
│   ├── components/             # 公共组件
│   │   ├── card-tile/          # 卡牌卡片组件
│   │   └── draw-result/        # 抽卡结果展示组件
│   ├── pages/                  # 页面
│   │   ├── home/               # 首页（签到+抽卡）
│   │   ├── album/              # 卡册页
│   │   ├── card-detail/        # 卡牌详情页
│   │   ├── privacy/            # 隐私政策页
│   │   └── admin/              # 管理员后台
│   │       ├── cards/          # 卡牌列表
│   │       ├── card-edit/      # 卡牌编辑
│   │       ├── config/         # 规则配置
│   │       └── logs/           # 操作日志
│   └── utils/                  # 工具函数
│       ├── api.js              # API 调用封装
│       ├── request-id.js       # 请求ID生成
│       └── format.js           # 格式化工具
├── cloudfunctions/             # 云函数
│   └── api/                    # 主云函数
│       ├── index.js            # 云函数入口
│       ├── src/                # 源代码
│       │   ├── router.js       # 统一路由
│       │   ├── errors.js       # 错误定义
│       │   ├── context.js      # 上下文管理
│       │   ├── domain/         # 领域层（纯业务逻辑）
│       │   │   ├── time.js     # 时间工具
│       │   │   ├── config.js   # 配置管理
│       │   │   ├── card-state.js # 卡牌状态
│       │   │   └── draw-engine.js # 抽卡引擎
│       │   ├── services/       # 服务层（业务编排）
│       │   │   ├── bootstrap-service.js    # 初始化服务
│       │   │   ├── sign-in-service.js      # 签到服务
│       │   │   ├── draw-service.js         # 抽卡服务
│       │   │   ├── catalog-service.js      # 卡册服务
│       │   │   ├── admin-service.js        # 管理服务
│       │   │   └── security-client.js      # 安全检测客户端
│       │   └── repositories/   # 仓储层（数据访问）
│       │       ├── cloud-repository.js   # 云数据库实现
│       │       └── memory-repository.js  # 内存实现（测试用）
│       └── test/               # 测试文件
│           ├── router.test.js
│           ├── time.test.js
│           ├── config.test.js
│           ├── card-state.test.js
│           ├── draw-engine.test.js
│           ├── sign-in-service.test.js
│           ├── draw-service.test.js
│           ├── catalog-service.test.js
│           ├── admin-service.test.js
│           ├── bootstrap-service.test.js
│           ├── cloud-repository.test.js
│           └── security-client.test.js
├── docs/                       # 项目文档
│   ├── database-schema.md      # 数据库结构
│   ├── manual-test-checklist.md # 手动测试清单
│   └── release-checklist.md    # 发布检查清单
├── project.config.json         # 项目配置文件
└── README.md                   # 项目说明
```

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- 微信开发者工具
- 微信小程序 AppID（可使用测试号）

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd cardory
   ```

2. **安装云函数依赖**
   ```bash
   cd cloudfunctions/api
   npm install
   ```

3. **运行测试**
   ```bash
   npm test
   ```

4. **导入微信开发者工具**
   - 打开微信开发者工具
   - 选择导入项目
   - 选择 `cardory` 目录
   - 填入 AppID
   - 点击导入完成

## 🎯 核心设计

### 架构特点
- **领域驱动设计**: 业务逻辑集中在 `domain/` 层，无外部依赖
- **分层架构**: 路由 → 服务 → 领域 → 仓储，职责清晰
- **接口隔离**: 通过仓储接口支持云数据库和内存两种实现
- **测试先行**: 关键业务逻辑均有单元测试覆盖

### 数据安全
- 所有关键写操作支持幂等性
- 十连抽保证整体成功或整体失败
- 管理员权限仅通过服务端 OpenID 白名单验证
- 小程序端禁止直接写入数据库

### 抽卡规则
- 四档稀有度：N、R、SR、SSR（内部编号固定，显示名称可配置）
- 同稀有度内按卡牌权重随机抽取
- 常驻卡和限定卡共用卡池
- 最高稀有度支持保底机制
- 限定卡仅在设定时间范围内可抽取

## 📊 项目目标

- **当前阶段**: 两周体验版 MVP
- **目标规模**: 100 名用户、200 张卡牌
- **产品定位**: 私人纪念卡收集体验
- **后续规划**: 可接入小游戏作为新的抽卡次数来源

## 📝 相关文档

- [需求说明书](./微信小程序抽卡需求说明书-v1.0.md) - 详细的产品需求说明
- [实施计划](./微信小程序抽卡实施计划-v1.0.md) - 完整的开发实施计划

## ⚠️ 重要说明

- 本项目为私人朋友间使用的纪念卡抽取小程序
- 所有卡牌图片需已获得明确的肖像授权
- 首版不包含小游戏、充值支付、广告等功能
- 不收集用户昵称、头像、手机号或地理位置信息
- 正式公开发布不属于本阶段验收条件

## 📄 许可证

本项目为私有项目，仅供授权用户使用。