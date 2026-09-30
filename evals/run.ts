import fs from "fs";
import path from "path";
import { searchWikipediaCandidates, fetchWikipediaExtract } from "../lib/wikipedia";
import { generateQuizContent } from "../lib/llm/generator";

interface TopicConfig {
  id: string;
  name: string;
  era: string;
}

interface ValidationResult {
  topic: string;
  passed: boolean;
  questionCount: number;
  factCount: number;
  avgStemWords: number;
  avgOptionWords: number;
  maxOptionDelta: number;
  hasEllipses: boolean;
  issues: string[];
}

async function runEval() {
  const args = process.argv.slice(2);
  const topicFilter = args.find((a, i) => args[i - 1] === "--topic");
  const limitArg = args.find((a, i) => args[i - 1] === "--limit");
  const runAll = args.includes("--all");

  const topicsPath = path.join(process.cwd(), "evals", "topics.json");
  const rawTopics: TopicConfig[] = JSON.parse(fs.readFileSync(topicsPath, "utf-8"));

  let selectedTopics = rawTopics;
  if (topicFilter) {
    selectedTopics = rawTopics.filter(
      (t) => t.name.toLowerCase() === topicFilter.toLowerCase()
    );
    if (selectedTopics.length === 0) {
      selectedTopics = [{ id: "custom", name: topicFilter, era: "Custom Query" }];
    }
  } else if (!runAll) {
    const limit = limitArg ? parseInt(limitArg, 10) : 2;
    selectedTopics = rawTopics.slice(0, limit);
  }

  const outDir = path.join(process.cwd(), "evals", "output");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`\n======================================================`);
  console.log(`⚔️  RUNNING HISTORY QUEST EVAL HARNESS (M5)`);
  console.log(`Topics to evaluate: ${selectedTopics.length}`);
  console.log(`======================================================\n`);

  const results: ValidationResult[] = [];

  for (const topic of selectedTopics) {
    console.log(`[EVAL] Testing: ${topic.name} (${topic.era})...`);
    const issues: string[] = [];

    try {
      // 1. Resolve Wikipedia
      const searchRes = await searchWikipediaCandidates(topic.name);
      if (!searchRes || searchRes.length === 0) {
        issues.push(`Wikipedia search returned 0 candidates.`);
        results.push({
          topic: topic.name,
          passed: false,
          questionCount: 0,
          factCount: 0,
          avgStemWords: 0,
          avgOptionWords: 0,
          maxOptionDelta: 0,
          hasEllipses: false,
          issues,
        });
        continue;
      }

      const candidate = searchRes[0];
      const pageId = candidate.pageId;
      const title = candidate.title;

      // 2. Fetch Extract
      const article = await fetchWikipediaExtract(pageId, title);
      const extract = article.fullExtract;
      if (!extract || extract.length < 300) {
        issues.push(`Wikipedia extract too short (${extract?.length || 0} chars).`);
      }

      // 3. Generate Content
      const start = Date.now();
      const content = await generateQuizContent(title, extract);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      console.log(`  -> Generated in ${elapsed}s (Facts: ${content.facts.length}, Questions: ${content.questions.length})`);

      // 4. Validate Structural Rules
      if (content.questions.length < 10) {
        issues.push(`Expected 10 questions, got ${content.questions.length}.`);
      }
      if (content.facts.length < 10) {
        issues.push(`Expected >= 10 facts, got ${content.facts.length}.`);
      }

      let totalStemWords = 0;
      let totalOptionWords = 0;
      let maxDeltaAcross = 0;
      let ellipsesFound = false;

      const factIds = new Set(content.facts.map((f) => f.id));

      content.questions.forEach((q, idx) => {
        const stemWords = q.stem.trim().split(/\s+/).length;
        totalStemWords += stemWords;
        if (stemWords > 22) {
          issues.push(`Q${idx + 1} stem is too long (${stemWords} words, max 20): "${q.stem}"`);
        }

        if (q.options.length !== 4) {
          issues.push(`Q${idx + 1} has ${q.options.length} options, expected 4.`);
        }

        const optionLengths = q.options.map((opt) => opt.trim().split(/\s+/).length);
        const minLen = Math.min(...optionLengths);
        const maxLen = Math.max(...optionLengths);
        const delta = maxLen - minLen;
        if (delta > maxDeltaAcross) maxDeltaAcross = delta;

        if (delta > 3) {
          issues.push(`Q${idx + 1} option word length delta is ${delta} (max allowed 3). Options: ${JSON.stringify(q.options)}`);
        }

        q.options.forEach((opt, oIdx) => {
          totalOptionWords += opt.trim().split(/\s+/).length;
          if (opt.includes("...") || opt.includes("…")) {
            ellipsesFound = true;
            issues.push(`Q${idx + 1} option ${oIdx + 1} contains truncation ellipses: "${opt}"`);
          }
          if (opt.trim().split(/\s+/).length > 12) {
            issues.push(`Q${idx + 1} option ${oIdx + 1} is too long (> 10 words): "${opt}"`);
          }
        });

        if (!factIds.has(q.fact_id)) {
          issues.push(`Q${idx + 1} fact_id "${q.fact_id}" is not grounded in extracted facts.`);
        }
      });

      const avgStem = content.questions.length > 0 ? +(totalStemWords / content.questions.length).toFixed(1) : 0;
      const avgOpt = content.questions.length > 0 ? +(totalOptionWords / (content.questions.length * 4)).toFixed(1) : 0;

      // Save output
      const slug = topic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const dumpFile = path.join(outDir, `${slug}.json`);
      fs.writeFileSync(
        dumpFile,
        JSON.stringify(
          {
            topic: topic.name,
            era: topic.era,
            title,
            pageId,
            validation: {
              passed: issues.length === 0,
              avgStemWords: avgStem,
              avgOptionWords: avgOpt,
              maxOptionDelta: maxDeltaAcross,
              issues,
            },
            content,
          },
          null,
          2
        )
      );

      results.push({
        topic: topic.name,
        passed: issues.length === 0,
        questionCount: content.questions.length,
        factCount: content.facts.length,
        avgStemWords: avgStem,
        avgOptionWords: avgOpt,
        maxOptionDelta: maxDeltaAcross,
        hasEllipses: ellipsesFound,
        issues,
      });

      if (issues.length === 0) {
        console.log(`  ✅ PASSED all structural and quality checks (avg stem: ${avgStem}w, avg opt: ${avgOpt}w, max delta: ${maxDeltaAcross}w)`);
      } else {
        console.log(`  ❌ ISSUES DETECTED:`);
        issues.forEach((iss) => console.log(`     - ${iss}`));
      }
    } catch (err: any) {
      console.error(`  💥 Exception running eval on ${topic.name}:`, err.message);
      results.push({
        topic: topic.name,
        passed: false,
        questionCount: 0,
        factCount: 0,
        avgStemWords: 0,
        avgOptionWords: 0,
        maxOptionDelta: 0,
        hasEllipses: false,
        issues: [err.message],
      });
    }
    console.log("");
  }

  // Summary Table
  console.log(`\n================ EVALUATION SUMMARY ================`);
  const passCount = results.filter((r) => r.passed).length;
  console.log(`Total Topics: ${results.length}`);
  console.log(`Passed: ${passCount} / ${results.length} (${Math.round((passCount / results.length) * 100)}%)`);
  console.table(
    results.map((r) => ({
      Topic: r.topic,
      Status: r.passed ? "PASS" : "FAIL",
      Questions: r.questionCount,
      Facts: r.factCount,
      "Avg Stem": `${r.avgStemWords}w`,
      "Avg Opt": `${r.avgOptionWords}w`,
      "Max Delta": `${r.maxOptionDelta}w`,
      Ellipses: r.hasEllipses ? "YES" : "NO",
      Issues: r.issues.length,
    }))
  );
  console.log(`Outputs archived in: ${outDir}\n`);

  if (passCount < results.length) {
    process.exit(1);
  }
}

runEval();
