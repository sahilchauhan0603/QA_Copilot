"""
Multi-Agent State Management
Shared state that flows through all agents in the pipeline
"""
from typing import List, Dict, Optional, TypedDict, Annotated
from datetime import datetime
import operator


class TicketInfo(TypedDict):
    """Structured ticket information"""
    ticket_id: str
    title: str
    description: str
    acceptance_criteria: List[str]
    ticket_type: str  # bug, story, task, etc.
    priority: str
    status: str
    attachments: List[str]
    comments: List[Dict]
    linked_tickets: List[str]


class TestCase(TypedDict):
    """Individual test case structure"""
    test_id: str
    title: str
    priority: str  # P0, P1, P2
    category: str  # Happy Path, Negative, Edge Case, Regression
    preconditions: str
    test_steps: List[str]
    expected_result: str
    test_data: Optional[str]
    automation_feasibility: str  # High, Medium, Low


class AgentState(TypedDict):
    """
    The shared state that all agents can read and update.
    Uses Annotated with operator.add for list fields to append instead of replace.
    """
    # Input
    ticket_info: TicketInfo
    
    # Agent Outputs (accumulated)
    extracted_requirements: List[str]
    acceptance_criteria_gaps: Annotated[List[str], operator.add]
    impacted_modules: List[str]
    dependencies: List[str]
    
    # QA Strategy
    qa_roadmap: Dict[str, List[str]]  # {category: [test scenarios]}
    risk_areas: Annotated[List[str], operator.add]
    
    # Generated Artifacts
    test_cases: Annotated[List[TestCase], operator.add]
    coverage_gaps: Annotated[List[str], operator.add]
    clarification_questions: Annotated[List[str], operator.add]
    
    # Metadata
    agent_logs: Annotated[List[Dict], operator.add]
    current_agent: str
    processing_time: float
    timestamp: str


def create_initial_state(ticket_info: TicketInfo) -> AgentState:
    """Create initial state from ticket information"""
    return AgentState(
        ticket_info=ticket_info,
        extracted_requirements=[],
        acceptance_criteria_gaps=[],
        impacted_modules=[],
        dependencies=[],
        qa_roadmap={},
        risk_areas=[],
        test_cases=[],
        coverage_gaps=[],
        clarification_questions=[],
        agent_logs=[],
        current_agent="",
        processing_time=0.0,
        timestamp=datetime.now().isoformat()
    )


def log_agent_action(state: AgentState, agent_name: str, action: str, details: Dict) -> None:
    """Helper to log agent actions"""
    state["agent_logs"].append({
        "agent": agent_name,
        "action": action,
        "details": details,
        "timestamp": datetime.now().isoformat()
    })
