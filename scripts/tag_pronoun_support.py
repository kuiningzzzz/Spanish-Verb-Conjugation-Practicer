# -*- coding: utf-8 -*-
"""
Tag pronoun support fields for a verbs JSON file with the same shape as server/src/verbs.json.

What this script does:
1) Add three fields to every verb object:
   - supports_do
   - supports_io
   - supports_do_io
   The three fields are inserted right after has_intr_use and default to null.
2) For verbs where has_tr_use == true, call the same Qwen API path used by get_verb.py
   to judge support for DO / IO / DO+IO.
3) Input and output paths are read from interactive console input.
"""

import json
import os
import re
import time
from collections import OrderedDict
from http import HTTPStatus


REQUEST_INTERVAL_SECONDS = 0.5

TOP_LEVEL_KEY_ORDER = [
    "infinitive",
    "gerund",
    "participle",
    "is_reflexive",
    "has_tr_use",
    "has_intr_use",
    "supports_do",
    "supports_io",
    "supports_do_io",
    "indicative",
    "subjunctive",
    "imperative",
    "compound_indicative",
    "compound_subjunctive",
]

SYSTEM_PROMPT = """
You are an expert in Spanish valency, clitic pronouns, and pedagogical sentence design.

Your task:
Given a single Spanish verb and basic metadata, decide whether it supports these patterns
in natural, mainstream modern Spanish (non-rare, non-poetic usage):

1) supports_do:
   The verb can naturally take ONLY a direct-object clitic pattern in context
   (lo/la/los/las or cliticized equivalent), without requiring an indirect object.

2) supports_io:
   The verb can naturally take ONLY an indirect-object clitic pattern in context
   (me/te/le/nos/os/les), without requiring a direct object.
   Use strict standards: mark true only if this pattern is genuinely common/natural.

3) supports_do_io:
   The verb can naturally take BOTH indirect + direct clitics together in one predicate
   (e.g., se lo, me la, te los), in ordinary usage.

Important rules:
- Be conservative. If uncertain, return false.
- Base judgment on common usage, not rare literary edge cases.
- Reflexive/pronominal uses do not automatically imply supports_io.
- Do not infer from a single idiom unless it is common.
- Return strict JSON only, no markdown.

Output JSON schema:
{
  "supports_do": true/false,
  "supports_io": true/false,
  "supports_do_io": true/false,
  "confidence": 0.0-1.0,
  "reason": "short explanation"
}
"""


def extract_json_from_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r"```$", "", text, flags=re.MULTILINE)
    text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or start > end:
        raise ValueError("No JSON object found in model output.")
    return text[start : end + 1]


def compact_lists(json_str: str) -> str:
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


def coerce_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ("true", "1", "yes", "y"):
            return True
        if normalized in ("false", "0", "no", "n"):
            return False
    return None


def to_bool_default_false(value) -> bool:
    parsed = coerce_bool(value)
    return parsed if parsed is not None else False


def load_json_file(path: str):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("Input JSON must be a top-level array.")
    return data


def add_support_fields_and_reorder(verb: dict) -> OrderedDict:
    base = OrderedDict()

    # Start from original key order first.
    for key, value in verb.items():
        base[key] = value

    # Ensure fields exist with null defaults before final reorder.
    if "supports_do" not in base:
        base["supports_do"] = None
    if "supports_io" not in base:
        base["supports_io"] = None
    if "supports_do_io" not in base:
        base["supports_do_io"] = None

    # Reorder with preferred key order, then append any remaining keys.
    ordered = OrderedDict()
    for key in TOP_LEVEL_KEY_ORDER:
        if key in base:
            ordered[key] = base[key]
    for key, value in base.items():
        if key not in ordered:
            ordered[key] = value
    return ordered


def build_user_prompt(verb: dict) -> str:
    infinitive = str(verb.get("infinitive", "")).strip()
    is_reflexive = to_bool_default_false(verb.get("is_reflexive"))
    has_tr_use = to_bool_default_false(verb.get("has_tr_use"))
    has_intr_use = to_bool_default_false(verb.get("has_intr_use"))
    translation = verb.get("translation", [])
    if isinstance(translation, list):
        translation_text = " / ".join(str(x) for x in translation if x is not None)
    else:
        translation_text = str(translation or "")

    return (
        "Verb profile:\n"
        f"- infinitive: {infinitive}\n"
        f"- translation_hints: {translation_text or '(none)'}\n"
        f"- is_reflexive: {str(is_reflexive).lower()}\n"
        f"- has_tr_use: {str(has_tr_use).lower()}\n"
        f"- has_intr_use: {str(has_intr_use).lower()}\n\n"
        "Decide supports_do / supports_io / supports_do_io.\n"
        "Return JSON only."
    )


def call_qwen_for_support(verb: dict) -> dict:
    from dashscope import Generation

    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        raise RuntimeError("Environment variable DASHSCOPE_API_KEY is not set.")

    model = os.getenv("VERB_GENERATEION_MODEL", "qwen-plus")
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_user_prompt(verb)},
    ]

    response = Generation.call(
        api_key=api_key,
        model=model,
        messages=messages,
        result_format="message",
    )

    if response.status_code != HTTPStatus.OK:
        raise RuntimeError(
            "Qwen API error: "
            f"status_code={response.status_code}, "
            f"code={getattr(response, 'code', None)}, "
            f"message={getattr(response, 'message', None)}"
        )

    content = response.output.choices[0].message.content
    payload = json.loads(extract_json_from_text(content))

    result = {
        "supports_do": coerce_bool(payload.get("supports_do")),
        "supports_io": coerce_bool(payload.get("supports_io")),
        "supports_do_io": coerce_bool(payload.get("supports_do_io")),
        "confidence": payload.get("confidence"),
        "reason": str(payload.get("reason", "")).strip(),
    }

    # Keep strict bool/null for the three support fields.
    return result


def write_json_array(path: str, data: list):
    with open(path, "w", encoding="utf-8") as f:
        text = json.dumps(data, ensure_ascii=False, indent=2)
        text = compact_lists(text)
        f.write(text)
        f.write("\n")


def load_env():
    try:
        from dotenv import load_dotenv
    except ImportError:
        return

    # First try scripts/.env to match project conventions.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    script_env = os.path.join(script_dir, ".env")
    if os.path.exists(script_env):
        load_dotenv(script_env, override=False)
    # Also allow default dotenv discovery behavior.
    load_dotenv(override=False)


def main():
    load_env()

    input_path = input("Input verbs JSON path: ").strip()
    output_path = input("Output JSON path: ").strip()

    if not input_path:
        raise RuntimeError("Input path is required.")
    if not output_path:
        raise RuntimeError("Output path is required.")
    if not os.path.exists(input_path):
        raise RuntimeError(f"Input file not found: {input_path}")

    verbs = load_json_file(input_path)
    total = len(verbs)
    print(f"Loaded {total} verbs.")

    processed = []
    target_indexes = []

    for idx, verb in enumerate(verbs):
        if not isinstance(verb, dict):
            raise ValueError(f"Item at index {idx} is not an object.")
        normalized = add_support_fields_and_reorder(verb)
        processed.append(normalized)
        if to_bool_default_false(normalized.get("has_tr_use")):
            target_indexes.append(idx)

    print(f"Will evaluate pronoun support for {len(target_indexes)} verbs (has_tr_use=true).")

    success_count = 0
    fail_count = 0

    for seq, idx in enumerate(target_indexes, start=1):
        verb = processed[idx]
        infinitive = str(verb.get("infinitive", "")).strip() or f"index:{idx}"
        print(f"[{seq}/{len(target_indexes)}] {infinitive} ...", end="", flush=True)
        try:
            result = call_qwen_for_support(verb)
            verb["supports_do"] = result["supports_do"]
            verb["supports_io"] = result["supports_io"]
            verb["supports_do_io"] = result["supports_do_io"]
            success_count += 1
            print(" OK")
        except Exception as error:
            fail_count += 1
            # Keep null when failed.
            print(" FAIL")
            print(f"    reason: {error}")
        time.sleep(REQUEST_INTERVAL_SECONDS)

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    write_json_array(output_path, processed)

    print("\nDone.")
    print(f"- total verbs: {total}")
    print(f"- evaluated(has_tr_use=true): {len(target_indexes)}")
    print(f"- success: {success_count}")
    print(f"- failed: {fail_count}")
    print(f"- output: {output_path}")


if __name__ == "__main__":
    main()
