from abc import ABC, abstractmethod

class BaseLLM(ABC):
    @abstractmethod
    async def generate(self, prompt: str, system_prompt: str | None = None, model: str | None = None, **kwargs) -> str:
        """
        Generate text from the language model.
        
        :param prompt: The user prompt.
        :param system_prompt: Optional system prompt to guide the model behavior.
        :param model: Optional model identifier. Overrides the default model.
        :return: Generated string response.
        """
        pass
