"""
Ticket Reader Agent
Extracts key requirements, acceptance criteria, and metadata from tickets
"""
from typing import Dict, List, Optional
import json
import google.generativeai as genai
from agents.state import AgentState, log_agent_action
from utils.rate_limiter import RateLimiter
from utils.api_cache import APICache
from utils.api_helper import call_gemini_with_retry
import os


class TicketReaderAgent:
    """
    Agent responsible for understanding the ticket and extracting structured information
    """
    
    def __init__(self, llm_client, rate_limiter: Optional[RateLimiter] = None, api_cache: Optional[APICache] = None):
        self.llm = llm_client
        self.name = "TicketReaderAgent"
        self.rate_limiter = rate_limiter
        self.api_cache = api_cache
    
    def process(self, state: AgentState) -> AgentState:
        """
        Extract requirements and identify gaps in acceptance criteria
        """
        state["current_agent"] = self.name
        
        ticket = state["ticket_info"]
        
        # Build prompt for extraction
        prompt = self._build_extraction_prompt(ticket)
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
            # Use cached response
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
            
            # Parse response
            result = json.loads(response_text)
        
        # Update state
        state["extracted_requirements"] = result.get("requirements", [])
        state["acceptance_criteria_gaps"] = result.get("ac_gaps", [])
        state["clarification_questions"] = result.get("clarification_questions", [])
        
        # Log action
        log_agent_action(state, self.name, "extracted_requirements", {
            "requirements_count": len(state["extracted_requirements"]),
            "gaps_found": len(state["acceptance_criteria_gaps"])
        })
        
        return state
    
    def _get_system_prompt(self) -> str:
        return """You are an expert QA analyst specializing in requirement extraction.
        
Your task is to:
1. Extract all testable requirements from the ticket
2. Identify missing or ambiguous acceptance criteria
3. Generate clarifying questions for unclear requirements

Return a JSON object with:
{
    "requirements": ["requirement 1", "requirement 2", ...],
    "ac_gaps": ["gap 1", "gap 2", ...],
    "clarification_questions": ["question 1", "question 2", ...]
}

Be thorough and look for edge cases and implicit requirements."""
    
    def _build_extraction_prompt(self, ticket: Dict) -> str:
        """Build the prompt from ticket information"""
        
        ac_section = ""
        if ticket.get("acceptance_criteria"):
            ac_section = f"\n**Acceptance Criteria:**\n" + "\n".join(
                f"- {ac}" for ac in ticket["acceptance_criteria"]
            )
        
        comments_section = ""
        if ticket.get("comments"):
            comments_section = f"\n**Recent Comments:**\n" + "\n".join(
                f"- {c.get('author', 'Unknown')}: {c.get('body', '')}" 
                for c in ticket["comments"][:5]  # Last 5 comments
            )
        
        return f"""Analyze this {ticket.get('ticket_type', 'ticket')} and extract all testable requirements.

**Ticket ID:** {ticket.get('ticket_id', 'Unknown')}
**Title:** {ticket.get('title', 'No title')}
**Priority:** {ticket.get('priority', 'Unknown')}
**Status:** {ticket.get('status', 'Unknown')}

**Description:**
{ticket.get('description', 'No description provided')}
{ac_section}
{comments_section}

**Attachments:** {', '.join(ticket.get('attachments', [])) or 'None'}
**Linked Tickets:** {', '.join(ticket.get('linked_tickets', [])) or 'None'}

Extract all requirements and identify gaps in acceptance criteria."""
