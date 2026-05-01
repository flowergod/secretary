// OpenClaw Skill 打包脚本
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'dist', 'skill-openclaw');

async function packOpenClawSkill() {
  console.log('Packing OpenClaw skill...');

  // Clean output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Copy OpenClaw specific files
  fs.cpSync(path.join(ROOT_DIR, 'soul'), path.join(OUTPUT_DIR, 'soul'), { recursive: true });
  fs.cpSync(path.join(ROOT_DIR, 'agents'), path.join(OUTPUT_DIR, 'agents'), { recursive: true });
  fs.copyFileSync(path.join(ROOT_DIR, 'SKILL.md'), path.join(OUTPUT_DIR, 'SKILL.md'));

  // Copy compiled JavaScript (only the src files, not the whole dist)
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

  // Create package.json for the skill
  const packageJson = {
    name: 'project-secretary',
    version: '1.0.0',
    description: '项目管理 AI 助理 - OpenClaw Skill',
    main: 'dist/index.js',
    scripts: { start: 'node dist/index.js' },
    dependencies: { uuid: '^9.0.0', yaml: '^2.3.4' }
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'package.json'), JSON.stringify(packageJson, null, 2));

  console.log(`OpenClaw skill packed to: ${OUTPUT_DIR}`);
  console.log('\nTo install locally:');
  console.log('  openclaw skills install ./dist/skill-openclaw');
}

packOpenClawSkill().catch(console.error);