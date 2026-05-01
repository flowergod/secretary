# Project Secretary - 双平台项目管理 AI 助理

## 概述

Project Secretary 是一个全能秘书式 AI 助理，通过自然对话管理日程、任务和项目。

## 目录结构

```
project-secretary/
├── SKILL.md                      # Claude Code 格式（主入口）
├── soul/
│   └── SOUL.md                   # OpenClaw 人格定义
├── agents/
│   └── AGENTS.md                 # OpenClaw 行为规则
├── src/                          # 共用核心逻辑
│   ├── index.ts                  # 入口
│   ├── parser/                   # 自然语言理解
│   ├── connectors/               # 数据连接器
│   ├── scheduler/                # 主动提醒调度
│   ├── memory/                   # 上下文管理
│   └── shared/                   # 共用工具
└── tests/                        # 测试文件
```

## 支持平台

| 平台 | 支持模式 | 说明 |
|------|---------|------|
| OpenClaw | 完整支持 | Skill 插件形式，支持主动提醒定时推送 |
| Claude Code | 基础支持 | Skill 形式，被动响应模式，无主动提醒 |

## 安装

### OpenClaw

```bash
openclaw skills install ./project-secretary
```

### Claude Code

```bash
npx skills add ./project-secretary
```

## 配置

参见 `src/shared/config.ts` 或创建 `config.yaml` 文件。

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 测试
npm test
```

## 许可证

MIT
