"""
Agent Orchestrator
Coordinates the multi-agent workflow using LangGraph
"""
from typing import Dict, Optional
from langgraph.graph import StateGraph, END
import google.generativeai as genai
import time
from datetime import datetime

from agents.state import AgentState, create_initial_state, TicketInfo
from agents.ticket_reader import TicketReaderAgent
from agents.context_builder import ContextBuilderAgent
from agents.test_strategy import TestStrategyAgent
from agents.test_generator import TestGeneratorAgent
from agents.coverage_auditor import CoverageAuditorAgent
from utils.rate_limiter import get_rate_limiter
from utils.api_cache import get_api_cache


class AgentOrchestrator:
    """
    Orchestrates the multi-agent workflow
    """
    
    def __init__(self, google_api_key: str):
        genai.configure(api_key=google_api_key)
        self.llm_client = genai
        
        # Initialize rate limiter (5 requests per minute for free tier)
        self.rate_limiter = get_rate_limiter(max_requests=5, time_window=60)
        
        # Initialize API cache
        self.api_cache = get_api_cache(ttl=3600)  # 1 hour cache
        
        # Initialize all agents
        self.ticket_reader = TicketReaderAgent(self.llm_client, self.rate_limiter, self.api_cache)
        self.context_builder = ContextBuilderAgent(self.llm_client, self.rate_limiter, self.api_cache)
        self.test_strategy = TestStrategyAgent(self.llm_client, self.rate_limiter, self.api_cache)
        self.test_generator = TestGeneratorAgent(self.llm_client, self.rate_limiter, self.api_cache)
        self.coverage_auditor = CoverageAuditorAgent(self.llm_client, self.rate_limiter, self.api_cache)
        
        # Build the workflow graph
        self.workflow = self._build_workflow()
    
    def _build_workflow(self) -> StateGraph:
        """
        Build the LangGraph workflow
        
        Flow: TicketReader → ContextBuilder → TestStrategy → TestGenerator → CoverageAuditor → END
        """
        workflow = StateGraph(AgentState)
        
        # Add agent nodes
        workflow.add_node("ticket_reader", self.ticket_reader.process)
        workflow.add_node("context_builder", self.context_builder.process)
        workflow.add_node("test_strategy", self.test_strategy.process)
        workflow.add_node("test_generator", self.test_generator.process)
        workflow.add_node("coverage_auditor", self.coverage_auditor.process)
        
        # Define the linear flow
        workflow.set_entry_point("ticket_reader")
        workflow.add_edge("ticket_reader", "context_builder")
        workflow.add_edge("context_builder", "test_strategy")
        workflow.add_edge("test_strategy", "test_generator")
        workflow.add_edge("test_generator", "coverage_auditor")
        workflow.add_edge("coverage_auditor", END)
        
        return workflow.compile()
    
    def process_ticket(
        self, 
        ticket_info: TicketInfo,
        progress_callback: Optional[callable] = None
    ) -> AgentState:
        """
        Process a ticket through the entire agent pipeline
        
        Args:
            ticket_info: The ticket information
            progress_callback: Optional callback function(agent_name, state) called after each agent
        
        Returns:
            Final AgentState with all generated artifacts
        """
        start_time = time.time()
        
        # Create initial state
        initial_state = create_initial_state(ticket_info)
        
        # Execute workflow
        final_state = None
        for state in self.workflow.stream(initial_state):
            # state is a dict with agent name as key
            if state:
                agent_name = list(state.keys())[0]
                agent_state = state[agent_name]
                
                # Call progress callback if provided
                if progress_callback:
                    progress_callback(agent_name, agent_state)
                
                final_state = agent_state
        
        # Update processing time
        if final_state:
            final_state["processing_time"] = time.time() - start_time
        
        return final_state
    
    def get_workflow_diagram(self) -> str:
        """
        Returns a text representation of the workflow
        """
        return """
QA Copilot Agent Workflow
=================================

┌─────────────────────┐
│  Ticket Reader      │ ← Extracts requirements & identifies gaps
│  Agent              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Context Builder    │ ← Identifies impacted modules & dependencies
│  Agent              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Test Strategy      │ ← Creates QA roadmap by category
│  Agent              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Test Generator     │ ← Generates detailed test cases
│  Agent              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Coverage Auditor   │ ← Reviews coverage & identifies gaps
│  Agent              │
└──────────┬──────────┘
           │
           ▼
      ┌────────┐
      │  END   │
      └────────┘
        """
