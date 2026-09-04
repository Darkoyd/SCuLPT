# SCuLPT

**Simple Cubic Language for Programming Tasks**

SCuLPT is a tangible, stack-based programming language designed to make computation more approachable and artistic. Programs are constructed physically using 3D-printed blocks that snap together, creating a hands-on experience with fundamental computing concepts.

---

## Table of Contents

- [Overview](#overview)
- [The Physical Language](#the-physical-language)
  - [Stacks (FILO)](#stacks-filo)
  - [Operations](#operations)
  - [Arithmetic Operations](#arithmetic-operations)
- [3D Files](#3d-files)
- [SCuLPTER — Online Runtime](#sculpter--online-runtime)
- [Validation Data](#validation-data)
- [Related Repositories](#related-repositories)

---

## Overview

SCuLPT turns programming into a physical, tactile experience. Blocks represent operations, stacks hold data, and programs are assembled by connecting pieces together. The language is stack-based and operates using a FILO (First In, Last Out) model — values are pushed onto and popped from named stacks as the program executes.

The language is intentionally minimal: a small set of operations is enough to express any computation, while remaining simple enough to hold in your hands.

---

## The Physical Language

### Stacks (FILO)

SCuLPT programs operate on one or more named stacks. Each stack follows a **First In, Last Out** (FILO / LIFO) discipline. The last value pushed is the first one retrieved. Most operations reference a specific stack by name as part of their syntax.

Stacks hold numbers and one special value, `nil`. `nil` is the empty value. An operation that needs a value from an empty stack gets `nil`. The papers write this same value as `#` in the Turing machine sections.

Every operation consumes the stack values that it reads. No operation reads a value and leaves it on the stack.

### Operations

| Operation | Icon | Description | Syntax |
|-----------|------|-------------|--------|
| **Push** | ↓ | Puts a literal number on the top of the given stack. The second parameter is always a literal number. To move a value from one stack to another, use Move. | `<Push><Stack><Number>` |
| **Pop** | ↑ | Removes the top value of the given stack. The value is discarded. To keep it, use Move. | `<Pop><Stack>` |
| **Move** | ↓□ | Pops the top value of the source stack and pushes it onto the destination stack. The first parameter is the destination. The second is the source. If the source is empty, Move pushes `nil`. | `<Move><Destination><Source>` |
| **Duplicate** | ⧉ | Pushes a copy of the top value onto the same stack. If the stack is empty, Duplicate pushes `nil`. | `<Duplicate><Stack>` |
| **Compare** | ⟺ | Pops the top value, then pops the value below it. Pushes `1` if the first value is greater, `0` if the two are equal, and `-1` if the first value is lesser. A missing value counts as `nil`. One `nil` operand gives `nil`. Two `nil` operands give `1`. | `<Compare><Stack>` |
| **Compare with a literal** | ⟺ | Pops the top value and compares it with the literal. The stack value is the left operand. The literal can be `nil`, so `<Compare><Stack>nil` gives `1` if the top value is `nil`, and `nil` if it is a number. Use this to test a value before you operate on it. | `<Compare><Stack><Number>` |
| **Jump** | ↺ | Moves the execution forward or backward by the given number of blocks. Give the offset as a literal number, or as a stack. With a stack, Jump pops the top value and uses it as the offset. Decimal values are truncated. | `<Jump><Number>` or `<Jump><Stack>` |
| **Question** | ? | Pops the top value. If the value is `0` or greater, the next block runs. If the value is negative, or if it is `nil`, Question skips the next block and resumes after it. | `<Question><Stack> [TrueBlock]` |

### Arithmetic Operations

Each arithmetic operation has two forms. The one-parameter form pops the top value of the stack, then pops the value below it, and pushes the result. The two-parameter form pops the top value only, and uses the literal number as the second operand. In both forms the value from the stack is the left operand. A subtraction on a stack with `5` on top and `3` below it pushes `2`.

Division by zero and modulo by zero push `nil`. Any other arithmetic on a `nil` value stops the program with an error. Compare accepts `nil`, so a program can test a value with `<Compare><Stack>nil` and branch on the result before it operates on that value.

Negation is different. It takes one stack, pops the top value, and pushes the negation of that value.

| Operation | Symbol | Syntax |
|-----------|--------|--------|
| Addition | `+` | `<Addition><Stack>` or `<Addition><Stack><Number>` |
| Subtraction | `−` | `<Subtraction><Stack>` or `<Subtraction><Stack><Number>` |
| Multiplication | `*` | `<Multiplication><Stack>` or `<Multiplication><Stack><Number>` |
| Division | `/` | `<Division><Stack>` or `<Division><Stack><Number>` |
| Modulo | `%` | `<Modulo><Stack>` or `<Modulo><Stack><Number>` |
| Negation | `¬` | `<Negation><Stack>` |

---

## 3D Files

### Ready-to-Print STLs

Pre-sliced, print-ready STL files are located in the [`/STLs`](./STLs) directory:

| File | Description |
|------|-------------|
| `1 Param Block v9.stl` | Single-parameter operation block |
| `2 Param Block v7.stl` | Two-parameter operation block |
| `Block Male Connector v2.stl` | Connector for linking blocks together |
| `Nut v7.stl` | Fastening nut |
| `Parameter v4.stl` | Parameter piece |
| `Wedge v3.stl` | Wedge connector |

### Editable Models (Fusion 360)

Editable Fusion 360 model links are available in [`F360.txt`](./F360.txt):

| Model | Link |
|-------|------|
| 1 Param Block | https://a360.co/4dIMM4s |
| 2 Param Block | https://a360.co/3T9inE2 |
| Connectors 1 | https://a360.co/4dG0lBF |
| Connectors 2 | https://a360.co/4755mkN |
| Operations | https://a360.co/3MthmTE |

---

## SCuLPTER — Online Runtime

[**SCuLPTER**](https://darkoyd.github.io/SCuLPTER/) is the web-based environment and runtime for SCuLPT. It lets you write, lex, parse, and execute SCuLPT programs step by step — without any 3D printing required.

SCuLPTER is built with **Scala.js**, **Vite**, and **Laminar** and is freely accessible online.

### Running SCuLPTER Locally

**Dependencies:**

- [sbt](https://www.scala-sbt.org/) >= 1.7.3
- [Node.js](https://nodejs.org/en) >= 16.13.0
- [npm](https://www.npmjs.com/) >= 8.1.0

**Steps:**

```bash
# 1. Start the sbt server
sbt

# 2. Inside the sbt CLI, initialize the Scala.js linker
fastLinkJS
# or, for live updates on file change:
~fastLinkJS
```

Then in a separate terminal:

```bash
# 3. Install Node dependencies
npm install

# 4. Start the local dev server
npm run dev
```

---

## Validation Data

The [`/data`](./data) directory holds the raw validation survey results for SCuLPT and a small, *question-aware* Node.js script that turns the open-ended (free-text) responses into a Likert-style **favorability** signal using [NLP.js](https://github.com/axa-group/nlp.js).

| File | Description |
|------|-------------|
| `Resultados SCuLPT.xlsx` | Raw survey results. Sheet `Resultados` holds the respondent answers; sheet `Preguntas de Encuesta` holds the question text per ID. |
| `questions-config.json` | Per-question metadata: type (`positive` / `negative` / `recommendation` / `comparison` / `suggestion`) and keyword lists used by the scoring rules. Edit this to tune the analysis. |
| `colombian-slang-es.json` | Colombian Spanish slang scores (`[-1, 1]`) that are stemmed at load time and merged into NLP.js's senticon dictionary. Covers regionalisms like *chévere*, *bacano*, *jartera*, *maluco*, *brutal* (whose Colombian sense differs from standard Spanish). Edit to add or tune entries. |
| `sentiment-likert.js` | Reads both sheets, runs Spanish sentiment analysis, applies the per-question rule, and emits a final favorability Likert (1–5) plus an engagement metric for suggestion-type questions. |
| `sentiment-results.json` | Output of the script: question text, per-cell breakdown (raw sentiment, applied rule, final score) and summary tables. |
| `package.json` | Declares the `@nlpjs/sentiment`, `@nlpjs/lang-es`, `@nlpjs/basic`, and `xlsx` dependencies. |

Why question-aware? Survey questions don't share the same valence toward SCuLPT — a negative-sounding answer to *"what was most difficult?"* (P11) is bad for SCuLPT, while the same wording answering *"what did you like?"* (P14) is good. A raw sentiment score collapses both into the same number. The script therefore picks a scoring rule per question type so that the final Likert always means *favorability toward SCuLPT*, comparable across questions.

**Base sentiment → Likert mapping** (used as-is for `positive`, inverted for `negative`, and as fallback elsewhere):

| Comparative range | Likert | Meaning |
|---|---|---|
| `≤ -0.6` | 1 | Muy negativo |
| `(-0.6, -0.2]` | 2 | Negativo |
| `(-0.2, 0.2)` (or empty / `-`) | 3 | Neutral / sin dato |
| `[0.2, 0.6)` | 4 | Positivo |
| `≥ 0.6` | 5 | Muy positivo |

**Per-question rule by type:**

| Type | Questions | Rule | Example |
|---|---|---|---|
| `positive` | P10, P14 | Raw sentiment → Likert. | *"Muy bueno e interesante"* → 4 |
| `negative` | P11, P22 | Favorable keywords (e.g. *ninguno*, *nada*) → 5; unfavorable (e.g. *difícil*, *confuso*) → 1–2; otherwise sentiment is **inverted**. | *"Muy confusos"* (P11) → 1 |
| `recommendation` | P15, P21 | Affirmative tokens (*sí*, *claro*, *me gustaría*) → 4–5; negative tokens (*no*, *no creo*) → 1; sentiment as tiebreaker. | *"No lo necesito en mi vida laboral"* (P15) → 1 |
| `comparison` | P12 | Count comparative cues (*mejor*, *peor*, *más fácil*, *más difícil*); diff drives the Likert. | *"Este lenguaje es más completo"* → 4 |
| `suggestion` | P18, P19, P23 | **Not** mapped to favorability. Reported in a separate engagement table (chars and # of suggested items per response). | — |

A lightweight negation guard flips a keyword's polarity if preceded by *no* / *nunca* / *jamás* in the same clause (e.g. *"no fue fácil"* doesn't count as favorable).

**Colombian slang.** Before scoring, the script merges `colombian-slang-es.json` into NLP.js's senticon dictionary so regionalisms map to their *Colombian* sense — without that, *"chévere"* scores -0.25 (mistaken for an unrelated Spanish stem), *"brutal"* -0.34 (literal sense), and *"jartera"* / *"maluco"* are simply absent. The console reports how many entries were injected and which ones overrode an existing standard-Spanish value, and the full report is saved under `slang` in `sentiment-results.json`.

### Extended analyses

On top of the per-question favorability/engagement tables, the script emits three additional reports that together test and contextualise the text-derived signal.

**Bootstrap 95% CIs.** Every average in the favorability, engagement, quantitative and pre/post tables now ships with a bootstrap confidence interval (1000 resamples). With *n* = 30 — and as low as 8 valid responses for some evaluator questions — point estimates are easy to over-read; the interval makes the noise floor explicit (e.g. *P22 = 2.75 [2.38, 3.00]*).

**Anchoring against explicit Likert questions.** P4–P8 (ease, utility, overall experience) and P20 (would-you-recommend) are explicit 1–5 questions answered by the same respondent that wrote the open-ended fields. The script computes a Spearman ρ between the text-derived Likert and the conceptually parallel quantitative one — for example, P11 *"what was hardest?"* (inverted to favorability) versus P4 *"how easy was it to understand?"*. A composite of *all* text-Likerts versus a composite of *all* explicit Likerts is also reported. ρ ≈ 0 means the text analysis is not tracking what people explicitly said; moderate-to-strong positive ρ is direct validation that the question-aware rules and the negative-question inversion are doing real work.

**Pedagogical impact (P16 vs P17).** Columns 16 and 17 hold tuples like `"3,4,2,1,3"` and `"4,4,3,3,3"` — each respondent's self-rated comprehension of five programming concepts *before* and *after* using SCuLPT. The script parses both tuples per respondent, computes a paired delta per concept, and reports the mean delta with a bootstrap 95% CI. A CI that excludes 0 is the closest thing this corpus has to a statistically backed claim about SCuLPT's learning impact, broken down by concept (variables, operations, control structures, data structures, programming logic).

These analyses persist under `summary.quantSummary`, `summary.anchors`, and `summary.prePost` in `sentiment-results.json`, plus a per-respondent record under `perRow` (quantitative answers, text Likerts, pre/post tuples) for downstream stats work.

**Running it:**

```bash
cd data
npm install
npm start
```

The script prints two console tables — **Favorabilidad hacia SCuLPT** and **Engagement** — and writes `sentiment-results.json` with the question text, summaries, and per-cell rule trace (`type`, `reason`, raw sentiment, final Likert).

---

## Related Repositories

| Repository | Description |
|------------|-------------|
| [Darkoyd/SCuLPTER](https://github.com/Darkoyd/SCuLPTER) | Web-based environment and runtime for SCuLPT (Scala.js + Vite + Laminar) |
| [Darkoyd/SCuLPT-Document](https://github.com/Darkoyd/SCuLPT-Document) | Thesis document covering the language design and theory |
