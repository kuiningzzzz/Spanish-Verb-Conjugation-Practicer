# Scripts

这个目录包含若干离线脚本，主要用于批量生成练习题与动词变位数据，以及对提示词/模型进行快速对比测试。

## 目录概览

- `prompt_matrix_test.js`：对不同 prompt / 模型 / 温度 / validator 组合做出题与验证测试，输出 CSV。
- `input/generator_prompt.js`：生成题 prompt 模板列表（数组 index 即版本号）。
- `input/validator_prompt.js`：验证 prompt 模板列表（数组 index 即版本号）。
- `generate_course_sentences.js`：根据课程配置批量生成课程例句题并写入数据库。
- `get_verb.py`：调用 Qwen 生成动词变位 JSON（含复合时态规则补全）。
- `input/`：示例输入目录（用于 `get_verb.py` 这类脚本）。
- `input/`：脚本输入模板目录（例如 prompt 模板）。
- `output/`：示例输出目录（用于 `get_verb.py` 这类脚本）。

---

## prompt_matrix_test.js

**用途**
- 从 `server/src/verbs.json` 随机选一个动词与一个变位。
- 结合「生成 prompt 版本」「模型」「温度」「是否启用 validator」「validator prompt 版本」，生成一行 CSV 结果。

**运行**
```bash
cd /scripts
node prompt_matrix_test.js > output/prompt_matrix.csv
```

**输出字段**
- 题目字段：`question_sentence`, `question_answer`, `question_translation`, `question_hint`
- 输入动词与变位信息：`verb_infinitive`, `verb_meaning`, `conjugation_*`
- 元数据：`generator_prompt_index`, `generator_model`, `generator_temperature`, `validator_used`, `validator_prompt_index`
- Validator 结果：`validator_is_valid`, `validator_has_unique_answer`, `validator_reason`
- 失败原因：`question_error`

**配置（读取 `scripts/.env`）**
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_API_URL`（可选，默认 `https://api.deepseek.com/v1/chat/completions`）
- `QWEN_API_KEY` 或 `DASHSCOPE_API_KEY`
- `QWEN_API_URL`（可选，默认 `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`）
- `MODELS`（逗号分隔，支持 `provider:model` 形式）
- `GENERATOR_TEMPERATURES`（逗号分隔）
- `USE_VALIDATOR`（true/false，决定是否实际调用 validator）
- `GENERATOR_PROMPTS`（逗号分隔，prompt index）
- `VALIDATOR_PROMPTS`（逗号分隔，prompt index）
- `VALIDATOR_TEMPERATURE`（可选，validator 单独指定温度，默认沿用生成温度）
- `TEST_CASES`（测试次数；每次随机一个动词+一个时态+一个人称）
- `OUTPUT_FILE`（可选，CSV 输出文件路径）
- `LOG_FILE`（可选，日志输出文件路径）

**产出行数**
- 单次测试会生成：`generator_prompt版本数 * validator_prompt版本数 * 生成模型数 * 生成温度数` 行
- 总行数再乘以 `TEST_CASES`

**日志与输出文件**
- 默认 CSV 输出到终端（stdout），日志以 CSV 形式输出到终端（stderr）。
- 如需写入文件，可设置：`OUTPUT_FILE=/path/to/out.csv`，`LOG_FILE=/path/to/run.log`。

---

## input/generator_prompt.js

**用途**
- 维护生成题 prompt 列表。
- 每个条目是一个函数，返回 `{ system, user }`。
- 版本号就是数组 index（从 0 开始）。

**新增 prompt**
- 只要在数组末尾追加一个函数即可。

---

## input/validator_prompt.js

**用途**
- 维护验证 prompt 列表。
- 每个条目是一个函数，返回 `{ system, user }`。
- 版本号就是数组 index（从 0 开始）。

**新增 prompt**
- 只要在数组末尾追加一个函数即可。

---

## generate_course_sentences.js

**用途**
- 按课程与课时配置批量生成例句题，并写入数据库。
- 依赖服务端数据库与模型逻辑。

**运行**
```bash
node scripts/generate_course_sentences.js [options]
```

**参数**
- `-c, --count <n>`：每课目标例句数（默认 20）
- `-m, --min-per-verb <n>`：每个动词最少例句数（默认 2）
- `--max-attempts <n>`：每条句子最大尝试次数（默认 3）
- `--lesson-id <id>`：只处理指定 lesson
- `--textbook-id <id>`：只处理指定 textbook

**示例**
```bash
node scripts/generate_course_sentences.js --lesson-id 3 --count 30
```

**注意**
- 默认读取 `server/.env`（脚本内指定）。
- 需要可用的数据库与相关表。

---

## get_verb.py

**用途**
- 调用 Qwen 生成动词变位 JSON。
- 输入：txt 文件（每行一个动词，可含反身形式）。
- 输出：JSON 数组（流式写入，便于中途查看）。

**运行**
```bash
python scripts/get_verb.py <input_verbs.txt> <output.json>
```

**示例**
```bash
python scripts/get_verb.py scripts/input/verbs.txt scripts/output/verbs.json
```

**依赖**
- Python 3
- `dashscope`
- `python-dotenv`

**环境变量**
- `DASHSCOPE_API_KEY`
- `VERB_GENERATEION_MODEL`（可选，默认 `qwen-plus`）

**建议**
- 若希望读取 `scripts/.env`，可先 `cd scripts` 再运行脚本，或将 `.env` 放到当前工作目录。
