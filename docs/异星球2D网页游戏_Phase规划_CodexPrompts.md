# 异星球 2D 俯视角网页小游戏：分阶段（Phase）超详细规划 + Codex 执行 Prompt（可直接转发给 Master Agent）

> 目标：做一个**网页端**的 2D **俯视角（top-down）射击闯关**游戏（异星球题材）。玩家在地图中移动、拾取装备、打怪、迎接持续入侵的怪物波次；通过**角色升级 + 枪支升级 + 配件升级 + 装备合成**不断变强；支持**关卡选择**与逐步解锁；要求**动作/射击手感流畅**。  
> 本文档给 Master Agent 用：Master Agent 将按 Phase 拆解任务，指挥 Codex 每次完成一个小部分 → 构建/测试 → 回报结果 → 下一轮迭代，直到交付完整项目。

---

## 1. 总体方法论（给 Master Agent 的“迭代作战纲领”）

### 1.1 迭代原则（强制）
1. **先做 Vertical Slice（可玩最小闭环）**：移动 → 射击 → 敌人 → 掉落 → 过关/失败 → 下一关入口。  
2. **每次让 Codex 做“可验证的小步”**：每步必须包含：  
   - 代码改动（新增/修改文件）  
   - 可运行的构建/启动命令  
   - 最少 1 条可验证的测试/自检（单测、lint、或手动测试 checklist）  
   - 结果回报（通过/失败 + 日志 + 下一步建议）  
3. **数据驱动（配置优先）**：武器/敌人/关卡/掉落/升级/配件尽量用 JSON/TS 配置，不要散落硬编码。  
4. **流畅性优先**：输入响应、移动/射击动画、相机跟随、击中反馈，都要在最早期就建立“手感基线”。  
5. **性能从结构上保证**：子弹/敌人/特效用对象池；避免每帧大量 new；尽量减少昂贵碰撞计算。  
6. **保持可扩展架构**：先简单（不引入过重框架），但模块边界清晰：实体、系统、数据、UI、关卡。

### 1.2 建议技术栈（网页端 2D 俯视角最佳实践）
- 引擎：**Phaser 3**（成熟、Web 友好、2D 场景/物理/动画支持好）  
- 语言：**TypeScript**（长期维护和数据建模更稳）  
- 工程：**Vite**（启动快、打包简单）  
- 测试：**Vitest**（逻辑单测），可选 **Playwright**（基本 E2E）  
- 规范：ESLint + Prettier  
- 资源：先用占位图形（几何/简单 sprites），后期再替换美术资源（不影响代码结构）  
- 部署：静态站点（Vercel/Netlify/GitHub Pages）

> 你也可以换 PixiJS，但 Phaser 的“Scene + 物理 + 输入 + 动画 + 摄像机”一体化更适合快速迭代。

---

## 2. 游戏设计摘要（GDD Lite）

### 2.1 核心体验（Core Pillars）
- **爽快流畅**：移动顺、转向顺、射击反馈强（后坐力/击中/音效/抖动）。  
- **成长驱动**：角色升级（天赋/属性）+ 装备升级（枪/配件/合成）。  
- **波次压迫感**：怪物持续入侵，节奏从“清理 → 短喘息 → 更强波次”。  
- **关卡策略**：不同关卡（怪物组合/地形/词缀）带来差异，支持关卡选择和逐步解锁。

### 2.2 玩法循环（Loop）
1. 进入关卡（地图/词缀/波次表）  
2. 移动探索 → 遭遇敌人 → 射击消灭  
3. 掉落装备/材料/金币/经验球（拾取）  
4. 升级触发：选择 1 个升级（角色/武器/配件/被动）  
5. 波次推进 → Boss/精英波（可选）  
6. 过关结算：获得奖励，解锁下一关或更高难度  
7. 回到关卡选择 → 下一关

### 2.3 角色与属性（建议基础属性）
- HP / MaxHP  
- MoveSpeed  
- DashCooldown（可选）  
- Armor / DamageReduction（可选）  
- CritChance / CritDamage（可选）  
- PickupRange（拾取范围）  
- XP（经验）与 PlayerLevel（角色等级）

### 2.4 武器系统（基础字段）
- Damage（伤害）  
- FireRate（射速，发/秒）  
- ProjectileSpeed（弹速）  
- Spread（散布）  
- MagazineSize（弹匣）/ ReloadTime（换弹）  
- Range（射程/子弹生命周期）  
- Knockback（击退）/ OnHitEffect（中弹效果）  
- Rarity（稀有度）与 Level（武器等级）  
- AttachmentSlots（配件槽：枪口/弹匣/瞄具/握把/枪托…）

### 2.5 配件系统（Attachment）
- SlotType：Muzzle / Magazine / Optic / Grip / Stock / Chip（科幻芯片槽）  
- Modifiers：例如 +Damage%、+FireRate、-ReloadTime、+Crit、+Spread（负面）等  
- 组合策略：让配件带 trade-off，形成构筑空间。

### 2.6 合成/升级（Crafting）
- 同类装备合成：例如 3 把同稀有同等级 → 1 把更高等级  
- 材料升级：低级材料 ×N → 高级材料  
- 配件强化：消耗材料提升配件品质/数值

### 2.7 敌人系统（分层）
- 小怪：冲脸、远程、绕后  
- 精英：更高 HP、特殊技能（护盾/分裂/冲刺）  
- Boss（可选）：阶段机制

基础字段：HP、Speed、Damage、ExpReward、DropTable、BehaviorType

### 2.8 关卡系统
- 关卡可选：LevelSelect 场景展示关卡卡片（难度、奖励、怪物类型）  
- 关卡解锁：通关上一关解锁下一关；或星级解锁  
- 每关包含：地图（Tilemap 或 Arena）、波次表、环境词缀（可选）

---

## 3. 数据结构建议（配置驱动的“契约”）

> 关键点：先把 schema 定好，Codex 每一步都围绕 schema 迭代，后期新增内容只改配置。

### 3.1 WeaponDef（示例）
```ts
export type WeaponId = string;

export interface WeaponDef {
  id: WeaponId;
  name: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  baseLevel: number; // 初始等级
  damage: number;
  fireRate: number; // shots per second
  projectileSpeed: number;
  spreadDeg: number;
  magazineSize: number;
  reloadTimeMs: number;
  rangePx: number;
  attachmentSlots: Array<"muzzle" | "magazine" | "optic" | "grip" | "stock" | "chip">;
}
```

### 3.2 AttachmentDef
```ts
export interface StatModifier {
  stat:
    | "damageMul"
    | "fireRateMul"
    | "reloadTimeMul"
    | "critChanceAdd"
    | "critDamageMul"
    | "spreadDegAdd"
    | "magazineSizeAdd"
    | "projectileSpeedMul"
    | "moveSpeedMul"
    | "maxHpAdd";
  value: number; // 例如 0.1 表示 +10%（Mul），或 +5（Add）按规则约定
}

export interface AttachmentDef {
  id: string;
  name: string;
  slot: "muzzle" | "magazine" | "optic" | "grip" | "stock" | "chip";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  modifiers: StatModifier[];
}
```

### 3.3 EnemyDef
```ts
export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  contactDamage: number;
  expReward: number;
  behavior: "chaser" | "ranged" | "swarm" | "charger";
  dropTableId: string;
}
```

### 3.4 LevelDef（波次）
```ts
export interface WaveSpawn {
  enemyId: string;
  count: number;
  intervalMs: number;   // 每只间隔
  startAtMs: number;    // 从开局多少毫秒开始
  spawnPattern: "edgeRandom" | "aroundPlayer" | "fixedPoints";
}

export interface LevelDef {
  id: string;
  name: string;
  description: string;
  mapKey: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  waves: WaveSpawn[];
  reward: { credits: number; unlocks?: string[] };
}
```

---

## 4. Phase 总路线图（从 0 到 完整交付）

> 每个 Phase 都给了：目标、拆分任务、验收标准、Codex Prompt。  
> Master Agent 的做法：按顺序投喂给 Codex，每次只做一个“小步”，要求它跑起来并回报结果。

---

# Phase 0：项目脚手架与工程基线（必须先做）

## 目标
建立可运行的工程骨架：开发服务器、构建、lint/format、测试框架、基础目录结构。

## 产出/验收
- `npm install && npm run dev` 可启动  
- `npm run build` 成功  
- `npm run lint` 成功（或至少有明确规则）  
- `npm run test` 有最少 1 个通过的示例单测  
- 目录结构清晰（见下）

## 建议目录结构
```
/src
  /assets           # 美术/音频（初期可空）
  /core             # 引擎封装：时间、输入、事件总线、随机、对象池
  /data             # 配置：weapons/enemies/levels/dropTables
  /game
    /scenes         # Phaser Scenes
    /entities       # Player/Enemy/Bullet/Pickup 的实体封装
    /systems        # 移动/射击/碰撞/刷怪/掉落 等系统
    /ui             # HUD、菜单、背包、升级选择
  /tests
/index.html
```
（如果 Codex 更偏好按 feature 分层也可以，但要统一。）

## 给 Codex 的 Prompt（Phase 0）
> 复制给 Codex：
```text
你是一个资深前端/游戏工程师。请用 Phaser 3 + TypeScript + Vite 初始化一个网页 2D 游戏项目骨架。
要求：
1) 提供 npm scripts：dev/build/preview/lint/test。
2) 配置 ESLint + Prettier（或至少 ESLint），保持 TS 规范。
3) 配置 Vitest，并提供一个最小单测示例（比如对一个 clamp/lerp 工具函数测试）。
4) 创建基本目录结构：src/core、src/game/scenes、src/data、src/tests。
5) 创建一个最小 Phaser 场景：启动后显示“Alien Arena”文本，并在控制台输出 FPS 或 tick。
6) 最后请运行：npm test、npm run build，并把关键输出摘要贴出来。
```
## 测试命令
- `npm run lint`
- `npm run test`
- `npm run build`

---

# Phase 1：游戏框架骨架（场景流转 + 状态机）

## 目标
建立 Scene 流程：Boot/Preload/MainMenu/LevelSelect/Game/UIScene；并有全局 GameState（当前关卡、玩家持久数据）。

## 产出/验收
- 进入 MainMenu → 点击进入 LevelSelect → 选择关卡 → 进入 GameScene
- UI 场景与 GameScene 分离（HUD 不影响主场景更新）
- GameState 具备基本字段：`selectedLevelId`、`metaProgress`（可先空）

## 拆分任务（推荐小步）
1. Scene 路由与切换（按钮可用简单文本点击）  
2. `GameState` 与事件总线（例如 EventEmitter）  
3. Preload 占位资源（最少加载一张占位 sprite）

## 给 Codex 的 Prompt（Phase 1）
```text
在现有 Phaser3+TS+Vite 项目基础上，实现场景流转：BootScene -> PreloadScene -> MainMenuScene -> LevelSelectScene -> GameScene，并增加 UIScene 作为 HUD。
要求：
- Scene 文件放在 src/game/scenes。
- 提供一个全局 GameState（可用单例或通过 Phaser registry 注入），至少包含 selectedLevelId。
- LevelSelectScene 展示 3 个关卡按钮（占位），点击后设置 selectedLevelId 并进入 GameScene。
- UIScene 在 GameScene 启动时 overlay 显示 HUD 文本（如 HP、Weapon、LevelId）。
- 添加最少 1 条 Vitest 单测（对 GameState 的 getter/setter 或事件派发）。
- 请运行 npm test，并说明如何手动验证场景切换。
```

---

# Phase 2：玩家移动、朝向与相机（“流畅手感基线”）

## 目标
实现俯视角玩家：WASD/方向键移动，鼠标指向决定朝向；相机平滑跟随；动画/插值保证“动作流畅”。

## 产出/验收
- 玩家可移动（有加速度/减速度或平滑 lerp，不是生硬瞬移）
- 鼠标移动时玩家朝向平滑旋转（限制最大角速度，避免抖动）
- 相机跟随玩家（带一点 lag smoothing）
- 帧率稳定（至少在本地开发中保持流畅）

## 拆分任务
1. InputManager：键盘移动向量 + 鼠标世界坐标  
2. Player 实体：位置、速度、朝向、更新逻辑  
3. CameraFollow：平滑跟随（lerp）  
4. 手动测试 checklist：边缘移动、快速转向、按住移动同时转向

## 给 Codex 的 Prompt（Phase 2）
```text
请在 GameScene 中加入 Player 实体，实现俯视角移动与朝向：
- WASD/方向键控制移动；移动使用平滑方式（例如速度 + 加速度/阻尼，或 position lerp），避免“卡顿/瞬移感”。
- 鼠标位置决定玩家朝向（旋转角度），旋转要做平滑插值（限制最大角速度或使用 lerpAngle）。
- 摄像机跟随玩家，并加入平滑跟随（camera lerp）。
- 玩家使用一个占位 sprite（比如一个圆或三角形），但朝向要可见（例如前方有一个小点/枪口）。
- 请补充一个纯逻辑单测：例如对角度插值函数 smoothAngle(current, target, maxDelta) 的测试。
- 最后请给出手动测试步骤，并运行 npm test。
```

---

# Phase 3：射击系统（子弹、碰撞、命中反馈）

## 目标
实现“左右扫射/射击”核心：持续射击、子弹飞行、与敌人碰撞扣血；加入击中反馈（闪白/抖动/音效占位）。

## 产出/验收
- 鼠标左键按住连射（或自动射击）
- 子弹从枪口发射，速度/射程/散布生效
- 子弹命中敌人：敌人掉血并出现反馈（颜色闪烁/数值飘字占位）
- 子弹对象池（避免每帧 new 一堆对象）

## 拆分任务
1. Weapon 模型（只实现 1 把基础枪：步枪）  
2. Bullet 实体 + Pool  
3. 命中判定（Phaser Arcade Physics 或自定义简单圆形碰撞）  
4. 命中反馈（至少 1 种：闪白/屏幕轻微 shake）

## 给 Codex 的 Prompt（Phase 3）
```text
在现有 Player 的基础上实现射击系统：
- 鼠标左键按住持续射击（fireRate 控制）。
- 实现 Bullet 对象池（例如预创建 N 个 Bullet，复用）。
- Bullet 有速度、生命周期（射程或时间），超出后回收。
- 场景中先放 3 个“木桩敌人”（静止目标），子弹命中会扣血并显示命中反馈（例如 tint 闪烁 + 简单飘字）。
- Weapon 参数从一个 data/weaponDefs.ts 读取（哪怕只有 1 把枪），不要全写死在逻辑里。
- 添加至少 1 条 Vitest 单测：例如对射速计时器或散布角度生成函数的测试。
- 请运行 npm test，并说明如何在浏览器手动验证射击与命中。
```

---

# Phase 4：敌人 AI 与刷怪（入侵感）

## 目标
实现基础敌人：追踪玩家、近战接触伤害；刷怪点/边缘随机刷怪；波次前的“持续压力”。

## 产出/验收
- 敌人从地图边缘随机生成，追着玩家走（简单 steering）
- 敌人碰到玩家扣血，玩家有受伤无敌帧（短暂）
- 敌人死亡：掉落经验球（占位）
- 基础难度可调（刷怪率、敌人速度/血量）

## 拆分任务
1. Enemy 实体（状态：追踪/受击/死亡）  
2. Spawner（边缘随机点或固定 spawn points）  
3. 玩家受伤机制（iFrame + 受击反馈）  
4. 经验球 Pickup（靠近自动拾取或按键拾取）

## 给 Codex 的 Prompt（Phase 4）
```text
请加入 Enemy 系统与刷怪：
- EnemyDef 从 src/data/enemyDefs.ts 读取（至少 1 种 enemy：chaser）。
- 刷怪器每隔 X 秒从地图边缘随机刷出 1-3 只敌人，敌人朝玩家移动。
- 敌人接触玩家造成伤害，玩家有 0.5-1s 无敌帧，并有受伤反馈（闪红或屏幕抖动）。
- 敌人被子弹打死后掉落 ExpOrb（经验球，占位），玩家靠近自动拾取并累计 XP（先不做升级选择）。
- 添加至少 1 条单测：例如对 spawn 点生成（在边缘范围内）或 iFrame 计时的测试。
- 运行 npm test，并给出手动验证 checklist。
```

---

# Phase 5：关卡与波次系统（可选择关卡、关卡内推进）

## 目标
建立 LevelDef 波次表：不同关卡有不同波次；关卡内基于时间推进刷怪；关卡结束条件（撑过时间/击杀数/击杀 Boss）。

## 产出/验收
- LevelSelect 中展示 3 个 LevelDef（不同 difficulty、waves）
- 进入关卡后按波次表刷怪（startAtMs + intervalMs + count）
- 关卡目标达成触发胜利界面 → 返回 LevelSelect
- 失败：玩家 HP 归零 → GameOver → 返回菜单

## 拆分任务
1. LevelDef 数据与读取  
2. WaveScheduler（时间轴调度）  
3. 胜利/失败 UI（简单 overlay）  
4. 结算奖励（credits/解锁项，先放在 GameState）

## 给 Codex 的 Prompt（Phase 5）
```text
请实现关卡与波次系统：
- 在 src/data/levelDefs.ts 定义至少 3 个关卡（不同 waves、不同难度参数）。
- GameScene 根据 selectedLevelId 加载对应 LevelDef，并用 WaveScheduler 按时间刷怪（支持多个 wave 并发）。
- 关卡胜利条件：例如存活 60 秒 或 消灭指定数量敌人（任选其一，写清楚并可配置）。
- 失败条件：玩家 HP=0。
- 胜利/失败都显示一个简单面板，提供按钮返回 LevelSelect。
- 单测：对 WaveScheduler（给定时间推进，应该触发指定 spawn 事件）的测试。
- 运行 npm test，并说明如何选择关卡验证波次差异。
```

---

# Phase 6：掉落、拾取、背包（装备拾取闭环）

## 目标
实现“捡装备”与背包：敌人掉落武器/配件/材料；玩家拾取进入背包；可查看/装备主武器与配件。

## 产出/验收
- 掉落系统：根据 DropTable 概率掉落（至少：金币/材料/武器占位）
- 背包 UI：打开/关闭；显示已获得物品列表
- 装备系统：玩家可装备 1 把主武器（先简单）+ 若干配件槽（可先 1-2 个槽）
- 装备后武器属性变化（DPS/射速/弹匣等可见）

## 拆分任务
1. DropTable 数据结构与 roll  
2. Pickup 实体（武器/配件/材料）  
3. Inventory 数据结构（容量、叠加规则）  
4. Inventory UI（最简：列表 + 点击装备）

## 给 Codex 的 Prompt（Phase 6）
```text
请加入掉落与背包系统：
- 定义 DropTable（src/data/dropTables.ts），敌人死亡时 roll 掉落：credits、material、weapon、attachment（至少实现其中 2-3 种）。
- 掉落物在地上显示为 pickup，玩家靠近自动拾取（或按 E）。
- 实现 Inventory（src/game/ui 或 src/core/state）：支持添加/移除/叠加（材料可叠加，武器不叠加）。
- 增加一个 Inventory 面板：按 I 打开/关闭，显示物品列表；点击某武器可装备为当前武器。
- 装备变化要影响射击参数（至少 damage/fireRate/magazine）。
- 单测：对 DropTable roll 的概率逻辑（可用固定 seed 的 RNG）或 Inventory add/remove 的测试。
- npm test 通过，并提供手动验证流程（击杀->掉落->拾取->打开背包->装备->射击手感变化）。
```

---

# Phase 7：角色升级（经验、升级选择、被动/主动加成）

## 目标
让“升级”成为节奏核心：拾取经验 → 升级 → 弹出 3 选 1 升级卡 → 选择后立刻生效。

## 产出/验收
- XP 达到阈值后升级（阈值曲线可配置）
- 升级时暂停战斗（或降低时间流速），出现 3 张升级卡
- 选择后：玩家属性或武器属性立即变化；HUD 显示等级与关键属性变化

## 拆分任务
1. XP 曲线（Level->RequiredXP）  
2. UpgradeDef（升级项定义与权重）  
3. Upgrade UI（3 选 1）  
4. 作用系统（apply modifiers）

## 给 Codex 的 Prompt（Phase 7）
```text
请实现角色升级与升级选择：
- 玩家拾取 ExpOrb 增加 XP，达到阈值后 Level+1。
- 升级时弹出 UI：随机提供 3 个 Upgrade 选项（从 src/data/upgrades.ts 定义）。
- 选择后立即生效（例如：+10% damage、+15% fireRate、+20 maxHP、+10% moveSpeed 等）。
- 升级 UI 出现时暂停游戏更新（或 timeScale=0），选择后恢复。
- 单测：对 XP 升级阈值计算或升级池抽取（权重随机）进行测试。
- 运行 npm test，并说明如何快速获得经验触发升级（可提供 debug 按键加 XP）。
```

---

# Phase 8：武器升级 + 配件系统深化（构筑开始成型）

## 目标
把武器与配件从“背包里一个物品”升级为“可成长系统”：武器等级、稀有度、配件槽、配件带来的属性变化；可在关卡内或关卡间升级。

## 产出/验收
- 武器具有 Level 与 Rarity（影响基础属性系数）
- 配件可装备到对应槽位，实时改变武器/角色属性
- HUD/背包中可看到最终属性（例如 DPS、射速、装弹）

## 拆分任务
1. Stat 计算：BaseStats + Modifiers（来自升级/配件/武器等级）  
2. WeaponInstance（实例）与 WeaponDef（模板）分离  
3. 配件槽管理（equip/unequip）  
4. UI 展示最终属性

## 给 Codex 的 Prompt（Phase 8）
```text
请升级武器与配件系统：
- 引入 WeaponInstance 概念：WeaponDef 是模板，WeaponInstance 包含 level、rarity、attachments[]。
- 实现统一的属性计算层：finalStats = base * rarityMultiplier * levelCurve + modifiers（来自 attachments 与 player upgrades）。
- 支持至少 3 个配件槽（比如 muzzle/magazine/optic），背包中可以装备/卸下。
- UI 需要展示当前武器的关键最终属性（damage、fireRate、magazine、reloadTime、spread）。
- 单测：对属性计算（给定固定 modifiers，输出应一致）写测试。
- npm test 通过，并说明如何通过掉落或 debug 生成配件来测试。
```

---

# Phase 9：合成与升级（装备合成闭环）

## 目标
实现“合成/升级”玩法：材料与重复装备可合成更高等级/稀有度，形成长期追求。

## 产出/验收
- 合成 UI（可在关卡结算后或关卡内某个站点打开）
- 至少实现 2 类合成：
  1) 材料合成（低→高）
  2) 武器合成/升阶（例如 3 把同类同稀有 → 升 1 级）
- 合成消耗与产出正确，背包更新正确

## 拆分任务
1. CraftRecipe 数据结构  
2. CraftingService：canCraft、craft、consumeItems  
3. Crafting UI：列表 + 合成按钮 + 结果提示  
4. debug：快速生成合成材料

## 给 Codex 的 Prompt（Phase 9）
```text
请实现合成/升级系统：
- 定义 CraftRecipe（src/data/crafting.ts），至少包含：材料升级配方、武器升阶配方。
- 实现 CraftingService：校验材料是否足够、扣除、生成新物品。
- 增加 Crafting UI（按 C 打开/关闭）：展示可合成项、当前拥有数量、合成按钮。
- 合成完成后弹出提示（Toast）并更新背包。
- 单测：对 canCraft/craft 的逻辑进行测试（确保扣除与产出严格一致）。
- npm test 通过，并提供手动验证：生成材料->合成->查看背包变化。
```

---

# Phase 10：完整 UI/UX、打击感与音效（“像游戏”）

## 目标
把“能玩”提升到“好玩”：HUD 完整、动效、音效、屏幕反馈、菜单过渡；让动作流畅且反馈明确。

## 产出/验收
- HUD：HP 条、XP 条、等级、当前武器/弹匣、当前关卡进度（剩余时间/击杀数）
- 反馈：命中闪、暴击提示、屏幕轻微 shake、击杀音效/爆炸音效（可占位）
- 菜单：主菜单/关卡选择/暂停/设置（音量）

## 拆分任务
1. HUD 组件化  
2. 屏幕反馈工具：cameraShake、hitStop（极短暂停）、flash  
3. 音频管理器（BGM/SFX）  
4. Pause 菜单与设置项

## 给 Codex 的 Prompt（Phase 10）
```text
请完善 UI/UX 与打击感：
- 完整 HUD：HP 条、XP 条、等级、武器信息（弹匣/换弹）、关卡目标进度。
- 命中反馈加强：hit flash + 小幅 camera shake；可加入极短 hitStop（例如 30ms）。
- 加入 AudioManager：支持播放 BGM/SFX（资源可用占位，至少代码结构要完整）。
- 加入 Pause：按 ESC 暂停/继续，暂停时显示菜单（继续/返回关卡选择/音量设置占位）。
- 单测可以保持为逻辑层（例如设置音量持久化、HUD 数值格式化）。
- npm test 通过，并给出手动验证清单。
```

---

# Phase 11：存档、关卡解锁、元进度（Meta Progression）

## 目标
实现长期留存：通关解锁关卡/难度；玩家拥有永久资源；本地存档（localStorage）。

## 产出/验收
- localStorage 存档：已解锁关卡、货币、已获得图鉴（可选）
- 关卡选择界面显示锁定/解锁状态
- 结算奖励写入存档，刷新后保留

## 拆分任务
1. SaveData schema（版本号、迁移策略）  
2. SaveService（load/save/reset）  
3. 解锁逻辑与 UI 展示  
4. Debug：清档按钮（开发用）

## 给 Codex 的 Prompt（Phase 11）
```text
请实现存档与元进度：
- 定义 SaveData（包含 version、unlockedLevelIds、credits、options 等）。
- 实现 SaveService：load/save/reset，使用 localStorage，支持版本号（未来可迁移）。
- 通关关卡后写入奖励（credits）并解锁下一关。
- LevelSelectScene 显示关卡锁定状态，锁定关卡不可进入。
- 提供开发用“清空存档”按钮（仅开发环境显示即可）。
- 单测：对 SaveService（序列化/反序列化、默认值回退、版本字段）测试。
- npm test 通过，并说明刷新页面后存档仍生效的验证方法。
```

---

# Phase 12：性能优化、内容扩展与发布（收尾交付）

## 目标
让游戏在浏览器稳定运行并可发布：性能、兼容、可玩内容数量、基础平衡、部署。

## 产出/验收
- 性能：敌人 100+、子弹大量时仍可玩（对象池/剔除/碰撞优化）
- 内容：至少 5 个关卡、≥4 种敌人、≥6 把武器、≥10 个升级项、≥10 个配件、≥6 个合成配方
- 发布：`npm run build` 产物可部署，提供部署说明（Vercel/Netlify/GH Pages 任一）
- QA：关键 bug 清单关闭，基础平衡可通关

## 拆分任务
1. 对象池覆盖（敌人/子弹/飘字/掉落）  
2. 碰撞优化：分层碰撞、距离裁剪、降低检查频率  
3. 内容补齐（仅改 data 文件）  
4. 发布脚本与 README

## 给 Codex 的 Prompt（Phase 12）
```text
请对项目进行性能与发布收尾：
- 检查并确保 Bullet/Enemy/Pickup/FloatText 等使用对象池复用，避免频繁 new/destroy。
- 为碰撞加入简单的距离裁剪或分组管理，减少无谓检测。
- 扩充 data：增加关卡、敌人、武器、配件、升级、合成配方（优先通过配置实现，不要大量改逻辑）。
- 完善 README：本地运行、构建、部署（给出一种方案即可）。
- 运行 npm run build 并确保通过；npm test 通过。
- 最后输出：性能改动点清单 + 你建议的后续优化方向。
```

---

## 5. 可选增强 Phase（如果你要“更像完整商业 Demo”）

### A. Tilemap + 程序化关卡（增强可玩性）
- 支持 Tiled 地图导入（障碍、碰撞层、刷怪点层）
- 或做程序化房间拼接（roguelike）  
**建议插入在 Phase 5 之后、Phase 6 之前**（影响刷怪与导航）

### B. 路径寻路（导航网格/简化 A*）
- 如果地图障碍多，追踪敌人需要绕行，可引入简化网格寻路  
**建议：先用简单 steering + 障碍避让，除非确实需要 A***

### C. 武器特殊效果（增强爽感）
- 穿透、链式闪电、爆炸、毒 DOT、冰冻减速等  
通过 OnHitEffect 系统做插件化

---

## 6. 给 Master Agent 的“每轮迭代”标准模板（强烈建议照抄）

> 你每次给 Codex 的任务都用这个框架，能显著提升迭代质量。

```text
【上下文】
我们在做一个 Phaser3 + TS 的异星球 2D 俯视角射击网页游戏。当前已完成：<列出已完成内容>。

【本轮目标】
只实现：<一个很小的目标>。
不要做额外功能，不要重构整个项目。

【约束】
- 保持数据驱动：新增内容尽量写在 src/data。
- 保持模块边界：scene/entity/system/ui/core。
- 需要对象池/性能考虑的地方要说明。
- 代码要能运行：npm run dev。
- 必须跑：npm test（或 npm run lint），并贴出摘要结果。

【交付物】
- 变更文件列表 + 简述
- 如何手动验证（步骤）
- 测试命令与结果摘要
- 下一步建议（可选）
```

---

## 7. 手感与“动作流畅”的关键清单（贯穿所有 Phase）

> Master Agent 可以把这份清单当作验收标准，每次都检查。

- **输入延迟**：键盘移动即时响应；鼠标转向不抖动。  
- **移动平滑**：有加速度/阻尼或 lerp，停止时不突兀。  
- **旋转平滑**：角度插值、最大角速度限制，避免快速抖动。  
- **相机**：跟随平滑，不要“锁死”导致眩晕；可加轻微偏移（朝向前方一点点）。  
- **射击**：稳定射速、清晰散布、换弹反馈明显。  
- **命中反馈**：至少有一项（闪白/飘字/音效/抖动/短暂停）。  
- **性能**：波次上来后仍稳定，不因 GC 卡顿。

---

## 8. 最终交付定义（Definition of Done）
当以下全部达成，可视为“完整产品/完整项目”：
1. 主菜单 → 关卡选择 → 进入关卡 → 通关/失败 → 结算/解锁 → 返回关卡选择，闭环完整  
2. 角色升级 3 选 1 生效，武器/配件系统可构筑  
3. 掉落、拾取、背包、装备、合成全部可用  
4. ≥5 关卡 + 基础内容量（敌人/武器/升级/配件）  
5. 存档可用（刷新页面保留解锁与资源）  
6. 构建通过、测试通过、可部署（README 清晰）

---

### 你接下来要做的事情
- 直接把这个 MD 发给你的 Master Agent。  
- Master Agent 从 Phase 0 开始，一次只让 Codex 做一个小步，严格要求“运行 + 测试 + 回报结果”。

祝迭代顺利。需要我把某个 Phase 再拆成更细的 20~50 个小任务清单（逐条可投喂 Codex）也可以。
