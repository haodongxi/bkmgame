# AI 交接文档（2026-08-17 · Remote PvP）

## 这份文档的用途

给下一位 AI 直接接手当前开发上下文，避免重复摸索。

## 仓库与分支

- 客户端仓库：`/Users/haodongsheng/git/bkmgame`
  - 当前分支：`codex/bkm-remote-battle`
- 服务端仓库：`/Users/haodongsheng/git/bkmserver`
  - 当前分支：`main`

## 非常重要的工作边界

用户明确要求：

- 服务端代码只在 `bkmserver` 里更新
- 客户端代码只在 `bkmgame` 里更新
- 不要跨仓混改

如果一个需求同时涉及前后端，要先拆开，再分别在对应仓库里修改。

## 可参考的现有文档

- 单机项目总会话总结：[`docs/SESSION_SUMMARY_2026-08-17.md`](file:///Users/haodongsheng/git/bkmgame/docs/SESSION_SUMMARY_2026-08-17.md)
- 联机 PvP 会话总结：[`docs/SESSION_2026-08-17.md`](file:///Users/haodongsheng/git/bkmgame/docs/SESSION_2026-08-17.md)
- 抓宠辅助招式 MVP：[`docs/MVP_CAPTURE_ASSIST_2026-08-17.md`](file:///Users/haodongsheng/git/bkmgame/docs/MVP_CAPTURE_ASSIST_2026-08-17.md)
- 联机死亡后强制选首发 MVP：[`docs/MVP_REMOTE_SWITCH_PROMPT_2026-08-17.md`](file:///Users/haodongsheng/git/bkmgame/docs/MVP_REMOTE_SWITCH_PROMPT_2026-08-17.md)

## 当前已经确认的产品规则

### 1. `点到为止`

- 只对**野生宝可梦**生效
- 若本次伤害本来会击倒目标，则强制保留 `1 HP`
- 训练家战 / 道馆 / 火箭队 / 双塔不生效

说明：用户曾质疑“没有保留 1 HP”，后通过截图确认其测试场景其实是训练家战，因此规则没有问题。

### 2. 联机开发边界

- 联机 PvP 客户端属于 `bkmgame/js/remote.js`
- `bkmserver` 是服务端权威结算，客户端只负责展示与提交指令

### 3. 单机与 PvP 要分开

用户明确要求：

- 只改 PvP 的地方时，不要波及单机界面
- 不要修改用户单机存档本体
- 进入联机时可以做 PvP 专用映射/变换，但退出联机后要保持进入前的原状态

## 这轮已经完成的联机客户端改动

### 已实现：PvP 中宝可梦倒下后强制弹框选下一只

只改了 `bkmgame` 客户端，没有改服务端。

实现效果：

- 在联机 PvP 的 `pending_switch` 状态下
- 不再把候选宝可梦按钮平铺在主操作区
- 改为自动弹出“选择下一只出战宝可梦”弹框
- 选择后继续沿用现有服务端流程
- 若已提交换人，则主操作区显示“已提交换人，等待对方……”
- 若对局结束，会自动清掉这个弹框
- 单机战斗界面完全没动

主要代码位置：

- [`js/remote.js`](file:///Users/haodongsheng/git/bkmgame/js/remote.js)
  - 增加 `switchPromptKey`
  - 增加 `remoteSwitchCandidates`
  - 增加 `remoteOpenSwitchPrompt`
  - 增加 `remoteCloseSwitchPrompt`
  - 增加 `remoteSyncSwitchPrompt`
  - 修改 `remoteActions`
  - 修改 `remoteRenderBattle`

对应测试：

- [`test/browser_play.js`](file:///Users/haodongsheng/git/bkmgame/test/browser_play.js)
  - 新增联机 `pending_switch` 的浏览器测试
  - 通过伪造远程对战视图验证弹框、提交 `switch`、等待提示

验证结果：

- 浏览器冒烟：`179 / 179` 通过
- `0` 异常
- `0` 控制台错误

## 这轮刚讨论但**尚未实现**的需求

用户提出两个 PvP 规则想法：

1. 进入 PvP 后，宝可梦自动变成满级
2. 进入 PvP 后，宝可梦血量乘以一个倍数

### 当前讨论结论

#### 关于满级

- 用户接受 `PvP 统一 Lv100`
- 这个方向是合理的
- 但必须满足：
  - 只影响 PvP
  - 不修改单机存档中的原始等级
  - 退出联机后恢复进入前状态

实现上建议：

- 优先做成“上传队伍到 PvP 时的映射”
- 或在服务端构建 PvP 队伍时统一转成 `Lv100`
- 不要直接改 `STATE.party` 里的单机队伍数据并保存

#### 关于 HP 倍率

用户追问是否能直接用现有伤害公式，把 PvP HP 放大到 `x10`，后来又问“乘以 10 可以吗”。

当前建议结论：

- 技术上当然可以跑，不是公式算不了
- 但 `HP x10` 会极大拉长 PvP 节奏，并放大固定回复、固定伤害、PP 压力等平衡问题
- 如果只是想避免对局过于容易秒人，更建议先只做 `Lv100`
- 如果未来还觉得太脆，再评估 `x2` 或 `x3`

非常关键：

- **HP 倍率如果要真正生效，必须改 `bkmserver`**
- 因为 PvP 的真实 HP、伤害、道具回复、胜负都在服务端结算
- 客户端只改显示是没用的，还会和服务端状态打架

所以：

- `Lv100` 可以优先安排
- `HP x10` 当前没有拍板实现
- 若后续要做 HP 倍率，请把它当成**服务端改动**处理，不要只改客户端

## 当前建议的下一步

如果下一位 AI 要继续干，推荐按这个顺序：

1. 先和用户确认：
   - PvP `Lv100` 是否现在就做
   - HP 是否暂时不做，还是要改成 `x2/x3/x10`
2. 如果只做 `Lv100`：
   - 按“只影响 PvP、不改单机存档”的原则设计
   - 若用户坚持“客户端只改客户端、服务端只改服务端”，则需要判断这次需求属于哪一侧
3. 如果要做 HP 倍率：
   - 归类为服务端需求
   - 去 `bkmserver` 里改，不要在 `bkmgame` 里伪造显示

## 当前仓库状态

本次保存交接文档时，检查结果：

- `bkmgame` 当前分支：`codex/bkm-remote-battle`
- `bkmserver` 当前分支：`main`
- 两边执行 `git status --short` 时未看到额外未提交改动输出

## 给下一位 AI 的一句话

现在最重要的不是重做联机界面，而是继续沿着“PvP 专属逻辑与单机隔离”的原则推进：  
客户端只做 PvP 客户端表现，服务端只做 PvP 权威结算，任何会影响真实 HP / 伤害 / 胜负的数据改动，都优先判断是不是应该落在 `bkmserver`。
