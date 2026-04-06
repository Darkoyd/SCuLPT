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
- [Related Repositories](#related-repositories)

---

## Overview

SCuLPT turns programming into a physical, tactile experience. Blocks represent operations, stacks hold data, and programs are assembled by connecting pieces together. The language is stack-based and operates using a FILO (First In, Last Out) model — values are pushed onto and popped from named stacks as the program executes.

The language is intentionally minimal: a small set of operations is enough to express any computation, while remaining simple enough to hold in your hands.

---

## The Physical Language

### Stacks (FILO)

SCuLPT programs operate on one or more named stacks. Each stack follows a **First In, Last Out** (FILO / LIFO) discipline — the last value pushed is the first one retrieved. Most operations reference a specific stack by name as part of their syntax.

### Operations

| Operation | Icon | Description | Syntax |
|-----------|------|-------------|--------|
| **Push** | ↓ | Pushes a number onto the given stack | `<Push><Stack><Number>` |
| **Pop** | ↑ | Removes the topmost value from the given stack. Popped values are discarded — use Move if you need to keep them. | `<Pop><Stack><Number>` |
| **Move** | ↓□ | Pops the topmost value from one stack and pushes it onto another | `<Move><Stack1><Stack2>` |
| **Duplicate** | ⧉ | Copies the topmost item and pushes it back onto the same stack | `<Duplicate><Stack>` |
| **Compare** | ⟺ | Compares the two topmost values of the stack. Pushes `1` if the first is greater, `0` if equal, `-1` if lesser | `<Compare><Stack>` |
| **Jump** | ↺ | Pops the topmost value and jumps that many blocks forward or backward. Decimal values are floored. Negative jumps work as expected. | `<Jump><Stack>` |
| **Question** | ? | Pops the topmost value. If positive, executes the next block; otherwise skips it and resumes execution | `<Question><Stack> [TrueBlock]` |

### Arithmetic Operations

Arithmetic operations consume the two topmost values of the specified stack and push the result back onto it. The general syntax is `<Operation><Stack>`.

| Operation | Symbol |
|-----------|--------|
| Addition | `+` |
| Subtraction | `−` |
| Multiplication | `*` |
| Division | `/` |
| Modulo | `%` |
| Negation | `¬` |

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

## Related Repositories

| Repository | Description |
|------------|-------------|
| [Darkoyd/SCuLPTER](https://github.com/Darkoyd/SCuLPTER) | Web-based environment and runtime for SCuLPT (Scala.js + Vite + Laminar) |
| [Darkoyd/SCuLPT-Document](https://github.com/Darkoyd/SCuLPT-Document) | Thesis document covering the language design and theory |
