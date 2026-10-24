import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.llm.ollama import OllamaLLM
from app.llm.factory import get_llm

@pytest.mark.asyncio
async def test_ollama_generate():
    llm = OllamaLLM(base_url="http://mock")
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"response": "Mocked response"}
    
    mock_post = AsyncMock(return_value=mock_response)
    
    with patch("httpx.AsyncClient.post", mock_post):
        result = await llm.generate("Hello", system_prompt="You are a bot", model="test-model")
        assert result == "Mocked response"
        mock_post.assert_called_once()
        
        args, kwargs = mock_post.call_args
        assert kwargs["json"]["prompt"] == "Hello"
        assert kwargs["json"]["system"] == "You are a bot"
        assert kwargs["json"]["model"] == "test-model"

from app.llm.adaptive import AdaptiveLLM

def test_get_llm_factory():
    llm = get_llm("ollama")
    assert isinstance(llm, OllamaLLM)

    auto_llm = get_llm("auto")
    assert isinstance(auto_llm, AdaptiveLLM)
    
    with pytest.raises(ValueError):
        get_llm("unknown-provider")

@pytest.mark.asyncio
async def test_adaptive_llm_routes_to_groq_when_ollama_offline():
    adaptive = AdaptiveLLM()
    adaptive.groq_llm.generate = AsyncMock(return_value="Groq response")
    adaptive.ollama_llm.generate = AsyncMock(return_value="Ollama response")
    
    with patch.object(adaptive, "is_ollama_online", AsyncMock(return_value=False)):
        res = await adaptive.generate("Hello world")
        assert res == "Groq response"
        adaptive.groq_llm.generate.assert_called_once()
        adaptive.ollama_llm.generate.assert_not_called()

@pytest.mark.asyncio
async def test_adaptive_llm_routes_to_ollama_when_ollama_online():
    adaptive = AdaptiveLLM()
    adaptive.groq_llm.generate = AsyncMock(return_value="Groq response")
    adaptive.ollama_llm.generate = AsyncMock(return_value="Ollama response")
    
    with patch.object(adaptive, "is_ollama_online", AsyncMock(return_value=True)):
        res = await adaptive.generate("Hello world")
        assert res == "Ollama response"
        adaptive.ollama_llm.generate.assert_called_once()
        adaptive.groq_llm.generate.assert_not_called()

@pytest.mark.asyncio
async def test_adaptive_llm_falls_back_to_groq_on_ollama_failure():
    adaptive = AdaptiveLLM()
    adaptive.groq_llm.generate = AsyncMock(return_value="Groq fallback response")
    adaptive.ollama_llm.generate = AsyncMock(side_effect=Exception("Ollama crashed"))
    
    with patch.object(adaptive, "is_ollama_online", AsyncMock(return_value=True)):
        res = await adaptive.generate("Hello world")
        assert res == "Groq fallback response"
        adaptive.ollama_llm.generate.assert_called_once()
        adaptive.groq_llm.generate.assert_called_once()

from app.llm.openai import OpenAILLM
from app.llm.anthropic import AnthropicLLM
from app.llm.gemini import GeminiLLM
from app.llm.factory import resolve_provider_and_model

def test_resolve_provider_and_model():
    p, m = resolve_provider_and_model("groq", "openai/gpt-oss-120b")
    assert p == "groq"
    assert m == "openai/gpt-oss-120b"

    p, m = resolve_provider_and_model(None, "openai:gpt-4o")
    assert p == "openai"
    assert m == "gpt-4o"

    p, m = resolve_provider_and_model(None, "claude-3-5-sonnet")
    assert p == "anthropic"
    assert m == "claude-3-5-sonnet"

def test_multi_agent_different_providers():
    from app.services.pipeline import WorkflowStateMachine
    pipe = WorkflowStateMachine(
        schema_linker_provider="groq",
        schema_linker_model="openai/gpt-oss-20b",
        query_planner_provider="ollama",
        query_planner_model="llama3.1",
        sql_generator_provider="openai",
        sql_generator_model="gpt-4o",
        validator_provider="anthropic",
        validator_model="claude-3-5-sonnet"
    )
    assert pipe.schema_linker.provider == "groq"
    assert pipe.query_planner.provider == "ollama"
    assert pipe.sql_generator.provider == "openai"
    assert pipe.validator.provider == "anthropic"
    assert isinstance(pipe.sql_generator.llm, OpenAILLM)
    assert isinstance(pipe.validator.llm, AnthropicLLM)


