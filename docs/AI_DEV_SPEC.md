> **Implementation note (2026-11-10):** This file is the original execution
> spec. The implemented project lives in this repository; see `README.md`,
> `docs/PROGRESS.md`, and `docs/PARAMS.md` for the final state. Deviations
> from this draft: production underdog is 2.00×, production daily mint is
> 100,000 WAR, the season winner is decided by final map ownership (not daily
> win count), spectator markets are not shipped, and partners are
> “explored, not integrated.” **For submission, follow the live
> https://nearhackathon.com/HACKATHON.md, not §10.5:** the live API uses
> `leadName`, `size`, `idea`, `projectUrl` (repository) and `demoUrl` (X post),
> and `website` is a spam trap that must be omitted. Prepared draft:
> `docs/SUBMISSION.md`.

# MEME WARS — AI 驱动开发文档

> 版本: 1.0  
> 日期: 2026-11-10  
> 项目: **Meme Wars（$WAR）** — NEAR Hackathon 2026, Track 11 `memecoins`  
> 状态: Draft for AI agent execution  
> 用法: 先执行官方 `00-setup.md`，再把本文档 + 赛道 prompt 交给 AI coding agent；按 §8 的检查点推进，每个检查点必须停下等人确认。

## 来源与参考

| 内容 | 链接 |
|---|---|
| 赛道原文 | https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/11-memecoins.md |
| 黑客松规则 | https://nearhackathon.com/HACKATHON.md |
| 提交清单 | https://github.com/nearai/near-hackathon-prompt-examples/blob/main/SUBMITTING.md |
| Setup 提示 | https://github.com/nearai/near-hackathon-prompt-examples/blob/main/00-setup.md |
| 伙伴页 | https://nearhackathon.com/#partners |
| NEAR 文档索引 | https://docs.near.org/llms.txt |
| NEAR Intents 文档索引 | https://docs.near-intents.org/llms.txt |
| NEAR agent skills | `npx skills add near/agent-skills` |

---

## 0. 给 AI Agent 的硬规则（先读）

1. **不猜**版本、合约地址、API 端点、SDK 名称。用 `llms.txt` 和官方文档查，查不到就写 `TBD` 并停下来问人。
2. **先测试网，后主网。** 密钥只放 `.env`，绝不进仓库、不进命令历史、不打印。
3. **核心合约不得依赖任何伙伴 API。** 伙伴只出现在前端、脚本、AI agent、运营层；伙伴宕机不能影响游戏核心。
4. **不写后台、不写 admin、不写可改参数的方法。** 参数在 `new()` 里固定，部署后公开可读、不可修改。
5. **每个阶段结束必须停下**，汇报：改了什么、测试结果、部署地址、截图/录屏、未解决问题。等人类确认后才进入下一阶段。
6. **提交前必须展示完整 JSON payload**，等人类明确说 OK 才能发送。项目名、负责人、邮箱、团队规模、收款账户、赛道、仓库 URL、演示帖 URL、描述、同意声明，全部由人类决定。
7. **不伪造**集成、截图、数据、测试结果。没跑通的伙伴集成写 `explored, not integrated`。
8. **README 从第一天维护**，按 “do X - see Y” 写，给 AI 评委看，不写营销文案。
9. **不做价格图表、不做 AMM 作为卖点、不依赖预言机、不依赖链上随机数**（除非有可验证方案；本项目不需要）。
10. **复杂度服务于可验证性。** 每加一个机制，问一句：评委 3 分钟内能不能看懂？看不懂就砍。

---

## 1. 黑客松约束

### 1.1 赛道

- Track: **11. Memecoins With Mechanics**
- id: `memecoins`
- 标语: **“The joke needs rules.”**
- 方向: 让 meme 具有实际机制——供给随社区行为变化、金库受规则约束、链上仪式与挑战。
- 评分口径: **“Judges score the mechanic, and the price chart doesn't count.”**
- 参考: NEP-141、meme.cooking、near-smart-contracts agent skill。

### 1.2 四条硬性要求（必须在 README 里逐条给证据）

1. **NEP-141 代币**；机制写在合约内，不能依赖可被关闭的后端。
2. **目标值、增发量、销毁量在启动时设定**，任何人可读；部署后不存在可修改这些参数的管理密钥。
3. **具备演示级女巫抵抗**，并在 README 中明确说明其局限。
4. **页面展示**：当前连续天数、当日进度、每次增发和销毁的日志。

### 1.3 参数流程（评审会看）

- 先模拟 **60 天**社区行为。
- 展示多种情景下的代币供给变化。
- 再据此选择参数。
- README 里给出模拟命令、图表和“为什么是这些数”。

### 1.4 提交与评审

- 截止: **2026-11-14 23:59 UTC**。
- 仓库必须公开，README 有 “do X, see Y” 步骤，仓库有 LICENSE。
- AI 评审（Claude Code、Codex）先做 reproducibility check、feature verification、structured report、preliminary score；人类陪审最终决定。
- 演示必须由人类发在 X：写明 “built at NEAR HACKATHON”，带 `@NEARProtocol` 和 `#NEARHackathon`，附视频或截图。
- 提交 API: `POST https://nearhackathon.com/api/applications`；发送前必须人类确认；`requestId` 复用；`website` 是 honeypot，必须为空。
- 规则可能更新：提交前重读线上 `HACKATHON.md`。

---

## 2. 产品定义

### 2.1 一句话

**Meme Wars 是一个“阵营战争”memecoin：社区每天选边、押注、作战；赢家铸币、输家烧币、地图记录战果，代币供应随社区行为变化。**

### 2.2 电梯陈述

> 大多数 memecoin 只有一个价格图。Meme Wars 把“社区”本身变成游戏：两个阵营每天争夺地图，玩家用 $WAR 押注自己的阵营；赢了分新铸的币，输了被烧掉一部分。没有后台、没有管理员、没有预言机——规则全在链上，参数部署时写死。每天一场，30 天一个赛季，地图会记住谁赢了。

### 2.3 核心循环（必须先用一句话讲清）

1. **选边**：加入 DOGS 或 CATS。
2. **参战**：每天一次，把 $WAR 押进本阵营战池（有上下限）。
3. **结算**：当天结束后，战力高的一方赢；弱势方有固定加成。
4. **分配**：赢家拿回押注 + 分当日固定奖池；输家拿回 80%，20% 烧毁。
5. **占格**：赢家在地图上占一格；30 天一个赛季，格子多的一方拿金库奖金。
6. **连续**：个人连续参战、阵营连续获胜，页面展示。

### 2.4 完整版功能分层

| 层 | 内容 | 优先级 | 说明 |
|---|---|---|---|
| 核心层 | 阵营、每日押注、结算、赢家铸币、输家烧币、地图占格、连续 | P0 | 必须完整可跑 |
| 赛季层 | 30 天赛季、地图重置、赛季奖金、名人堂 | P1 | 提供长期目标 |
| 观战层 | 观众押当天胜者/是否冷场；输家池部分烧毁 | P1 | 让不参战的人也能玩 |
| 公会层 | 组队、公会战力、内部分成、跳槽成本 | P2 | 增加社交 |
| 角色层 | 先锋/守将/间谍等固定角色，每天选一种 | P2 | 增加策略，不引入随机数 |

**原则**：主菜只能有一个。评委记住的必须是“选边、参战、赢地图”，其他层是加菜，不能盖过主菜。

### 2.5 参数表（示例值，最终由模拟决定）

| 参数 | 示例 | 范围/说明 |
|---|---:|---|
| `day_length_ns`（正式） | 86_400_000_000_000 | 24h；UTC 对齐或启动后滚动 |
| `day_length_ns`（演示） | 60_000_000_000 | 60s 一天，单独部署，README 标注 |
| `season_days` | 30 | 7–90 |
| `daily_mint_pool` | 500,000 WAR | 占创世供应 0.05%/天，待模拟 |
| `loss_burn_bp` | 2000 (20%) | 0–5000 |
| `underdog_bonus_bp` | 15000 (1.5x) | 10000–20000 |
| `cold_line` | 5,000,000 WAR | 当日总战力低于此值算冷场 |
| `cold_burn` | 1,000,000 WAR | 冷场从金库烧毁 |
| `min_stake` | 1,000 WAR | 防零成本小号 |
| `max_stake_per_day` | 100,000 WAR | 单人单日上限 |
| `streak_step_bp` | 500 (5%) | 每连续一天加成 |
| `streak_cap_days` | 20 | 最高 2x |
| `claim_window_days` | 7 | 领取窗口 |
| `season_bonus_bp` | 500 (5%) | 赛季奖金占金库比例 |
| `market_burn_bp` | 200 (2%) | 观战市场输家池烧毁比例 |
| `faction_switch_burn` | 10,000 WAR | 换阵营烧毁（可选） |

**创世分配（示例）**：

- 总供应：1,000,000,000 WAR
- 金库：200,000,000 WAR（20%，由合约持有，按规则烧毁/发赛季奖金）
- 社区/发射：800,000,000 WAR（80%，通过 meme.cooking 或测试网 faucet）
- 演示部署：`demo_mode = true`，允许每个账户领一次 starter 包（仅演示；正式部署 `demo_mode = false`，无 faucet）

### 2.6 供应与金库规则

供应变化只来自四条线，全部可在页面看到：

1. **赢家铸币**：每个成功结算日，铸造 `daily_mint_pool` 到奖励金库，赢家按战力占比领取。
2. **输家烧币**：结算时，输家总押注的 `loss_burn_bp` 立即从总供应中烧毁；输家可领回剩余部分。
3. **冷场烧金库**：当日总战力低于 `cold_line`，所有押注原路退回，金库烧 `cold_burn`，双方连胜清零。
4. **赛季奖金**：赛季结束，格子多的一方从金库获得 `season_bonus_bp`，按赛季战力分给该阵营参与者。

**不变量**：

- `sum(available_balances) + locked_total + treasury_balance + reward_vault + season_reward_vault == total_supply`
- 任何时刻 `total_supply >= 0`，任何账户余额 `>= 0`
- 锁定的押注不能被 `ft_transfer` 转走
- 结算 `settle_day(day)` 幂等；重复调用不改变状态
- 每天每账户只能 enlist 一次
- 每个 enlistment 只能 claim 一次 stake / reward
- 参数在 `new()` 后不可变

### 2.7 防女巫设计与局限

**链上措施**：

- **押注有成本**：每次参战必须锁定 ≥ `min_stake` 的 $WAR；输了烧 `loss_burn_bp`。
- **单人单日上限**：`max_stake_per_day` 限制单账户影响；多账户需要多份资本。
- **固定奖池**：每日铸币固定，账户越多每人分得越少；堆号不增加总收益。
- **连续加成**：新账户从 1x 开始，长期账户最高 2x；养号需要时间。
- **弱势方加成**：结算时较弱一方获得固定 `underdog_bonus_bp` 战力加成，抑制一边倒和堆号。
- **赛季奖金按战力**：不是按人头平均，小号收益低。

**README 必须写明的局限**：

- 链上无法识别“一人多号”；以上只是提高成本，不是完全防止。
- 女巫可以用多账户同时押两边对冲，但会损失烧毁部分；不是无风险套利。
- 极端情况下，资本充足的玩家仍可影响战局；模拟里给出“30% 小号”情景的结果。
- 演示 faucet 只存在于 `demo_mode` 部署；正式部署没有免费代币，押注成本是真实的。

---

## 3. 系统架构

### 3.1 组件

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  Battle / Map / Season / Markets / Prophet / About           │
│  Wallet Selector / HOT (optional) / Intents buy flow         │
└───────────────┬──────────────────────────────┬──────────────┘
                │ RPC view/call                 │ events / log
                ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Meme Wars contract (Rust, near-sdk)             │
│  NEP-141 + factions + daily battle + settlement + claims     │
│  config immutable, no admin, no backend                      │
└───────────────┬─────────────────────────────────────────────┘
                │
     ┌──────────┴──────────┬──────────────────┐
     ▼                     ▼                  ▼
┌──────────┐        ┌─────────────┐   ┌──────────────┐
│ Treasury │        │ Reward vault│   │ Season vault │
│ (rules)  │        │ (claims)    │   │ (claims)     │
└──────────┘        └─────────────┘   └──────────────┘

Off-chain (optional, never controls the game):
- Simulation (Python) → params + charts
- AI War Prophet → NEAR.AI / BRRRAIN / OutLayer → prediction JSON
- Seed script → demo activity
```

### 3.2 环境

| 环境 | 网络 | `day_length` | `demo_mode` | 用途 |
|---|---|---:|---|---|
| dev | local sandbox | 60s | true | 本地测试 |
| demo | testnet | 60s | true | 评委 5 分钟看完整循环 |
| prod-testnet | testnet | 24h | false | 真实参数验证 |
| mainnet | mainnet | 24h | false | 可选；通过 meme.cooking 或直接部署 |

### 3.3 关键数据流

1. 用户钱包 → `storage_deposit`（首次）→ `join_faction` → `enlist(stake)`。
2. `enlist` 内部：自动结算之前未结算的日（最多 `MAX_SETTLE_DAYS`）→ 扣可用余额 → 记录 `Enlistment` → 更新当日阵营/个人连续/赛季战力 → emit `enlist`。
3. 任何人（通常是前端）在日结束后调用 `settle_day(day)`：计算胜者 → 烧输家部分 → 铸奖池 → 占格 → 更新连胜/赛季 → emit `day_settled`。
4. 用户调用 `claim_stake(day)` / `claim_reward(day)` / `claim_season(season)`；前端自动批量调用。
5. 前端读 `get_day`、`get_faction`、`get_map`、`get_member`、`get_log` 渲染。

### 3.4 目录结构（建议）

```
meme-wars/
├── README.md
├── LICENSE
├── .env.example
├── .gitignore
├── contracts/
│   └── meme-wars/
│       ├── Cargo.toml
│       ├── src/
│       │   ├── lib.rs
│       │   ├── nep141.rs
│       │   ├── game.rs
│       │   ├── settlement.rs
│       │   ├── markets.rs
│       │   ├── events.rs
│       │   ├── views.rs
│       │   └── types.rs
│       └── tests/
├── frontend/
│   ├── package.json
│   └── src/
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── hooks/
├── sim/
│   ├── simulate.py
│   ├── scenarios/
│   └── results/
├── scripts/
│   ├── deploy.sh
│   ├── seed-demo.ts
│   ├── settle.ts
│   └── verify.sh
├── config/
│   ├── demo.json
│   └── prod.json
└── docs/
    ├── AI_DEV_SPEC.md
    ├── PARAMS.md
    ├── PARTNERS.md
    └── PROGRESS.md
```

---

## 4. 合约规格

### 4.1 标准与方法

**NEP-141（必须）**：

- `ft_transfer(receiver_id, amount, memo?)`
- `ft_transfer_call(receiver_id, amount, memo?, msg)`
- `ft_balance_of(account_id) -> U128`
- `ft_total_supply() -> U128`
- `ft_metadata() -> FungibleTokenMetadata`
- `storage_deposit(account_id?, registration_only?)`
- `storage_withdraw(amount)`
- `storage_balance_of(account_id) -> StorageBalance`
- `ft_resolve_transfer`（`#[private]`，标准参考实现）

**游戏方法**：

- `new(config: Config) -> Self`（唯一初始化入口；参数写死）
- `join_faction(faction: u8)`（0 = DOGS, 1 = CATS）。MVP 不允许换边，只能调一次；若开启换边（P2），`season_power` 必须按 `(season, faction, account)` 存储，否则赛季奖金分配会错。
- `enlist(stake: U128)`（每天一次；押注；自动结算前几日）
- `settle_day(day: u64)`（任何人可调；日结束后；幂等；按顺序）
- `claim_stake(day: u64)`
- `claim_reward(day: u64)`
- `claim_season(season: u32)`（P1）
- `close_claims(day: u64)`（可选；窗口后烧未领取奖励）
- 观战市场（P1）：`bet(day, kind, side, amount)`、`claim_market(day, kind)`

**只读方法**：

- `get_config()`
- `get_member(account_id)`
- `get_faction(faction: u8)`
- `get_day(day: u64)`
- `get_current_day()`
- `get_map()`
- `get_season(season: u32)`
- `get_log(from: u64, limit: u64)`
- `get_locked_balance(account_id)`
- `get_total_balance(account_id)`

**禁止**：任何 `set_*`、`update_config`、`pause`、`upgrade`、`withdraw_treasury` 的管理方法。

### 4.2 状态模型

```rust
pub struct Config {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub genesis_supply: U128,
    pub treasury_allocation: U128,
    pub community_allocation: U128,
    pub demo_faucet_pool: U128,
    pub day_length_ns: u64,
    pub epoch_start_ns: u64,
    pub season_days: u32,
    pub daily_mint_pool: U128,
    pub loss_burn_bp: u32,        // 2000 = 20%
    pub underdog_bonus_bp: u32,   // 15000 = 1.5x
    pub cold_line: U128,
    pub cold_burn: U128,
    pub min_stake: U128,
    pub max_stake_per_day: U128,
    pub streak_step_bp: u32,      // 500 = 5%
    pub streak_cap_days: u32,     // 20
    pub claim_window_days: u32,   // 7
    pub season_bonus_bp: u32,     // 500 = 5%
    pub market_burn_bp: u32,      // 200 = 2%
    pub demo_mode: bool,
}

// 初始化时必须满足：
// genesis_supply == treasury_allocation + community_allocation + demo_faucet_pool
// 正式部署：demo_mode = false，demo_faucet_pool = 0
// new() 里把 community_allocation 记到部署者可用余额；treasury_allocation 记到金库；
// demo_faucet_pool 记到固定 faucet 池（只减不增，领完为止）。

pub struct Member {
    pub faction: u8,
    pub last_enlist_day: u64,
    pub streak: u32,
    pub longest_streak: u32,
    pub joined_day: u64,
}

pub struct FactionState {
    pub id: u8,
    pub win_streak: u32,
    pub longest_win_streak: u32,
    pub season_tiles: u8,
}

pub struct DayState {
    pub day: u64,
    pub start_ns: u64,
    pub total_power: [U128; 2],
    pub total_stake: [U128; 2],
    pub contributors: [u32; 2],
    pub winner: Option<u8>,
    pub cold: bool,
    pub settled: bool,
    pub reward_pool: U128,
    pub base_power_winner: U128,
    pub burned: U128,
    pub tile: Option<u8>,
    pub claimed_reward: U128,
}

pub struct Enlistment {
    pub faction: u8,
    pub stake: U128,
    pub streak_mult_bp: u32,
    pub power: U128, // stake * streak_mult_bp / 10000
    pub claimed_stake: bool,
    pub claimed_reward: bool,
}

pub struct SeasonState {
    pub season: u32,
    pub start_day: u64,
    pub end_day: u64,
    pub winner: Option<u8>,
    pub bonus_pool: U128,
    pub total_power: [U128; 2],
    pub settled: bool,
}
```

**存储**：

- `accounts: LookupMap<AccountId, Account>`
- `members: LookupMap<AccountId, Member>`
- `days: LookupMap<u64, DayState>`
- `enlistments: LookupMap<(u64, AccountId), Enlistment>`
- `season_power: LookupMap<(u32, AccountId), U128>`
- `seasons: LookupMap<u32, SeasonState>`
- `log: Vector<LogEntry>`（环形或最多 200 条，供 UI 读取；同时 emit NEP-297 事件）
- `treasury_balance`, `reward_vault`, `season_reward_vault`, `locked_total`, `total_supply`
- `last_settled_day: Option<u64>`
- `current_season: u32`
- `map: [u8; 25]`

### 4.3 每日生命周期

```
Day D 开始
  │
  ├─ 用户 join_faction（一次性）
  ├─ 用户 enlist(stake)：每天一次
  │    ├─ 自动 settle_day(D-1) 及更早未结算日（最多 MAX_SETTLE_DAYS）
  │    ├─ 计算新 streak、multiplier、power
  │    ├─ 扣 available balance，locked_total += stake
  │    ├─ 记录 Enlistment(day=D, account)
  │    ├─ day.total_power[faction] += power
  │    ├─ day.total_stake[faction] += stake
  │    ├─ season.total_power[faction] += power
  │    └─ emit enlist
  │
Day D 结束
  │
  ├─ 任何人 settle_day(D)
  │    ├─ 计算 base power；若一方较弱，给 underdog bonus
  │    ├─ 若 total_power < cold_line：冷场 → 退全部押注、烧 cold_burn、清零双方连胜
  │    ├─ 若平局：退全部押注、清零双方连胜
  │    ├─ 若胜者：烧输家总押注的 loss_burn_bp；铸 daily_mint_pool 到 reward_vault
  │    ├─ 赢家占 tile = D % 25；更新阵营连胜/赛季格子
  │    ├─ 若 (D+1) % season_days == 0：结算赛季
  │    ├─ last_settled_day = Some(D)
  │    └─ emit day_settled / reward_mint / stake_burn / map_capture
  │
Day D+1 起
  │
  ├─ 赢家 claim_stake(D) + claim_reward(D)
  ├─ 输家 claim_stake(D)（80%）
  └─ 赛季结束 → claim_season(season)
```

### 4.4 结算与领取（O(1)，不遍历参与者）

这是本合约最重要的工程约束：**结算和领取都不能遍历当日参与者**，否则会被 gas 卡死。

**结算时只更新聚合值**：

- 计算 `base_power[0]`、`base_power[1]`（enlist 时已累计）。
- 弱势方乘 `underdog_bonus_bp`，得到 `effective_power`，比较胜负。
- 冷场/平局：押注全额可领回。
- 胜者：`burn = day.total_stake[loser] * loss_burn_bp / 10000`；从 `locked_total` 和 `total_supply` 扣除；铸 `daily_mint_pool` 到 `reward_vault`；记录 `day.reward_pool`、`day.base_power_winner`。
- 不逐个返还押注、不逐个发奖励。

**领取时按个人记录计算**：

- `claim_stake(day)`：
  - 冷场/平局/胜方：`stake`。
  - 输方：`stake * (10000 - loss_burn_bp) / 10000`。
  - 从 `locked_total` 扣除，加回 `available balance`。
- `claim_reward(day)`：
  - 仅胜方；`share = day.reward_pool * enlistment.power / day.base_power_winner`。
  - 从 `reward_vault` 扣除，加回 `available balance`；累加 `day.claimed_reward`。
- 取整误差留在 `reward_vault`；赛季结束时按固定规则处理（滚入下季或烧毁，二选一写死）。

**为什么可行**：输家烧毁是聚合值（`total_stake[loser]`），个人领回 80% 是个人记录；赢家奖励按个人 power 占胜方总 power 的比例；都不需要遍历。

### 4.5 数学与不变量

所有金额用 `U128`，比例用 basis points（10000 = 100%），不用浮点。

**连续加成**：

```
new_streak = if last_enlist_day + 1 == current_day { streak + 1 } else { 1 }
multiplier_bp = 10000 + min(new_streak, streak_cap_days) * streak_step_bp
power = stake * multiplier_bp / 10000
```

**弱势方加成**：

```
if base_power[0] < base_power[1]:
    effective[0] = base_power[0] * underdog_bonus_bp / 10000
    effective[1] = base_power[1]
elif base_power[1] < base_power[0]:
    effective[0] = base_power[0]
    effective[1] = base_power[1] * underdog_bonus_bp / 10000
else:
    effective = base_power
winner = argmax(effective); tie => None
```

**奖励份额**：用 base power 比例，underdog 加成不影响个人分成（否则要额外存储）。`share = reward_pool * power_i / base_power_winner`。

**示例**：

- Alice 押 10,000 WAR，连续 10 天：multiplier = 1 + 10×5% = 1.5；power = 15,000。
- 胜方总 base power = 1,000,000；当日奖池 = 500,000。
- Alice 奖励 = 500,000 × 15,000 / 1,000,000 = 7,500 WAR。
- 若 Alice 在输方：拿回 8,000 WAR，2,000 WAR 被烧（聚合烧毁）。

### 4.6 事件（NEP-297）

所有事件用 `EVENT_JSON:` 前缀：

```json
EVENT_JSON:{"standard":"meme-wars","version":"1.0.0","event":"enlist","data":{"day":1,"account":"alice.near","faction":0,"stake":"10000","streak":10,"multiplier_bp":15000,"power":"15000"}}
```

事件列表：

| event | 关键字段 |
|---|---|
| `enlist` | day, account, faction, stake, streak, multiplier_bp, power |
| `day_settled` | day, winner, cold, total_power, total_stake, reward_pool, burned, tile |
| `reward_mint` | day, amount |
| `stake_burn` | day, faction, amount |
| `cold_day` | day, cold_burn |
| `map_capture` | day, faction, tile |
| `stake_claim` | day, account, amount |
| `reward_claim` | day, account, amount |
| `season_end` | season, winner, bonus_pool, total_power |
| `season_claim` | season, account, amount |
| `market_bet` | day, kind, account, side, amount |
| `market_settle` | day, kind, outcome, pool_yes, pool_no, burned |
| `market_claim` | day, kind, account, amount |

同时把最近 200 条写入 `log: Vector<LogEntry>`，供前端 `get_log(from, limit)` 读取；生产环境可换成 indexer，但事件格式不变。

### 4.7 存储与押金

- 新账户必须先 `storage_deposit` 注册；UI 用多 action 交易或两步交易。
- 每次 `enlist` 写一条 `Enlistment`；建议要求 `claim_window_days` 内领取，窗口后可 `close_claims` 把未领取奖励烧掉/滚入下季（固定规则）。
- `enlistments` 按 `(day, account)` 存储；这是 hackathon 规模可接受的方案。README 写明主网扩展限制（未来可改 Merkle claim）。
- 合约账户需要足够 NEAR 支付状态存储；部署前估算并充值。演示 faucet 只存在于 `demo_mode`。

### 4.8 安全与不可变性

- **无 admin**：没有 `set_config`、`pause`、`upgrade`、`withdraw`。`new()` 只能调一次。
- **生产不可升级**：部署后移除合约账户的所有 full-access key（用 `near account delete-key` 或等价命令），README 记录交易哈希；测试网可保留 key 迭代，但必须标注。
- **无外部调用**：核心路径（enlist/settle/claim）不调用其他合约；NEP-141 `ft_transfer_call` 用标准参考实现 + `#[private]` 回调。
- **无随机数/预言机**：结果完全由链上状态决定。
- **无无界循环**：`enlist` 自动结算最多 `MAX_SETTLE_DAYS`（建议 7）；`settle_day` 一次只结算一天；`claim` 一次一天。
- **溢出**：用 `checked_*` 或 `near_sdk::json_types::U128` + 安全数学库；所有 `bp` 计算先乘后除，注意顺序。
- **重入**：核心无跨合约调用；`ft_resolve_transfer` 严格按标准实现。
- **存储 griefing**：标准 `storage_deposit`；每条记录有最低押金；不允许匿名批量写。
- **日志**：`log` 是 bounded；超出覆盖最旧，避免无限增长。

### 4.9 Rust 接口骨架

```rust
#[near(contract_state)]
pub struct Contract { /* 见 4.2 */ }

#[near]
impl Contract {
    #[init]
    pub fn new(config: Config) -> Self { /* assert no admin; set epoch */ }

    // NEP-141
    pub fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) { /* ... */ }
    pub fn ft_transfer_call(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>, msg: String) -> Promise { /* ... */ }
    pub fn ft_balance_of(&self, account_id: AccountId) -> U128 { /* ... */ }
    pub fn ft_total_supply(&self) -> U128 { /* ... */ }
    pub fn ft_metadata(&self) -> FungibleTokenMetadata { /* ... */ }

    // Game
    pub fn join_faction(&mut self, faction: u8) { /* ... */ }
    pub fn enlist(&mut self, stake: U128) { /* auto settle; record; emit */ }
    pub fn settle_day(&mut self, day: u64) { /* aggregate; idempotent */ }
    pub fn claim_stake(&mut self, day: u64) { /* ... */ }
    pub fn claim_reward(&mut self, day: u64) { /* ... */ }

    // Views
    pub fn get_config(&self) -> Config { /* ... */ }
    pub fn get_member(&self, account_id: AccountId) -> Option<Member> { /* ... */ }
    pub fn get_day(&self, day: u64) -> Option<DayState> { /* ... */ }
    pub fn get_map(&self) -> Vec<u8> { /* ... */ }
    pub fn get_log(&self, from: u64, limit: u64) -> Vec<LogEntry> { /* ... */ }
}
```

**实现顺序**：NEP-141 标准 → config/state → join → enlist → settle 胜负/冷场/平局 → claims → map/season → events/log → markets（P1）。

---

## 5. 前端规格

### 5.1 技术栈

- Next.js（App Router）+ React + TypeScript + Tailwind CSS。
- NEAR 连接：`@near-wallet-selector/*`（MyNearWallet、Meteor、HOT 等），或 `near-kit`；版本从文档确认，不猜。
- 链上读取：`near-api-js` / `near-kit` 的 view 调用；写调用用 wallet selector。
- 图表：轻量 SVG/CSS；可选 Recharts。
- 部署：Vercel / Netlify / 静态导出；演示 URL 公开到评审结束（至少 11 月 18 日，最好 25 日）。

### 5.2 页面与组件

| 页面 | 内容 |
|---|---|
| `/` Battle | 拔河条、倒计时、选边、押注、个人连续、最近日志 |
| `/map` | 5×5 地图、赛季进度、格子归属 |
| `/season` | 赛季奖金、阵营连胜、名人堂/历史 |
| `/markets` | 观战市场（P1） |
| `/prophet` | AI War Prophet 每日预测（P1，可选） |
| `/about` | 规则、合约地址、模拟结果、女巫局限、README 链接 |

组件：`WalletButton`、`FactionPicker`、`TugOfWarBar`、`DayCountdown`、`EnlistForm`、`StreakCard`、`EventLog`、`MapGrid`、`SeasonProgress`、`MarketCard`、`DemoBanner`、`TxToast`。

**视觉**：深色底；DOGS 橙红、CATS 青蓝；地图格子有归属色；拔河条实时动画；倒计时醒目；移动端优先。

### 5.3 数据读取与日志

- 每 3–5 秒轮询 `get_day(current)`、`get_faction`、`get_map`、`get_member`；或在日结束时刷新。
- 日志优先读 `get_log(from, limit)`；同时可接 NEAR Query API / FastNEAR 的 NEP-297 事件。
- 结算按钮：前端在 `current_day` 变化后自动调用 `settle_day(previous_day)`；失败时提示用户手动重试。
- 领取：结算后显示 “Claim stake / Claim reward”，一键批量领取最近 N 天（N ≤ 7，避免 gas 过大）。

### 5.4 演示模式

- 演示部署使用 `day_length_ns = 60s`，页面顶部固定横幅：  
  **“Accelerated demo: 1 day = 60 seconds. Production uses 24 hours. Parameters are fixed at launch.”**
- 演示部署 `demo_mode = true`：每个账户可领一次 starter 包（例如 100,000 WAR），仅用于演示；正式部署无 faucet。
- 演示页提供 “Seed demo activity” 按钮/脚本说明，让评委看到两边都有活动；seed 数据必须标注为演示数据。

### 5.5 验收路径（README 必须写）

1. 打开演示 URL → 连接测试网钱包。
2. 点 “Get test WAR” → 看到余额（仅 demo）。
3. 选择 DOGS → 看到阵营徽章。
4. 押 1,000 WAR → 看到锁定金额、拔河条变化。
5. 等 60 秒 → 页面自动结算 → 看到胜者、铸币/烧币日志、地图格子变色。
6. 点 “Claim” → 看到余额增加、日志新增 `reward_claim`。
7. 打开 `/map` → 看到本日格子归属。
8. 运行 `python sim/simulate.py` → 看到 60 天模拟图。

---

## 6. 60 天模拟

### 6.1 目标

在写死参数前，用模拟回答三个问题：

1. 供应会不会失控通胀/通缩？
2. 金库能撑多久？冷场会不会把金库烧穿？
3. 女巫在什么比例下仍然无利可图？

### 6.2 情景（至少 4 个）

| 情景 | 设定 |
|---|---|
| Balanced | 200 名玩家，50/50 阵营，日参与率 60%，押注对数正态 |
| Imbalance | 300 名玩家，70/30 阵营，日参与率 55% |
| Sybil raid | 一方额外 30% 小号，连续 10 天，每号最低押注 |
| Cold start | 30 名玩家，40% 参与率，前 10 天 |
| Churn | 每周 20% 玩家流失（可选） |

### 6.3 变量与输出

**输入变量**：玩家数、阵营分布、参与率、押注分布、连续天数分布、女巫比例、`daily_mint_pool`、`loss_burn_bp`、`underdog_bonus_bp`、`cold_line`、`cold_burn`、`season_bonus_bp`。

**输出**：

- 每日/累计：`total_supply`、`treasury_balance`、`reward_vault`、`burned_total`。
- 战局：胜率、平局/冷场天数、地图归属、赛季赢家。
- 玩家：人均奖励、输家损失、女巫 ROI、奖励集中度（Gini）。
- 参数敏感性：每个参数 ±20% 的曲线。

**图表**：供应曲线、金库曲线、胜率、冷场天数、女巫 ROI。保存到 `sim/results/`，README 引用。

### 6.4 参数选择标准（建议）

- Balanced 情景胜率在 35%–65%，不出现 90% 一边倒。
- 金库在 base 情景下 ≥ 180 天不归零；冷场天数 5%–20%。
- 年化通胀在 base 情景 < 30%；sybil 情景下女巫 ROI < 0（含烧毁和机会成本）。
- 赛季奖金不会让金库一次性耗尽；`season_bonus_bp` ≤ 10%。
- 所有参数在 `config` 中公开；README 给出最终值和模拟证据。

### 6.5 交付物

- `sim/simulate.py`：可复现，固定 seed，输出 CSV/JSON/PNG。
- `sim/scenarios/*.json`：情景配置。
- `docs/PARAMS.md`：最终参数、选择理由、敏感性分析。
- README “60-day simulation” 一节：命令 + 图表 + 结论。

**注意**：模拟公式必须与合约公式一致；用一组单元测试交叉验证（例如同一输入下 Python 和 Rust 结果相同）。

---

## 7. 伙伴依赖与集成矩阵

### 7.1 原则

1. **核心合约不依赖伙伴**：所有伙伴都是前端/脚本/AI agent/运营层适配器；伙伴宕机不影响 `enlist/settle/claim`。
2. **不伪造集成**：只有真实跑通、有截图/交易哈希的才算；没跑通写 `explored, not integrated`。
3. **不为了凑伙伴而加复杂度**：赛道规则明确说伙伴集成不是强制项；机制分才是主分。
4. **伙伴不得获得游戏管理权**：没有任何伙伴合约或账户能修改参数、暂停游戏、提取金库。
5. **所有外部调用都有 fallback**：Intents 失败 → 直连 NEAR swap；HOT 失败 → Wallet Selector；NEAR.AI 失败 → BRRRAIN 或本地缓存预测。

### 7.2 集成矩阵

| 伙伴 | 优先级 | 角色 | 集成位置 | 文档 | Fallback |
|---|---|---|---|---|---|
| **meme.cooking** | P0 | Memecoin 发射/曝光 | 上线流程/代币页 | https://docs.meme.cooking/ · https://api.meme.cooking/ | 自部署 NEP-141；README 说明 |
| **NEAR Intents** | P1 | 跨链买 $WAR / 充值 | 前端 buy flow | https://docs.near-intents.org/ · 1Click API | Rhea / Ref swap |
| **HOT** | P1 | 链抽象登录/跨链账户 | 前端钱包连接 | https://docs.hotdao.ai/ · https://docs.hotdao.ai/llms.txt | Wallet Selector |
| **Rhea** | P1 | $WAR/NEAR 流动性 | DEX 池/买币入口 | https://guide.rhea.finance/ · `/llms.txt` | meme.cooking 的 Ref 池 |
| **NEAR.AI** | P1 | AI War Prophet 私有推理 | `prophet/` 脚本 | https://docs.near.ai/cloud/quickstart.md | BRRRAIN / 本地预测缓存 |
| **BRRRAIN** | P2 | AI API / Power 配额 | `prophet/` 脚本 | https://brrrain.fun/docs/ · API `https://api.brrrain.fun/v1` | NEAR.AI |
| **OutLayer** | P2 | AI agent 安全签名/托管 | War Prophet 钱包 | https://app.outlayer.ai/docs/getting-started | 测试网本地 key（仅 demo） |
| **Agent Market** | P2 | 上架 War Prophet agent | 市场 listing | https://docs.market.near.ai/list-your-agent.md | 不上架，README 说明 |
| **Trezu** | P2 | 团队多签金库（运营） | 运营资金 | https://github.com/NEAR-DevHub/trezu-docs | 普通多签 |
| **SputnikDAO** | P2 | 社区 grants/宣传基金 | 运营 | https://github.com/near-daos/sputnik-dao-contract#setup | 无 |
| **NEAR Business** | P2 | 机密多签金库（运营） | 运营资金 | https://docs.business.near.com/ | Trezu |
| **Aurora** | P2 | EVM 镜像/跨链入口 | 可选 | https://doc.aurora.dev/ | 不做 |
| **HEX** | P2 | 跨链兑换替代 | 前端 buy flow 备选 | https://hot-labs.gitbook.io/hex/concepts-and-systems/interactive-blocks | NEAR Intents |
| **SVRN** | — | 主权技术 | 不使用 | https://svrn.net/research/near-protocol | — |
| **GoMining** | — | 比特币挖矿 | 不使用 | https://docs.gomining.com/ | — |
| **Gulf Labs** | — | 投资机构 | 不使用 | https://gulf-labs.com/ | — |
| **NEAR Builders** | — | 社区 | 宣传/反馈 | https://nearbuilders.org/build | — |

### 7.3 P0：meme.cooking（关键决策）

**目标**：用 meme.cooking 发射/曝光 $WAR，同时不破坏“合约内 mint/burn”的硬性要求。

**必须先验证的问题**：

1. meme.cooking 是否允许使用自己的 NEP-141 合约，还是只能用它生成的代币合约？
2. 如果只能用它生成的代币：该代币是否有 mint/burn 权限？能否把 minter 角色交给我们的游戏合约？
3. 是否支持测试网？如果不支持，演示用自部署合约，主网再考虑。

**两种可行架构**：

- **A. 单合约（推荐）**：游戏合约本身就是 NEP-141，原生 mint/burn。meme.cooking 仅作为发射/曝光渠道（如果平台支持导入；不支持就不强求）。README 说明“我们的机制需要原生 mint/burn，因此使用自部署 NEP-141；meme.cooking 集成情况：explored/…”。
- **B. 双合约（兼容发射平台）**：meme.cooking 生成代币；我们的游戏合约持有 minter/burner 权限（由不可变的游戏合约控制，不由人控制）。游戏合约调用 token 的 `mint`/`burn`。缺点：多一个合约、多一层权限、实施更复杂；只有在 A 不可行时采用。

**禁止**：让人类多签或 admin 持有 mint 权限；这违反硬性要求 2。

**验收**：代币页/合约地址公开；`get_config` 与 README 一致；mint/burn 只能由规则触发。

### 7.4 P1：NEAR Intents（跨链买币）

**目标**：让非 NEAR 用户也能买 $WAR 并参战。

**流程（以 1Click API 为准）**：

1. `GET supported tokens` 确认 $WAR 在支持列表；不在则先加流动性/登记。
2. `Request a swap quote`：输入资产、输出 $WAR、金额、滑点、收款地址。
3. 向报价返回的存款地址转入资产；有 memo 必须带。
4. 轮询 `Check swap status`；成功后前端提示“已到账，去参战”。
5. API key 放 `.env`；前端不要暴露 secret；生产用后端代理或签名 URL（仅用于报价，不托管资金）。

**文档**：https://docs.near-intents.org/integration/distribution-channels/1click-api/about-1click-api  
**OpenAPI**：https://1click.chaindefuser.com/docs/v0/openapi.yaml  
**验收**：从至少一条外部链买到 $WAR；给出交易哈希/截图；失败时回退到 Rhea/Ref。

### 7.5 P1：HOT（链抽象登录）

**目标**：让用户用一条链的账户登录并参战，减少 onboarding 摩擦。

**步骤**：

1. 读 `https://docs.hotdao.ai/llms.txt`，找当前 SDK/接入方式；不要猜包名。
2. 如果存在官方 SDK：接 Wallet Selector 的 HOT 适配器/连接器；测试登录、签名、切换账户。
3. 如果没有稳定 SDK：在 README 写 `explored, not integrated`，保留 Wallet Selector 作为主路径；不要伪造集成。

**验收**：HOT 登录 → 读余额 → 成功 `enlist`；或明确记录未集成原因。

### 7.6 P1：Rhea（流动性）

**目标**：给 $WAR 提供买入口，方便新用户参战（不是价格卖点）。

**步骤**：

1. 读 `https://guide.rhea.finance/llms.txt` 和 CLI trading 文档。
2. 创建 $WAR/NEAR 池（如果平台支持无许可建池）；注入初始流动性（团队/金库资金，需人类确认）。
3. 前端“Buy $WAR”按钮指向 Rhea/Ref 池；不把价格图作为卖点。
4. 如果建池不可行，使用 meme.cooking 发射后的 Ref 池。

**验收**：池子存在、可 swap；README 写明池地址和风险（流动性、滑点）。

### 7.7 P1：NEAR.AI / BRRRAIN（AI War Prophet）

**目标**：给项目一个“AI 驱动”的叙事：一个链下 AI agent 每天分析战局，发布预测；它可以有自己的钱包参战，但**没有任何管理权限**。

**数据**：读 `get_day`、`get_faction`、`get_member`、`get_log`、历史赛季；特征：双方战力、连续、押注分布、冷场线、underdog 加成、近期胜率。

**推理**：

- 首选 NEAR.AI Cloud（私有推理）：https://docs.near.ai/cloud/quickstart.md。
- 备选 BRRRAIN（OpenAI 兼容）：`https://api.brrrain.fun/v1/chat/completions`，需要持有 BRRRAIN 的账户创建 `brrr_...` key；文档：https://brrrain.fun/docs/。
- 输出：`frontend/public/prophet.json`（日期、预测阵营、置信度、理由、模型、时间戳）。脚本定时生成；不参与链上结算。

**Agent 钱包（可选）**：用 OutLayer 的 agent custody/signing 给 Prophet 一个独立钱包；它用普通用户路径 `join_faction/enlist`，没有特殊方法。不要用团队主钱包。

**验收**：`/prophet` 页面展示当日预测；预测与实际结果对比日志；README 说明“AI 是玩家/分析师，不是管理员”。

### 7.8 P2 / 运营层

- **Trezu / NEAR Business**：团队运营资金多签；不接入游戏合约。
- **SputnikDAO**：社区 grants/宣传基金；可选的社区治理，不改变游戏参数。
- **Agent Market**：把 War Prophet 上架为可雇用 agent；按 `list-your-agent.md` 操作。
- **Aurora**：EVM 镜像/跨链入口；需要单独的 EVM 代币合约，非核心，时间够再做。
- **HEX**：跨链兑换备选；如果 Intents 不可用再评估。

### 7.9 不使用的伙伴及原因

- **SVRN**：文档/可用性不确定；与核心机制无关。
- **GoMining**：比特币挖矿，与 memecoin 战争机制无关。
- **Gulf Labs**：投资机构，不是技术依赖。
- **NEAR Builders**：社区资源，用于反馈/宣传，不是代码依赖。

### 7.10 集成验收（写进 README）

| 伙伴 | 状态 | 证据 |
|---|---|---|
| meme.cooking | integrated / explored | 代币页 URL、交易哈希 |
| NEAR Intents | integrated / explored | swap 交易哈希、截图 |
| HOT | integrated / explored | 登录录屏 |
| Rhea | integrated / explored | 池地址 |
| NEAR.AI / BRRRAIN | integrated / explored | `prophet.json`、API 响应截图 |
| OutLayer / Agent Market | integrated / explored | agent 地址/listing URL |
| Trezu / NEAR Business / SputnikDAO | ops only | 多签地址（如公开） |

**规则**：没有证据的不要写 “integrated”；评审会点开看。

---

## 8. AI 开发工作流

### 8.1 角色

| 角色 | 职责 |
|---|---|
| Orchestrator（主 agent） | 读规则、拆任务、维护 PROGRESS.md、在检查点停下 |
| Contract agent | Rust 合约、测试、部署脚本 |
| Frontend agent | Next.js 页面、钱包、日志、演示 |
| Simulation agent | Python 模拟、图表、参数建议 |
| Docs/Submission agent | README、X 帖草稿、payload（人类确认后发） |

如果只有一个 agent，按阶段串行；不要并行改同一文件。

### 8.2 规则

- 先 `npx skills add near/agent-skills`；优先使用 `near-smart-contracts`、`near-dapp`、`near-intents`、`near-api-js`、`near-kit`。
- 先读 `https://nearhackathon.com/HACKATHON.md`，再读本文档和赛道原文。
- 用 `docs.near.org/llms.txt`、`docs.near-intents.org/llms.txt`、伙伴 `llms.txt` 查版本/地址/端点；不猜。
- 测试网优先；演示部署用 60s 天；正式参数 24h。
- 所有密钥进 `.env`；`.env.example` 只放占位符；提交前 `git grep` 检查。
- 每阶段更新 `docs/PROGRESS.md`：日期、决策、地址、命令、测试结果、截图路径、未决问题。
- 每阶段更新 `README.md` 的 “do X - see Y”。
- 任何破坏性操作（删仓库、主网部署、发交易、提交）先问人类。

### 8.3 阶段与检查点

| 阶段 | 产出 | 检查点（必须停下） |
|---|---|---|
| P0 Setup | 读规则、装 skills、列 13 个 track id、确认 scope | 汇报后等人类给赛道 prompt/确认 |
| P1 合约核心 | NEP-141 + config + join + enlist + settle + claim + events + tests | 贴 `cargo test` 结果、测试网地址；等确认 |
| P2 前端核心 | Battle 页 + 钱包 + 押注 + 结算 + 日志 + 60s demo | 贴 demo URL、2 分钟录屏；等确认 |
| P3 地图/赛季 | 5×5 地图、赛季、连胜、名人堂 | 贴截图/录屏；等确认 |
| P4 观战市场 | 二元市场、结算、领取 | 贴测试/截图；等确认 |
| P5 模拟/参数 | 60 天模拟、图表、`PARAMS.md` | 贴图表和建议参数；等人类冻结参数 |
| P6 伙伴/AI | Intents/HOT/Rhea/NEAR.AI 等真实集成或明确 explored | 贴证据；等确认 |
| P7 提交 | README、X 帖、payload、演示视频 | 展示完整 payload；等人类明确 OK |

### 8.4 主提示词（复制给 AI agent）

```text
你是 MEME WARS 项目的 lead engineer。项目是 NEAR Hackathon 2026 的 Track 11（memecoins）。
先完整阅读：
1) https://nearhackathon.com/HACKATHON.md
2) https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/11-memecoins.md
3) 本仓库 docs/AI_DEV_SPEC.md
4) 官方 00-setup.md 和 SUBMITTING.md

然后执行：
- npx skills add near/agent-skills
- 用 docs.near.org/llms.txt 和 docs.near-intents.org/llms.txt 查所需版本/地址/端点，不要猜。
- 列出 13 个 track id，证明你读过 HACKATHON.md。
- 用 5 条以内总结你对本项目的理解、当前阶段目标和未决问题。
- 停止，等我确认。不要写代码。

硬约束：不写后台、不写 admin、不写可改参数的方法；密钥只放 .env；先测试网；
每阶段结束停下汇报；提交前展示完整 payload 等我 OK；不伪造集成/数据/截图。
```

### 8.5 阶段提示词

**P1 合约**：

```text
按 docs/AI_DEV_SPEC.md §4 实现合约核心：
NEP-141 + Config + Member/Faction/Day/Enlistment + join_faction + enlist +
settle_day + claim_stake + claim_reward + events/log + views。
要求：O(1) 结算与领取，不遍历参与者；无 admin；参数不可变；参数从 config 文件读。
写单元测试覆盖：一天一次、连续加成、胜负、平局、冷场、烧毁、领取、重复结算幂等、余额不变量。
运行 cargo test，贴完整结果。部署到 testnet demo，贴地址和一条 enlist/settle/claim 交易哈希。
停止，等我确认。
```

**P2 前端**：

```text
按 §5 实现 Battle 页：钱包连接、选边、押注、倒计时、拔河条、个人连续、日志、领取。
接 demo 部署（60s 天）；顶部显示 Accelerated demo 横幅。
给我：本地截图、部署 URL、2 分钟录屏脚本（按 README 的 do X see Y）。
停止，等我确认。
```

**P5 模拟**：

```text
按 §6 实现 sim/simulate.py：4 个情景、固定 seed、输出 CSV/JSON/PNG。
公式必须与合约一致；用一组交叉测试验证（同输入 Python/Rust 同结果）。
给出建议参数和理由，写 docs/PARAMS.md。
停止，等我冻结参数。
```

**P7 提交**：

```text
按 §10 准备 README、X 帖草稿、submission payload。
先展示完整 payload 和 X 帖文案，不要发送。等我明确说 OK 再发。
检查：仓库公开、LICENSE、无 secrets（git grep）、README 有 do X see Y、
demo 帖已发、四条硬性要求逐条有证据。
```

### 8.6 Definition of Done（每阶段）

- 代码编译/测试通过，输出贴给人类。
- 新功能有单元测试或手动验收步骤。
- README/PROGRESS 更新。
- 部署地址/交易哈希可点开。
- 未决问题明确列出。
- 人类确认后才能进入下一阶段。

### 8.7 停止条件与反模式

**立即停止并问人**：

- 需要改参数/加 admin 才能继续。
- 伙伴文档找不到、API 不可用。
- 测试失败且原因不明。
- 需要主网交易/资金。
- 发现仓库里有 secret。
- 需要伪造数据才能演示。

**反模式**：

- 为了“复杂”加五个机制，结果每个都半成品。
- 用后端模拟链上状态。
- 用随机数决定胜负（不可验证/可操纵）。
- 用价格图/AMM 当核心卖点。
- README 写营销文案。
- 把未跑通的伙伴集成写成 integrated。
- 演示数据不标注。

---

## 9. 测试与验收

### 9.1 测试矩阵

| 类型 | 内容 |
|---|---|
| NEP-141 | transfer、transfer_call、storage、metadata、余额/总供应 |
| 游戏 | join、一天一次、min/max stake、连续倍数、阵营计数 |
| 结算 | 胜/负/平/冷场、underdog 翻转、烧毁、铸币、占格 |
| 领取 | 胜方 stake/reward、输方 80%、重复领取失败、取整 |
| 幂等 | 重复 settle、重复 claim、跨日 enlist 自动结算 |
| 赛季 | 30 天边界、格子计数、奖金池、领取 |
| 不变量 | 余额+锁定+金库+奖励池 == 总供应；无负数 |
| 安全 | 无 admin 方法、无 set_config、无 upgrade、无 secrets |
| 时间 | 日边界前后、跨越多个未结算日 |
| 市场（P1） | 押注、结算、赔率、无赢家退款、烧毁 |

### 9.2 硬性要求映射（README 必须有这张表）

| 要求 | 实现 | 证据 |
|---|---|---|
| NEP-141 | contract methods + metadata | 合约地址、`ft_metadata` 输出、transfer 交易 |
| 机制在链上 | 无后端；enlist/settle/claim 全在合约 | 合约源码、view 调用、交易 |
| 参数不可变、无 admin | `new()` 固定；无 setter/pause/upgrade；生产移除 key | `get_config`、源码搜索、key 删除交易 |
| 女巫抵抗 + 局限 | 押注成本/上限/固定奖池/连续/underdog | 模拟图、README limitations |
| 页面：连续/进度/日志 | 前端 + `get_log` + 事件 | 截图/录屏、demo URL |
| 60 天模拟 | `sim/simulate.py` + 图表 | 命令、CSV/PNG、PARAMS.md |

### 9.3 安全清单

- [ ] 仓库无 `.env`、私钥、API key（`git grep -i "secret\|private\|key"`）。
- [ ] 无 `set_config`、`update_config`、`pause`、`upgrade`、`withdraw_treasury`。
- [ ] 生产合约账户 full-access keys 已移除，交易哈希记录。
- [ ] 所有金额计算无浮点；无未检查减法。
- [ ] `enlist` 自动结算循环有上限。
- [ ] `settle_day` 幂等；`claim_*` 重复调用失败。
- [ ] `ft_transfer` 不能转走锁定押注。
- [ ] `ft_resolve_transfer` 按标准实现，`#[private]`。
- [ ] 日志/事件不包含隐私数据。
- [ ] 演示 faucet 只在 `demo_mode`；正式部署关闭。

### 9.4 人工验收脚本

`scripts/verify.sh` 至少做：

```bash
near view $CONTRACT get_config
near view $CONTRACT get_current_day
near view $CONTRACT get_faction '{"faction":0}'
near view $CONTRACT get_member "{\"account_id\":\"$ACCOUNT\"}"
near view $CONTRACT get_map
near view $CONTRACT get_log '{"from":0,"limit":20}'
```

输出与 README 期望值一致；任何一项失败，不能提交。

---

## 10. 部署与提交

### 10.1 环境与参数

- `config/demo.json`：60s 天、`demo_mode=true`、faucet 开启、测试网。
- `config/prod.json`：24h 天、`demo_mode=false`、无 faucet、测试网/主网。
- 部署脚本 `scripts/deploy.sh` 读取 config，调用 `new`；参数写死。
- 部署后立即 `get_config`，与 config 文件 diff；贴到 PROGRESS.md。

### 10.2 部署流程

1. 构建：`cargo near build`（版本以文档为准）。
2. 创建/使用子账户；充值存储。
3. `near deploy` / `cargo near deploy`。
4. `new(config)`；`get_config` 校验。
5. 演示部署：seed 两侧活动（脚本/演示账户）；标注演示数据。
6. 正式部署：移除 full-access key；记录交易哈希；README 声明不可升级。
7. 前端部署；配置合约地址/网络；测试钱包连接。
8. 录 3 分钟视频：选边 → 押注 → 结算 → 领取 → 地图 → 日志 → 模拟。

### 10.3 README 模板（AI 评委优先）

```markdown
# Meme Wars ($WAR)

One-liner: Pick a faction, fight a daily on-chain war, and the token supply reacts.

## What it is
- Problem: memecoins have no mechanic beyond price.
- Solution: two factions, daily staked battles, map, seasons; winners minted, losers burned.

## Live
- Demo (accelerated 60s days): <URL>
- Contract (demo): <account>
- Contract (prod-testnet): <account>
- Token page / launch: <URL>
- Demo video: <X URL>

## Do X, see Y (5 minutes)
1. Open <demo URL>; connect a testnet wallet.
2. Click "Get test WAR"; see balance.
3. Pick DOGS; see faction badge.
4. Stake 1,000 WAR; see locked stake and the tug bar move.
5. Wait 60s; the page settles the day; see winner, mint/burn log, and a map tile.
6. Click Claim; see balance increase and a reward_claim log.
7. Open /map; see the captured tile.
8. Run `python sim/simulate.py`; see 60-day supply/treasury charts.

## Hard requirements (evidence)
| Requirement | Where | Evidence |
...
## Mechanic
...
## 60-day simulation
...
## Sybil resistance and limitations
...
## Architecture
...
## Partner integrations
- meme.cooking: integrated/explored — evidence
- NEAR Intents: ...
- HOT: ...
- Rhea: ...
- NEAR.AI/BRRRAIN: ...
- Others: not used / ops only
## Known limitations
- ...
## License
MIT
```

### 10.4 X 演示帖

- 必须含：`built at NEAR HACKATHON`
- 必须含：`@NEARProtocol`、`#NEARHackathon`
- 可选：`@NearLegion`、`@NearBuilders`
- 附：视频或截图（至少一个可播放/可看清的演示）
- 由人类发布；agent 只准备草稿。

示例：

```text
built at NEAR HACKATHON — Meme Wars: pick a faction, fight a daily on-chain war, and the token supply reacts. Winners get minted, losers get burned, the map remembers.

@NEARProtocol #NEARHackathon @NearLegion @NearBuilders

[video]
```

### 10.5 提交 payload（模板，字段以 HACKATHON.md 为准）

```json
{
  "projectName": "<2-80 chars, HUMAN decides>",
  "lead": "<2-80 chars, HUMAN>",
  "email": "<HUMAN>",
  "teamSize": "<1 | 2 - 4 | 4 - 6 | 6 - 8 | 8+>",
  "tracks": ["memecoins"],
  "nearAccount": "<HUMAN mainnet named or implicit account>",
  "repoUrl": "https://github.com/<org>/<repo>",
  "projectUrl": "<demo URL, <=300 chars>",
  "demoUrl": "<X post URL, <=300 chars>",
  "description": "<20-2000 chars>",
  "consent": true,
  "requestId": "<uuid; reuse on retry>",
  "website": ""
}
```

**提交流程**：

1. 读线上 `HACKATHON.md` 的 submission API，确认字段名/限制。
2. 展示完整 JSON（含 `website: ""`）给人类。
3. 人类明确说 OK。
4. 发送；`201` 成功；`400` 按 `fields` 修正后用同一 `requestId`；`403` 停止问人；`409` 不绕过；`413` 缩短描述；`503` 稍后同 id 重试。
5. 保存响应/截图到 `docs/SUBMISSION.md`。

**赛道选择**：主赛道 `memecoins`。如果游戏循环完整、README 也能满足 `games` 赛道口径，可加 `games`；不确定就不加，别为了多赛道写假证据。

---

## 11. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 过度设计 | 核心跑不通 | 先核心层，完整可跑再加层；每层可独立演示 |
| 结算/领取遍历参与者 | gas 爆炸 | O(1) 聚合结算 + 个人 claim（§4.4） |
| 一方长期碾压 | 游戏死亡 | underdog 加成 + 赛季重置 + 模拟调参 |
| 冷场烧穿金库 | 经济崩溃 | 模拟定 `cold_burn`/`cold_line`；金库下限规则 |
| 女巫多号 | 机制失真 | 押注成本/上限/固定奖池/连续/underdog；README 诚实写局限 |
| 领取记录存储膨胀 | 主网成本 | claim window + `close_claims`；README 说明扩展限制 |
| 伙伴 API 不稳定 | 演示失败 | 适配器 + fallback；核心零依赖 |
| 发射平台与 mint/burn 冲突 | 硬性要求不满足 | 优先单合约；双合约只把 minter 给不可变游戏合约 |
| 生产仍可升级 | “无 admin”不成立 | 部署后移除 full-access keys；记录交易 |
| README 不可复现 | AI 评审低分 | 从第一天维护；`verify.sh`；录屏 |
| 演示摩擦（需两方） | 评委看不到战局 | 60s 天 + seed 脚本 + 预置演示账户 + 视频 |
| 观战市场被视为赌博 | 评审风险 | 仅测试网/演示；README 说明无真钱；不作为核心 |

---

## 12. 术语表

- **NEP-141**：NEAR 同质化代币标准。
- **NEP-297**：NEAR 事件标准（`EVENT_JSON`）。
- **Faction**：阵营（DOGS=0, CATS=1）。
- **Enlist**：每日参战，锁定押注。
- **Power**：战力 = stake × streak multiplier（base power）；结算时弱势方有 underdog 加成。
- **Cold day**：当日总战力低于 `cold_line`，算社区没来，金库烧 `cold_burn`。
- **Settlement**：日结束后计算胜负、烧毁、铸币、占格。
- **Lazy settlement**：没有 cron；由用户/前端/任何人调用 `settle_day`。
- **Claim**：用户领取押注返还和奖励；O(1) 个人计算。
- **Season**：30 天一个周期；地图重置；格子多的一方拿金库奖金。
- **Reward vault**：存放已铸但未领取奖励的合约余额。
- **Treasury**：创世分配的金库，按规则用于冷场烧毁/赛季奖金。
- **Demo mode**：60s 天 + faucet，仅演示；正式部署关闭。
- **Underdog bonus**：结算时较弱一方的固定战力加成，防止一边倒。
- **Parimutuel**：观战市场按池子分配，赢家分输家（扣烧毁）。

---

## 附录 A：事件 schema 示例

```json
EVENT_JSON:{"standard":"meme-wars","version":"1.0.0","event":"day_settled","data":{"day":12,"winner":0,"cold":false,"total_power":["1200000","900000"],"total_stake":["800000","600000"],"reward_pool":"500000","burned":"120000","tile":12}}
```

```json
EVENT_JSON:{"standard":"meme-wars","version":"1.0.0","event":"reward_claim","data":{"day":12,"account":"alice.near","amount":"7500"}}
```

## 附录 B：示例 config

```json
{
  "name": "Meme Wars",
  "symbol": "WAR",
  "decimals": 24,
  "genesis_supply": "1000000000000000000000000000000000",
  "treasury_allocation": "200000000000000000000000000000000",
  "community_allocation": "700000000000000000000000000000000",
  "demo_faucet_pool": "100000000000000000000000000000000",
  "day_length_ns": 60000000000,
  "epoch_start_ns": 0,
  "season_days": 30,
  "daily_mint_pool": "500000000000000000000000000000",
  "loss_burn_bp": 2000,
  "underdog_bonus_bp": 15000,
  "cold_line": "5000000000000000000000000000000",
  "cold_burn": "1000000000000000000000000000000",
  "min_stake": "1000000000000000000000000000",
  "max_stake_per_day": "100000000000000000000000000000",
  "streak_step_bp": 500,
  "streak_cap_days": 20,
  "claim_window_days": 7,
  "season_bonus_bp": 500,
  "market_burn_bp": 200,
  "demo_mode": true
}
```

> 以上是 demo 部署示例（24 decimals）；`genesis_supply` 必须等于三项 allocation 之和。正式部署：`demo_mode=false`、`demo_faucet_pool=0`、`day_length_ns=86400000000000`、`epoch_start_ns` 取部署时或下一个 UTC 零点。示例里 `epoch_start_ns: 0` 只是占位符；部署前必须替换为真实值（或在 `new()` 明确支持 0 = 当前时间，二者择一写死）。最终值由模拟和人类确认；不要让 agent 猜。

## 附录 C：伙伴链接速查

- meme.cooking: https://meme.cooking/ · https://docs.meme.cooking/ · https://api.meme.cooking/
- NEAR Intents: https://intents.near.org/ · https://docs.near-intents.org/ · https://github.com/near/intents
- HOT: https://hot-labs.org/ · https://docs.hotdao.ai/ · https://github.com/hot-dao
- Rhea: https://rhea.finance/ · https://guide.rhea.finance/ · https://github.com/rhea-finance
- NEAR.AI: https://near.ai/ · https://docs.near.ai/ · https://github.com/nearai/cloud-api
- OutLayer: https://outlayer.ai/ · https://app.outlayer.ai/docs/getting-started · https://github.com/out-layer/outlayer
- Agent Market: https://market.near.ai/ · https://docs.market.near.ai/ · https://market.near.ai/docs/
- BRRRAIN: https://brrrain.fun/ · https://brrrain.fun/docs/ · https://brrrain.fun/docs/api/
- Trezu: https://trezu.org/ · https://github.com/NEAR-DevHub/trezu-docs · https://github.com/NEAR-DevHub/trezu
- SputnikDAO: https://x.com/SputnikDAO · https://github.com/near-daos/sputnik-dao-contract#setup
- NEAR Business: https://business.near.com/ · https://docs.business.near.com/
- Aurora: https://aurora.dev/ · https://doc.aurora.dev/ · https://github.com/aurora-is-near
- HEX: https://hex.exchange/ · https://hot-labs.gitbook.io/hex/concepts-and-systems/interactive-blocks
- NEAR Builders: https://nearbuilders.org/ · https://nearbuilders.org/build · https://github.com/nearbuilders
- GoMining: https://gomining.com/ · https://docs.gomining.com/
- SVRN: https://svrn.net/ · https://svrn.net/research/near-protocol
- Gulf Labs: https://gulf-labs.com/

---

**最后提醒**：本文件是执行规格，不是营销材料。任何与线上 `HACKATHON.md` 冲突的地方，以线上规则为准；任何伙伴 API 细节，以官方 `llms.txt`/文档为准。不要猜。
