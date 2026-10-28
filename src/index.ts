/**
 * dsh-text-preset - 宿主插件
 *
 * 插件名称：writing-brick-injector
 * 职能：
 * 1. 声明后台可热更新（Volatile）的写作预设配置字段；
 * 2. 注册 ctx.systemPrompt.variable：
 *    - writing_active_brick 供「文本模式 · 动态」按 activePreset 组装；
 *    - writing_fixed_pure / writing_fixed_office / writing_fixed_research 供三个固定预设；
 * 3. 监听 loader/volatile-update 事件，触发 system-prompt/change 实时重绘提示词。
 */

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  WRITING_PRESET_BRICKS,
  BASE_TOOL_PROTOCOL,
  assembleWritingPrompt,
  presetVariableName,
  type AssemblePromptOptions,
} from './presets.js';

export const name = 'writing-brick-injector';
export const inject = ['systemPrompt'];

/**
 * 轻量 Schema 构建器，自适应环境是否有 @deepseek-ai/schemastery
 */
function createSchemaBuilder() {
  class FluentSchema {
    meta: Record<string, any>;
    constructor(meta: Record<string, any> = {}) {
      this.meta = meta;
    }
    default(value: any) {
      this.meta.default = value;
      return this;
    }
    description(desc: string) {
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
    object: (shape: Record<string, any>) => new FluentSchema({ type: 'object', shape }),
    union: (items: any[]) => new FluentSchema({ type: 'union', items }),
    string: () => new FluentSchema({ type: 'string' }),
    boolean: () => new FluentSchema({ type: 'boolean' }),
  };
}

let SchemaFactory: any;
try {
  // @ts-ignore
  const schemastery = await import('@deepseek-ai/schemastery');
  SchemaFactory = schemastery.default || schemastery.Schema || schemastery;
} catch {
  SchemaFactory = undefined;
}
if (SchemaFactory === undefined) {
  // 0.2.1+ 宿主 argv[2] 是 host 入口文件、运行时根在 argv[3]，故逐个候选尝试（兼顾目录与文件路径锚点）
  for (const runtimeRoot of process.argv.slice(2)) {
    for (const anchor of [join(runtimeRoot, 'package.json'), runtimeRoot]) {
      try {
        const resolved = createRequire(anchor).resolve('@deepseek-ai/schemastery');
        const mod: any = await import(pathToFileURL(resolved).href);
        SchemaFactory = mod?.default ?? mod?.Schema ?? mod;
        break;
      } catch {
        // 落到下一个候选
      }
    }
    if (SchemaFactory !== undefined) break;
  }
}
if (SchemaFactory === undefined) SchemaFactory = createSchemaBuilder();

export interface WritingInjectorConfig {
  activePreset?: 'pure' | 'office' | 'research';
  includeBaseProtocol?: boolean;
}

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

/**
 * Cordis 插件生命周期挂载
 */
export function apply(ctx: any, config: WritingInjectorConfig = {}) {
  // 1. 注册系统提示词变量：
  //    - writing_active_brick：动态预设使用，随 activePreset 切换；
  //    - writing_fixed_<id>：三个固定预设各用一个，人设固定、只随 includeBaseProtocol 变化。
  if (ctx.systemPrompt?.variable) {
    const registerVariable = (variableName: string, render: () => string) => {
      const disposer = () => ctx.systemPrompt.variable(variableName, render);
      if (typeof ctx.effect === 'function') {
        ctx.effect(disposer, `writing-brick-injector.variable(${variableName})`);
      } else {
        disposer();
      }
    };

    registerVariable('writing_active_brick', () => assembleWritingPrompt(config as AssemblePromptOptions));

    for (const presetId of Object.keys(WRITING_PRESET_BRICKS)) {
      registerVariable(presetVariableName(presetId), () => assembleWritingPrompt({
        activePreset: presetId,
        includeBaseProtocol: (config as AssemblePromptOptions).includeBaseProtocol,
      }));
    }
  }

  // 2. 配置 Settings 交互策略（关闭自动表单，交由客户端卡片控制）
  if (ctx.inject && typeof ctx.inject === 'function') {
    ctx.inject(['settings'], (child: any) => {
      child.settings?.configure?.({ auto: false }, ctx.fiber);
    });
  } else if (ctx.settings?.configure) {
    ctx.settings.configure({ auto: false }, ctx.fiber);
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
