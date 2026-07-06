"""
Coverage Auditor Agent
Reviews generated test cases and identifies coverage gaps
"""
from typing import Dict, List, Optional
import json
import google.generativeai as genai
from agents.state import AgentState, log_agent_action
from utils.rate_limiter import RateLimiter
from utils.api_cache import APICache
from utils.api_helper import call_gemini_with_retry
import os


class CoverageAuditorAgent:
    """
    Agent that audits test coverage and suggests improvements
    """
    
    def __init__(self, llm_client, rate_limiter: Optional[RateLimiter] = None, api_cache: Optional[APICache] = None):
        self.llm = llm_client
        self.name = "CoverageAuditorAgent"
        self.rate_limiter = rate_limiter
        self.api_cache = api_cache
    
    def process(self, state: AgentState) -> AgentState:
        """
        Audit test coverage and identify gaps
        """
        state["current_agent"] = self.name
        
        # Build audit prompt
        prompt = self._build_audit_prompt(state)
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
        state["coverage_gaps"] = result.get("coverage_gaps", [])
        state["requirement_mappings"] = result.get("requirement_mappings", [])
        state["coverage_score_label"] = result.get("coverage_score", "N/A")
        if result.get("coverage_percentage") is not None:
            state["coverage_percentage"] = result.get("coverage_percentage")

        # Add any additional clarification questions
        if result.get("additional_questions"):
            state["clarification_questions"].extend(result["additional_questions"])
        
        # Log action
        log_agent_action(state, self.name, "audited_coverage", {
            "gaps_found": len(state["coverage_gaps"]),
            "coverage_score": result.get("coverage_score", "N/A"),
            "requirement_mappings": len(state["requirement_mappings"]),
        })
        
        return state
    
    def _get_system_prompt(self) -> str:
        return """You are an expert QA auditor who reviews test coverage for completeness.

Your task is to:
1. Review all generated test cases against requirements
2. Identify coverage gaps (untested scenarios, edge cases, error conditions)
3. Rate overall coverage quality
4. Suggest additional test scenarios if needed

Return JSON:
{
    "coverage_gaps": ["gap1", "gap2", ...],
    "coverage_score": "Excellent/Good/Fair/Poor",
    "coverage_percentage": 85,
    "requirement_mappings": [
        {
            "requirement_index": 0,
            "coverage_status": "full|partial|gap",
            "mapped_test_indices": [0, 2],
            "coverage_notes": "Brief note on how requirements are covered",
            "confidence": 0.9
        }
    ],
    "additional_questions": ["question1", "question2", ...] (optional),
    "recommendations": ["recommendation1", ...] (optional)
}

For requirement_mappings:
- Map each requirement (by zero-based index) to test case indices from the sample titles list
- Use "full" when comprehensively covered, "partial" when only some aspects covered, "gap" when untested
- mapped_test_indices should reference test cases by their position in the generated list (0-based)

Look for:
- Untested requirements
- Missing error scenarios
- Boundary conditions not covered
- Integration scenarios missed
- Security/performance considerations
- Data validation gaps"""
    
    def _build_audit_prompt(self, state: AgentState) -> str:
        """Build audit prompt with all generated artifacts"""
        
        ticket = state["ticket_info"]
        requirements = state["extracted_requirements"]
        test_cases = state["test_cases"]
        
        # Summarize test cases by category
        tc_summary = {}
        for tc in test_cases:
            category = tc.get("category", "Other")
            tc_summary[category] = tc_summary.get(category, 0) + 1
        
        return f"""Audit the test coverage for this ticket.

**Ticket:** {ticket.get('ticket_id')} - {ticket.get('title')}
**Type:** {ticket.get('ticket_type')}
**Priority:** {ticket.get('priority')}

**Requirements to Cover:**
{chr(10).join(f"- {req}" for req in requirements)}

**Test Cases Generated:**
Total: {len(test_cases)} test cases
{chr(10).join(f"- {cat}: {count} test cases" for cat, count in tc_summary.items())}

**All Test Cases (index | priority | title):**
{chr(10).join(f"- [{i}] [{tc.get('priority')}] {tc.get('title')}" for i, tc in enumerate(test_cases))}

**Risk Areas Identified:**
{chr(10).join(f"- {risk}" for risk in state.get('risk_areas', []))}

Review coverage and identify any gaps."""
