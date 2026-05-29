/*
 * SCuLPT — Survey text-field validation (question-aware)
 *
 * Reads "Resultados SCuLPT.xlsx":
 *   - Sheet "Resultados"          → respondent answers
 *   - Sheet "Preguntas de Encuesta" → question text per ID
 *
 * Each open-ended question has a type declared in questions-config.json. The
 * type drives a scoring strategy so the final Likert (1-5) consistently means
 * "favorability toward SCuLPT" across questions, instead of just raw sentiment.
 *
 *   positive       — raw sentiment → Likert (current baseline)
 *   negative       — invert sentiment; keyword overrides for "ninguno"/"difícil"
 *   recommendation — explicit sí/no detection, sentiment as tiebreaker
 *   comparison     — count comparative cues (mejor/peor/más fácil/…)
 *   suggestion     — NOT favorability; reported as engagement (chars, items)
 *
 * Output:
 *   - Two console tables (favorability, engagement)
 *   - data/sentiment-results.json with per-cell breakdown
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { SentimentAnalyzer } = require('@nlpjs/sentiment');
const { LangEs } = require('@nlpjs/lang-es');
const { Container } = require('@nlpjs/core');

const INPUT_FILE = path.join(__dirname, 'Resultados SCuLPT.xlsx');
const CONFIG_FILE = path.join(__dirname, 'questions-config.json');
const SLANG_FILE = path.join(__dirname, 'colombian-slang-es.json');
const OUTPUT_FILE = path.join(__dirname, 'sentiment-results.json');
const ANSWERS_SHEET = 'Resultados';
const QUESTIONS_SHEET = 'Preguntas de Encuesta';

const TEXT_COLUMNS = [10, 11, 12, 14, 15, 18, 19, 21, 22, 23];

// Quantitative anchor columns. Letter-coded (A-E → 1-5) for P4–P8; numeric for P20.
const QUANT_LETTER_COLUMNS = [
  { col: 4, id: 'P4-AC',  label: 'qué tan fácil entender los conceptos básicos' },
  { col: 5, id: 'P5-AC',  label: 'qué tan fácil identificar los tipos de bloques' },
  { col: 6, id: 'P6-AC',  label: 'qué tan fácil resolver el problema' },
  { col: 7, id: 'P7-AC',  label: 'qué tan útil para entender programación' },
  { col: 8, id: 'P8-AC',  label: 'experiencia general con SCuLPT' },
];
const QUANT_NUMERIC_COLUMNS = [
  { col: 20, id: 'P20-SyM', label: '¿recomendarías SCuLPT?' },
];

// Pre/post comparative blocks (5 concepts, encoded as "v1,v2,v3,v4,v5" tuples).
const PRE_COLUMN = 16;
const POST_COLUMN = 17;
const PRE_POST_CONCEPTS = [
  'Variables y tipos de datos',
  'Operaciones y expresiones',
  'Estructuras de control',
  'Estructuras de datos',
  'Lógica de programación',
];

// Conceptually parallel pairings used to anchor the text-derived Likert
// against the explicit quantitative responses (Spearman correlation).
const PAIRINGS = [
  { textId: '10-AC',     quant: 'P5-AC',   label: '"más intuitivo" ↔ "fácil identificar bloques"' },
  { textId: '11-AC',     quant: 'P4-AC',   label: '"más difícil" (invertido) ↔ "fácil entender"' },
  { textId: '11-AC',     quant: 'P6-AC',   label: '"más difícil" (invertido) ↔ "fácil resolver"' },
  { textId: '14-AC',     quant: 'P8-AC',   label: '"aspecto visual" ↔ "experiencia general"' },
  { textId: '15-AC',     quant: 'P20-SyM', label: '"¿usarías?" ↔ "¿recomendarías?"' },
  { textId: 'composite', quant: 'composite', label: 'favorabilidad textual agregada ↔ Likert cuantitativo agregado' },
];

function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function isMeaningful(text) {
  if (text === null || text === undefined) return false;
  const t = String(text).trim();
  if (t === '' || t === '-' || t === '--' || t === 'N/A' || t === 'n/a') return false;
  return true;
}

function comparativeToLikert(comparative) {
  if (comparative <= -0.6) return 1;
  if (comparative <= -0.2) return 2;
  if (comparative <   0.2) return 3;
  if (comparative <   0.6) return 4;
  return 5;
}

function injectColombianSlang(container) {
  if (!fs.existsSync(SLANG_FILE)) return { injected: 0, overrides: [] };
  const raw = JSON.parse(fs.readFileSync(SLANG_FILE, 'utf8'));
  const words = raw.words || {};
  const dict = container.get('sentiment-es');
  const stemmer = container.get('stemmer-es');
  if (!dict || !dict.senticon || !stemmer) return { injected: 0, overrides: [] };
  const overrides = [];
  let injected = 0;
  for (const [word, score] of Object.entries(words)) {
    const stems = stemmer.tokenizeAndStem(word);
    if (!stems.length) continue;
    const stem = stems[0];
    if (dict.senticon[stem] !== undefined && dict.senticon[stem] !== score) {
      overrides.push({ word, stem, previous: dict.senticon[stem], next: score });
    }
    dict.senticon[stem] = score;
    injected += 1;
  }
  return { injected, overrides };
}

function loadQuestions(wb) {
  const ws = wb.Sheets[QUESTIONS_SHEET];
  if (!ws) return {};
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  const out = {};
  for (const row of rows) {
    const id = row[1];
    const text = row[2];
    if (id && text && String(id).match(/^\d+-/)) {
      out[String(id).trim()] = String(text).trim();
    }
  }
  return out;
}

function countHits(normText, tokens) {
  if (!tokens || tokens.length === 0) return { hits: 0, matched: [] };
  let hits = 0;
  const matched = [];
  for (const t of tokens) {
    const nt = normalize(t).trim();
    if (!nt) continue;
    // word-ish containment: pad with spaces so short tokens like "si " behave
    const padded = ` ${normText} `;
    const needle = nt.startsWith(' ') || nt.endsWith(' ') ? nt : ` ${nt}`;
    let idx = padded.indexOf(needle);
    while (idx !== -1) {
      // negation guard: if preceded by " no " or " nunca " within ~10 chars, flip
      const before = padded.slice(Math.max(0, idx - 12), idx);
      if (/\s(no|nunca|jamas|tampoco)\s[^.,;]{0,8}$/.test(before)) {
        idx = padded.indexOf(needle, idx + needle.length);
        continue;
      }
      hits += 1;
      matched.push(t);
      idx = padded.indexOf(needle, idx + needle.length);
    }
  }
  return { hits, matched };
}

function scorePositive(_text, sentiment) {
  return { likert: comparativeToLikert(sentiment.comparative), reason: 'sentiment' };
}

function scoreNegative(text, sentiment, cfg) {
  const n = normalize(text);
  const fav = countHits(n, cfg.favorableTokens);
  const unfav = countHits(n, cfg.unfavorableTokens);
  if (fav.hits > unfav.hits && fav.hits > 0) {
    return { likert: 5, reason: `favorable-keyword(${fav.matched.join(',')})` };
  }
  if (unfav.hits > 0) {
    const likert = unfav.hits >= 2 ? 1 : 2;
    return { likert, reason: `unfavorable-keyword(${unfav.matched.join(',')})` };
  }
  // invert sentiment: negative sentiment toward a "what was hard?" question
  // means difficulty was reported → unfavorable to SCuLPT.
  return {
    likert: comparativeToLikert(-sentiment.comparative),
    reason: 'sentiment-inverted',
  };
}

function scoreRecommendation(text, sentiment, cfg) {
  const n = normalize(text);
  const aff = countHits(n, cfg.affirmativeTokens);
  const neg = countHits(n, cfg.negativeTokens);
  if (neg.hits > aff.hits && neg.hits > 0) {
    return { likert: 1, reason: `negative-keyword(${neg.matched.join(',')})` };
  }
  if (aff.hits > 0) {
    const base = sentiment.comparative >= 0.2 ? 5 : 4;
    return { likert: base, reason: `affirmative-keyword(${aff.matched.join(',')})` };
  }
  return { likert: comparativeToLikert(sentiment.comparative), reason: 'sentiment' };
}

function scoreComparison(text, sentiment, cfg) {
  const n = normalize(text);
  const fav = countHits(n, cfg.favorableTokens);
  const unfav = countHits(n, cfg.unfavorableTokens);
  const diff = fav.hits - unfav.hits;
  if (diff >= 2) return { likert: 5, reason: `comparison-favorable(${fav.matched.join(',')})` };
  if (diff === 1) return { likert: 4, reason: `comparison-favorable(${fav.matched.join(',')})` };
  if (diff === -1) return { likert: 2, reason: `comparison-unfavorable(${unfav.matched.join(',')})` };
  if (diff <= -2) return { likert: 1, reason: `comparison-unfavorable(${unfav.matched.join(',')})` };
  return { likert: comparativeToLikert(sentiment.comparative), reason: 'sentiment' };
}

// --- statistical helpers --------------------------------------------------

function mean(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function letterToLikert(v) {
  if (v == null) return null;
  const t = String(v).trim().toUpperCase();
  const map = { A: 1, B: 2, C: 3, D: 4, E: 5 };
  return map[t] ?? null;
}

function parseDeltaTuple(s) {
  if (s == null) return [];
  return String(s).split(',').map(tok => {
    const t = tok.trim();
    if (t === '' || t === '-') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  });
}

// Average ranks with tie correction (used for Spearman).
function ranks(arr) {
  const sorted = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(arr.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1][0] === sorted[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[sorted[k][1]] = avg;
    i = j + 1;
  }
  return out;
}

function pearson(x, y) {
  const n = x.length;
  if (n < 2) return null;
  const mx = mean(x);
  const my = mean(y);
  let num = 0, dx = 0, dy = 0;
  for (let k = 0; k < n; k++) {
    num += (x[k] - mx) * (y[k] - my);
    dx += (x[k] - mx) ** 2;
    dy += (y[k] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

function spearman(xs, ys) {
  const pairs = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] != null && ys[i] != null) pairs.push([xs[i], ys[i]]);
  }
  if (pairs.length < 3) return { rho: null, n: pairs.length };
  const rx = ranks(pairs.map(p => p[0]));
  const ry = ranks(pairs.map(p => p[1]));
  const rho = pearson(rx, ry);
  return { rho: rho == null ? null : Number(rho.toFixed(3)), n: pairs.length };
}

function bootstrapMeanCI(values, nResamples = 1000, alpha = 0.05) {
  if (!values || values.length < 2) return { low: null, high: null };
  const n = values.length;
  const means = new Array(nResamples);
  for (let i = 0; i < nResamples; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += values[Math.floor(Math.random() * n)];
    means[i] = s / n;
  }
  means.sort((a, b) => a - b);
  const lo = means[Math.floor((alpha / 2) * nResamples)];
  const hi = means[Math.floor((1 - alpha / 2) * nResamples)];
  return { low: Number(lo.toFixed(2)), high: Number(hi.toFixed(2)) };
}

function interpretRho(rho) {
  if (rho == null) return 'n/a';
  const a = Math.abs(rho);
  const sign = rho >= 0 ? '+' : '-';
  if (a < 0.1) return `≈ 0 (sin relación)`;
  if (a < 0.3) return `${sign} débil`;
  if (a < 0.5) return `${sign} moderada`;
  if (a < 0.7) return `${sign} fuerte`;
  return `${sign} muy fuerte`;
}

// --- scoring strategies ---------------------------------------------------

function scoreSuggestion(text) {
  const t = String(text).trim();
  const items = Math.min(
    5,
    Math.max(1, t.split(/[,;]| y |\n/).map(s => s.trim()).filter(Boolean).length)
  );
  return { engagement: { chars: t.length, items } };
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`Config file not found: ${CONFIG_FILE}`);
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

  const container = new Container();
  container.use(LangEs);
  const sentiment = new SentimentAnalyzer({ container });
  // Force lazy-loading of the Spanish sentiment dictionary so we can mutate it.
  await sentiment.process({ locale: 'es', text: 'inicializar' });
  const slangReport = injectColombianSlang(container);
  if (slangReport.injected) {
    console.log(`Diccionario de jerga colombiana inyectado: ${slangReport.injected} entradas (${slangReport.overrides.length} sobrescriben valores estándar).`);
  }

  const wb = XLSX.readFile(INPUT_FILE);
  const ws = wb.Sheets[ANSWERS_SHEET];
  if (!ws) {
    console.error(`Sheet "${ANSWERS_SHEET}" not found. Available: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }
  const questions = loadQuestions(wb);

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  const header = rows[1] || [];
  const dataRows = rows.slice(2).filter(r => r.some(c => isMeaningful(c)));

  const perColumn = {};
  for (const col of TEXT_COLUMNS) {
    const id = header[col - 1] || `col${col}`;
    perColumn[id] = {
      questionText: questions[id] || null,
      type: (config[id] && config[id].type) || 'positive',
      responses: [],
      likertValues: [],
      engagementValues: [],
    };
  }

  // Per-respondent collectors for anchoring and pre/post analyses.
  const perRow = dataRows.map((row, i) => {
    const quant = {};
    for (const q of QUANT_LETTER_COLUMNS) quant[q.id] = letterToLikert(row[q.col - 1]);
    for (const q of QUANT_NUMERIC_COLUMNS) {
      const v = row[q.col - 1];
      quant[q.id] = typeof v === 'number' && Number.isFinite(v) ? v : null;
    }
    return {
      rowIndex: i + 1,
      quant,
      textLikerts: {},
      pre: parseDeltaTuple(row[PRE_COLUMN - 1]),
      post: parseDeltaTuple(row[POST_COLUMN - 1]),
    };
  });

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    for (const col of TEXT_COLUMNS) {
      const id = header[col - 1] || `col${col}`;
      const slot = perColumn[id];
      const cell = row[col - 1];
      if (!isMeaningful(cell)) {
        slot.responses.push({
          rowIndex: i + 1,
          text: cell == null ? '' : String(cell),
          type: slot.type,
          empty: true,
          reason: 'empty',
        });
        continue;
      }
      const text = String(cell).trim();
      const result = await sentiment.process({ locale: 'es', text });
      const s = result.sentiment || result;
      const sentInfo = {
        score: typeof s.score === 'number' ? s.score : 0,
        comparative: typeof s.average === 'number' ? s.average : (s.comparative ?? 0),
        vote: s.vote || null,
      };

      const cfg = config[id] || { type: 'positive' };
      let scored;
      switch (cfg.type) {
        case 'negative':      scored = scoreNegative(text, sentInfo, cfg); break;
        case 'recommendation': scored = scoreRecommendation(text, sentInfo, cfg); break;
        case 'comparison':    scored = scoreComparison(text, sentInfo, cfg); break;
        case 'suggestion':    scored = scoreSuggestion(text); break;
        case 'positive':
        default:              scored = scorePositive(text, sentInfo); break;
      }

      const entry = {
        rowIndex: i + 1,
        text,
        type: cfg.type,
        sentiment: sentInfo,
        empty: false,
        ...scored,
      };
      slot.responses.push(entry);

      if (typeof scored.likert === 'number') {
        slot.likertValues.push(scored.likert);
        perRow[i].textLikerts[id] = scored.likert;
      }
      if (scored.engagement) {
        slot.engagementValues.push(scored.engagement.items);
      }
    }
  }

  console.log(`Procesadas ${dataRows.length} respuestas de encuesta.\n`);

  // --- 1. Favorability + engagement with bootstrap CIs -------------------

  const favorability = [];
  const engagement = [];
  for (const [id, slot] of Object.entries(perColumn)) {
    if (slot.type === 'suggestion') {
      const avg = mean(slot.engagementValues);
      const ci = bootstrapMeanCI(slot.engagementValues);
      engagement.push({
        pregunta: id,
        tipo: slot.type,
        n: slot.engagementValues.length,
        items_promedio: avg == null ? null : Number(avg.toFixed(2)),
        IC95: avg == null ? '—' : `[${ci.low}, ${ci.high}]`,
      });
    } else {
      const avg = mean(slot.likertValues);
      const ci = bootstrapMeanCI(slot.likertValues);
      favorability.push({
        pregunta: id,
        tipo: slot.type,
        n: slot.likertValues.length,
        favorabilidad: avg == null ? null : Number(avg.toFixed(2)),
        IC95: avg == null ? '—' : `[${ci.low}, ${ci.high}]`,
      });
    }
  }

  console.log('Favorabilidad hacia SCuLPT (1 = muy desfavorable, 5 = muy favorable; IC95 por bootstrap, 1000 resamples):');
  console.table(favorability);
  console.log('\nEngagement (preguntas de sugerencias — # de ítems promedio):');
  console.table(engagement);

  // --- 2. Quant anchors: Spearman vs explicit Likert questions -----------

  // Composite per-respondent scores (favorability text vs quant).
  const composite = perRow.map(r => {
    const tVals = Object.values(r.textLikerts);
    const qVals = [...QUANT_LETTER_COLUMNS, ...QUANT_NUMERIC_COLUMNS]
      .map(q => r.quant[q.id])
      .filter(v => v != null);
    return {
      text: tVals.length ? mean(tVals) : null,
      quant: qVals.length ? mean(qVals) : null,
    };
  });

  const quantSummary = [...QUANT_LETTER_COLUMNS, ...QUANT_NUMERIC_COLUMNS].map(q => {
    const vals = perRow.map(r => r.quant[q.id]).filter(v => v != null);
    const ci = bootstrapMeanCI(vals);
    return {
      pregunta: q.id,
      label: q.label,
      n: vals.length,
      promedio: vals.length ? Number(mean(vals).toFixed(2)) : null,
      IC95: vals.length ? `[${ci.low}, ${ci.high}]` : '—',
    };
  });

  console.log('\nPreguntas cuantitativas (anclaje — promedio 1-5):');
  console.table(quantSummary);

  const anchors = PAIRINGS.map(pair => {
    let xs, ys;
    if (pair.textId === 'composite' && pair.quant === 'composite') {
      xs = composite.map(c => c.text);
      ys = composite.map(c => c.quant);
    } else {
      xs = perRow.map(r => r.textLikerts[pair.textId] ?? null);
      ys = perRow.map(r => r.quant[pair.quant] ?? null);
    }
    const { rho, n } = spearman(xs, ys);
    return {
      par: `${pair.textId} ↔ ${pair.quant}`,
      descripcion: pair.label,
      n,
      rho_spearman: rho,
      interpretacion: interpretRho(rho),
    };
  });

  console.log('\nAnclaje: correlación de Spearman (texto derivado vs Likert explícito):');
  console.table(anchors);

  // --- 3. Pre/post delta (P16 vs P17) ------------------------------------

  const prePost = PRE_POST_CONCEPTS.map((concept, idx) => {
    const pre = perRow.map(r => r.pre[idx]).filter(v => v != null);
    const post = perRow.map(r => r.post[idx]).filter(v => v != null);
    const deltas = perRow
      .map(r => {
        if (r.pre[idx] != null && r.post[idx] != null) return r.post[idx] - r.pre[idx];
        return null;
      })
      .filter(v => v != null);
    const ci = bootstrapMeanCI(deltas);
    return {
      concepto: concept,
      n_pares: deltas.length,
      pre_promedio: pre.length ? Number(mean(pre).toFixed(2)) : null,
      post_promedio: post.length ? Number(mean(post).toFixed(2)) : null,
      delta_promedio: deltas.length ? Number(mean(deltas).toFixed(2)) : null,
      delta_IC95: deltas.length ? `[${ci.low}, ${ci.high}]` : '—',
    };
  });

  console.log('\nImpacto pedagógico (auto-evaluación de comprensión — pre vs post SCuLPT):');
  console.table(prePost);

  // --- Persist -----------------------------------------------------------

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        slang: slangReport,
        questions,
        summary: {
          favorability,
          engagement,
          quantSummary,
          anchors,
          prePost,
        },
        perColumn,
        perRow,
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`\nDetalle por celda y por respondiente escrito en: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
