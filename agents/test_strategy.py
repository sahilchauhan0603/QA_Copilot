"""
Test Strategy Agent
Creates the QA execution roadmap with test categories and scenarios
"""
from typing import Dict, List, Optional
import json
import google.generativeai as genai
from agents.state import AgentState, log_agent_action
from utils.rate_limiter import RateLimiter
from utils.api_cache import APICache
from utils.api_helper import call_gemini_with_retry
import os


class TestStrategyAgent:
    """
    Agent that builds the QA roadmap and testing strategy
    """
    
    def __init__(self, llm_client, rate_limiter: Optional[RateLimiter] = None, api_cache: Optional[APICache] = None):
        self.llm = llm_client
        self.name = "TestStrategyAgent"
        self.rate_limiter = rate_limiter
        self.api_cache = api_cache
    
    def process(self, state: AgentState) -> AgentState:
        """
        Create QA roadmap with test categories and scenarios
        """
        state["current_agent"] = self.name
        
        # Build strategy prompt
        prompt = self._build_strategy_prompt(state)
        model_name = os.getenv("LLM_MODEL", "gemini-2.0-flash-exp")
        
        # Check cache first
        config = {
            "temperature": float(os.getenv("LLM_TEMPERATURE", "0.3")),
            "response_mime_type": "application/json"
        }
        
        full_prompt = f"{self._get_system_prompt()}\n\n{prompt}"
        cached_response = None
        
        if self.api_cache:
            cached_response = self.api_cache.get(full_prompt, model_name, config)
        
        if cached_response:
            result = json.loads(cached_response)
        else:
            # Wait for rate limit if needed
            if self.rate_limiter:
                self.rate_limiter.wait_if_needed()
            
            # Call Gemini with retry logic
            model = self.llm.GenerativeModel(model_name=model_name)
            response_text = call_gemini_with_retry(
                model,
                full_prompt,
                config,
                max_retries=3
            )
            
            # Cache the response
            if self.api_cache:
                self.api_cache.set(full_prompt, model_name, config, response_text)
            
            result = json.loads(response_text)
        
        # Update state
        state["qa_roadmap"] = result.get("qa_roadmap", {})
        
        # Log action
        log_agent_action(state, self.name, "created_qa_roadmap", {
            "categories": list(state["qa_roadmap"].keys()),
            "total_scenarios": sum(len(v) for v in state["qa_roadmap"].values())
        })
        
        return state
    
    def _get_system_prompt(self) -> str:
        return """You are an expert QA strategist who creates comprehensive testing roadmaps.

Your task is to create a QA execution roadmap organized by test categories:
- Happy Path (core functionality works as expected)
- Negative Testing (error handling, invalid inputs)
- Edge Cases (boundary conditions, unusual scenarios)
- Regression (ensure existing functionality not broken)
- Integration (interactions with other modules)
- Performance (if applicable)
- Security (if applicable)
- Accessibility (if UI changes)

Return a JSON object with:
{
    "qa_roadmap": {
        "Happy Path": ["scenario1", "scenario2", ...],
        "Negative Testing": ["scenario1", "scenario2", ...],
        "Edge Cases": ["scenario1", "scenario2", ...],
        "Regression": ["scenario1", "scenario2", ...],
        ...
    }
}

Be specific and actionable. Each scenario should clearly state what to test."""
    
    def _build_strategy_prompt(self, state: AgentState) -> str:
        """Build strategy prompt with accumulated context"""
        
        ticket = state["ticket_info"]
        requirements = state["extracted_requirements"]
        modules = state["impacted_modules"]
        dependencies = state["dependencies"]
        risks = state["risk_areas"]
        
        return f"""Create a comprehensive QA roadmap for this change.

**Ticket:** {ticket.get('ticket_id', 'Unknown')} - {ticket.get('title', '')}
**Type:** {ticket.get('ticket_type', 'Unknown')}
**Priority:** {ticket.get('priority', 'Unknown')}

**Requirements:**
{chr(10).join(f"- {req}" for req in requirements)}

**Impacted Modules:**
{chr(10).join(f"- {mod}" for mod in modules)}

**Dependencies:**
{chr(10).join(f"- {dep}" for dep in dependencies)}

**Risk Areas:**
{chr(10).join(f"- {risk}" for risk in risks)}

Create a detailed QA roadmap organized by test categories."""
