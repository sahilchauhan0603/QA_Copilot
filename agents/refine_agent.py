"""
Refine Agent
Handles refinement of generated test cases based on user requests
"""
import warnings
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', category=UserWarning, message='.*pydantic.*')

from typing import Dict, List, Optional
import logging
import os

from agents.state import AgentState

logger = logging.getLogger(__name__)


class RefineAgent:
    """
    Agent responsible for refining existing test cases based on user feedback
    """
    
    def __init__(self, llm_client, rate_limiter, api_cache):
        self.llm = llm_client
        self.rate_limiter = rate_limiter
        self.api_cache = api_cache
        self.model_name = os.getenv('LLM_MODEL', 'gemini-2.0-flash-exp')
    
    def refine(
        self, 
        state: AgentState, 
        refinement_type: str,
        refinement_context: Optional[Dict] = None
    ) -> AgentState:
        """
        Refine test cases based on refinement type
        
        Args:
            state: Current agent state with existing test cases
            refinement_type: Type of refinement to apply
            refinement_context: Additional context for refinement (e.g., focus_area)
        
        Returns:
            Updated AgentState with refined test cases
        """
        refinement_context = refinement_context or {}
        
        if refinement_type == "minimize":
            return self._minimize_test_cases(state)
        elif refinement_type == "focus":
            focus_area = refinement_context.get('focus_area', '')
            return self._focus_on_area(state, focus_area)
        elif refinement_type == "edge_cases":
            return self._add_edge_cases(state)
        elif refinement_type == "coverage":
            return self._increase_coverage(state)
        elif refinement_type == "simplify":
            return self._simplify_test_cases(state)
        else:
            logger.warning(f"Unknown refinement type: {refinement_type}")
            return state
    
    def _minimize_test_cases(self, state: AgentState) -> AgentState:
        """Remove redundant test cases and consolidate similar ones"""
        logger.info("Refining: Minimizing test cases")
        
        test_cases = state.get('test_cases', [])
        if not test_cases:
            return state
        
        with self.rate_limiter:
            prompt = f"""You are a QA expert tasked with minimizing test cases by removing redundancy.

**Current Test Cases ({len(test_cases)} total):**
{self._format_test_cases_for_prompt(test_cases)}

**Task:**
Analyze these test cases and:
1. Identify redundant or overlapping test cases
2. Consolidate similar test cases where possible
3. Keep only the most valuable, unique test cases
4. Maintain coverage of all critical scenarios

**Goal:** Reduce the count by 20-40% while maintaining quality and coverage.

Return your response as a JSON array of refined test cases in this exact format:
```json
[
  {{
    "id": "TC-001",
    "title": "Test case title",
    "category": "Functional|Regression|Negative|Edge Case|Integration|Performance|Security",
    "priority": "P0|P1|P2|P3",
    "preconditions": "Prerequisites before test",
    "steps": [
      "Step 1 description",
      "Step 2 description"
    ],
    "expected_results": [
      "Expected result 1",
      "Expected result 2"
    ],
    "test_data": "Sample test data",
    "tags": ["tag1", "tag2"]
  }}
]
```

Return ONLY the JSON array, no additional text."""

            try:
                model = self.llm.GenerativeModel(self.model_name)
                response = model.generate_content(prompt)
                
                # Parse response
                refined_cases = self._parse_test_cases_response(response.text)
                
                if refined_cases:
                    logger.info(f"Minimized test cases: {len(test_cases)} → {len(refined_cases)}")
                    state['test_cases'] = refined_cases
                else:
                    logger.warning("Failed to minimize test cases, keeping original")
                    
            except Exception as e:
                logger.error(f"Error minimizing test cases: {e}")
        
        return state
    
    def _focus_on_area(self, state: AgentState, focus_area: str) -> AgentState:
        """Generate additional test cases focused on a specific area"""
        logger.info(f"Refining: Focusing on area - {focus_area}")
        
        if not focus_area:
            logger.warning("No focus area specified")
            return state
        
        test_cases = state.get('test_cases', [])
        ticket_info = state.get('ticket_info', {})
        
        with self.rate_limiter:
            prompt = f"""You are a QA expert generating focused test cases.

**Ticket Information:**
Title: {ticket_info.get('title', '')}
Description: {ticket_info.get('description', '')}

**Focus Area:** {focus_area}

**Existing Test Cases ({len(test_cases)} total):**
{self._format_test_cases_for_prompt(test_cases[:10])}  # Show first 10 for context

**Task:**
Generate 5-10 NEW test cases that specifically focus on: {focus_area}

These should:
1. Be more detailed than existing tests
2. Cover scenarios not already tested
3. Focus specifically on the requested area
4. Include both positive and negative scenarios

Return your response as a JSON array of new test cases in this exact format:
```json
[
  {{
    "id": "TC-XXX",
    "title": "Test case title",
    "category": "Functional|Regression|Negative|Edge Case|Integration|Performance|Security",
    "priority": "P0|P1|P2|P3",
    "preconditions": "Prerequisites before test",
    "steps": [
      "Step 1 description",
      "Step 2 description"
    ],
    "expected_results": [
      "Expected result 1",
      "Expected result 2"
    ],
    "test_data": "Sample test data",
    "tags": ["tag1", "tag2", "focused"]
  }}
]
```

Return ONLY the JSON array, no additional text."""

            try:
                model = self.llm.GenerativeModel(self.model_name)
                response = model.generate_content(prompt)
                
                # Parse response
                new_cases = self._parse_test_cases_response(response.text)
                
                if new_cases:
                    # Add new cases to existing ones
                    logger.info(f"Added {len(new_cases)} focused test cases")
                    state['test_cases'] = test_cases + new_cases
                else:
                    logger.warning("Failed to generate focused test cases")
                    
            except Exception as e:
                logger.error(f"Error generating focused test cases: {e}")
        
        return state
    
    def _add_edge_cases(self, state: AgentState) -> AgentState:
        """Generate additional edge case test scenarios"""
        logger.info("Refining: Adding edge cases")
        
        test_cases = state.get('test_cases', [])
        ticket_info = state.get('ticket_info', {})
        
        with self.rate_limiter:
            prompt = f"""You are a QA expert specializing in edge case testing.

**Ticket Information:**
Title: {ticket_info.get('title', '')}
Description: {ticket_info.get('description', '')}

**Existing Test Cases:**
{self._format_test_cases_for_prompt(test_cases[:10])}

**Task:**
Generate 5-10 NEW edge case test scenarios that cover:
1. Boundary conditions (max/min values, empty inputs, etc.)
2. Unusual but valid input combinations
3. Race conditions and timing issues
4. Data type mismatches
5. Special characters and encoding issues
6. Concurrent operations
7. System resource limits

Return your response as a JSON array of edge case tests in this exact format:
```json
[
  {{
    "id": "TC-EDGE-XXX",
    "title": "Test case title",
    "category": "Edge Case",
    "priority": "P1|P2",
    "preconditions": "Prerequisites before test",
    "steps": [
      "Step 1 description",
      "Step 2 description"
    ],
    "expected_results": [
      "Expected result 1",
      "Expected result 2"
    ],
    "test_data": "Sample edge case data",
    "tags": ["edge-case", "boundary"]
  }}
]
```

Return ONLY the JSON array, no additional text."""

            try:
                model = self.llm.GenerativeModel(self.model_name)
                response = model.generate_content(prompt)
                
                # Parse response
                edge_cases = self._parse_test_cases_response(response.text)
                
                if edge_cases:
                    logger.info(f"Added {len(edge_cases)} edge case tests")
                    state['test_cases'] = test_cases + edge_cases
                else:
                    logger.warning("Failed to generate edge cases")
                    
            except Exception as e:
                logger.error(f"Error generating edge cases: {e}")
        
        return state
    
    def _increase_coverage(self, state: AgentState) -> AgentState:
        """Generate test cases to cover identified gaps"""
        logger.info("Refining: Increasing coverage")
        
        test_cases = state.get('test_cases', [])
        coverage_gaps = state.get('coverage_gaps', [])
        
        if not coverage_gaps:
            logger.info("No coverage gaps identified, skipping")
            return state
        
        with self.rate_limiter:
            prompt = f"""You are a QA expert tasked with improving test coverage.

**Identified Coverage Gaps:**
{self._format_coverage_gaps(coverage_gaps)}

**Existing Test Cases ({len(test_cases)} total):**
{self._format_test_cases_for_prompt(test_cases[:10])}

**Task:**
Generate test cases specifically to address the identified coverage gaps.
Create 1-2 test cases for each gap area.

Return your response as a JSON array of test cases in this exact format:
```json
[
  {{
    "id": "TC-COV-XXX",
    "title": "Test case title addressing specific gap",
    "category": "Functional|Regression|Negative|Edge Case|Integration",
    "priority": "P0|P1|P2",
    "preconditions": "Prerequisites before test",
    "steps": [
      "Step 1 description",
      "Step 2 description"
    ],
    "expected_results": [
      "Expected result 1",
      "Expected result 2"
    ],
    "test_data": "Sample test data",
    "tags": ["coverage-gap", "gap-addressed"]
  }}
]
```

Return ONLY the JSON array, no additional text."""

            try:
                model = self.llm.GenerativeModel(self.model_name)
                response = model.generate_content(prompt)
                
                # Parse response
                coverage_cases = self._parse_test_cases_response(response.text)
                
                if coverage_cases:
                    logger.info(f"Added {len(coverage_cases)} coverage test cases")
                    state['test_cases'] = test_cases + coverage_cases
                else:
                    logger.warning("Failed to generate coverage tests")
                    
            except Exception as e:
                logger.error(f"Error generating coverage tests: {e}")
        
        return state
    
    def _simplify_test_cases(self, state: AgentState) -> AgentState:
        """Simplify test cases to make them more concise and maintainable"""
        logger.info("Refining: Simplifying test cases")
        
        test_cases = state.get('test_cases', [])
        if not test_cases:
            return state
        
        with self.rate_limiter:
            prompt = f"""You are a QA expert tasked with simplifying test cases.

**Current Test Cases ({len(test_cases)} total):**
{self._format_test_cases_for_prompt(test_cases)}

**Task:**
Simplify these test cases by:
1. Making steps more concise and clear
2. Removing unnecessary details
3. Combining steps where logical
4. Using simpler language
5. Keeping test data minimal but sufficient

Keep all test cases but make them easier to read and execute.

Return your response as a JSON array of simplified test cases in this exact format:
```json
[
  {{
    "id": "TC-XXX",
    "title": "Clear, concise title",
    "category": "Functional|Regression|Negative|Edge Case|Integration|Performance|Security",
    "priority": "P0|P1|P2|P3",
    "preconditions": "Brief prerequisites",
    "steps": [
      "Concise step 1",
      "Concise step 2"
    ],
    "expected_results": [
      "Clear expected result 1",
      "Clear expected result 2"
    ],
    "test_data": "Minimal test data",
    "tags": ["tag1", "tag2"]
  }}
]
```

Return ONLY the JSON array, no additional text."""

            try:
                model = self.llm.GenerativeModel(self.model_name)
                response = model.generate_content(prompt)
                
                # Parse response
                simplified_cases = self._parse_test_cases_response(response.text)
                
                if simplified_cases:
                    logger.info(f"Simplified {len(test_cases)} test cases")
                    state['test_cases'] = simplified_cases
                else:
                    logger.warning("Failed to simplify test cases, keeping original")
                    
            except Exception as e:
                logger.error(f"Error simplifying test cases: {e}")
        
        return state
    
    def _format_test_cases_for_prompt(self, test_cases: List[Dict]) -> str:
        """Format test cases for inclusion in prompt"""
        if not test_cases:
            return "None"
        
        formatted = []
        for i, tc in enumerate(test_cases[:20], 1):  # Limit to 20 for context length
            formatted.append(f"""
Test Case {i}:
- Title: {tc.get('title', 'N/A')}
- Category: {tc.get('category', 'N/A')}
- Priority: {tc.get('priority', 'N/A')}
- Steps: {len(tc.get('steps', []))} steps
""")
        
        if len(test_cases) > 20:
            formatted.append(f"\n... and {len(test_cases) - 20} more test cases")
        
        return "\n".join(formatted)
    
    def _format_coverage_gaps(self, gaps: List[Dict]) -> str:
        """Format coverage gaps for inclusion in prompt"""
        if not gaps:
            return "None identified"
        
        formatted = []
        for i, gap in enumerate(gaps, 1):
            formatted.append(f"{i}. {gap.get('area', 'Unknown')}: {gap.get('gap', gap.get('description', 'N/A'))}")
        
        return "\n".join(formatted)
    
    def _parse_test_cases_response(self, response_text: str) -> List[Dict]:
        """Parse test cases from AI response"""
        import json
        import re
        
        try:
            # Extract JSON from markdown code blocks
            json_match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find JSON array directly
                json_match = re.search(r'\[\s*\{.*?\}\s*\]', response_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    logger.error("Could not find JSON in response")
                    return []
            
            test_cases = json.loads(json_str)
            
            # Validate structure
            if not isinstance(test_cases, list):
                logger.error("Response is not a list")
                return []
            
            # Renumber IDs sequentially
            for i, tc in enumerate(test_cases, 1):
                if not isinstance(tc, dict):
                    continue
                tc['id'] = f"TC-{i:03d}"
            
            return test_cases
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            return []
        except Exception as e:
            logger.error(f"Error parsing test cases: {e}")
            return []
