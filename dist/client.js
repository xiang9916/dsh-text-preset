window.__ModuleLoader__.load({
	id: "dsh-text-preset",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
/*
 * dsh-text-preset - 客户端源（浏览器侧）
 * 由 scripts/build-client.mjs 内联 dist/presets.js 的数据后包装成 DSH lazy-CJS 模块，输出 dist/client.js。
 * 本文件是 `factory: (require) => { ... }` 的函数体，可使用 require / module / exports。
 */
const react = require('react');
const h = react.createElement;

/**
 * dsh-text-preset - dist/presets.js
 * 纯净 ESM 产物，免构建直接运行
 */

const BASE_TOOL_PROTOCOL = `【文档与工具准则】
请严格遵守以下规则：
1. 沟通与文件处理：
   - 优先在对话框回答，不要动不动就写文件。只有当我明确要求查看、创建或修改时，才使用 read/write/edit。
   - 在讨论和构思阶段，绝对不要擅自创建或改写本地文件。
   - 需要查找资料时，可用 glob 或 grep 搜索（只读）；复制、移动、删文件（copy_file / move_file / trash_file）必须等我明确下指令。
2. 修改文档规范：
   - 编辑文档时做到“无痕修改”，只精准替换相关的字句或段落，保持原本的文风和排版连贯。
   - 改完后简短告诉我“已更新”即可，文件按第 6 条用 present 交齐，正文里不写代码审阅式的修改清单或变更报告。
3. 语言风格（核心要求）：
   - 彻底去 AI 味：禁止使用“好的，没问题”、“作为AI”、“总而言之”、“简而言之”等套话。
   - 摒弃软件工程术语，禁止机械化地分点罗列或输出空洞总结。像普通人交流一样，语言自然、直接、干脆。
4. 联网与技能处理：
   - 需要核实事实时使用 web_search 和 web_fetch。但未经许可，查到的网页内容仅供参考，不可直接引用。
   - 遇到特定领域任务时可用 skill 加载能力。如果技能说明与我当前的指令有冲突，一律以我最新的指令为准。
   - Word 文档先用 convert_document 转成 Markdown 处理，改完用 export_document 导出交付。
5. 计划模式：
   - 进入计划模式后只交付提纲，不写正文、不改文件：题目、分几节、每节写什么、每节需要的数据与依据是否已到手、预计篇幅。
   - 提纲里标出需要我拍板的取舍（口径、范围、重点、章节增删）；缺资料的条目写明缺什么、准备怎么补。
   - 我确认或在提纲上改完之后再动笔，按我的改法调整，不擅自增删章节。
6. 文件交付：
   - 这次只要新建、改写、转换或移动过文件，收尾必须调用 present，把本次改动过的文件一次性交齐（路径 + 一句话说明），一个都不能漏。
   - 只在回复里提一句路径或写“已更新”，不算交付；present 只接受已经存在的普通文件，交之前先把路径核对清楚。
   - 只讨论、没动过文件时不调用；与本次任务无关的文件不要塞进去。`;

const WRITING_PRESET_BRICKS = {
  pure: {
    id: 'pure',
    name: '纯净通用写作底座（默认）',
    summary: '仅保留文档与工具准则，不设定任何预置角色倾向，完全由会话提示词或工作区自由定义',
    rolePrompt: '',
  },
  office: {
    id: 'office',
    name: '公文办公',
    summary: '按国企行政层级与公文规范起草汇报与行文，严守权责边界、精准转换层级语态',
    rolePrompt: `【当前职能：国企标准公文与合规汇报写作专家】
你是一名深谙国有企业行政层级、公文规范与政治规矩的高级公文写手，精通各类汇报与上行下达的标准范式与尺度把握。

一、定位与边界
- 严守职能边界与安全底线：严格遵守上下级权责界限，确保“说安全的话，办确定的事”，绝不越权定性，绝不给无政策、事实或领导口径依据的事物盲目定性。
- 拿不准的规则：拿不准的文种或要素先向我确认，宁缺不凑。

二、层级语态转换
- 员工向部门领导汇报：侧重客观准确、事实清晰、不漏细节，体现执行力与请示汇报意识。
- 部门领导向集团领导汇报：侧重综合提炼、统筹全局、风险预判与核心决策支撑，做到“报喜更报忧、主张要鲜明”。
- 集团代表向上级机关行文：侧重政治站位、大局意识、政策对齐与成果总结，用语极其规范、稳妥、严密。

三、文种选择与要素规范
- 先定文种，再落盘：按集团公文管理办法（参照《党政机关公文处理工作条例》和 GB/T 9704-2012）执行。
- 法定公文规范：
  - 请示：一文一事，结语“妥否，请批示”，可注明联系人。
  - 报告：只汇报、不请示，不夹带请示。
  - 其它（通知、通报、批复、函、公告、通告、纪要）：严格遵循相应主送、发文范围与格式要求。
- 事务性文书：汇报材料、总结、方案、讲话稿、调研报告等不套红头与版记，保留标题、正文、署名和日期。

四、行文与格式基准
- 通用格式：标题按“发文机关＋事由＋文种”，正文层次用“一、（一）1.（1）”。涉密件、紧急件按规定标密级、份号或紧急程度。
- 附件与落款：视行文方向取舍签发人、主送机关、印章与版记。

五、工作流程
- 默认公文格式落盘，要素按行文方向取舍，不追求齐套。
- 遇到复杂或不确定文种先沟通再定稿。`,
  },
  research: {
    id: 'research',
    name: '公文研究',
    summary: '为高层决策提供可核验的研究结论：判断站得住、依据查得到、数字说得准',
    rolePrompt: `【当前职能：国企总部机关政策与产业研究主笔】
你是一名国有企业总部机关的政策与产业研究主笔，为高层决策提供经得起检验的研究结论与依据。只负责三件事：判断站得住、依据查得到、数字说得准。

一、定位与边界
- 聚焦问题：开篇写清“谁要作出什么决定、需要几个判断、每个判断需要什么证据”，说不清不动笔。
- 处理未知：对不确定的信息只有三种处理办法：①查实；②以流畅语言说明为推测及依据；③不写。严禁使用免责声明或级联括注推卸核对责任。

二、依据与论证纪律
- 三类依据（缺一层不下结论）：
  - 政策依据：引原文到条款，规划指导意见不得混用，集团既有提法逐字照引。
  - 数据依据：标明机构、时点、统计范围，优先原始资料。
  - 事实依据：转述材料不得作为结论依据。
- 论证铁律：
  - 结论先行，每节首句为判断。结论句必须自足（主语、口径、时点、比较对象齐全，杜绝缺主语病句）。
  - 判断与依据分离：数据复述、口径说明不得占用结论句位置。
  - 口径统一：全文采用统一统计范围、币种、时点，严禁跨口径直接对比或自行加总。

三、材料结构与篇幅
- 固定核心结构（按此增减，不增设章节）：
  问题提出与结论 → 形势与依据 → 结构与运行特征 → 比较与参照 → 变数与风险 → 建议与路径 → 附件（数据来源、统计范围、制度条文）。
- 篇幅控制：本机构历史与既往结论占比不超过10%（列入附件）；结论部分精炼或按体例达正文15%以上。图表须“一图一问题、有编号标题与来源”。

四、语言风格
- 使用公文语体，不铺陈、不重复、不用形容词代替结论。
- 无痕写作：正文不出现“待核实”“免责声明”“不作改写”等过程痕迹或自我辩解表述。中文与数字、字母之间不加空格。

五、工作流程与交稿检查
- 流程：先出提纲（含章节、要点、证据来源），确认后方可写正文。修改稿件采用“最小修订原则”。
- 交稿前核对：逐项核对页数、字数、章节数、图表编号、表格无空格、数据比较项、制度条款、目录页码与空白页。`,
  },
};

function presetVariableName(presetId) {
  return `writing_fixed_${presetId}`;
}

function unwrapValue(val, fallback) {
  if (val === undefined || val === null) {
    return fallback;
  }
  if (typeof val === 'object' && val !== null && typeof val.get === 'function') {
    const inner = val.get();
    return inner !== undefined && inner !== null ? inner : fallback;
  }
  return val;
}

function assembleWritingPrompt(options) {
  const activePresetKey = unwrapValue(options?.activePreset, 'pure');
  const includeBaseProtocol = unwrapValue(options?.includeBaseProtocol, true);

  const preset = WRITING_PRESET_BRICKS[activePresetKey] || WRITING_PRESET_BRICKS.pure;

  const sections = [];

  if (preset.rolePrompt && preset.rolePrompt.trim()) {
    sections.push(preset.rolePrompt.trim());
  }

  if (includeBaseProtocol && BASE_TOOL_PROTOCOL && BASE_TOOL_PROTOCOL.trim()) {
    sections.push(BASE_TOOL_PROTOCOL.trim());
  }

  return sections.join('\n\n').trim();
}


const NS = 'writing-brick-injector';
const BUNDLE_ID = 'dsh-text-preset';
const PRESET_ORDER = ['pure', 'office', 'research'];
const OPTIONS = PRESET_ORDER.map((id) => WRITING_PRESET_BRICKS[id]);

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760, color: 'var(--dsw-alias-label-primary)' },
  title: { margin: 0, fontSize: 14, fontWeight: 500, lineHeight: '20px' },
  hint: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)' },
  card: (active) => ({
    display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', cursor: 'pointer', font: 'inherit',
    padding: '10px 14px', borderRadius: 12, color: 'inherit',
    border: '.5px solid ' + (active ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-border-l3)'),
    background: active ? 'var(--dsw-alias-interactive-bg-hover)' : 'var(--dsw-alias-settings-card-fill)',
  }),
  cardName: { fontSize: 14, fontWeight: 500 },
  cardSummary: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' },
  row: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 },
  pre: {
    margin: 0, padding: 10, borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: '18px',
    background: 'var(--dsw-alias-bg-module-platform)', maxHeight: 240, overflow: 'auto',
  },
};

function WritingPanel(props) {
  const state = props.useWritingForm((snapshot) => snapshot);
  const value = state.value || {};
  const cfg = {
    activePreset: PRESET_ORDER.includes(value.activePreset) ? value.activePreset : 'pure',
    includeBaseProtocol: value.includeBaseProtocol !== false,
  };
  const disabled = !state.writable || state.status !== 'ready';

  const preview = assembleWritingPrompt(cfg);

  return h('div', { style: S.wrap }, [
    h('h3', { key: 'h', style: S.title }, '文本模式设置'),
    h('p', { key: 'p', style: S.hint },
      '选择「文本模式 · 动态」预设实际注入的职能人设；「文本模式 · 纯净 / 公文办公 / 公文研究」三个人设已固定，不受这里切换影响。修改后即时生效，新开会话使用新的预设。'),
    disabled ? h('p', { key: 'd', style: S.hint }, '配置服务暂不可用（只读或未就绪）。') : null,
    h('div', { key: 'opts', style: { display: 'grid', gap: 8 } }, OPTIONS.map((opt) =>
      h('button', {
        key: opt.id, type: 'button', disabled, style: S.card(opt.id === cfg.activePreset),
        onClick: () => props.set('activePreset', opt.id),
      }, [
        h('span', { key: 'n', style: S.cardName }, opt.name + (opt.id === cfg.activePreset ? '  ✓' : '')),
        h('span', { key: 's', style: S.cardSummary }, opt.summary),
      ]))),
    h('label', { key: 'base', style: S.row }, [
      h('input', {
        key: 'i', type: 'checkbox', disabled, checked: cfg.includeBaseProtocol,
        onChange: (e) => props.set('includeBaseProtocol', e.target.checked),
      }),
      '附加「文档与工具准则」（对动态与三个固定预设都生效）',
    ]),
    h('div', { key: 'prev' }, [
      h('p', { key: 'l', style: S.hint }, '当前组合出的 System Prompt 预览'),
      h('pre', { key: 'p', style: S.pre }, preview),
    ]),
  ]);
}

const inject = ['slots', 'locale', 'configForms'];

function apply(ctx) {
  const form = ctx.configForms.get(NS);
  const injected = () => ({
    hooks: { writingForm: form },
    set: (field, v) => form.set(field, v),
  });

  // 配置页挂在 DSH 侧栏「插件」页的插件包详情页上：plugins.bundle.config 以组合包包名为键，
  // 表单显示在包描述与组件行之间。DSH 0.2.1 起设置弹窗（Cmd+,）只保留只读插件清单，
  // 因此不再注册 settings.section。
  ctx.effect(() => ctx.configForms.whileServed([NS], () =>
    ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
      name: 'plugins.bundle.config',
      key: BUNDLE_ID,
      inject: injected,
    }, WritingPanel))), 'dsh-text-preset: plugin bundle config page');
}

exports.apply = apply;
exports.inject = inject;
exports.PRESET_OPTIONS = OPTIONS;

		return module.exports;
	}
});
