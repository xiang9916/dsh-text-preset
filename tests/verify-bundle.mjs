/**
 * tests/verify-bundle.mjs
 * 纯净文本模式插件（dsh-text-preset）全链路自检验证套件
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('='.repeat(70));
console.log('开始执行 dsh-text-preset 插件自检测试套件...');
console.log('='.repeat(70));

// ============================================================================
// 测试 1：校验核心文件存在性与导出入口
// ============================================================================
console.log('\n[Test 1] 校验核心工程文件与导出入口...');

const requiredFiles = [
  'package.json',
  'cordis.patch.yml',
  'src/presets.ts',
  'src/index.ts',
  'src/client/panel.js',
  'dist/presets.js',
  'dist/index.js',
  'dist/client.js',
  'scripts/switch-preset.mjs',
];

for (const relPath of requiredFiles) {
  const absPath = path.join(ROOT_DIR, relPath);
  assert.ok(fs.existsSync(absPath), `缺少必要文件: ${relPath}`);
}

// 检查 package.json 结构
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
assert.equal(pkg.name, 'dsh-text-preset', 'package.json name 必须为 dsh-text-preset');
assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'package.json version 必须为合法 semver');
assert.ok(pkg.engines?.dsh, 'package.json 必须声明 engines.dsh（兼容性检查）');
assert.match(pkg.engines.dsh, /0\.2\.1-rc\.2/, 'engines.dsh 下界必须覆盖已验证的 0.2.1-rc.2');
assert.match(pkg.engines.dsh, /<\s*0\.3\.0/, 'engines.dsh 上界必须排除未验证的 0.3.x');
// 0.2.1-rc.2 < 0.2.1-rc.3 < 0.2.1-rc.4 < 0.2.1-rc.5 < 0.3.0：同一条区间覆盖 rc.2 / rc.3 / rc.4 / rc.5，
// 0.2.2-alpha.2 在 DSH 的 includePrerelease 语义下同样满足
assert.equal(pkg.version, '0.2.1-rc.5', '本版本针对 DSH 0.2.1-rc.5 适配，package.json version 必须为 0.2.1-rc.5');
assert.equal(pkg.type, 'module');
assert.ok(pkg.exports['.'], 'package.json 缺少 . 导出');
assert.ok(pkg.exports['./presets'], 'package.json 缺少 ./presets 导出');
assert.ok(pkg.exports['./client'], 'package.json 缺少 ./client 导出');
assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml', 'dsh.bundle.patch 指向必须为 ./cordis.patch.yml');

// 动态导入 dist 模块
const presetsModule = await import('../dist/presets.js');
const hostModule = await import('../dist/index.js');

assert.ok(presetsModule.BASE_TOOL_PROTOCOL, 'presets.js 必须导出 BASE_TOOL_PROTOCOL');
assert.ok(presetsModule.WRITING_PRESET_BRICKS, 'presets.js 必须导出 WRITING_PRESET_BRICKS');
assert.equal(typeof presetsModule.assembleWritingPrompt, 'function', 'presets.js 必须导出 assembleWritingPrompt 函数');

assert.equal(hostModule.name, 'writing-brick-injector', 'hostModule.name 必须为 writing-brick-injector');
assert.deepEqual(hostModule.inject, ['systemPrompt'], 'hostModule.inject 必须包含 systemPrompt');
assert.equal(typeof hostModule.apply, 'function', 'hostModule.apply 必须为函数');

// 客户端为 DSH lazy-CJS 格式（window.__ModuleLoader__.load），在 vm 沙箱中加载并校验槽位注册
const clientSource = fs.readFileSync(path.join(ROOT_DIR, 'dist/client.js'), 'utf-8');
assert.ok(clientSource.includes('window.__ModuleLoader__.load('), 'client.js 必须使用 window.__ModuleLoader__.load');
let loaded;
const sandbox = {
  window: { __ModuleLoader__: { load: (m) => { loaded = m; } } },
  Symbol,
  Object,
};
sandbox.globalThis = sandbox;
(await import('node:vm')).runInNewContext(clientSource, sandbox);
assert.equal(loaded.id, 'dsh-text-preset', 'client 模块 id 必须为 dsh-text-preset');
const fakeReact = { createElement: (...a) => a, useState: (v) => [v, () => {}] };
const clientExports = loaded.factory((id) => {
  if (id === 'react') return fakeReact;
  throw new Error('unexpected require: ' + id);
});
assert.equal(typeof clientExports.apply, 'function', 'client.apply 必须为函数');
assert.ok(clientExports.inject.includes('configForms') && clientExports.inject.includes('slots'), 'client.inject 缺少必需服务');
assert.equal(clientExports.PRESET_OPTIONS.length, 3, 'client 必须暴露 3 个预设选项');
assert.equal(
  Array.from(clientExports.PRESET_OPTIONS, (o) => o.id).join(','),
  'pure,office,research',
  '预设面板顺序必须为 pure → office → research',
);
// 客户端内嵌提示词不得被构建缩进污染（历史 bug：每行前缀 \t\t 进入提示词正文）
assert.ok(
  Array.from(clientExports.PRESET_OPTIONS).every((o) => !/\t/.test(o.rolePrompt || '')),
  '客户端内嵌人设提示词不得包含制表符',
);

const registered = [];
const effects = [];
const mockClientCtx = {
  configForms: {
    get: () => ({ set: () => Promise.resolve(true) }),
    whileServed: (nss, register) => { assert.equal(JSON.stringify(nss), '["writing-brick-injector"]'); return register(new Set(nss)); },
  },
  slots: {
    inject: (name, fn) => fn(),
    register: (opts, component) => { registered.push({ ...opts, component }); return () => {}; },
  },
  effect: (fn) => effects.push(fn()),
};
clientExports.apply(mockClientCtx);

// 配置页只挂在侧栏「插件」页的插件包详情页（plugins.bundle.config）；
// 设置弹窗（settings.section）与官方插件卡片（plugins.item）都不再注册。
assert.equal(registered.length, 1, '客户端必须只注册一处配置入口');
const pageEntry = registered[0];
assert.equal(pageEntry.name, 'plugins.bundle.config', '配置页必须注册到 plugins.bundle.config');
assert.equal(pageEntry.key, 'dsh-text-preset', 'plugins.bundle.config 的 key 必须是组合包包名');
assert.equal(typeof pageEntry.component, 'function', '槽位必须携带配置面板组件');
assert.equal(typeof pageEntry.inject, 'function', '槽位必须携带注入面');
assert.ok(!clientSource.includes("'settings.section'"), 'dist/client.js 不得再注册 settings.section');
assert.ok(!clientSource.includes("'plugins.item'"), 'dist/client.js 不得再注册 plugins.item');

// 插件页以 view: 'page' 渲染配置页：冒烟渲染一次，确认标题、五个预设与提示词预览都在。
const collectText = (node, out) => {
  if (node === null || node === undefined || typeof node === 'boolean') return out;
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out; }
  if (Array.isArray(node)) { for (const child of node) collectText(child, out); return out; }
  if (typeof node === 'object' && Array.isArray(node.children)) collectText(node.children, out);
  return out;
};
const pageTree = pageEntry.component({
  view: 'page',
  useWritingForm: (selector) => selector({
    status: 'ready',
    writable: true,
    value: {
      activePreset: 'pure',
      includeBaseProtocol: true,
    },
  }),
  set: () => {},
});
const pageText = collectText(pageTree, []).join('\n');
assert.ok(pageText.includes('文本模式设置'), '配置页必须渲染「文本模式设置」标题');
assert.ok(pageText.includes('纯净通用写作底座'), '配置页必须列出预设选项');
assert.ok(pageText.includes('公文办公'), '配置页必须列出公文办公人设');
assert.ok(pageText.includes('公文研究'), '配置页必须列出公文研究人设');
assert.ok(pageText.includes('System Prompt 预览'), '配置页必须渲染提示词预览');
// 已删除的两个人设不得再出现在面板
assert.ok(!pageText.includes('创作与 RP'), '已删除的 RP 人设不得出现在面板');
assert.ok(!pageText.includes('职业写手'), '已删除的职业写手人设不得出现在面板');
// 工作区提示模式整块移除：面板不得再出现任何模式选择或自定义文本框
assert.ok(!pageText.includes('工作区提示模式'), '配置页不得再渲染「工作区提示模式」分区');
assert.ok(!pageText.includes('初始纯净'), '配置页不得再渲染「初始纯净」模式卡片');
assert.ok(!pageText.includes('自定义填写'), '配置页不得再渲染「自定义填写」模式卡片');
assert.ok(!pageText.includes('工作区识别'), '配置页不得再渲染「工作区识别」模式卡片');
// 预览必须带出计划模式提纲准则（第 5 条）
assert.ok(pageText.includes('计划模式'), '配置页预览必须包含【文档与工具准则】的计划模式条目');
assert.ok(pageText.includes('只交付提纲'), '配置页预览必须包含「只交付提纲」');

// 源码与产物层不得残留三个已删配置项与工作区文档读取实现
for (const rel of ['src/presets.ts', 'src/index.ts', 'dist/presets.js', 'dist/index.js', 'src/client/panel.js']) {
  const source = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf-8');
  for (const banned of ['workspacePromptMode', 'customPromptBehavior', 'customPromptOverride', 'readWorkspaceDocs', 'resolveWorkspacePromptMode']) {
    assert.ok(!source.includes(banned), `${rel} 不得残留已删除的 ${banned}`);
  }
}


console.log('✓ [Test 1 通过] 所有关键文件与 ESM 模块导出接口验证完毕。');

// ============================================================================
// 测试 2：模拟 DSH SystemPrompt 变量插值、三大预设与三个固定预设变量
// ============================================================================
console.log('\n[Test 2] 模拟 DSH SystemPrompt 模板变量插值与三大预设验证...');

class MockSystemPromptService {
  constructor() {
    this.variables = new Map();
  }

  variable(name, getter) {
    assert.ok(/^[a-z][a-z0-9_]*$/.test(name), `变量名 ${name} 不符合 DSH 小写下划线命名规范`);
    this.variables.set(name, getter);
  }

  // 模拟 DSH 的严格模板插值逻辑
  render(template) {
    return template.replace(/\{\{([a-z][a-z0-9_]*)\}\}/g, (_, varName) => {
      const getter = this.variables.get(varName);
      if (!getter) return '';
      const val = getter();
      return typeof val === 'string' ? val : '';
    });
  }
}

// 模拟 Cordis Context
// 宿主 dsh-tools/json-schema.ts 的强制子集（assertSupportedJsonSchema）复刻：
// 仅允许 type/oneOf/properties/required/additionalProperties/items/enum/const + 注解关键字；
// required 只允许出现在 type:object 节点上且必须为字符串数组并逐一存在于 properties。
const SUBSET_CONSTRAINT = new Set(['type', 'oneOf', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const']);
const SUBSET_ANNOTATION = new Set(['description', 'title', 'default', 'examples']);
const SUBSET_TYPES = ['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'];
function assertSchemaSubset(node, path, violations) {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    violations.push(`${path} must be a schema object`);
    return;
  }
  for (const key of Object.keys(node)) {
    if (!SUBSET_CONSTRAINT.has(key) && !SUBSET_ANNOTATION.has(key)) violations.push(`${path}.${key} is not a supported keyword`);
  }
  if (typeof node.description === 'boolean') violations.push(`${path}.description must be a string`);
  const hasType = Object.hasOwn(node, 'type');
  const hasOneOf = Object.hasOwn(node, 'oneOf');
  if (hasType && hasOneOf) { violations.push(`${path} cannot declare both type and oneOf`); return; }
  if (!hasType) return;
  const type = node.type;
  if (!SUBSET_TYPES.includes(type)) { violations.push(`${path}.type must be one of ${SUBSET_TYPES.join('/')}`); return; }
  const allowedBeside = {
    properties: ['object'], required: ['object'], additionalProperties: ['object'], items: ['array'],
    enum: ['string', 'number', 'integer', 'boolean', 'null'], const: ['string', 'number', 'integer', 'boolean', 'null'],
  };
  for (const [key, types] of Object.entries(allowedBeside)) {
    if (Object.hasOwn(node, key) && !types.includes(type)) violations.push(`${path}.${key} is not supported on type "${type}"`);
  }
  if (type === 'object' && Object.hasOwn(node, 'properties') && typeof node.properties === 'object' && node.properties !== null) {
    for (const [k, child] of Object.entries(node.properties)) assertSchemaSubset(child, `${path}.properties.${k}`, violations);
    if (Object.hasOwn(node, 'required')) {
      if (!Array.isArray(node.required) || node.required.some((e) => typeof e !== 'string')) {
        violations.push(`${path}.required must be an array of strings`);
      } else {
        for (const key of node.required) {
          if (!Object.hasOwn(node.properties, key)) violations.push(`${path}.required names "${key}" which is not in properties`);
        }
      }
    }
  }
  if (type === 'array' && Object.hasOwn(node, 'items')) assertSchemaSubset(node.items, `${path}.items`, violations);
}

/** 宿主同款工具定义契约校验：DSH tools.register 在新建会话时执行的 TypeError + JSON Schema 子集校验 + render 冒烟。 */
function assertHostToolContract(registered) {
  for (const tool of registered) {
    const o = tool.output;
    assert.ok(o !== undefined && o !== null && typeof o === 'object', `tool "${tool.name}" 必须声明 output 对象（宿主 register 校验）`);
    assert.equal(typeof o.render, 'function', `tool "${tool.name}" output.render 必须为函数`);
    assert.ok(o.presentationMeta === undefined || typeof o.presentationMeta === 'function', `tool "${tool.name}" presentationMeta 必须为函数`);
    assert.ok(o.schema && typeof o.schema === 'object' && o.schema.type === 'object', `tool "${tool.name}" output.schema 必须为 object JSON Schema`);
    const violations = [];
    assertSchemaSubset(o.schema, 'schema', violations);
    assert.deepStrictEqual(violations, [], `tool "${tool.name}" output.schema 必须通过宿主 assertSupportedJsonSchema 子集校验`);
    // parameters 直接上模型 API 的 function schema 线缆：必须是编译后的原始 JSON Schema
    // （顶层 type:'object' + required 数组），而不是 defineTool 入参的属性表方言。
    const p = tool.parameters;
    assert.ok(p && typeof p === 'object' && !Array.isArray(p), `tool "${tool.name}" 必须声明 parameters 对象`);
    assert.equal(p.type, 'object', `tool "${tool.name}" parameters.type 必须为 'object'（模型 API 要求，属性表方言会被拒：Invalid schema ... got 'type: null'）`);
    const pv = [];
    assertSchemaSubset(p, 'parameters', pv);
    assert.deepStrictEqual(pv, [], `tool "${tool.name}" parameters 必须通过 JSON Schema 子集校验`);
    const fake = {};
    for (const [k, spec] of Object.entries(o.schema.properties ?? {})) {
      fake[k] = spec.type === 'integer' || spec.type === 'number' ? 1 : spec.type === 'boolean' ? true : 'x';
    }
    const blocks = o.render({}, fake);
    assert.ok(Array.isArray(blocks) && blocks.length >= 1 && blocks[0].type === 'text' && typeof blocks[0].text === 'string', `tool "${tool.name}" render 必须返回 [{type:'text'}]`);
  }
}

function createMockContext() {
  const events = new Map();
  const sp = new MockSystemPromptService();
  return {
    systemPrompt: sp,
    on(event, handler) {
      if (!events.has(event)) events.set(event, []);
      events.get(event).push(handler);
    },
    emit(event, ...args) {
      const handlers = events.get(event) || [];
      for (const h of handlers) h(...args);
    },
    effect(fn) {
      return fn();
    },
  };
}

// 0. 未指定 activePreset 时应默认 pure（纯净底座，不注入职能人设）
{
  const ctx = createMockContext();
  hostModule.apply(ctx, {});
  const rendered = ctx.systemPrompt.render('{{writing_active_brick}}');
  assert.ok(!rendered.includes('【当前职能'), '默认预设必须为 pure，不得注入任何职能人设');
  assert.match(rendered, /【文档与工具准则】/, '默认 pure 必须拼接底座准则');
  assert.ok(rendered.includes('web_search') && rendered.includes('web_fetch'), '底座准则应说明联网检索与原文抓取（tool-web 已挂载）');
  assert.ok(rendered.includes('skill'), '底座准则应说明技能按需加载（tool-skill 已挂载）');
  assert.ok(rendered.includes('仅供参考'), '底座准则应提示网页内容仅供参考、不可直接引用');
  assert.match(rendered, /保持原本的文风和排版连贯/, '底座改稿准则必须强调保持原本文风与排版');
  assert.match(rendered, /彻底去 AI 味/, '底座必须包含彻底去 AI 味导向');
  assert.match(rendered, /未经许可，查到的网页内容仅供参考，不可直接引用/, '联网引用必须受用户许可约束');
}

// 1. 固定预设变量：三份人设各自固定，与动态预设的 activePreset 无关
{
  const ctx = createMockContext();
  hostModule.apply(ctx, { activePreset: 'research', includeBaseProtocol: true });

  const fixedPure = ctx.systemPrompt.render('{{writing_fixed_pure}}');
  const fixedOffice = ctx.systemPrompt.render('{{writing_fixed_office}}');
  const fixedResearch = ctx.systemPrompt.render('{{writing_fixed_research}}');

  assert.ok(!fixedPure.includes('【当前职能'), '固定纯净预设不得注入任何人设');
  assert.match(fixedPure, /^【文档与工具准则】/, '固定纯净预设必须只拼接准则');
  assert.match(fixedOffice, /【当前职能：国企标准公文与合规汇报写作专家】/, '固定公文办公预设必须含公文办公人设');
  assert.match(fixedResearch, /【角色与边界】/, '固定公文研究预设必须含公文研究人设');
  assert.notEqual(fixedOffice, fixedResearch, '三个固定预设变量不得互相串用');
  assert.match(fixedOffice, /【文档与工具准则】/, '固定预设默认拼接准则');
}

// 2. 验证 research 预设（公文研究）
{
  const ctx = createMockContext();
  hostModule.apply(ctx, { activePreset: 'research', includeBaseProtocol: true });
  const rendered = ctx.systemPrompt.render('{{writing_active_brick}}');

  assert.match(rendered, /【角色与边界】/);
  assert.match(rendered, /三类依据，缺一层就不下结论/);
  assert.match(rendered, /【文档与工具准则】/);
}

// 3. 验证已删除的人设不再可组装（rp / pro 已下线）
{
  assert.equal(presetsModule.WRITING_PRESET_BRICKS.rp, undefined, 'RP 人设必须已删除');
  assert.equal(presetsModule.WRITING_PRESET_BRICKS.pro, undefined, '职业写手人设必须已删除');
  assert.deepEqual(Object.keys(presetsModule.WRITING_PRESET_BRICKS), ['pure', 'office', 'research'], '人设字典必须只剩三大预设');
}

// 4. 验证 pure 预设（纯净通用写作底座 · 无角色偏见白板）
{
  const ctx = createMockContext();
  hostModule.apply(ctx, { activePreset: 'pure', includeBaseProtocol: true });
  const rendered = ctx.systemPrompt.render('{{writing_active_brick}}');

  assert.ok(!rendered.includes('【当前职能'), 'pure 预设严禁包含任何职能人设');
  assert.match(rendered, /【文档与工具准则】/, 'pure 预设必须包含公共底座准则');
}

// 5. 验证 office 预设（公文办公）
{
  const ctx = createMockContext();
  hostModule.apply(ctx, { activePreset: 'office', includeBaseProtocol: true });
  const rendered = ctx.systemPrompt.render('{{writing_active_brick}}');

  assert.match(rendered, /【当前职能：国企标准公文与合规汇报写作专家】/);
  assert.match(rendered, /说安全的话，办确定的话/);
  assert.match(rendered, /精准的层级语态转换/);
  assert.match(rendered, /默认公文格式落盘/, '公文办公必须默认按公文格式成文落盘');
  assert.match(rendered, /先定文种/, '公文办公必须先定文种再备要素');
  assert.match(rendered, /请示：一文一事/, '公文办公必须体现请示一文一事');
  assert.match(rendered, /报告：只汇报/, '公文办公必须区分报告与请示');
  assert.match(rendered, /纪要/, '公文办公必须覆盖纪要格式');
  assert.ok(!rendered.includes('版记齐全'), '不得要求公文要素一律齐套');
  assert.match(rendered, /【文档与工具准则】/);
}

// 6. 验证 Cordis Volatile 响应式对象模拟（.get() 解包）与热更新
{
  const ctx = createMockContext();
  let dynamicPreset = 'office';
  const volatileConfig = {
    activePreset: {
      get() {
        return dynamicPreset;
      },
    },
    includeBaseProtocol: true,
  };

  hostModule.apply(ctx, volatileConfig);

  // 初始应为 office
  let rendered = ctx.systemPrompt.render('{{writing_active_brick}}');
  assert.match(rendered, /【当前职能：国企标准公文与合规汇报写作专家】/);

  // 动态修改 Volatile 配置并模拟触发 volatile-update
  let promptChangeFired = false;
  ctx.on('system-prompt/change', () => {
    promptChangeFired = true;
  });

  dynamicPreset = 'research';
  ctx.emit('loader/volatile-update');

  assert.ok(promptChangeFired, '监听到 volatile-update 时必须触发 system-prompt/change 事件');
  rendered = ctx.systemPrompt.render('{{writing_active_brick}}');
  assert.match(rendered, /【角色与边界】/, '响应式读取必须自动返回更新后的预设');
}

// 7. 验证 includeBaseProtocol 开关、两层拼接顺序，以及已删除配置项不再生效
{
  const pureOnly = presetsModule.assembleWritingPrompt({ activePreset: 'pure', includeBaseProtocol: false });
  assert.equal(pureOnly, '', 'pure 预设关闭底座后必须为空串');
  const officeFull = presetsModule.assembleWritingPrompt({ activePreset: 'office', includeBaseProtocol: true });
  assert.ok(officeFull.startsWith('【当前职能：国企标准公文与合规汇报写作专家】'), 'office 人设必须排在准则之前');
  assert.ok(officeFull.trimEnd().endsWith('不擅自增删章节。'), '准则必须收在计划模式第 5 条末尾');
  const legacy = presetsModule.assembleWritingPrompt({
    activePreset: 'pure',
    includeBaseProtocol: true,
    customPromptOverride: '【已删除的配置】不应出现',
    workspacePromptMode: 'custom',
    customPromptBehavior: 'replace',
    workspaceDocs: '## AGENTS.md\n不应出现',
  });
  assert.ok(!legacy.includes('【已删除的配置】'), 'customPromptOverride 已移除，不得再影响组装结果');
  assert.ok(!legacy.includes('【工作区上下文规则】'), 'workspace 注入已移除，不得再拼工作区段');
  assert.match(legacy, /^【文档与工具准则】/, 'pure 预设开启底座时必须以准则开头');
}

console.log('✓ [Test 2 通过] SystemPrompt 模板插值、三大预设切换、固定预设变量、Volatile 响应式与两层拼接顺序验证通过。');

// ============================================================================
// 测试 3：校验 cordis.patch.yml 声明式补丁合规性
// ============================================================================
console.log('\n[Test 3] 校验 cordis.patch.yml 纯净沙箱与隔离配置...');

const patchYaml = fs.readFileSync(path.join(ROOT_DIR, 'cordis.patch.yml'), 'utf-8');
// 注释行不参与无效配置键扫描（文件头说明会提及这些键名）
const patchYamlEffective = patchYaml
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');

assert.match(patchYaml, /id:\s*agent-preset-registry/, '补丁必须包含 agent-preset-registry 配置');
assert.match(patchYaml, /default:\s*writing/, '默认预设必须设置为 writing');
assert.match(patchYaml, /id:\s*writing-brick-injector/, '必须包含 writing-brick-injector 注入器');
assert.match(patchYamlEffective, /activePreset:\s*pure/, '默认激活预设必须为 pure（纯净通用写作底座）');

// 四个前台预设：动态 + 纯净 / 公文办公 / 公文研究
const PRESET_ROWS = [
  ['preset-writing', 'writing', '文本模式 · 动态', '{{writing_active_brick}}'],
  ['preset-writing-pure', 'writing-pure', '文本模式 · 纯净', '{{writing_fixed_pure}}'],
  ['preset-writing-office', 'writing-office', '文本模式 · 公文办公', '{{writing_fixed_office}}'],
  ['preset-writing-research', 'writing-research', '文本模式 · 公文研究', '{{writing_fixed_research}}'],
];
for (const [rowId, presetId, displayName, variable] of PRESET_ROWS) {
  assert.match(patchYaml, new RegExp(`^ {4}- id: ${rowId}$`, 'm'), `补丁必须声明预设行 ${rowId}`);
  assert.match(patchYaml, new RegExp(`^ {8}id: ${presetId}$`, 'm'), `预设 ${rowId} 的 config.id 必须为 ${presetId}`);
  assert.match(patchYaml, new RegExp(`^ {8}name: ${displayName}$`, 'm'), `预设 ${rowId} 的显示名必须为「${displayName}」`);
  assert.ok(patchYaml.includes(`prefix: '${variable}'`), `预设 ${rowId} 必须引用 ${variable}`);
}
assert.equal((patchYaml.match(/^ {4}- id: preset-writing/gm) || []).length, 4, '前台必须恰好声明四个文本模式预设');
assert.match(patchYaml, /order:\s*1[\s\S]*order:\s*2[\s\S]*order:\s*3[\s\S]*order:\s*4/, '四个预设必须按 order 1-4 排列');
assert.ok(!patchYaml.includes('preset-writing-rp'), '不得残留 RP 预设行');
assert.ok(!patchYaml.includes('preset-writing-pro'), '不得残留职业写手预设行');
assert.doesNotMatch(patchYamlEffective, /创作与 RP|职业写手/, '不得残留已删除的人设文案');

// 四个预设都必须开启 complete + 静音运行时上下文
assert.equal((patchYaml.match(/complete:\s*true/g) || []).length, 4, '四个预设都必须开启 complete: true');
assert.equal((patchYaml.match(/includeRuntimeContext:\s*false/g) || []).length, 4, '四个预设都必须开启 includeRuntimeContext: false');
assert.match(
  patchYaml,
  /isolate:\s*[\r\n]+\s*fs:\s*true[\r\n]+\s*attachments:\s*true/,
  '文件工具组必须 isolate fs + attachments：剥离沙箱参数，且切断根作用域 attachment-local 使 read_image 不注册',
);
// DSH 0.2.0-rc.2 的 @deepseek-ai/dsh-tool-fs Config 仅接受 readLimit 等数值参数，
// 不存在 per-tool 布尔开关；以下断言防止无效配置键回归。
assert.doesNotMatch(patchYamlEffective, /readImage/, 'tool-fs 无 readImage 开关，不得写入无效配置键');
assert.doesNotMatch(patchYamlEffective, /\bread:\s*true\b/, 'tool-fs 无 read 布尔开关，不得写入无效配置键');
assert.doesNotMatch(patchYamlEffective, /\bwrite:\s*true\b/, 'tool-fs 无 write 布尔开关，不得写入无效配置键');
assert.doesNotMatch(patchYamlEffective, /\bedit:\s*true\b/, 'tool-fs 无 edit 布尔开关，不得写入无效配置键');
// 每个预设的 pure-fs 组都必须挂载 fs-search（glob/grep 只读查找）
const fsSearchCount = (patchYaml.match(/dsh-tool-fs-search/g) || []).length;
assert.equal(fsSearchCount, 4, `四个预设的 pure-fs 组都须挂载 fs-search（实际 ${fsSearchCount} 处）`);

// 四个预设共用的运行时能力：AGENTS.md 注入、当前时间、计划模式、用户确认、工具结果剪枝、文件与联网工具
const SHARED_MODULES = [
  '@deepseek-ai/dsh-agent-instructions',
  '@deepseek-ai/dsh-time-context',
  '@deepseek-ai/dsh-plan-mode',
  '@deepseek-ai/dsh-tool-ask-user',
  '@deepseek-ai/dsh-compaction-tool-result-pruner',
  '@deepseek-ai/dsh-tool-fs',
  '@deepseek-ai/dsh-tool-fs-search',
  '@deepseek-ai/dsh-tool-web',
  '@deepseek-ai/dsh-skill-filesystem',
  '@deepseek-ai/dsh-tool-skill',
  'dsh-text-preset/file-butler',
  'dsh-text-preset/doc-bridge',
];
for (const mod of SHARED_MODULES) {
  // 按带引号的完整包名计数，避免 dsh-tool-fs 命中 dsh-tool-fs-search
  const count = patchYaml.split(`'${mod}'`).length - 1;
  assert.equal(count, 4, `四个预设都必须挂载 ${mod}（实际 ${count} 处）`);
}

// 隔离域与剪枝参数：四个预设必须完全一致
assert.equal(
  (patchYaml.match(/isolate:\s*[\r\n]+\s*fs:\s*true[\r\n]+\s*attachments:\s*true/g) || []).length,
  4,
  '四个预设的 pure-fs 组都必须 isolate fs + attachments',
);
assert.equal(
  (patchYaml.match(/ {10}- id: planning\n {12}name: cordis:group\n {12}group: true\n {12}isolate:\n {14}planMode: true/g) || []).length,
  4,
  '四个预设的计划模式都必须挂在 planMode 隔离组内（否则挂载审计失败）',
);
assert.equal(
  (patchYaml.match(/ {14}compaction: true\n {14}toolResultPruner: true/g) || []).length,
  4,
  '四个预设的工具结果剪枝都必须与 compaction 同组隔离',
);
assert.equal(
  (patchYaml.match(/thresholdChars:\s*8192[\r\n]+\s*headChars:\s*4096[\r\n]+\s*tailChars:\s*1024/g) || []).length,
  4,
  '四个预设的剪枝阈值必须一致（8192 / 4096 / 1024）',
);
assert.equal(
  (patchYaml.match(/fetch:\s*true[\r\n]+\s*searchTimeoutMs:\s*60000/g) || []).length,
  4,
  '四个预设的 tool-web 都必须开启 fetch: true 且 searchTimeoutMs: 60000',
);

// 预设显示名：四个「文本模式 · X」；历史旧称（Unicode 转义书写）不得残留
const LEGACY_PRESET_NAME = '\u5199\u4f5c\u534f\u4f5c\u6a21\u5f0f';
assert.ok(!patchYamlEffective.includes(LEGACY_PRESET_NAME), '不得残留旧预设名');
for (const name of ['文本模式 · 动态', '文本模式 · 纯净', '文本模式 · 公文办公', '文本模式 · 公文研究']) {
  assert.ok(patchYaml.includes(`name: ${name}`), `补丁必须包含预设显示名「${name}」`);
}

// 技能节点必须位于 pure-fs 隔离组内（14 空格缩进），不得作为组外兄弟节点
assert.doesNotMatch(patchYaml, /^ {10}- id: skill-filesystem$/m, 'skill-filesystem 不得挂在 pure-fs 组外');
assert.doesNotMatch(patchYaml, /^ {10}- id: tool-skill$/m, 'tool-skill 不得挂在 pure-fs 组外');
assert.equal((patchYaml.match(/^ {14}- id: skill-filesystem$/gm) || []).length, 4, '四个预设都须在 pure-fs 组内挂载 skill-filesystem');
assert.equal((patchYaml.match(/^ {14}- id: tool-skill$/gm) || []).length, 4, '四个预设都须在 pure-fs 组内挂载 tool-skill');

assert.doesNotMatch(patchYaml, /disabled:\s*true/, '不得保留任何 disabled: true 的预设行');

console.log('✓ [Test 3 通过] cordis.patch.yml 四预设结构、共用运行时能力、隔离域与净化参数完整合规。');

// ============================================================================
// 测试 4：CLI 切换工具集成测试
// ============================================================================
console.log('\n[Test 4] 测试 scripts/switch-preset.mjs 命令行工具切换与 YAML 同步...');

// 1. 运行 --list 命令
const listOutput = execSync(`node ${path.join(ROOT_DIR, 'scripts/switch-preset.mjs')} --list`, { encoding: 'utf-8' });
assert.match(listOutput, /纯净通用写作底座（默认）/);
assert.match(listOutput, /公文研究/);
assert.match(listOutput, /公文办公/);
assert.ok(!listOutput.includes('创作与 RP'), 'CLI 不得再列出已删除的 RP 人设');
assert.ok(!listOutput.includes('职业写手'), 'CLI 不得再列出已删除的职业写手人设');
// 列表顺序必须为 pure → office → research
const listOrder = ['纯净通用写作底座（默认）', '公文办公', '公文研究'];
const listIndex = listOrder.map((s) => listOutput.indexOf(s));
assert.ok(
  listIndex.every((v, i) => v >= 0 && (i === 0 || v > listIndex[i - 1])),
  `CLI 预设列表顺序不符合要求（实际位置：${listIndex.join(', ')}）`,
);

// 2. 切换为 research
execSync(`node ${path.join(ROOT_DIR, 'scripts/switch-preset.mjs')} research`, { encoding: 'utf-8' });
const patchAfterResearch = fs.readFileSync(path.join(ROOT_DIR, 'cordis.patch.yml'), 'utf-8');
assert.match(patchAfterResearch, /activePreset:\s*research/, '切换后 cordis.patch.yml 的 activePreset 必须更新为 research');

// 3. 运行 --show 验证预览输出
const showOutput = execSync(`node ${path.join(ROOT_DIR, 'scripts/switch-preset.mjs')} --show`, { encoding: 'utf-8' });
assert.match(showOutput, /【角色与边界】/);

// 4. 切回默认的 pure
execSync(`node ${path.join(ROOT_DIR, 'scripts/switch-preset.mjs')} pure`, { encoding: 'utf-8' });
const patchAfterDefault = fs.readFileSync(path.join(ROOT_DIR, 'cordis.patch.yml'), 'utf-8');
assert.match(patchAfterDefault, /activePreset:\s*pure/, '切回后 cordis.patch.yml 的 activePreset 必须恢复为 pure');

console.log('✓ [Test 4 通过] CLI 切换工具无损更新 cordis.patch.yml 测试完成。');

// ============================================================================
// 测试 5：计划模式提纲准则与双配置项组装
// ============================================================================
console.log('\n[Test 5] 计划模式提纲准则与双配置项组装验证...');

// 5.1 准则必须带计划模式提纲条目，且有明确约束
{
  const protocol = presetsModule.BASE_TOOL_PROTOCOL;
  assert.match(protocol, /5\. 计划模式：/, '准则必须包含第 5 条计划模式');
  assert.ok(protocol.includes('只交付提纲'), '准则必须要求计划模式只交付提纲');
  assert.ok(protocol.includes('不写正文、不改文件'), '准则必须限制计划模式写正文/改文件');
  assert.ok(protocol.includes('每节写什么'), '提纲必须写清每节内容');
  assert.ok(protocol.includes('是否已到手'), '提纲必须核对依据是否到手');
  assert.ok(protocol.includes('需要我拍板的取舍'), '提纲必须标出待定取舍');
  assert.ok(protocol.includes('不擅自增删章节'), '必须约束按确认的提纲动笔');
}

// 5.2 五个预设开启准则时都带该条，关闭后都不带
{
  for (const id of ['pure', 'office', 'research']) {
    const on = presetsModule.assembleWritingPrompt({ activePreset: id, includeBaseProtocol: true });
    assert.ok(on.includes('只交付提纲'), `预设 ${id} 开启准则时必须带计划模式提纲条目`);
    const off = presetsModule.assembleWritingPrompt({ activePreset: id, includeBaseProtocol: false });
    assert.ok(!off.includes('只交付提纲'), `预设 ${id} 关闭准则时不得带该条目`);
  }
}

// 5.3 变量 provider 只按两项配置组装，不再接收会话上下文
{
  const ctx = createMockContext();
  hostModule.apply(ctx, { activePreset: 'research', includeBaseProtocol: true });
  const provider = ctx.systemPrompt.variables.get('writing_active_brick');
  assert.equal(typeof provider, 'function', '变量 provider 必须已注册');
  const rendered = provider({ agent: { session: { header: { cwd: '/tmp/whatever' } } } });
  assert.match(rendered, /【角色与边界】/, 'research 人设必须生效');
  assert.ok(rendered.includes('只交付提纲'), '提示词里必须带计划模式提纲条目');
  assert.ok(!rendered.includes('【工作区上下文规则】'), '不得再注入工作区文档段');
}

// 5.4 已删除的宿主 API 与导出必须消失
{
  assert.equal(hostModule.readWorkspaceDocs, undefined, 'readWorkspaceDocs 必须已移除');
  assert.equal(hostModule.resolveWorkspacePromptMode, undefined, 'resolveWorkspacePromptMode 必须已移除');
  assert.equal(hostModule.WORKSPACE_DOCS_MAX_BYTES, undefined, 'WORKSPACE_DOCS_MAX_BYTES 必须已移除');
  assert.equal(presetsModule.WORKSPACE_RULES_HEADER, undefined, 'WORKSPACE_RULES_HEADER 必须已移除');
  assert.equal(presetsModule.resolveWorkspacePromptMode, undefined, 'presets 层 resolveWorkspacePromptMode 必须已移除');
}

console.log('✓ [Test 5 通过] 计划模式提纲条目、三预设覆盖、双配置项组装与已删除 API 校验完成。');

// ═══════════════════════════════════════════════════════════════
// [Test 6] file-butler 文件管理模块：注册、真实文件系统功能与 yml 挂载
// ═══════════════════════════════════════════════════════════════
{
  const butler = await import('../dist/file-butler.js');
  assert.equal(butler.name, 'file-butler', 'file-butler.name 必须为 file-butler');
  assert.deepEqual(butler.inject, ['tools', 'fs'], 'file-butler.inject 必须为 [tools, fs]');

  const registered = [];
  const butlerCtx = {
    tools: { register: (tool) => registered.push(tool) },
    fs: {
      resolve: async (p) => {
        const abs = path.resolve(String(p));
        return { displayPath: abs, targetKey: abs };
      },
      processPath: (t) => t.targetKey,
    },
  };
  butler.apply(butlerCtx);
  const names = registered.map((t) => t.name);
  assert.deepEqual(names.sort(), ['copy_file', 'move_file', 'stat_file', 'trash_file'], `必须注册四工具（实际 ${names}）`);
  const byName = Object.fromEntries(registered.map((t) => [t.name, t]));
  assertHostToolContract(registered);

  // 真实文件系统功能实测（隔离 tmp 目录）
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-butler-test-'));
  const content = '# 测试稿\n中文内容 🖋️ 与 "引号"\n';
  fs.writeFileSync(path.join(dir, 'a.md'), content, 'utf8');
  const exec = (tool, args) => tool.execute(args, { signal: undefined });

  // copy：自动建父目录 + 内容逐字保真
  const copyRes = await exec(byName.copy_file, { file_path: path.join(dir, 'a.md'), destination: path.join(dir, 'sub', 'b.md') });
  assert.equal(fs.readFileSync(path.join(dir, 'sub', 'b.md'), 'utf8'), content, 'copy_file 内容必须逐字一致');
  assert.equal(copyRes.bytes, Buffer.byteLength(content), 'copy_file 必须返回字节数');

  // copy 默认拒绝覆盖已存在目标（防数据丢失）；显式 overwrite:true 才允许覆盖
  await assert.rejects(
    () => exec(byName.copy_file, { file_path: path.join(dir, 'a.md'), destination: path.join(dir, 'sub', 'b.md') }),
    /exist/i, '未传 overwrite 时必须默认拒绝覆盖已存在目标',
  );
  await exec(byName.copy_file, { file_path: path.join(dir, 'a.md'), destination: path.join(dir, 'sub', 'b.md'), overwrite: true });
  assert.equal(fs.readFileSync(path.join(dir, 'sub', 'b.md'), 'utf8'), content, 'overwrite:true 覆盖后目标内容必须等于源内容');

  // move：源消失、目标出现
  await exec(byName.move_file, { file_path: path.join(dir, 'sub', 'b.md'), destination: path.join(dir, 'c.md') });
  assert.ok(!fs.existsSync(path.join(dir, 'sub', 'b.md')), 'move 后源必须消失');
  assert.equal(fs.readFileSync(path.join(dir, 'c.md'), 'utf8'), content, 'move 后内容必须保真');

  // move 防静默覆盖：目标文件已存在且未传 overwrite:true 时必须报错保护原目标文件
  await assert.rejects(
    () => exec(byName.move_file, { file_path: path.join(dir, 'a.md'), destination: path.join(dir, 'c.md') }),
    /exist/i, 'move_file 默认不得静默覆盖已存在的目标文件',
  );

  // move / copy 目标传入已存在目录名时，自动将文件移入/复制到该目录下同名文件
  const archiveDir = path.join(dir, 'archive');
  fs.mkdirSync(archiveDir);
  const moveDirRes = await exec(byName.move_file, { file_path: path.join(dir, 'c.md'), destination: archiveDir });
  assert.equal(moveDirRes.destination, path.join(archiveDir, 'c.md'), 'destination 为已存在目录时应自动拼入文件名');
  assert.equal(fs.readFileSync(path.join(archiveDir, 'c.md'), 'utf8'), content);

  // stat：元数据字段
  const statRes = await exec(byName.stat_file, { file_path: path.join(archiveDir, 'c.md') });
  assert.equal(statRes.size_bytes, Buffer.byteLength(content), 'stat size_bytes 必须正确');
  assert.ok(statRes.created && statRes.modified, 'stat 必须返回时间字段');

  // trash：同秒/同毫秒连续删除不同子目录下的同名文件不得互相覆盖，且测试后清理回收站残留
  const sameName2 = path.join(dir, 'c.md');
  fs.writeFileSync(sameName2, '第二份同名文件', 'utf8');
  const trashRes1 = await exec(byName.trash_file, { file_path: path.join(archiveDir, 'c.md') });
  const trashRes2 = await exec(byName.trash_file, { file_path: sameName2 });
  assert.notEqual(trashRes1.trash_path, trashRes2.trash_path, '同秒删除同名文件必须生成不同回收站路径');
  assert.equal(fs.readFileSync(trashRes1.trash_path, 'utf8'), content, '第一份进回收站的文件不得被第二份覆盖');
  assert.equal(fs.readFileSync(trashRes2.trash_path, 'utf8'), '第二份同名文件', '第二份进回收站的文件内容必须完整');
  fs.rmSync(trashRes1.trash_path, { force: true });
  fs.rmSync(trashRes2.trash_path, { force: true });

  // 底座准则同步引用四工具
  {
    const ctx = createMockContext();
    hostModule.apply(ctx, { activePreset: 'office', includeBaseProtocol: true });
    const rendered = ctx.systemPrompt.render('{{writing_active_brick}}');
    for (const t of ['copy_file', 'move_file', 'trash_file']) {
      assert.ok(rendered.includes(t), `底座准则必须说明 ${t}（file-butler 已挂载）`);
    }
  }

  // yml：五个 pure-fs 组均挂载 file-butler 行
  const patchText = fs.readFileSync(path.join(__dirname, '../cordis.patch.yml'), 'utf8');
  const butlerMounts = (patchText.match(/dsh-text-preset\/file-butler/g) || []).length;
  assert.ok(butlerMounts >= 1, `主预设的 pure-fs 组须挂载 file-butler（实际 ${butlerMounts} 处）`);
  // 内联准则块缩进防回归：字面量块内的准则行必须保持块内缩进，顶格行会终止 YAML 块
  assert.ok(!/^(?:\d)\. [^\n]/m.test(fs.readFileSync(path.join(__dirname, '../cordis.patch.yml'), 'utf8')), 'cordis.patch.yml 字面量块内不得出现顶格准则行（YAML 块提前终止）');

  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('✓ [Test 6 通过] file-butler 四工具注册、真实文件系统往返（复制/防覆盖/目录目标/元数据/回收站防碰撞）与 yml 挂载验证完成。');

// ═══════════════════════════════════════════════════════════════
// [Test 7] doc-bridge Word↔md 单向文档桥：注册、真实往返、第三方校验与挂载
// ═══════════════════════════════════════════════════════════════
{
  const bridge = await import('../dist/doc-bridge.js');
  assert.equal(bridge.name, 'doc-bridge', 'doc-bridge.name 必须为 doc-bridge');
  assert.deepEqual(bridge.inject, ['tools', 'fs'], 'doc-bridge.inject 必须为 [tools, fs]');

  const registered = [];
  const bridgeCtx = {
    tools: { register: (tool) => registered.push(tool) },
    fs: {
      resolve: async (p) => {
        const abs = path.resolve(String(p));
        return { displayPath: abs, targetKey: abs };
      },
      processPath: (t) => t.targetKey,
    },
  };
  bridge.apply(bridgeCtx);
  assert.deepEqual(registered.map((x) => x.name).sort(), ['convert_document', 'export_document'], '必须注册 convert_document 与 export_document');
  const byName = Object.fromEntries(registered.map((x) => [x.name, x]));
  assertHostToolContract(registered);
  const exec = (tool, args) => tool.execute(args, { signal: undefined });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-bridge-test-'));
  const md = '# 第一章 初雪\n\n雪落下来的时候，她正在写信。\n\n- 检查炉火\n- 喂猫\n- **重要**：锁好后门\n\n## 1.1 转折\n\n"你回来了。"她说。\n\n含转义：a < b & c > d。\n';
  const mdPath = path.join(dir, 'story.md');
  fs.writeFileSync(mdPath, md, 'utf8');

  // export：md → 新建 docx
  const exp = await exec(byName.export_document, { file_path: mdPath });
  const docxPath = path.join(dir, 'story.docx');
  assert.ok(fs.existsSync(docxPath), 'export 后 docx 必须存在');
  assert.equal(exp.destination, docxPath, 'export 默认目标应为同名 .docx');

  // 第三方独立校验：macOS textutil 必须能读出标题/列表/转义文本
  const text = execSync(`textutil -convert txt -stdout "${docxPath}"`, { encoding: 'utf8' });
  for (const s of ['第一章 初雪', '• 喂猫', 'a < b & c > d', '1.1 转折']) {
    assert.ok(text.includes(s), `textutil 必须从导出的 docx 读出「${s}」`);
  }

  // convert：docx → md，往返结构等价
  const conv = await exec(byName.convert_document, { file_path: docxPath });
  const backPath = path.join(dir, 'story.converted.md');
  assert.equal(conv.destination, backPath, '目标 .md 已存在时 convert 必须避让为 .converted.md（不覆盖源 md）');
  const back = fs.readFileSync(backPath, 'utf8');
  const keep = (s) => s.split('\n').filter((l) => l.trim());
  assert.deepEqual(keep(back), keep(md.replace(/\*\*/g, '')), 'md→docx→md 往返后行集合必须等价');
  assert.ok(conv.preview.includes('第一章'), 'convert 必须返回预览');

  // 核心设计不变量防回归：当原 story.docx 已存在时，再次对 story.md 调用 export_document（不传 destination）
  // 绝不能覆盖原 story.docx，必须自动避让生成 story.exported.docx
  const originalDocxBytes = fs.readFileSync(docxPath);
  fs.writeFileSync(mdPath, md + '\n新增结尾段（含非法XML控制符\x0c换页与\x0b垂直制表）。\n', 'utf8');
  const exp2 = await exec(byName.export_document, { file_path: mdPath });
  assert.equal(exp2.destination, path.join(dir, 'story.exported.docx'), '同名原 .docx 已存在时，export_document 必须自动避让为 .exported.docx');
  assert.deepEqual(fs.readFileSync(docxPath), originalDocxBytes, '原 .docx 必须一字节未动');
  const text2 = execSync(`textutil -convert txt -stdout "${exp2.destination}"`, { encoding: 'utf8' });
  assert.ok(text2.includes('新增结尾段（含非法XML控制符换页与垂直制表）。'), 'XML 1.0 非法控制字符必须被安全剥除且导出文档可读');

  // convert 防数据丢失：已编辑的 story.md 存在时，再次 convert 原 docx 不得静默覆盖它
  const conv2 = await exec(byName.convert_document, { file_path: docxPath });
  assert.match(path.basename(conv2.destination), /^story\.converted(-\d+)?\.md$/, 'convert 避让目标必须是 .converted 变体');
  assert.ok(fs.readFileSync(mdPath, 'utf8').includes('新增结尾段'), '已编辑的 .md 必须原样保留（不被重新转换覆盖）');

  // OOXML 解析边缘防回归：大写 Heading 1、十六进制实体 &#x2014;、标题内 <w:br/> 软回车、取消编号 <w:numId w:val="0"/>、代理区实体
  const edgeStyles = '<w:styles><w:style w:type="paragraph" w:styleId="H2Custom"><w:name w:val="Heading 2"/></w:style></w:styles>';
  const edgeLevels = bridge.headingLevelsFromStyles(edgeStyles);
  assert.equal(edgeLevels.get('H2Custom'), 2, '必须兼容 WPS/LibreOffice 大写 Heading N 样式名');
  const edgeDocXml = [
    '<w:document><w:body>',
    '<w:p><w:pPr><w:pStyle w:val="H2Custom"/></w:pPr><w:r><w:t>第四章</w:t><w:br/><w:t>风雨&#x2014;欲来</w:t></w:r></w:p>',
    '<w:p><w:pPr><w:numPr><w:numId w:val="0"/></w:numPr></w:pPr><w:r><w:t>取消过编号的普通正文段</w:t></w:r></w:p>',
    '</w:body></w:document>',
  ].join('');
  const edgeMd = bridge.documentXmlToMarkdown(edgeDocXml, edgeLevels);
  assert.match(edgeMd, /^## 第四章 风雨—欲来$/m, '标题内软回车必须合并为单行且十六进制实体 &#x2014; 必须正确解码');
  assert.match(edgeMd, /^取消过编号的普通正文段$/m, 'w:numId val="0" 的段落不得被误判为无序列表');
  const surrogateMd = bridge.documentXmlToMarkdown('<w:document><w:body><w:p><w:r><w:t>孤&#xD800;代理</w:t></w:r></w:p></w:body></w:document>', new Map());
  assert.ok(!JSON.stringify(surrogateMd).includes('ud800'), '代理区实体不得解码为孤立代理项（会产生非法 XML）');

  // TS 源码镜像防回归：所有 src/*.ts 不得出现重复修饰符（如 export export）
  for (const tsFile of ['src/index.ts', 'src/presets.ts', 'src/file-butler.ts', 'src/doc-bridge.ts']) {
    const tsContent = fs.readFileSync(path.join(ROOT_DIR, tsFile), 'utf8');
    assert.doesNotMatch(tsContent, /\bexport\s+export\b/, `${tsFile} 不得包含重复的 export 语法错误`);
  }

  // 底座准则引用两工具
  {
    const ctx = createMockContext();
    hostModule.apply(ctx, { activePreset: 'office', includeBaseProtocol: true });
    const rendered = ctx.systemPrompt.render('{{writing_active_brick}}');
    for (const toolName of ['convert_document', 'export_document']) {
      assert.ok(rendered.includes(toolName), `底座准则必须说明 ${toolName}`);
    }
  }

  // yml：五个 pure-fs 组均挂载 doc-bridge 行
  const patchText = fs.readFileSync(path.join(__dirname, '../cordis.patch.yml'), 'utf8');
  const mounts = (patchText.match(/dsh-text-preset\/doc-bridge/g) || []).length;
  assert.ok(mounts >= 1, `主预设的 pure-fs 组须挂载 doc-bridge（实际 ${mounts} 处）`);

  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('✓ [Test 7 通过] doc-bridge 双工具注册、md→docx（textutil 第三方校验）→md 往返等价、双向防覆盖（docx/md）与 OOXML 边缘防回归验证完成。');

console.log('\n' + '='.repeat(70));
console.log('🎉 所有自检测试项全部通过 (All tests passed successfully)!');
console.log('='.repeat(70));
