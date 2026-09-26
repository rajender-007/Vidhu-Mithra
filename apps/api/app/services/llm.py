from __future__ import annotations

import json
from typing import Any

import httpx

from ..config import Settings


class LLMRouter:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def complete(self, system: str, user: str, json_mode: bool = False) -> str | None:
        provider = self.settings.primary_llm_provider.lower()
        try:
            if provider == "openai" and self.settings.openai_api_key:
                return await self._openai(system, user, json_mode)
            if provider == "gemini" and self.settings.gemini_api_key:
                return await self._gemini(system, user, json_mode)
        except (httpx.HTTPError, ValueError, KeyError, json.JSONDecodeError):
            return None
        return None

    async def _openai(self, system: str, user: str, json_mode: bool) -> str:
        payload: dict[str, Any] = {"model": self.settings.primary_llm_model, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}], "temperature": 0.1}
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post("https://api.openai.com/v1/chat/completions", headers={"Authorization": f"Bearer {self.settings.openai_api_key}"}, json=payload)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

    async def _gemini(self, system: str, user: str, json_mode: bool) -> str:
        prompt = f"SYSTEM:\n{system}\n\nUSER:\n{user}"
        if json_mode:
            prompt += "\nReturn only valid JSON."
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.settings.primary_llm_model}:generateContent"
        payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.1}}
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, params={"key": self.settings.gemini_api_key}, json=payload)
            response.raise_for_status()
            return response.json()["candidates"][0]["content"]["parts"][0]["text"]
