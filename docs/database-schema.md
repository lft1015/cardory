# Cardory 数据库结构

## 集合概览

| 集合 | 说明 | 唯一性 |
|---|---|---|
| `users` | 用户档案 | `openid` 全局唯一 |
| `admins` | 管理员白名单 | `openid` 全局唯一（云控制台预置） |
| `cards` | 卡牌定义 | `_id` 自动 |
| `collections` | 用户卡册 | `(userId, cardId)` 复合唯一 |
| `rarity_config` | 稀有度与概率配置 | 单条记录（云控制台预置） |
| `draw_records` | 抽卡流水记录 | `_id` 自动 |
| `operation_records` | 幂等操作记录（签到等） | `requestHash` 唯一 |
| `admin_logs` | 管理员操作审计 | `_id` 自动 |

---

## 1. users

用户档案。小程序端不可直接写入。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 用户 ID（`crypto.randomUUID()`） |
| `openid` | string | 微信 OpenID，唯一 |
| `drawCredits` | number | 当前可用抽卡次数 |
| `pityCount` | number | 当前最高稀有度保底计数 |
| `lastSignInDate` | string \| null | 最后签到日期 `YYYY-MM-DD` |
| `createdAt` | Date | 创建时间 |

**索引：** `openid` 唯一索引。

---

## 2. admins

管理员白名单。仅通过云控制台手动添加，不提供 API 写入。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 自动 |
| `openid` | string | 管理员 OpenID |

**索引：** `openid` 普通索引。

---

## 3. cards

卡牌定义。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 自动 |
| `name` | string | 卡牌名称 |
| `rarity` | string | `N` / `R` / `SR` / `SSR` |
| `type` | string | `PERMANENT` / `LIMITED` |
| `weight` | number | 同档抽卡权重（正整数） |
| `imageUrl` | string | 卡面图片云存储路径 |
| `status` | string | `DRAFT` / `PUBLISHED` / `OFFLINE` / `FORCE_REMOVED` |
| `startsAt` | Date \| null | 限定卡开始时间 |
| `endsAt` | Date \| null | 限定卡结束时间 |
| `createdAt` | Date | 创建时间 |
| `updatedAt` | Date | 更新时间 |

**索引：** `(rarity, status)` 复合索引。

**状态枚举：**
- `DRAFT`：草稿，不可抽取
- `PUBLISHED`：已发布，常驻卡始终可抽；限定卡在时间范围内可抽
- `OFFLINE`：临时下架，不可抽取
- `FORCE_REMOVED`：强制移除，不可抽取

---

## 4. collections

用户拥有的卡牌集合。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 自动 |
| `userId` | string | 用户 ID |
| `cardId` | string | 卡牌 ID |
| `count` | number | 拥有数量 |
| `firstObtainedAt` | Date | 首次获得时间 |

**唯一性策略：** `(userId, cardId)` 复合唯一索引，通过云数据库唯一索引约束或 `upsert` 实现幂等。

---

## 5. rarity_config

稀有度概率与保底配置。单条记录，通过云控制台预置。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 自动 |
| `tiers` | array | 四档稀有度配置数组 |
| `tiers[].id` | string | `N` / `R` / `SR` / `SSR` |
| `tiers[].probabilityBps` | number | 万分比概率 |
| `tiers[].displayName` | string | 展示名称 |
| `pityLimit` | number | 保底触发阈值（正整数） |
| `updatedAt` | Date | 更新时间 |

**约束：** `probabilityBps` 合计必须为 `10000`。

---

## 6. draw_records

抽卡流水，记录每次抽卡结果。仅管理员可查询。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 自动 |
| `userId` | string | 用户 ID |
| `cardId` | string | 获得的卡牌 ID |
| `rarity` | string | 稀有度 |
| `isPity` | boolean | 是否由保底触发 |
| `createdAt` | Date | 创建时间 |

---

## 7. operation_records

非抽卡操作的幂等记录。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 自动 |
| `requestHash` | string | `sha256(userId + ':' + action + ':' + requestId)` |
| `action` | string | 操作类型（如 `signIn`） |
| `userId` | string | 用户 ID |
| `result` | object | 首次请求的返回结果快照 |
| `createdAt` | Date | 创建时间 |

**唯一性策略：** `requestHash` 唯一索引，写入失败时返回已有记录的 `result`。

---

## 8. admin_logs

管理员操作审计日志。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 自动 |
| `adminOpenid` | string | 操作者 OpenID |
| `action` | string | 操作类型 |
| `detail` | object \| null | 操作详情 |
| `createdAt` | Date | 创建时间 |