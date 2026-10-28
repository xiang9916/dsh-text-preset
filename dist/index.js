/**
 * dsh-text-preset - dist/index.js
 * 宿主插件 ESM 产物，免构建直接运行。
 *
 * Config 必须是真正的 @deepseek-ai/schemastery 节点，DSH 的 SettingsForms 才会识别并
 * 暴露 `writing-brick-injector` 设置命名空间。schemastery 的解析顺序：
 *   1. 常规 import（插件目录或 profile 能解析到时）；
 *   2. DSH 宿主进程 argv[2]（运行时根目录，如 app.asar/dsh）为锚点解析；
 *   3. 独立 Node 测试环境的轻量兼容 fallback（仅用于 tests/verify-bundle.mjs）。
 */

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  WRITING_PRESET_BRICKS,
  BASE_TOOL_PROTOCOL,
  assembleWritingPrompt,
  presetVariableName,
} from './presets.js';

export const name = 'writing-brick-injector';
export const inject = ['systemPrompt'];

function createSchemaBuilder() {
  class FluentSchema {
    constructor(meta = {}) {
      this.meta = meta;
    }
    default(value) {
      this.meta.default = value;
      return this;
    }
    description(desc) {
      this.meta.description = desc;
      return this;
    }
    volatile() {
      this.meta.volatile = true;
      return this;
    }
    toJSON() {
      return this.meta;
    }
  }

  return {
    object: (shape) => new FluentSchema({ type: 'object', shape }),
    union: (items) => new FluentSchema({ type: 'union', items }),
    string: () => new FluentSchema({ type: 'string' }),
    boolean: () => new FluentSchema({ type: 'boolean' }),
  };
}

function pickFactory(mod) {
  return mod?.default ?? mod?.Schema ?? mod;
}

async function loadSchemaFactory() {
  try {
    return pickFactory(await import('@deepseek-ai/schemastery'));
  } catch {
    // 继续尝试以 DSH 运行时根目录为锚点解析
  }
  // 0.2.1+ 宿主 argv[2] 是 host 入口文件、运行时根在 argv[3]，故逐个候选尝试（兼顾目录与文件路径锚点）
  for (const runtimeRoot of process.argv.slice(2)) {
    for (const anchor of [join(runtimeRoot, 'package.json'), runtimeRoot]) {
      try {
        const resolved = createRequire(anchor).resolve('@deepseek-ai/schemastery');
        return pickFactory(await import(pathToFileURL(resolved).href));
      } catch {
        // 落到下一个候选
      }
    }
  }
  return createSchemaBuilder();
}

const SchemaFactory = await loadSchemaFactory();

export const Config = SchemaFactory.object({
  activePreset: SchemaFactory.union([
    'pure',
    'office',
    'research',
  ])
    .default('pure')
    .description('「文本模式 · 动态」当前注入的写作人设：pure(纯净底座·默认) / office(公文办公) / research(公文研究)')
    .volatile(),

  includeBaseProtocol: SchemaFactory.boolean()
    .default(true)
    .description('是否拼接第一层文档与工具准则（去工程化底座）')
    .volatile(),
});

export function apply(ctx, config = {}) {
  // 1. 注册系统提示词变量：
  //    - writing_active_brick：动态预设使用，随 activePreset 切换；
  //    - writing_fixed_<id>：三个固定预设各用一个，人设固定、只随 includeBaseProtocol 变化。
  if (ctx.systemPrompt?.variable) {
    const registerVariable = (variableName, render) => {
      const disposer = () => ctx.systemPrompt.variable(variableName, render);
      if (typeof ctx.effect === 'function') {
        ctx.effect(disposer, `writing-brick-injector.variable(${variableName})`);
      } else {
        disposer();
      }
    };

    registerVariable('writing_active_brick', () => assembleWritingPrompt(config));

    for (const presetId of Object.keys(WRITING_PRESET_BRICKS)) {
      registerVariable(presetVariableName(presetId), () => assembleWritingPrompt({
        activePreset: presetId,
        includeBaseProtocol: config.includeBaseProtocol,
      }));
    }
  }

  // 2. 配置 Settings 交互策略：交由客户端卡片控制，不使用自动表单
  try {
    if (ctx.inject && typeof ctx.inject === 'function') {
      ctx.inject(['settings'], (child) => {
        child.settings?.configure?.({ auto: false }, ctx.fiber);
      });
    } else if (ctx.settings?.configure) {
      ctx.settings.configure({ auto: false }, ctx.fiber);
    }
  } catch {
    // settings 服务不可用时忽略
  }

  // 3. 监听热更新事件 loader/volatile-update，实时触发提示词重新计算
  if (typeof ctx.on === 'function') {
    ctx.on('loader/volatile-update', () => {
      ctx.emit?.('system-prompt/change');
    });
  }
}

export {
  WRITING_PRESET_BRICKS,
  BASE_TOOL_PROTOCOL,
  assembleWritingPrompt,
};
