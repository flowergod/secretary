// Claude Code Skill 打包脚本
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'dist', 'skill-claude-code');

async function packClaudeCodeSkill() {
  console.log('Packing Claude Code skill...');

  // Clean output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Copy SKILL.md (main entry point for Claude Code)
  fs.copyFileSync(path.join(ROOT_DIR, 'SKILL.md'), path.join(OUTPUT_DIR, 'SKILL.md'));

  // Copy compiled JavaScript (only the src files)
  fs.mkdirSync(path.join(OUTPUT_DIR, 'dist'), { recursive: true });
  const distFiles = ['index.js', 'index.js.map', 'index.d.ts', 'index.d.ts.map'];
  for (const file of distFiles) {
    const srcPath = path.join(ROOT_DIR, 'dist', file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(OUTPUT_DIR, 'dist', file));
    }
  }

  // Copy subdirectories from dist
  const subDirs = ['ai', 'connectors', 'core', 'engine', 'memory', 'parser', 'scheduler', 'services', 'shared'];
  for (const subDir of subDirs) {
    const srcPath = path.join(ROOT_DIR, 'dist', subDir);
    if (fs.existsSync(srcPath)) {
      fs.cpSync(srcPath, path.join(OUTPUT_DIR, 'dist', subDir), { recursive: true });
    }
  }

  // Copy config.example.yaml
  fs.copyFileSync(path.join(ROOT_DIR, 'config.example.yaml'), path.join(OUTPUT_DIR, 'config.example.yaml'));

  // Copy tests
  fs.cpSync(path.join(ROOT_DIR, 'tests'), path.join(OUTPUT_DIR, 'tests'), { recursive: true });

  // Create package.json for the skill
  const packageJson = {
    name: 'project-secretary',
    version: '1.0.0',
    description: '项目管理 AI 助理 - Claude Code Skill',
    main: 'dist/index.js',
    scripts: { build: 'tsc', test: 'jest' },
    dependencies: { uuid: '^9.0.0', yaml: '^2.3.4' },
    devDependencies: {
      '@types/node': '^20.0.0',
      '@types/uuid': '^9.0.0',
      typescript: '^5.0.0',
      jest: '^29.7.0',
      'ts-jest': '^29.1.0',
      '@types/jest': '^29.5.0'
    }
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'package.json'), JSON.stringify(packageJson, null, 2));

  // Copy tsconfig and jest config
  fs.copyFileSync(path.join(ROOT_DIR, 'tsconfig.json'), path.join(OUTPUT_DIR, 'tsconfig.json'));
  fs.copyFileSync(path.join(ROOT_DIR, 'jest.config.js'), path.join(OUTPUT_DIR, 'jest.config.js'));

  console.log(`Claude Code skill packed to: ${OUTPUT_DIR}`);
  console.log('\nTo install locally:');
  console.log('  npx skills add ./dist/skill-claude-code');
}

packClaudeCodeSkill().catch(console.error);