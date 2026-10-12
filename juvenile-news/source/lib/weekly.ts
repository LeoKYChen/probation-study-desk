import { z } from "zod";
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, "日期無效");
const short = z.string().min(1).max(500);
const webUrl = z.string().url().refine(v => /^https?:\/\//.test(v), "僅接受 HTTP/HTTPS 來源");
export const articleSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,120}$/), title: short,
  category: z.enum(["少年司法制度", "修復式司法", "少年毒品處遇", "CRC與國際規範"]),
  tags: z.array(z.string().max(50)).max(10), type: short,
  publishedDate: day.nullable(), eventDate: day.nullable(), dateNote: z.string().max(500),
  author: short, sourceTitle: short, url: webUrl, summary: z.string().min(1).max(10000),
  significance: z.string().min(1).max(10000), followUp: z.string().min(1).max(3000),
  limitation: z.string().min(1).max(3000), legalNature: z.string().min(1).max(2000),
  checkedAt: day, readingScope: short, isBackground: z.boolean(),
});
export const issueSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,120}$/), date: day,
  periodStart: day, periodEnd: day, title: short,
  sourceConversation: short, status: z.enum(["draft","reviewed","published"]),
  note: z.string().max(4000), trend: z.string().max(4000),
  originalMarkdown: z.string().max(250000), items: z.array(articleSchema).max(30),
}).refine(v => v.periodStart <= v.periodEnd, "涵蓋期間順序無效");
export type Article = z.infer<typeof articleSchema>;
export type Issue = z.infer<typeof issueSchema>;
export function asMarkdown(issue: Issue) {
  if (issue.originalMarkdown) return issue.originalMarkdown;
  return `# ${issue.title}\n\n編製日期：${issue.date}\n資料期間：${issue.periodStart} ～ ${issue.periodEnd}\n來源：${issue.sourceConversation}\n狀態：${issue.status}\n\n${issue.note}\n\n` + issue.items.map((a,i) => `## ${i+1}. ${a.title}\n\n分類：${a.category}｜${a.type}\n作者／機構：${a.author}\n發布日期：${a.publishedDate || "未知"}\n事件日期：${a.eventDate || "未知"}\n${a.dateNote}\n原始來源：[${a.sourceTitle}](${a.url})\n\n### 核心內容\n${a.summary}\n\n### 實務／修法意義（本站分析）\n${a.significance}\n\n### 最值得追的 1 個問題\n${a.followUp}\n\n法律性質：${a.legalNature}\n閱讀範圍：${a.readingScope}\n查核日期：${a.checkedAt}\n資料限制：${a.limitation}\n`).join("\n---\n\n") + `\n## 本期共同趨勢\n${issue.trend}\n`;
}
