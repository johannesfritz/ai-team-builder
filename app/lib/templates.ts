import type { Node, Edge } from '@xyflow/react';
import { NODE_COLORS, type PluginNodeType } from './plugin-types';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: Node[];
  edges: Edge[];
}

function edge(id: string, source: string, target: string, sourceType: PluginNodeType): Edge {
  return { id, source, target, animated: true, style: { stroke: NODE_COLORS[sourceType] } };
}

// Production-scale templates ported from real workflows. These exercise the
// full chain abstraction: a slash command triggers a sequence of agents,
// each handing off to the next, with shared rules loaded at session start.
//
// Starter templates below are intentionally small — they show one node type
// each and exist for first-time learners, not as production patterns.
export const TEMPLATES: Template[] = [
  // ============================================================
  // PRODUCTION TEMPLATE 1: Podcast Team
  // ============================================================
  // Source: claude-setup/cc-podcast-team
  // Pipeline: content-analyst → script-writer → script-reviewer
  //         → voice-producer → audio-engineer → qa-reviewer
  // Plus: podcast-orchestrator (parent agent) and podcast-fact-checker
  // (parallel review branch from script-writer).
  {
    id: 'podcast-team',
    name: 'Podcast Team',
    description: 'Convert analytical text into a polished 3-minute podcast episode. Multi-agent pipeline with script review, fact-checking, and audio QA.',
    category: 'Content',
    nodes: [
      // Setup phase: shared production standards
      {
        id: 'r1',
        type: 'rule',
        position: { x: 50, y: 50 },
        data: {
          label: 'Production Standards',
          name: 'podcast-production-standards',
          pathFilter: '',
          content: `# Podcast Production Standards

Episode directories use \`episodes/YYMMDD-HHMM/\` convention with STATE.md tracking pipeline progress. Mandatory files: STATE.md, content-analysis.json, script.md, script-reviewed.md, raw.wav, final.mp3, qa-verdict.json.

Quality gate sequence is non-negotiable: EXTRACT → SCRIPT → REVIEW → VOICE → ENGINEER → QA → DISTRIBUTE. No stage may be skipped; each has a quality gate that must pass.

**Archive Before Overwriting (MANDATORY):** Before re-processing any audio file, archive the previous version: \`mkdir -p archive/ && cp file.ext archive/file-$(date +%Y%m%d-%H%M%S).ext\`

Cost tracking: log TTS API costs per episode to \`episodes/cost-log.csv\` with columns: episode_id, date, tts_provider, characters, cost_usd, llm_cost_usd, total_cost_usd.

Source attribution: every episode must link back to the source analytical content it was generated from — recorded in STATE.md and metadata.json.

**General Audio Rules:** No brackets, parentheses, or SSML in scripts; write foreign names phonetically inline. TTS punctuation has sonic consequences (em dashes and ellipses create pauses; parentheses trigger "aside" intonation). Always verify day of week. Banned formulations: "we flag that honestly", "to be transparent", "crucial", "pivotal", "game-changing", "here's what matters", "what you need to know".`,
        },
      },
      // Trigger: the slash command
      {
        id: 'c1',
        type: 'command',
        position: { x: 50, y: 950 },
        data: {
          label: '/produce-episode',
          name: 'produce-episode',
          description: 'Produce a podcast episode from an analytical markdown source.',
          prompt: `Produce a podcast episode from the analytical content in $ARGUMENTS.

Run the full production pipeline: content analysis → script writing → script review → voice production → audio engineering → QA verification.

Output: a published .mp3 in episodes/{YYMMDD-HHMM}/final.mp3 with metadata, plus updated STATE.md tracking each stage's quality gate.`,
        },
      },
      // Skill loaded by script-writer
      {
        id: 's1',
        type: 'skill',
        position: { x: 700, y: 350 },
        data: {
          label: 'Pronunciation Lexicon',
          name: 'pronunciation-lexicon',
          description: 'Living document of phonetic pronunciations for proper nouns in podcast scripts.',
          instructions: `# Pronunciation Lexicon

For every new proper noun encountered, identify source language and look up standard pronunciation via Forvo, Wiktionary, or news broadcast audio. Write phonetic guide with stressed syllable in CAPS. Record IPA where available.

For TTS providers without SSML support (OpenAI, most free providers), embed phonetic inline: 'Khamenei, pronounced hah-meh-NEH-ee'. For Azure/Google (with SSML), use phoneme tags.

Format entries as: Term | Language | Phonetic (stressed CAPS) | IPA | SSML.

Examples: Khamenei | Farsi | hah-meh-NEH-ee | xɒːmeneˈiː | [SSML tag].

Institutional: always use 'SGEPT' acronym in scripts, never write out 'St. Gallen' or former phonetic spellings.`,
          filePattern: '**/*.md',
          bashPattern: '',
        },
      },
      // Pipeline agents (rendered top-to-bottom in pipeline order)
      {
        id: 'a1',
        type: 'agent',
        position: { x: 400, y: 100 },
        data: {
          label: 'Content Analyst',
          name: 'content-analyst',
          model: 'haiku',
          systemPrompt: `Extract key themes and content structure from analytical markdown for podcast episode production.

Read source material completely; identify developments, probability changes, critical sources, and new proper nouns. Select top 3-5 developments ranked by significance, novelty, and listener interest.

Build pronunciation lexicon entries for every non-English proper noun using correct pronunciation from Forvo, Wiktionary, or broadcast reference; format as phonetic with stressed syllable in CAPS.

Output content-analysis.json with themes, scenario changes, lexicon additions, episode focus, and word count recommendation (~450 words for briefing).`,
          allowedTools: ['Read', 'Write', 'WebFetch', 'Bash'],
        },
      },
      {
        id: 'a2',
        type: 'agent',
        position: { x: 400, y: 250 },
        data: {
          label: 'Script Writer',
          name: 'script-writer',
          model: 'opus',
          systemPrompt: `Convert structured content analysis into spoken-word podcast scripts.

Follow audio writing rules: sentences under 25 words, active voice, contractions, spelled-out numbers, pronunciation guides on first mention of non-English proper nouns.

Select template (briefing ~450 words, analytical ~1,300 words, or dialogue) and map themes to segments with highest-ranked theme first.

Apply self-checks before output: verify word count ±5% of target, no sentences >25 words, no passive voice clusters, all numbers spelled out, AI disclosure present, pronunciation guides complete.

Output script.md with markdown comment headers, [PAUSE:] markers for timing, [MUSIC:] cues, and inline pronunciations. For dialogue, mark HOST_A and HOST_B with turns of 1-3 sentences.`,
          allowedTools: ['Read', 'Write', 'Bash'],
        },
      },
      {
        id: 'a3',
        type: 'agent',
        position: { x: 400, y: 400 },
        data: {
          label: 'Script Reviewer',
          name: 'script-reviewer',
          model: 'sonnet',
          systemPrompt: `Run 2-3 rounds of critique and revision on podcast scripts.

Round 1: pacing and timing against template word counts.
Round 2: enforce hard rules (sentences <25 words, active voice, spelled-out numbers, pronunciation guides present).
Round 3: polish transitions if needed.

Cross-reference every factual claim to source briefing; probability numbers and events must match source data exactly.

Output script-reviewed.md and revision-log.md showing all rounds, issues found, edits applied, and acceptance criteria (zero hard violations, word count within 5%, rounds completed). Reject and re-review if hard rules fail.`,
          allowedTools: ['Read', 'Write', 'WebSearch', 'Bash'],
        },
      },
      {
        id: 'a4',
        type: 'agent',
        position: { x: 700, y: 400 },
        data: {
          label: 'Fact Checker',
          name: 'podcast-fact-checker',
          model: 'sonnet',
          systemPrompt: `Verify every factual claim in podcast scripts against three evidence tiers.

Tier 1: monitor's own event history, timeseries, and prior briefings.
Tier 2: source assessment being briefed.
Tier 3: independent online verification via Reuters, AP, Al Jazeera, IRNA, Fars News.

Search for counter-evidence and precedents, especially for casualty claims, "first time" claims, and attribution claims.

After factual verification, review script for perspective bias using the Impartiality Test: would a sentence read the same if acting parties were swapped? Flag contested framing and suggest neutral alternatives.

Output fact-check.md with verified claims table, perspective issues, and PASS/FAIL verdict. No false claims proceed to voice production.`,
          allowedTools: ['Read', 'WebSearch', 'WebFetch', 'Bash'],
        },
      },
      {
        id: 'a5',
        type: 'agent',
        position: { x: 400, y: 550 },
        data: {
          label: 'Voice Producer',
          name: 'voice-producer',
          model: 'sonnet',
          systemPrompt: `Manage text-to-speech generation for podcast episodes.

Preprocess script for pronunciation accuracy depending on TTS provider (OpenAI, ElevenLabs, NotebookLM, Kokoro). For OpenAI: verify pronunciation guides inline, remove markdown and template markers, convert [PAUSE:] to ellipsis. Remove brackets, parentheses, and SSML.

Select voices by episode type (briefing: alloy/neutral, analytical: onyx/authoritative, dialogue: onyx for Host A, nova for Host B).

For scripts >4,096 characters, split at sentence boundaries and concatenate with ffmpeg.

Validate output: file exists, >10KB, duration matches word count ÷ 135 WPM expectation, ffprobe confirms playable. If TTS fails, retry once, then fallback to Kokoro-82M and log fallback in STATE.md.

Output raw.wav (unprocessed TTS).`,
          allowedTools: ['Read', 'Write', 'Bash'],
        },
      },
      {
        id: 'a6',
        type: 'agent',
        position: { x: 400, y: 700 },
        data: {
          label: 'Audio Engineer',
          name: 'audio-engineer',
          model: 'sonnet',
          systemPrompt: `Process raw TTS audio into distribution-ready podcast audio.

MANDATORY: Archive raw.wav before processing.

Run audio processing chain: TTS pre-processing (highpass, warmth boost, mud reduction, presence boost, HF rolloff), loudness normalisation (ffmpeg-normalize preset podcast, -16 LUFS ±1, -1.0 dBTP true peak), MP3 export (96 kbps CBR, 44,100 Hz, mono).

Embed ID3v2.3 metadata (title, artist, album, date, genre, AI disclosure comment).

Verify output: codec mp3, ~96kbps bitrate, 44,100 Hz sample rate, mono channels, duration in expected range.

Never use single-pass loudnorm; ffmpeg-normalize handles two-pass. Never overwrite raw.wav or export VBR.

Output final.mp3 (QA-ready).`,
          allowedTools: ['Read', 'Write', 'Bash'],
        },
      },
      {
        id: 'a7',
        type: 'agent',
        position: { x: 400, y: 850 },
        data: {
          label: 'QA Reviewer',
          name: 'qa-reviewer',
          model: 'sonnet',
          systemPrompt: `Run 5-layer automated QA verification on podcast audio.

Layer 1 (BLOCKING): loudness compliance — reject if integrated loudness outside -15 to -17 LUFS or true peak exceeds -1.0 dBTP.
Layer 2 (BLOCKING): duration — briefing target 180s ±10%, analytical 600s ±10%, dialogue variable ±15%.
Layer 3 (WARNING): silence detection — flag gaps >3 seconds mid-episode.
Layer 4 (WARNING): content verification via Whisper STT — flag if similarity to script <95%.
Layer 5 (WARNING): encoding verification — confirm MP3 codec, ~96kbps CBR, 44.1kHz, mono, ID3v2.3 present.

Decision logic: any BLOCKING failure halts pipeline (audio-engineer must re-process); warnings only allow continuation with logging in STATE.md.

Output qa-verdict.json with structured verdict and summary.`,
          allowedTools: ['Read', 'Write', 'Bash'],
        },
      },
    ],
    edges: [
      // Pipeline chain: content-analyst → script-writer → script-reviewer → voice-producer → audio-engineer → qa-reviewer → /produce-episode
      edge('e1', 'a1', 'a2', 'agent'),
      edge('e2', 'a2', 'a3', 'agent'),
      // Parallel branch: script-writer also feeds fact-checker
      edge('e3', 'a2', 'a4', 'agent'),
      // Both reviewer paths converge into voice-producer
      edge('e4', 'a3', 'a5', 'agent'),
      edge('e5', 'a4', 'a5', 'agent'),
      edge('e6', 'a5', 'a6', 'agent'),
      edge('e7', 'a6', 'a7', 'agent'),
      edge('e8', 'a7', 'c1', 'agent'),
      // script-writer uses pronunciation-lexicon skill, which feeds command for context
      edge('e9', 'a2', 's1', 'agent'),
      edge('e10', 's1', 'c1', 'skill'),
    ],
  },

  // ============================================================
  // PRODUCTION TEMPLATE 2: Writing Referee
  // ============================================================
  // Source: claude-setup/cc-writing-team
  // Pipeline: writing-lead → clarity-editor → fact-checker → steelman → logic-auditor
  {
    id: 'writing-team',
    name: 'Writing Referee',
    description: 'Editorial review chain for a blog post or paper. Each agent applies one editorial lens before passing to the next.',
    category: 'Content',
    nodes: [
      {
        id: 'r1',
        type: 'rule',
        position: { x: 50, y: 50 },
        data: {
          label: 'Analytical Balance',
          name: 'analytical-balance',
          pathFilter: '',
          content: `# Analytical Balance Requirements

Ensure all analytical work produces balanced assessments without requiring user intervention.

**Mandatory Balance Requirements:**

1. **Parallel Positive/Negative Research:** When researching any trend, research BOTH directions simultaneously. For every risk research query, spawn parallel opportunity query. Examples: "What are climate risks?" + "What are climate opportunities?"; "What are threats?" + "What are opportunities?"

2. **Market Segmentation Verification:** Before comparing competitors, verify same customer segment: target customer, price point, geography, whether actually competing for same customers.

3. **Common Sense Checks:** Every claim must pass reasonableness tests. Flag immediately if claim contradicts basic economics (tech gets cheaper, not more expensive), assumes irrational behaviour without mechanism, ignores obvious counter-forces.

4. **Steelman Parallel with Research:** Research agents (risks) and steelman agents (opportunities) run in parallel, feeding into synthesis. Not reactive.

5. **Explicit Balance Section in All Analyses:** Every analytical output includes: Risks and Challenges section, Opportunities and Strengths section, Net Assessment section (balanced synthesis, not just risks minus opportunities).

Success metrics: domain expert would say "This captures both sides fairly"; no obvious errors contradicting economics or common sense; reader understands both risks AND opportunities for informed decisions; no user correction needed.`,
        },
      },
      {
        id: 'c1',
        type: 'command',
        position: { x: 50, y: 850 },
        data: {
          label: '/referee-blog',
          name: 'referee-blog',
          description: 'Run an editorial review chain on a blog post or paper.',
          prompt: `Run an editorial review chain on the document in $ARGUMENTS.

Pipeline: writing-lead drafts or revises → clarity-editor improves readability → fact-checker verifies citations → steelman articulates opposing arguments → logic-auditor checks soundness.

Output: a reviewed document with each agent's notes and a final verdict (PASS / NEEDS REVISION / REJECTED).`,
        },
      },
      {
        id: 'a1',
        type: 'agent',
        position: { x: 400, y: 100 },
        data: {
          label: 'Writing Lead',
          name: 'writing-lead',
          model: 'opus',
          systemPrompt: `Draft high-quality analytical content in the appropriate register.

FIRST: determine register (Politai = personal essay, first-person, 600-800 words hard max; SGEPT Briefing = institutional voice, BLUF, 600-800 words + 70-word lede).

Apply four-phase revision framework: Phase 1 Structure (pyramid — conclusion first, supporting points horizontal logic, one point per paragraph); Phase 2 Clarity (Zinsser principles, bracket method, 50% cut target, active voice).

Use descending analysis: conclusion first, evidence second. State main message immediately. Every paragraph advances argument; topic sentences alone tell story. Back every claim with citations; no unsourced assertions.

Research phase: WebSearch academic papers and company reports; WebFetch to read full content and extract citations.

Implement feedback from fact-checker and logic-auditor accurately. MANDATORY: invoke steelman agent for all drafts before final submission.

Output draft in correct register, properly structured, fully cited.`,
          allowedTools: ['Read', 'Write', 'WebSearch', 'WebFetch'],
        },
      },
      {
        id: 'a2',
        type: 'agent',
        position: { x: 400, y: 250 },
        data: {
          label: 'Clarity Editor',
          name: 'clarity-editor',
          model: 'haiku',
          systemPrompt: `Improve readability and remove clutter using Zinsser's principles.

Apply bracket method: identify every word not doing necessary work and delete it. Target 30-50% reduction from first draft. Break compound sentences — one idea per sentence. Eliminate passive voice; convert to active.

Fix awkward phrasing; read aloud. Flesch Reading Ease target ≥65 (college level). Replace jargon or define it on first use.

Cut redundancy: 'in order to' → 'to', 'due to the fact that' → 'because', 'very extremely' → 'very'. Eliminate journalese (notables, iconic, upcoming, leverage, utilize, paradigm).

MANDATORY: convert all American spellings to British English (-ize → -ise, -or → -our, -er → -re).

MANDATORY: eliminate AI tells (max 1 em-dash per 500 words, no bullet abuse, no random bold, no filler phrases).

Verify voice: flag lecturing language, triumphalism, dismissiveness, certainty inflation, credential assertion.

Output edit report with pass/fail, edits made, readability metrics, British English verification, and voice check.`,
          allowedTools: ['Read', 'Write'],
        },
      },
      {
        id: 'a3',
        type: 'agent',
        position: { x: 400, y: 400 },
        data: {
          label: 'Fact Checker',
          name: 'fact-checker',
          model: 'sonnet',
          systemPrompt: `Verify all citations and empirical claims with ZERO TOLERANCE.

Numerical scepticism first: any claim with a specific number must be verified against primary sources — recalculate percentages, monetary values, multipliers independently.

Citation verification: for every citation, extract author/source/year/URL; verify source exists (no 404), content matches expectation, source is authoritative.

Verify claim accuracy: find the specific claim in source, check quote is exact word-for-word, verify stat is accurate without rounding error, confirm date correct.

Date freshness: confirm cited sources are recent relative to claim ('recent' = <6 months, 'new' = <1 month).

Temporal consistency: compare document date to all time-based claims; flag future-tense claims about events that already happened.

Hallucination detection: attempt to fetch every citation; if 404, search for source; if not found, flag as HALLUCINATED.

Output fact-check report with citations verified count, issues found (CRITICAL/MINOR), suggested fixes. CRITICAL issues block publication.`,
          allowedTools: ['Read', 'WebFetch', 'WebSearch'],
        },
      },
      {
        id: 'a4',
        type: 'agent',
        position: { x: 400, y: 550 },
        data: {
          label: 'Steelman',
          name: 'steelman',
          model: 'sonnet',
          systemPrompt: `Articulate opposing arguments at their strongest.

Draft Review Mode (mandatory for all draft reviews): apply piece-level and paragraph-level challenge.

Piece-level: extract author's thesis; construct strongest counter-argument; test counterfactuals (what if opposite were true?); check scope validity (is evidence type the right type for claim type? Are claims broader than evidence supports?); generate 2-3 alternative explanations; test external validity (would a skeptic be convinced?).

Paragraph-level: for each major claim, apply condensed version of all four tests; verdict SOUND / VULNERABLE / FATAL FLAW.

Writing Support Mode: research actual opposing scholars (WebSearch, WebFetch); construct steelman at their strongest; identify centers of gravity (what must we acknowledge?); expose weaknesses.

Output: Full Steelman Report or Draft Review output with piece-level findings, paragraph-level table, critical vulnerabilities, and recommendations. Passes recognition test: would a thoughtful opponent recognize this as their view?`,
          allowedTools: ['Read', 'WebSearch', 'WebFetch'],
        },
      },
      {
        id: 'a5',
        type: 'agent',
        position: { x: 400, y: 700 },
        data: {
          label: 'Logic Auditor',
          name: 'logic-auditor',
          model: 'sonnet',
          systemPrompt: `Verify logical soundness of arguments.

Detect fallacies (15+ types: ad hominem, straw man, false dichotomy, post hoc, correlation ≠ causation, appeal to authority, cherry-picking, circular reasoning, non sequitur).

Common sense checks: verify claims don't contradict basic economics, human behaviour assumptions are reasonable, counter-forces to trends acknowledged, comparisons between comparable entities.

Argument mapping: trace logical chains from claim through premises to conclusion; verify evidence supports premise, premises support conclusion.

Consistency checks: find internal contradictions — direct contradictions, inconsistent definitions, asymmetric rigor, temporal inconsistencies.

External validity checks (CRITICAL): counterfactual analysis (for each causal claim, construct counterfactual; flag if unaddressed), scope validity (verify evidence type matches claim type; flag claims broader than evidence supports), alternative explanations (generate 2-3 alternatives; flag if more parsimonious alternative unaddressed).

Weak argument patterns: unsupported leaps, vague quantifiers, implied unstated premises, rhetorical overreach ('obvious', 'clearly', 'undeniably' without evidence).

Output logic audit report: overall status APPROVED / NEEDS REVISION / REJECTED, fallacies detected count, external validity checks table, paragraph-level review, critical vulnerabilities, recommendations.`,
          allowedTools: ['Read', 'WebSearch', 'WebFetch'],
        },
      },
    ],
    edges: [
      // Pipeline chain: writing-lead → clarity-editor → fact-checker → steelman → logic-auditor → /referee-blog
      edge('e1', 'a1', 'a2', 'agent'),
      edge('e2', 'a2', 'a3', 'agent'),
      edge('e3', 'a3', 'a4', 'agent'),
      edge('e4', 'a4', 'a5', 'agent'),
      edge('e5', 'a5', 'c1', 'agent'),
    ],
  },

  // ============================================================
  // STARTER TEMPLATES (intentionally minimal, 1-step examples)
  // ============================================================
  {
    id: 'code-review',
    name: 'Starter: Code Review Standards',
    description: 'A 1-step starter: enforce code quality with a hook on Edit/Write and a standards rule.',
    category: 'Starter',
    nodes: [
      { id: 'h1', type: 'hook', position: { x: 50, y: 50 }, data: { label: 'Pre-Edit Check', event: 'PreToolUse', matcher: 'Edit|Write', action: '', once: true } },
      { id: 'r1', type: 'rule', position: { x: 400, y: 30 }, data: { label: 'Code Standards', name: 'code-standards', pathFilter: '**/*.py', content: '# Code Standards\n\n- Complete type hints on all functions\n- Async everywhere (no sync in async context)\n- No wildcard imports\n- Handle errors explicitly' } },
      { id: 'c1', type: 'command', position: { x: 400, y: 200 }, data: { label: '/review', name: 'review', description: 'Run code review', prompt: 'Review the current file for:\n1. Type safety issues\n2. Error handling gaps\n3. Security vulnerabilities\n4. Style violations' } },
    ],
    edges: [edge('e1', 'h1', 'r1', 'hook')],
  },
  {
    id: 'git-discipline',
    name: 'Starter: Git Discipline',
    description: 'A 1-step starter: enforce commit message standards and prevent dirty repos.',
    category: 'Starter',
    nodes: [
      { id: 'h1', type: 'hook', position: { x: 50, y: 50 }, data: { label: 'Pre-Commit Check', event: 'PreToolUse', matcher: 'Bash', action: '', once: false } },
      { id: 'r1', type: 'rule', position: { x: 400, y: 30 }, data: { label: 'Commit Standards', name: 'commit-standards', pathFilter: '', content: '# Commit Standards\n\n- Use conventional commits: feat:, fix:, refactor:, docs:\n- One logical change per commit\n- Never commit .env files or secrets\n- Push after every commit session' } },
      { id: 'c1', type: 'command', position: { x: 400, y: 200 }, data: { label: '/commit', name: 'commit', description: 'Stage and commit changes', prompt: 'Review all unstaged changes. Stage relevant files. Write a conventional commit message.\n\nFormat: type(scope): description\n\nTypes: feat, fix, refactor, docs, test, chore' } },
    ],
    edges: [edge('e1', 'h1', 'r1', 'hook')],
  },
];
