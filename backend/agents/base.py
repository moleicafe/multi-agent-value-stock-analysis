import os
import json
import time
import re
import logging
import anthropic
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL = "claude-sonnet-4-6"


def _api_call_with_retry(fn, max_retries: int = 3):
    """Call fn() with exponential backoff on rate limit / overload errors."""
    for attempt in range(max_retries):
        try:
            return fn()
        except anthropic.RateLimitError:
            if attempt < max_retries - 1:
                wait = 20 * (2 ** attempt)
                logger.warning(f"Rate limit hit — retry {attempt + 1}/{max_retries}, waiting {wait}s")
                time.sleep(wait)
            else:
                logger.error("Rate limit hit — max retries exhausted, giving up")
                raise
        except anthropic.APIStatusError as e:
            if e.status_code in (529, 503) and attempt < max_retries - 1:
                wait = 10 * (2 ** attempt)
                logger.warning(f"API overload ({e.status_code}) — retry {attempt + 1}/{max_retries}, waiting {wait}s")
                time.sleep(wait)
            else:
                logger.error(f"API error {e.status_code} — not retrying")
                raise


def parse_json_from_response(raw: str) -> dict:
    """Robustly extract JSON from a response that may be wrapped in code fences or have LLM formatting issues."""
    if not raw or not raw.strip():
        raise ValueError("Agent returned an empty response")
    text = raw.strip()

    # Try extracting from ```json ... ``` or ``` ... ``` block first
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        text = match.group(1).strip()

    # Try to find a JSON object (handles leading prose before the {)
    obj_match = re.search(r"\{[\s\S]+\}", text)
    if obj_match and not text.startswith("{"):
        text = obj_match.group(0)

    # Try strict parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError as first_err:
        # Fall back to json-repair which handles: unescaped newlines in strings,
        # trailing commas, unterminated strings, single quotes, etc.
        try:
            from json_repair import repair_json
            repaired = repair_json(text, return_objects=True)
            if isinstance(repaired, dict) and repaired:
                logger.warning(f"JSON was malformed, repaired successfully (original error: {first_err})")
                return repaired
        except Exception:
            pass
        raise first_err


def _extract_text(content: list) -> str:
    """Pull all text from a response content list, joining multiple text blocks."""
    parts = [block.text for block in content if hasattr(block, "text") and block.text]
    return "\n".join(parts)


def run_agent(
    system_prompt: str,
    user_message: str,
    tools: list[dict],
    tool_handlers: dict[str, callable],
    max_iterations: int = 10,
) -> str:
    """
    Agentic loop: send message → handle tool calls → continue until text response.
    Returns the final text content from the agent.
    """
    messages = [{"role": "user", "content": user_message}]

    for iteration in range(max_iterations):
        response = _api_call_with_retry(
            lambda: client.messages.create(
                model=MODEL,
                max_tokens=8192,
                system=system_prompt,
                tools=tools if tools else anthropic.NOT_GIVEN,
                messages=messages,
            )
        )

        logger.debug(
            f"iteration={iteration} stop_reason={response.stop_reason} "
            f"content_types={[getattr(b, 'type', '?') for b in response.content]}"
        )

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "tool_use":
            # end_turn, max_tokens, or anything else — extract text and stop.
            # Do NOT loop: the conversation would end on an assistant message → 400.
            if response.stop_reason not in ("end_turn",):
                logger.warning(f"stop_reason='{response.stop_reason}' — returning whatever text is present")
            text = _extract_text(response.content)
            if not text:
                content_desc = [f"{getattr(b,'type','?')}" for b in response.content]
                logger.error(f"No text in response — stop_reason={response.stop_reason}, blocks={content_desc}")
            return text

        # stop_reason == "tool_use"
        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            handler = tool_handlers.get(block.name)
            if handler:
                try:
                    result = handler(**block.input)
                except Exception as e:
                    logger.warning(f"Tool '{block.name}' raised: {e}")
                    result = {"error": str(e)}
            else:
                logger.warning(f"Unknown tool requested: {block.name}")
                result = {"error": f"Unknown tool: {block.name}"}

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": json.dumps(result, default=str),
            })

        if not tool_results:
            # stop_reason=tool_use but no actual tool_use blocks — grab any text and bail
            logger.error("stop_reason=tool_use but zero tool_use blocks found in content")
            text = _extract_text(response.content)
            return text or "No tool results and no text in tool_use response."

        messages.append({"role": "user", "content": tool_results})

    logger.warning(f"Agent reached max_iterations={max_iterations} without completing")
    return "Agent reached max iterations without completing."
