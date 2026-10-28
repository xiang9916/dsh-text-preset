/*
 * dsh-text-preset - 客户端源（浏览器侧）
 * 由 scripts/build-client.mjs 内联 dist/presets.js 的数据后包装成 DSH lazy-CJS 模块，输出 dist/client.js。
 * 本文件是 `factory: (require) => { ... }` 的函数体，可使用 require / module / exports。
 */
const react = require('react');
const h = react.createElement;

/*__PRESETS__*/

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
