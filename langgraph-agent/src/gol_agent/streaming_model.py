import asyncio
import re
from collections.abc import AsyncIterator, Iterator
from typing import Any

from langchain_core.callbacks import AsyncCallbackManagerForLLMRun, CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import SimpleChatModel
from langchain_core.messages import AIMessageChunk, BaseMessage
from langchain_core.outputs import ChatGenerationChunk


class StreamingTextModel(SimpleChatModel):
    @property
    def _llm_type(self) -> str:
        return "gol-deterministic-stream"

    def _call(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> str:
        del stop, run_manager, kwargs
        return str(messages[-1].content) if messages else ""

    def _stream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        text = self._call(messages, stop=stop, run_manager=run_manager, **kwargs)
        for chunk in _text_chunks(text):
            yield ChatGenerationChunk(message=AIMessageChunk(content=chunk))

    async def _astream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        del run_manager
        text = self._call(messages, stop=stop, **kwargs)
        for index, chunk in enumerate(_text_chunks(text)):
            # Yield control between deltas so ASGI, the Next.js proxy, and React receive observable
            # streaming updates instead of one packet containing the entire deterministic reply.
            if index:
                await asyncio.sleep(0.055)
            yield ChatGenerationChunk(message=AIMessageChunk(content=chunk))


def _text_chunks(text: str) -> list[str]:
    return re.findall(r".{1,24}(?:\s|$)", text) or [text]


streaming_text_model = StreamingTextModel()
