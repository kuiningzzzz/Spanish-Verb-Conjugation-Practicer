# -*- coding: utf-8 -*-
"""
使用通义千问(Qwen)从动词列表生成西语变位 JSON。

特性概述：
- 输入：txt，每行一个西语动词，可以是非反身或反身（llamar, llamarse, llamar(se)）。
- 由 LLM 生成的部分：
  - 顶层：
    - infinitive: string（非反身形式，脚本会根据输入覆盖成是否反身）
    - gerund: string（第一分词）
    - participle: ["regular_past_participle", "irregular/adjectival?"]（最多两个，第二个为不规则）
    - is_reflexive: bool（最终也由脚本覆盖）
  - 简单时态（均含 regular 字段 + 所有人称为 list）：
    - Indicative:   present, imperfect, preterite, future, conditional
    - Subjunctive:  present, imperfect, future
    - Imperative:   affirmative, negative
  - Subjunctive imperfect 的每个槽位必须是两种形式：["pusiera","pusiese"]。

- 由脚本强规则生成的复合时态：
  - compound_indicative:
      - preterite_perfect      (pretérito perfecto)
      - pluperfect             (pluscuamperfecto)
      - future_perfect         (futuro perfecto)
      - conditional_perfect    (condicional perfecto)
      - preterite_anterior     (pretérito anterior)  ← 新增
  - compound_subjunctive:
      - preterite_perfect      (pretérito perfecto)
      - pluperfect             (pluscuamperfecto)
      - future_perfect         (futuro perfecto)

复合时态规则：
- 一律用 haber 的固定变位 + 该动词的过去分词。
- participle[0] 视为规则/主分词（regular）。
- 如果有第二个分词 participle[1]，视为不规则/形容词型（irregular）。
- 所有复合时态都带 "regular" 字段：
  - len(participle) == 1 → regular: true
  - len(participle) > 1  → regular: false
- compound_subjunctive.pluperfect:
  - 如果只有一个分词：每人称 2 种形式 ["hubiera X","hubiese X"]。
  - 如果有两个分词：每人称 4 种形式（两两组合）：
    ["hubiera P0","hubiese P0","hubiera P1","hubiese P1"]。
- compound_indicative.preterite_anterior:
  - 单分词：1 种形式（"hube X"）
  - 双分词：2 种形式（"hube P0","hube P1"）。

输出：
- 最终输出是一个 JSON 数组。
- 采用流式写入：每处理完一个动词立即写入文件，方便中途查看。
- dict 使用缩进多行；所有 list 都压成一行：["forma1","forma2"]。
"""

import os
import sys
import json
import time
import re
from http import HTTPStatus

from dashscope import Generation
from dotenv import load_dotenv

# 每次请求之间的间隔，防止打太快
REQUEST_INTERVAL_SECONDS = 0.5

# 7 个人称 key
PERSON_KEYS = [
    "first_singular",
    "second_singular",
    "second_singular_vos_form",
    "third_singular",
    "first_plural",
    "second_plural",
    "third_plural",
]

# haber 的简单时态（不含 vos），用于复合时态强规则生成
HABER_FORMS = {
    "indicative": {
        "present": {
            "first_singular": "he",
            "second_singular": "has",
            "third_singular": "ha",
            "first_plural": "hemos",
            "second_plural": "habéis",
            "third_plural": "han",
        },
        "imperfect": {
            "first_singular": "había",
            "second_singular": "habías",
            "third_singular": "había",
            "first_plural": "habíamos",
            "second_plural": "habíais",
            "third_plural": "habían",
        },
        "future": {
            "first_singular": "habré",
            "second_singular": "habrás",
            "third_singular": "habrá",
            "first_plural": "habremos",
            "second_plural": "habréis",
            "third_plural": "habrán",
        },
        "conditional": {
            "first_singular": "habría",
            "second_singular": "habrías",
            "third_singular": "habría",
            "first_plural": "habríamos",
            "second_plural": "habríais",
            "third_plural": "habrían",
        },
        # ★ 新增：haber 的 pretérito，用于 pretérito anterior
        "preterite": {
            "first_singular": "hube",
            "second_singular": "hubiste",
            "third_singular": "hubo",
            "first_plural": "hubimos",
            "second_plural": "hubisteis",
            "third_plural": "hubieron",
        },
    },
    "subjunctive": {
        "present": {
            "first_singular": "haya",
            "second_singular": "hayas",
            "third_singular": "haya",
            "first_plural": "hayamos",
            "second_plural": "hayáis",
            "third_plural": "hayan",
        },
        # subjunctive imperfect 有双形：hubiera / hubiese
        "imperfect": {
            "first_singular": ["hubiera", "hubiese"],
            "second_singular": ["hubieras", "hubieses"],
            "third_singular": ["hubiera", "hubiese"],
            "first_plural": ["hubiéramos", "hubiésemos"],
            "second_plural": ["hubierais", "hubieseis"],
            "third_plural": ["hubieran", "hubiesen"],
        },
        "future": {
            "first_singular": "hubiere",
            "second_singular": "hubieres",
            "third_singular": "hubiere",
            "first_plural": "hubiéremos",
            "second_plural": "hubiereis",
            "third_plural": "huberen",
        },
    },
}

# ====== 系统提示词：只让 LLM 负责简单时态和命令式 ======
SYSTEM_PROMPT = """
You are an expert Spanish linguist and a strict JSON generator.

Task:
Given ONE Spanish verb in its infinitive form (non-reflexive, like "llamar"),
return a single JSON object with its basic conjugation information.

IMPORTANT: Do NOT include any compound tenses (no "he amado", "habría amado", etc.).
Only simple tenses and imperative. Compound tenses will be computed by the caller.

The JSON MUST strictly follow this schema:

Top-level fields:
- "infinitive": string
- "gerund": string
- "participle": array of strings
- "is_reflexive": boolean

- "indicative": object with EXACTLY these tenses:
    - "present"
    - "imperfect"
    - "preterite"
    - "future"
    - "conditional"

- "subjunctive": object with EXACTLY these tenses:
    - "present"
    - "imperfect"
    - "future"

- "imperative": object with EXACTLY these tenses:
    - "affirmative"
    - "negative"

For EACH tense (in all moods), the value is an object with:
  - "regular": boolean
  - Person slots (ALWAYS arrays of strings):
      - "first_singular"
      - "second_singular"
      - "second_singular_vos_form"
      - "third_singular"
      - "first_plural"
      - "second_plural"
      - "third_plural"

Additional rules:
- "participle" MUST have length 1 or 2.
  - If 2, the FIRST is the regular/standard one, the SECOND is irregular/adjectival.
- "subjunctive.imperfect": EVERY person slot MUST have exactly 2 forms:
  the -ra and -se variants, in this order, e.g. ["hablara","hablase"].
- Imperative:
  - If a person has no imperative form (e.g. first_singular), return [] for that slot.
- Do NOT include any compound tenses.
- Do NOT print comments or explanations. Only output a single JSON object.
"""


def load_verbs_from_file(path: str) -> list[str]:
    """从 txt 文件加载动词（每行一个），去掉空行和前后空白。"""
    verbs: list[str] = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            verb = line.strip()
            if verb:
                verbs.append(verb)
    return verbs


def extract_json_from_text(text: str) -> str:
    """
    从模型返回的文本中提取 JSON 部分。
    防止出现 ```json ... ``` 之类的包裹。
    """
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r"```$", "", text, flags=re.MULTILINE)
    text = text.strip()

    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1 or start > end:
        raise ValueError("No JSON object found in model output:\n" + text)
    return text[start:end + 1]


def _ensure_list(value):
    """把值统一变成 list 形式：str -> [str], None -> [], list -> 自身。"""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return [value]
    return [value]


def _normalize_mood_block(mood_obj: dict) -> dict:
    """
    规范化一个语气（indicative / subjunctive / imperative / compound_*）下的所有时态：
    - 所有人称字段转成 list，缺失则 []
    - 如果没有 regular 字段，则保守设为 False（宁可当成不规则）
    """
    if not isinstance(mood_obj, dict):
        return mood_obj

    for tense_name, tense_data in mood_obj.items():
        if not isinstance(tense_data, dict):
            continue

        # 人称字段
        for key in PERSON_KEYS:
            if key in tense_data:
                tense_data[key] = _ensure_list(tense_data[key])
            else:
                tense_data[key] = []

        # regular 字段兜底：如果缺失或不是 bool，就设为 False
        if not isinstance(tense_data.get("regular"), bool):
            tense_data["regular"] = False

        # 若 vos 为空且二单非空，则用二单填补（方便使用）
        vos_list = tense_data.get("second_singular_vos_form", [])
        sec_sg_list = tense_data.get("second_singular", [])
        if (not vos_list) and sec_sg_list:
            tense_data["second_singular_vos_form"] = list(sec_sg_list)

        mood_obj[tense_name] = tense_data

    return mood_obj


def normalize_verb_data(data: dict) -> dict:
    """
    规范化一个动词的 JSON：
    - gerund 保证为 string
    - participle 保证为 list
    - 各语气的人称字段 -> list，regular 补全，vos 补齐
    """

    # gerund: 保证为 string
    g = data.get("gerund")
    if isinstance(g, list):
        data["gerund"] = g[0] if g else ""
    elif isinstance(g, str):
        data["gerund"] = g
    else:
        data["gerund"] = ""

    # participle: 保证为 list
    if "participle" in data:
        data["participle"] = _ensure_list(data["participle"])
    else:
        data["participle"] = []

    # 各语气规范化
    for mood_name in [
        "indicative",
        "subjunctive",
        "imperative",
        "compound_indicative",
        "compound_subjunctive",
    ]:
        mood_obj = data.get(mood_name)
        if isinstance(mood_obj, dict):
            data[mood_name] = _normalize_mood_block(mood_obj)

    return data


def parse_reflexive_verb(raw_verb: str) -> tuple[str, bool]:
    """
    根据输入判断是否为反身动词，并返回：
    - base_verb: 去掉 (se)/se 的部分，用来喂给大模型
    - is_reflexive: bool
    """
    s = raw_verb.strip()
    is_reflexive = False
    base = s

    if s.endswith("(se)"):
        base = s[:-4]
        is_reflexive = True
    elif s.endswith("se") and len(s) > 2:
        maybe_base = s[:-2]
        if maybe_base.endswith(("ar", "er", "ir")):
            base = maybe_base
            is_reflexive = True

    base = base.strip()
    return base, is_reflexive


def add_compound_tenses(data: dict) -> dict:
    """
    根据 participle 和 haber 的固定变位规则，在 data 上添加：
    - compound_indicative
    - compound_subjunctive
    """
    participles: list[str] = data.get("participle", [])
    if not participles:
        return data

    main_p = participles[0]
    has_irregular_participle = len(participles) > 1

    compound_indicative = {}
    compound_subjunctive = {}

    def build_compound_tense(
        aux_forms: dict,
        use_all_participles: bool = False,
        use_double_aux: bool = False,
    ) -> dict:
        """
        aux_forms:
          - use_double_aux=False: person -> str
          - use_double_aux=True:  person -> [aux1, aux2]
        返回一个时态对象（不含 regular 字段）
        """
        tense_obj: dict = {}
        for person in PERSON_KEYS:
            if person == "second_singular_vos_form":
                # 先留空，normalize 时会用 second_singular 补
                tense_obj[person] = []
                continue

            if person not in aux_forms:
                tense_obj[person] = []
                continue

            if use_double_aux:
                aux_list = _ensure_list(aux_forms[person])
            else:
                aux_list = [aux_forms[person]]

            forms: list[str] = []
            if use_all_participles:
                # aux × participles 的笛卡尔积
                # 为了读起来更自然，先按 participle 再按 aux 排：
                # ["hubiera imprimido","hubiese imprimido","hubiera impreso","hubiese impreso"]
                for p in participles:
                    for aux in aux_list:
                        forms.append(f"{aux} {p}")
            else:
                # 只使用 main participle
                for aux in aux_list:
                    forms.append(f"{aux} {main_p}")

            tense_obj[person] = forms

        return tense_obj

    # ===== compound_indicative =====
    ci = {}

    # pretérito perfecto: haber.indicative.present + main participle
    ci["preterite_perfect"] = {
        "regular": not has_irregular_participle,
        **build_compound_tense(
            HABER_FORMS["indicative"]["present"],
            use_all_participles=False,
            use_double_aux=False,
        ),
    }
    # pluscuamperfecto: haber.indicative.imperfect + main participle
    ci["pluperfect"] = {
        "regular": not has_irregular_participle,
        **build_compound_tense(
            HABER_FORMS["indicative"]["imperfect"],
            use_all_participles=False,
            use_double_aux=False,
        ),
    }
    # futuro perfecto: haber.indicative.future + main participle
    ci["future_perfect"] = {
        "regular": not has_irregular_participle,
        **build_compound_tense(
            HABER_FORMS["indicative"]["future"],
            use_all_participles=False,
            use_double_aux=False,
        ),
    }
    # condicional perfecto: haber.indicative.conditional + main participle
    ci["conditional_perfect"] = {
        "regular": not has_irregular_participle,
        **build_compound_tense(
            HABER_FORMS["indicative"]["conditional"],
            use_all_participles=False,
            use_double_aux=False,
        ),
    }
    # ★ 新增：pretérito anterior（haber.indicative.preterite + 所有 participles）
    ci["preterite_anterior"] = {
        "regular": not has_irregular_participle,
        **build_compound_tense(
            HABER_FORMS["indicative"]["preterite"],
            use_all_participles=True,   # 单分词 → 1 形；双分词 → 2 形
            use_double_aux=False,
        ),
    }

    compound_indicative = ci

    # ===== compound_subjunctive =====
    cs = {}

    # pretérito perfecto del subjuntivo: haber.subjunctive.present + main participle
    cs["preterite_perfect"] = {
        "regular": not has_irregular_participle,
        **build_compound_tense(
            HABER_FORMS["subjunctive"]["present"],
            use_all_participles=False,
            use_double_aux=False,
        ),
    }

    # pluscuamperfecto del subjuntivo:
    #   - 单分词：2 形（hubiera X, hubiese X）
    #   - 双分词：4 形（aux 双形 × 分词双形）
    cs["pluperfect"] = {
        "regular": not has_irregular_participle,
        **build_compound_tense(
            HABER_FORMS["subjunctive"]["imperfect"],
            use_all_participles=True,
            use_double_aux=True,
        ),
    }

    # futuro perfecto del subjuntivo: haber.subjunctive.future + main participle
    cs["future_perfect"] = {
        "regular": not has_irregular_participle,
        **build_compound_tense(
            HABER_FORMS["subjunctive"]["future"],
            use_all_participles=False,
            use_double_aux=False,
        ),
    }

    compound_subjunctive = cs

    data["compound_indicative"] = compound_indicative
    data["compound_subjunctive"] = compound_subjunctive
    return data


def compact_lists(json_str: str) -> str:
    """
    把 json_str 里的所有 JSON 数组格式压成一行，例如：
      [
        "a",
        "b"
      ]
    变成：
      ["a","b"]
    假设数组元素都是字符串（本项目正好如此）。
    """
    pattern = r'\[\s*(?:"[^"\n]*"(?:\s*,\s*"[^"\n]*")*)\s*\]'

    def repl(match: re.Match) -> str:
        text = match.group(0)
        try:
            arr = json.loads(text)
            if isinstance(arr, list):
                return json.dumps(arr, ensure_ascii=False)
        except Exception:
            pass
        return text

    return re.sub(pattern, repl, json_str)


def call_qwen_for_verb(raw_verb: str) -> dict:
    """
    调用 Qwen，为一个动词获取变位 JSON。
    - 根据 raw_verb 判断是否反身，把去掉 (se)/se 的 base_verb 喂给大模型
    - 返回 Python dict，并做规范化处理
    - 最后覆盖 is_reflexive 和 infinitive，再生成复合时态
    """
    base_verb, is_reflexive = parse_reflexive_verb(raw_verb)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Verb: {base_verb}"},
    ]

    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        raise RuntimeError("Environment variable DASHSCOPE_API_KEY is not set.")

    model = os.getenv("VERB_GENERATEION_MODEL", "qwen-plus")

    response = Generation.call(
        api_key=api_key,
        model=model,
        messages=messages,
        result_format="message",
    )

    if response.status_code != HTTPStatus.OK:
        raise RuntimeError(
            f"Qwen API error for verb '{raw_verb}' (base '{base_verb}'): "
            f"status_code={response.status_code}, "
            f"code={getattr(response, 'code', None)}, "
            f"message={getattr(response, 'message', None)}"
        )

    content = response.output.choices[0].message.content
    json_str = extract_json_from_text(content)
    raw_data = json.loads(json_str)

    # 先规范化简单部分
    data = normalize_verb_data(raw_data)

    # 覆盖 is_reflexive 和 infinitive
    data["is_reflexive"] = is_reflexive
    if is_reflexive:
        data["infinitive"] = base_verb + "se"
    else:
        data["infinitive"] = base_verb

    # 生成复合时态
    data = add_compound_tenses(data)

    # 再跑一遍 normalize，把 compound_* 里的人称也转成 list + regular 补全
    data = normalize_verb_data(data)

    return data


def main():
    if len(sys.argv) != 3:
        print("用法：python ./scripts/get_verb.py <input_verbs.txt> <output.json>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    load_dotenv()

    verbs = load_verbs_from_file(input_path)
    if not verbs:
        print("输入文件中没有动词呀 T_T")
        sys.exit(1)

    print(f"共读取到 {len(verbs)} 个动词，开始召唤 Qwen 劳动…")

    success_count = 0

    # 流式写 JSON 数组
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('[\n')
        first = True

        for idx, verb in enumerate(verbs, start=1):
            print(f"[{idx}/{len(verbs)}] 处理中：{verb} ...", end='', flush=True)
            try:
                data = call_qwen_for_verb(verb)

                if not first:
                    f.write(',\n')

                # dict 有缩进，list 压成一行
                json_pretty = json.dumps(data, ensure_ascii=False, indent=2)
                json_pretty = compact_lists(json_pretty)

                f.write(json_pretty)
                f.flush()

                first = False
                success_count += 1
                print(" ✅")
            except Exception as e:
                print(" ❌")
                print(f"    错误：{e}")
            time.sleep(REQUEST_INTERVAL_SECONDS)

        f.write('\n]\n')

    print(f"\n完成！共成功生成 {success_count} 个动词的变位。")
    print(f"已写入：{output_path}")


if __name__ == "__main__":
    main()
