# Scripts

这个目录用于离线实验与数据准备，核心覆盖三类任务：
- 题目生成实验（prompt 对比 / 模型对比 / 验证与修订流水线）
- 动词数据生成与标注（LLM 生成变位、补充代词能力标签）
- 结果查看与导出（本地可视化、CSV 转 XLSX）

## 1. 依赖安装

### 1.1 Node.js 依赖（JS 脚本）
在项目根目录执行：

```bash
cd /Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer
npm install
```

> `prompt_matrix_test.js` / `prompt_conj-with-pronoun_test.js` 依赖 `axios`、`dotenv`（已在项目 `package.json` 中）。

### 1.2 Python 依赖（Python 脚本）
建议使用虚拟环境：

```bash
cd /Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -U pip
python3 -m pip install dashscope python-dotenv
```

> `get_verb.py` 需要 `dashscope` 和 `python-dotenv`。  
> `tag_pronoun_support.py` 必须有 `dashscope`；`python-dotenv` 可选（无该包时会跳过 `.env` 自动加载）。

## 2. 环境变量

脚本默认读取：
- `/Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer/scripts/.env`
- 参考模板：`/Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer/scripts/.env.example`

常用变量：
- API: `DEEPSEEK_API_KEY`, `DEEPSEEK_API_URL`, `QWEN_API_KEY`, `DASHSCOPE_API_KEY`, `QWEN_API_URL`
- 实验: `MODELS`, `GENERATOR_TEMPERATURES`, `USE_VALIDATOR`, `USE_REVISOR`, `TEST_CASES`
- Prompt index: `GENERATOR_PROMPTS`, `VALIDATOR_PROMPTS`, `REVISOR_PROMPTS`
- 新题型专用: `CONJ_WITH_PRONOUN_*`
- Python 生成动词: `VERB_GENERATEION_MODEL`

## 3. 脚本清单（作用 + 用法）

### 3.1 `prompt_matrix_test.js`
**作用**
- 传统变位实验矩阵：`generator -> validator_1 -> revisor(必要时) -> validator_2`。
- 对比多模型、多温度、多 prompt 版本。

**输入**
- 动词源：`/Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer/server/src/verbs.json`
- 配置：`scripts/.env`

**输出**
- 主结果 CSV（默认 stdout，或 `OUTPUT_FILE`）
- 日志 CSV（默认 stderr，或 `LOG_FILE`）
- summary JSON（随输出文件同目录生成）

**运行**
```bash
cd /Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer/scripts
node prompt_matrix_test.js
```

---

### 3.2 `prompt_conj-with-pronoun_test.js`
**作用**
- 新题型实验矩阵（动词+代词组合填空）。
- 支持 host_form：`finite`, `imperative`, `infinitive`, `gerund`, `prnl`。
- 同样是 4 步流水线：`generator -> validator_1 -> revisor -> validator_2`。

**输入**
- 动词源：`/Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer/server/src/verbs.json`
- Prompt：
  - `scripts/input/conjugation_with_pronoun/generator_prompt.js`
  - `scripts/input/conjugation_with_pronoun/validator_prompt.js`
  - `scripts/input/conjugation_with_pronoun/revisor_prompt.js`
- 配置：`scripts/.env`

**输出（默认）**
- `/Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer/scripts/output/prompt_conj-with-pronoun.csv`
- `/Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer/scripts/output/prompt_conj-with-pronoun_logs.csv`
- `/Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer/scripts/output/prompt_conj-with-pronoun.summary.json`

**运行**
```bash
cd /Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer/scripts
node prompt_conj-with-pronoun_test.js
```

---

### 3.3 `generate_course_sentences.js`
**作用**
- 按课程/课时批量生成例句并写数据库（服务端流程）。

**运行**
```bash
cd /Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer
node scripts/generate_course_sentences.js [options]
```

**常用参数**
- `-c, --count <n>` 每课目标例句数（默认 20）
- `-m, --min-per-verb <n>` 每个动词最少例句数（默认 2）
- `--max-attempts <n>` 每条最大尝试次数（默认 3）
- `--lesson-id <id>` 只处理指定 lesson
- `--textbook-id <id>` 只处理指定 textbook

---

### 3.4 `get_verb.py`
**作用**
- 调用 Qwen 生成动词变位 JSON（含脚本规则补全复合时态）。

**输入**
- txt 文件（每行一个动词）

**输出**
- JSON 数组文件（流式写入）

**运行**
```bash
cd /Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer
python3 scripts/get_verb.py <input_verbs.txt> <output.json>
```

**示例**
```bash
python3 scripts/get_verb.py scripts/input/verbs.txt scripts/output/verbs.json
```

---

### 3.5 `tag_pronoun_support.py`
**作用**
- 给与 `server/src/verbs.json` 同格式的文件补充三字段：
  - `supports_do`
  - `supports_io`
  - `supports_do_io`
- 字段插入在 `has_intr_use` 后，默认 `null`。
- 对 `has_tr_use=true` 的动词调用 Qwen 进行能力判定。

**输入/输出方式**
- 通过控制台交互输入文件路径（不是命令行参数）：
  - `Input verbs JSON path:`
  - `Output JSON path:`

**运行**
```bash
cd /Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer
python3 scripts/tag_pronoun_support.py
```

---

### 3.6 `output/export_prompt_matrix_excel.js`
**作用**
- 将 `scripts/output/prompt_matrix.csv` 导出为 `scripts/output/prompt_matrix.xlsx`。

**运行**
```bash
cd /Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer/scripts/output
node export_prompt_matrix_excel.js
```

---

### 3.7 `experiment-results.html`
**作用**
- 本地可视化 CSV 实验结果（无需后端）。
- 支持传统变位实验和新题型实验 CSV。

**使用方式**
- 浏览器打开：`/Users/tomorikaho/Projects/Spanish-Verb-Conjugation-Practicer/scripts/experiment-results.html`
- 点击“上传 CSV”查看结果。

## 4. Prompt 文件约定

### 4.1 传统变位实验
- `scripts/input/generator_prompt.js`
- `scripts/input/validator_prompt.js`
- `scripts/input/revisor_prompt.js`

### 4.2 动词+代词实验
- `scripts/input/conjugation_with_pronoun/generator_prompt.js`
- `scripts/input/conjugation_with_pronoun/validator_prompt.js`
- `scripts/input/conjugation_with_pronoun/revisor_prompt.js`

新增版本时按数组追加，索引即 prompt 版本号。

## 5. 常见问题

### 5.1 报 `Missing apiUrl/apiKey`
- 检查 `scripts/.env` 的 API Key 是否填写。
- 检查 `MODELS` 里的 provider 与对应 key 是否匹配。

### 5.2 Python 报找不到 `dashscope` / `dotenv`
- 激活虚拟环境后执行：
```bash
python3 -m pip install dashscope python-dotenv
```

### 5.3 CSV 导入页面失败
- 先确认 CSV 是否来自这套脚本。
- 确认表头字段包含对应实验类型的必需字段。
