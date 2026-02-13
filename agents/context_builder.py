"""
Context Builder Agent
Understands impacted modules, dependencies, and system context
"""
from typing import Dict, List, Optional
import json
import google.generativeai as genai
from agents.state import AgentState, log_agent_action
from utils.rate_limiter import RateLimiter
from utils.api_cache import APICache
from utils.api_helper import call_gemini_with_retry
import os


class ContextBuilderAgent:
    """
    Agent that builds context about what parts of the system are impacted
    and what dependencies exist
    """
    
    def __init__(self, llm_client, rate_limiter: Optional[RateLimiter] = None, api_cache: Optional[APICache] = None):
        self.llm = llm_client
        self.name = "ContextBuilderAgent"
        self.rate_limiter = rate_limiter
        self.api_cache = api_cache
    
    def process(self, state: AgentState) -> AgentState:
        """
        Identify impacted modules and dependencies
        """
        state["current_agent"] = self.name
        
        # Build prompt with previous agent's output
        prompt = self._build_context_prompt(state)
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
        state["impacted_modules"] = result.get("impacted_modules", [])
        state["dependencies"] = result.get("dependencies", [])
        state["risk_areas"] = result.get("risk_areas", [])
        
        # Log action
        log_agent_action(state, self.name, "identified_context", {
            "modules_count": len(state["impacted_modules"]),
            "dependencies_count": len(state["dependencies"]),
            "risk_areas_count": len(state["risk_areas"])
        })
        
        return state
    
    def _get_system_prompt(self) -> str:
        return """You are an expert system architect and QA strategist.

Your task is to:
1. Identify all system modules/components impacted by this change
2. Map out dependencies (APIs, databases, third-party services, UI components)
3. Highlight risk areas that need extra testing attention

Return a JSON object with:
{
    "impacted_modules": ["module1", "module2", ...],
    "dependencies": ["dependency1", "dependency2", ...],
    "risk_areas": ["risk1", "risk2", ...]
}

Think about:
- Frontend vs Backend impacts
- Database schema changes
- API contract changes
- Authentication/Authorization impacts
- Integration points
- Data migration needs"""
    
    def _build_context_prompt(self, state: AgentState) -> str:
        """Build prompt with ticket and extracted requirements"""
        
        ticket = state["ticket_info"]
        requirements = state["extracted_requirements"]
        
        return f"""Analyze the system context and impacts for this change.

**Ticket Type:** {ticket.get('ticket_type', 'Unknown')}
**Title:** {ticket.get('title', '')}
**Priority:** {ticket.get('priority', 'Unknown')}

**Extracted Requirements:**
{chr(10).join(f"- {req}" for req in requirements)}

**Linked Tickets:** {', '.join(ticket.get('linked_tickets', [])) or 'None'}

Identify all impacted modules, dependencies, and risk areas."""
