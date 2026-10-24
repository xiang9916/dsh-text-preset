# dsh-text-preset

> **DeepSeek Harness (DSH) 纯净写作协作预设插件**  
> fork 自 [船板 / `chuanban-dsh-writingset`](https://github.com/Anarcadia/chuanban-dsh-writingset)（MIT）  
> *Minimal writing-collaboration preset for DeepSeek Harness — zero coding noise, `read / write / edit`, read-only `glob / grep`, safe `copy / move / trash / stat`, zero-dep `docx ↔ md` bridge, and modular role prompts.*

**极简介绍**：船板自用 DSH 写作工作台，砍掉 DSH 所有系统提示（接近极简模式），同时比极简模式增加贴合写作全流程的本地工具集（读写改、只读查找、可恢复文件整理、Word 稿件进出），添加情境代入写作人设，帮助 Agent 更好代入。

**关于本仓库**：这是 `xiang9916` 的个人 fork，包名与插件身份已调整为 `dsh-text-preset`，功能、补丁逻辑与预设内容与上游保持功能一致，方便作为自己的写作预设基底继续改造。本仓库已清空上游历史，从单一初始提交开始独立演进。代码基线为上游 **v0.3.0**；本仓库版本号自 **0.2.1** 起独立演进，并跟随 DSH 版本对齐（当前 **0.2.1-rc.3**），与上游 0.3.0 不存在“版本落后”关系。安装前请确认版本与你的 DSH 匹配。

插件本身不具备破限和风格指定效果，破限和风格指定需要用户在工作区添加世界观和写作风格资料、伪上下文；插件预设起到的作用，是帮助 Agent 更好地接受和理解你的设定，就像药引子。

插件有 2 件套，可搭配船板的仿 Claude 暖纸皮肤 [`chuanban-dsh-theme`](https://github.com/Anarcadia/chuanban-dsh-theme) 使用。

---

写作者需要的 Agent 工作台其实极其简单：

**一个由本地文件夹与 Markdown 文档构成的工作区**

**一个不受工具说明和编程提示词干扰，系统提示词专为沉浸写作设计的 Agent 伙伴。**

大多数通用或编程向 Agent 默认在后台塞入了数千字的“资深软件工程师”规训、代码规范、沙箱审批说明与庞大的工具链。拿它们来推敲小说、打磨长文或对戏时，模型总会带着强烈的“程序员肌肉记忆”——聊着天擅自落盘建文件、改完一段文字还要像交代码 PR 一样列出 `1. 2. 3.` 修改汇报，甚至时不时跳出语境做温和化说教。

DSH 在这一点上也不例外。虽然它内置了「极简模式（`minimal`）」，但那是一个近乎 0 提示词、0 文件工具的跑分向模式。在清掉噪音的同时，也失去了对 Agent 写作身份的引导与最基础的本地读写工具，因此并不适合直接拿来写作。

`dsh-text-preset` 的目标只有一件事：**赋予 DSH 极简、稳定的基础写作预设和工具环境**。

它在 DSH 运行时将原生编程提示词与冗余工具一刀切清零（**零 Shell 命令执行通道**），把工具面精准收敛为写作者真正用得上的四组纯路径工具——基础读写（`read` / `write` / `edit`）、只读查找（`glob` / `grep`）、安全文件整理（`copy_file` / `move_file` / `trash_file` / `stat_file`）与零依赖 Word 单向桥（`convert_document` / `export_document`），再加上联网检索（`web_search` / `web_fetch`）与技能加载（`skill`），再用**「去工程化的用户协作基底 + 极简写作人设」双层提示层**接管上下文。

于是，首轮输入仅千余 tokens（仍比官方标准预设节省 **70% 以上**），让 DSH 成为一张高效、低底噪的纯文字工作台。

用户还可通过后台设置，选择加载工作台 `AGENTS.md` / `CLAUDE.md` 等通用 Agent 规则文档，与上述的二层提示词叠加，构成**三层提示层**，因此此插件不会与本地 Skill、工作区预设冲突。

然而，和其它同样修改 DSH 初始系统提示词的写作预设插件会有潜在冲突，不建议一同开启，或者建议发送给 AI 分析确保无冲突后再使用。

---

## 安装

### 1. npm（推荐）

```sh
dsh plugin --profile web add dsh-text-preset
dsh web
```

- 锁定版本：`dsh plugin --profile web add dsh-text-preset@0.2.1-rc.3`
- **未全局安装 `dsh` CLI**：将上面的 `dsh` 替换为 `npx @deepseek-ai/dsh`。

> **版本对应关系**：本插件按 DSH 版本对齐发布——插件 `0.2.1-rc.3` 对应 DSH `0.2.1-rc.3`。
> npm 上 `latest` 与 `next` 均指向 `0.2.1-rc.3`；老版本 `0.2.1`（稳定号命名）保留但已落后，不建议再装。

### 2. GitHub Release（tgz）

```text
https://github.com/xiang9916/dsh-text-preset/releases/latest/download/dsh-text-preset.tgz
```

DSH Desktop 打开侧栏 **插件 → 添加插件**，粘贴上面的 URL 即可；CLI 用法：

```sh
npx @deepseek-ai/dsh plugin --profile web add https://github.com/xiang9916/dsh-text-preset/releases/latest/download/dsh-text-preset.tgz
```

### 3. 从源码安装

```sh
npm pack
dsh plugin --profile web add ./dsh-text-preset-0.2.1-rc.3.tgz
```

也可以直接运行仓库自带的注册脚本（以 symlink 方式挂进桌面版 profile，带备份、可重复执行，改完源码无需重新打包）：

```sh
./scripts/install-desktop.sh
```

### 4. 安装上游原版

如果只想用船板的原版，直接装上游 Release（包名仍是 `chuanban-dsh-writingset`）：

```text
https://github.com/Anarcadia/chuanban-dsh-writingset/releases/latest/download/chuanban-dsh-writingset.tgz
```

- **连同配套暖纸皮肤（[`chuanban-dsh-theme`](https://github.com/Anarcadia/chuanban-dsh-theme)）一起装**：

  ```sh
  dsh plugin --profile web add https://github.com/Anarcadia/chuanban-dsh-writingset/releases/latest/download/chuanban-dsh-writingset.tgz https://github.com/Anarcadia/chuanban-dsh-theme/releases/latest/download/chuanban-dsh-theme.tgz
  ```

安装后，前台预设选择器默认切入 **「文本模式」** （初始激活「纯净通用写作底座」预设）。所有职能切换与工作区规则注入均可在 **侧栏「插件」→ 已安装插件 → `dsh-text-preset`** 的配置页里热切换，新开会话即刻生效，无需重启。

## 从 `chuanban-dsh-writingset` 迁移

从上游插件切换过来时，如果 profile 里还留着旧插件的用户覆盖配置（`~/.dsh/profiles/<profile>/cordis.patch.yml`），日志里可能出现：

```text
patch: name mismatch for "writing-brick-injector"
(expected "dsh-text-preset", got "chuanban-dsh-writingset"), skipping
```

原因：两个插件都使用 `writing-brick-injector` 这个节点 id。配置合成按 id 合并，旧条目的 `name` 仍是上游包名，于是整段配置（`activePreset`、`customPromptOverride` 等）被静默跳过。

迁移步骤：

1. 卸载旧插件：

   ```sh
   dsh plugin --profile desktop remove chuanban-dsh-writingset
   ```

2. 打开 `~/.dsh/profiles/desktop/cordis.patch.yml`，把旧条目：

   ```yaml
   - id: writing-brick-injector
     name: chuanban-dsh-writingset
   ```

   改成：

   ```yaml
   - id: writing-brick-injector
     name: dsh-text-preset
   ```

   也可以直接删掉该条目，安装后在**侧栏「插件」→ `dsh-text-preset`** 的配置页里重新选择。

3. 预设 ID 有变化，按需修正 `activePreset`：

   | 旧值 | 新值 |
   | :-- | :-- |
   | `pro` | `pro`（不变） |
   | `play` | `research`（公文研究） |
   | `pro-v1` | `office`（公文办公） |
   | `rp` | `rp`（不变） |
   | `pure` | `pure`（不变） |

4. 重启 DSH，使 profile 重新合成。

## 兼容性

- 已验证的 DSH 版本：**0.2.1-rc.3**（同区间内 **0.2.1-rc.2** 亦可运行——rc.2 → rc.3 只改版本号，插件所依赖的包接口零差异）
- `package.json` 声明 `engines.dsh: ">=0.2.1-rc.2 <0.3.0"`，该区间同时覆盖 rc.2 与 rc.3，DSH Market 可据此显示兼容状态，而不是 `unknown`
- 插件依赖 0.2.x 的预设与补丁接口；DSH 0.3.x 尚未验证，升级前请先确认

---

## 快速上手：用「三层提示层」搭好你的写作台

打开 DSH 侧栏 **插件 → 已安装插件 → `dsh-text-preset`**，配置页由上至下对应了这套**三层提示层**的组装逻辑：

> DSH 0.2.1 起，插件的配置页统一放在侧栏「插件」里；`设置（Cmd + ,）→ 内置插件` 只保留只读的插件清单，不再承载本插件的设置。

### 第一、二层：去工程化协作基底 + 写作职能人设

所有预设默认勾选同一块约 640 字符的第一层基底——**【文档与工具准则】**（规定对话优先、未获明确指令严禁擅自建文件；改稿“无痕修改”、保持原本文风与排版；彻底去 AI 味、摒弃软件工程术语与机械分点；联网查证未经许可不可直接引用；技能加载冲突以用户最新指令为准）。

在这块干净基底之上，你可以选择叠加哪一块第二层 **「写作职能人设」**：

| 预设 ID               | 名称                               | 适用场景与核心导向                                                                                                               |
| :------------------ | :------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **`pure`** *(默认)*   | **纯净通用写作底座**<br>*(零预设人设白板)*      | **日常专栏、散文随笔或完全自定义角色**。仅保留底层【文档与工具准则】，不预置任何角色倾向，完全交由你的首轮指令或工作区文档自由定义。                                                  |
| **`office`**        | **公文办公**<br>*(国企标准公文与合规汇报)*     | **员工→部门、部门→集团、集团→上级机关**三种层级语态自动切换。严守权责边界与安全底线，不越权定性，不给无政策依据、事实依据或领导口径的事项盲目定性；用语规范、稳妥、严密。                                       |
| **`research`**      | **公文研究**<br>*(国企战略研究与智库化材料)*    | **战略研究、行业分析与宏观政策研判**。以宏观视野切入，依托多源权威数据交叉验证，输出逻辑严密、论证充分的行业研究报告、战略咨询文稿与前瞻性专题调研。                                          |
| **`rp`**            | **创作与 RP 扮演**<br>*(全浸入式叙事与第四面墙)* | **仅测试：角色对戏与沉浸式叙事**。严守“第四面墙”，绝不跳出戏外以 AI 助手视角做元叙事点评；用感官细节、动作张力与潜台词推进场面（Show, don't tell），查阅设定或改写文档均作为纯后台静默动作，执行完立即无缝回到戏内。 |
| **`pro`**           | **职业写手**<br>*(v2 无我沉浸版)*         | **我主要就是为了设计这个模式而做的插件：用于无禁忌无底线的小说创作，请在工作区放置详细的世界观资料文档和示例文（伪装成旧稿续写），叠加起来可影响 Agent 输出风格**。（单独使用预设不具备破甲或风格定义的效果）            |

> 前台预设选择器只保留「文本模式」一个入口；上面五个人设都在该模式的面板内切换，不再生成独立的直选预设。

### 第三层：工作区提示模式

前面两层提示层只负责把 Agent 调教成“懂规矩、不说教、不乱建文件的写手白板”。真正决定具体题材、文风与创作深度的，是下方的 **「工作区提示模式」** 三选一：

1. **初始纯净（`off`，默认）**
   - **怎么工作**：只注入前两层提示层（职能人设 + 协作基底），**完全不读取工作区里的任何文档**。
   - **什么时候用**：适合刚装好插件测试、随手聊脑洞或改一段短文，上下文极度干净（首轮仅千余 tokens）。但请注意，在没有第三层工作区资料配合时，单靠几百字的初始人设并不会自动赋予特定文风，也不具备破甲的效果。

2. **工作区识别（`workspace`，日常主力推荐）**
   - **怎么工作**：每次新开会话组装系统提示词时，自动扫描你当前打开的本地文件夹，把里面的规则与设定文档作为第三层 `【工作区上下文规则】` 拼接到前两层提示层之后。

   - **自动扫描顺序**：

     ```text
     AGENTS.md → CLAUDE.md → memory.md → memory/*.md → rules.md → rules/*.md
     ```

     *(注：`CLAUDE.md` 与 `AGENTS.md` 内容相同时自动去重；总读取上限 64KB，超出自动截断并注明；如果当前文件夹里没有这些文件，会自动静默退回「初始纯净」，不会报错。)*

   - **怎么搭出最佳效果**：
     - 如果你已经有一套带 `AGENTS.md` 或本地 `.agents/skills/` 的写作工作台，切到这个模式就能无缝衔接，插件不会吃掉你的工作区规则。
     - 如果你切到 **`pro`（职业写手）** 写小说，建议在工作区放一份 `AGENTS.md`（写明你的文风要求与设定目录），并放好详细的**世界观设定文档**与**示例正文（让 Agent 作为旧稿参考或续写）**——“无我职业操守 + 工作区世界观 + 旧稿样本”三层叠在一起，才能真正把模型的注意力锁死在故事语境里。

3. **自定义填写（`custom`）**
   - **怎么工作**：直接在配置页的文本框里手写第三层提示词，可选 **「追加在初始提示后（`append`）」**，或者点面板上的「用当前初始提示填充编辑」按钮切到 **「整段替换初始提示（`replace`）」** 直接改写默认提示层。
   - **什么时候用**：不想在本地文件夹里建 `AGENTS.md`，但想临时加几条人设、文风要求或直接微调内置提示词时使用。

---

## 底层做了什么？（为什么不与本地 Skill 冲突，但忌叠装同类预设插件）

DSH 原生的 `minimal` 模式之所以不能直接用来写东西，是因为它把文件工具也一起砍掉了；而官方默认模式又挂满了工程插件。本插件在底层通过 `cordis.patch.yml` 与内置子模块做了精确改造：

- **接管并重构主系统提示词（`complete: true`）**：在 `@deepseek-ai/dsh-persona` 开启 `complete: true`，将渲染终点的系统提示词收束为 `{{writing_active_brick}}` 变量，一刀切掉官方数千字的全栈工程师人设。
  - **为什么不与本地工作台/Skill 冲突**：插件在宿主侧通过 `workspace` 模式主动读取当前会话目录（`cwd`）下的 `AGENTS.md` / `CLAUDE.md` / `memory` / `rules` 并拼入 `{{writing_active_brick}}`（64KB $O(1)$ 安全截断），等于在干净的底座上为你留好了标准的工作区规则入口。
  - **为什么不建议与其它系统提示词插件同开**：因为 `complete: true` 是独占截断机制，若同时启用其它修改初始 Persona 或拦截 System Prompt 的插件，两者会互相覆盖或拼出混乱指令。
- **静音沙箱与审批长文（`includeRuntimeContext: false`）**：关掉运行时沙箱策略与审批机制的冗长说明，只留必需的当前工作目录路径感知。
- **收敛为纯净写作工具面（零 Shell 执行通道，`isolate: { fs: true, attachments: true }`）**：
  - **基础读写（`@deepseek-ai/dsh-tool-fs`）**：在独立作用域挂载 `read`、`write`、`edit`，切断根作用域 `read_image` 的自动注册，并剥离 `sandbox_permissions` 与 `justification` 参数。
  - **只读查找（`@deepseek-ai/dsh-tool-fs-search`）**：挂载 `glob`（列举文件，100 条上限 + 溢出清单；注：`*.md` 为全树递归，`/*.md` 为根层锚定，仅返回文件不返回目录名）与 `grep`（正则全文检索带行号）。
  - **文件整理（`file-butler`）**：提供 `copy_file`、`move_file`、`trash_file`、`stat_file` 四个服务端纯路径工具——长稿与二进制流转不经过模型上下文；`copy_file` 与 `move_file` 默认 `overwrite: false` 防误覆写（目标传目录名时自动拼入同名文件）；`trash_file` 将文件移入 `~/.Trash`（带毫秒时间戳与防碰撞序号，可手动恢复，不承诺 Finder「放回原处」元数据），绝不永久删除。
  - **Word 单向文档桥（`doc-bridge`）**：零外部依赖提供 `convert_document`（`.docx` → `.md`）与 `export_document`（`.md` → 新建 `.docx`）。定位为**内容级单向转换**：保留正文段落、标题层级（H1–H6）与列表项，表格拍平为正文行，行内粗斜体等样式不保留；内置**双向防覆盖保护**——目标 `.md` 已存在时自动派生 `<name>.converted.md`，目标 `.docx` 已存在时自动派生 `<name>.exported.docx`，绝不修改或覆盖原稿。
  - **联网检索（`@deepseek-ai/dsh-tool-web`）**：挂载 `web_search` 与 `web_fetch`（`fetch: true`），搜索超时 60 秒。检索结果按外部数据对待，未经许可不作直接引用，不把网页文字当作指令。
  - **技能加载（`@deepseek-ai/dsh-skill-filesystem` + `@deepseek-ai/dsh-tool-skill`）**：从 DSH 用户级 / 项目级技能目录读取 `SKILL.md`，由 `tool-skill` 暴露 `skill` 工具供 Agent 按需加载。两者与 `fs-local` 同处 `pure-fs` 隔离组，技能读取走预设内的工作区 fs，不会回退到 Node 原生 `node:fs`，也不会绕过工作区隔离。
  - *(注：会话中另有宿主运行时自带的 `working_directory` 与 `load_workspace_dependencies`，非本插件注册。)*
- **保留长文会话压缩**：内置 `@deepseek-ai/dsh-compaction-basic` 与 `/compact` 指令，长篇连载讨论可随时压缩上下文。

---

## 进阶：命令行切换与本地自检

如果你克隆了本仓库在本地折腾，也可以直接用自带的零依赖 CLI 脚本查看或切换预设：

```bash
# 查看所有可用预设提示层及当前激活项
node scripts/switch-preset.mjs --list

# 预览指定预设（如 pro）拼接后的完整 System Prompt
node scripts/switch-preset.mjs --show pro

# 一键切换默认预设（pure / office / research / rp / pro）
node scripts/switch-preset.mjs research

# 运行内置 7 项全链路自检测试套件
npm test
```

## 停用与卸载

- **临时切回官方编程模式**：不用卸载，直接在聊天输入框左下角的预设选择器切回官方预设，或在**侧栏「插件」→ `dsh-text-preset`** 详情页关掉本插件开关即可。
- **卸载插件**：
  - **DSH Desktop**：侧栏「插件」→ 已安装插件 → `dsh-text-preset` → 点击卸载。
  - **DSH CLI**：`dsh plugin --profile web remove dsh-text-preset`

## License

[MIT](LICENSE) © 船板（上游 `chuanban-dsh-writingset`）· fork 维护：xiang9916

本项目基于 [Anarcadia/chuanban-dsh-writingset](https://github.com/Anarcadia/chuanban-dsh-writingset)（MIT）fork，保留原作者版权声明。

本仓库已清空上游 git 历史（单一初始提交，无共同祖先），不与上游做 merge/rebase 同步。如需对照上游代码，可临时添加远端后仅做文件级查看：

```bash
git remote add upstream https://github.com/Anarcadia/chuanban-dsh-writingset.git
git fetch upstream            # 仅用于查看/对照
git remote remove upstream    # 对照完可移除
```
