import { copyFileSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
for (const file of ['index.html', 'questions.js', 'related-questions.js', 'rubrics.js', 'crime-topics.js', 'topic-practice.js', 'topic-rubrics.js', 'all-topics.js', 'all-topic-diagnostics.js', 'content-standards.js', 'legal-pilots.js', 'full-pilots.js']) {
  copyFileSync(file, `dist/${file}`);
}
