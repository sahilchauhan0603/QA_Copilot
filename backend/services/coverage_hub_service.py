"""
Coverage Hub Service
Builds requirement traceability, coverage metrics, and minimum viable test sets.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple


STOPWORDS = {
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'when', 'then', 'than', 'that',
    'this', 'these', 'those', 'it', 'its', 'user', 'system', 'must', 'shall',
}


def _tokenize(text: str) -> Set[str]:
    if not text:
        return set()
    tokens = re.findall(r'[a-z0-9]+', text.lower())
    return {t for t in tokens if len(t) > 2 and t not in STOPWORDS}


def _test_case_text(tc: Dict[str, Any]) -> str:
    parts = [
        tc.get('title', ''),
        tc.get('category', ''),
        tc.get('preconditions', ''),
        tc.get('expected_result', ''),
        tc.get('test_data', ''),
    ]
    steps = tc.get('test_steps', [])
    if isinstance(steps, list):
        parts.extend(str(s) for s in steps)
    elif steps:
        parts.append(str(steps))
    return ' '.join(str(p) for p in parts if p)


def _similarity(requirement: str, test_text: str) -> float:
    req_tokens = _tokenize(requirement)
    if not req_tokens:
        return 0.0
    test_tokens = _tokenize(test_text)
    if not test_tokens:
        return 0.0
    overlap = req_tokens & test_tokens
    return len(overlap) / len(req_tokens)


def _normalize_priority(priority: Optional[str]) -> str:
    if not priority:
        return 'P2'
    p = str(priority).upper().strip()
    if p.startswith('P') and len(p) >= 2 and p[1].isdigit():
        return p[:2]
    return 'P2'


def _coverage_grade(percentage: float) -> str:
    if percentage >= 90:
        return 'Excellent'
    if percentage >= 75:
        return 'Good'
    if percentage >= 50:
        return 'Fair'
    return 'Poor'


def _resolve_test_identifier(tc: Dict[str, Any], index: int) -> str:
    return str(tc.get('test_id') or tc.get('id') or f'TC-{index + 1}')


class CoverageHubService:
    """Builds Coverage Hub payloads from agent state or stored generation data."""

    FULL_THRESHOLD = 0.35
    PARTIAL_THRESHOLD = 0.15

    @classmethod
    def build_from_state(cls, state: Dict[str, Any]) -> Dict[str, Any]:
        requirements = state.get('extracted_requirements') or []
        test_cases = state.get('test_cases') or []
        coverage_gaps = state.get('coverage_gaps') or []
        llm_mappings = state.get('requirement_mappings')
        return cls.build(
            requirements=requirements,
            test_cases=test_cases,
            coverage_gaps=coverage_gaps,
            requirement_mappings=llm_mappings,
            acceptance_criteria_gaps=state.get('acceptance_criteria_gaps') or [],
            risk_areas=state.get('risk_areas') or [],
            coverage_score_label=state.get('coverage_score_label'),
            coverage_percentage=state.get('coverage_percentage'),
        )

    @classmethod
    def build_from_generation_data(cls, generation_data: Dict[str, Any]) -> Dict[str, Any]:
        meta = (generation_data.get('generation') or {}).get('metadata') or {}
        cached = meta.get('coverage_hub')
        if cached and cached.get('requirement_mappings'):
            return cached

        return cls.build(
            requirements=generation_data.get('extracted_requirements') or [],
            test_cases=generation_data.get('test_cases') or [],
            coverage_gaps=generation_data.get('coverage_gaps') or [],
            requirement_mappings=meta.get('requirement_mappings'),
            acceptance_criteria_gaps=generation_data.get('acceptance_criteria_gaps') or [],
            risk_areas=generation_data.get('risk_areas') or [],
            coverage_score_label=meta.get('coverage_score_label'),
            coverage_percentage=meta.get('coverage_percentage'),
        )

    @classmethod
    def build(
        cls,
        requirements: List[str],
        test_cases: List[Dict[str, Any]],
        coverage_gaps: List[str],
        requirement_mappings: Optional[List[Dict[str, Any]]] = None,
        acceptance_criteria_gaps: Optional[List[str]] = None,
        risk_areas: Optional[List[str]] = None,
        coverage_score_label: Optional[str] = None,
        coverage_percentage: Optional[float] = None,
    ) -> Dict[str, Any]:
        acceptance_criteria_gaps = acceptance_criteria_gaps or []
        risk_areas = risk_areas or []

        heuristic_mappings = cls._heuristic_mappings(requirements, test_cases)
        merged_mappings = cls._merge_mappings(
            requirements, test_cases, requirement_mappings, heuristic_mappings
        )

        summary = cls._build_summary(merged_mappings, requirements, test_cases, coverage_gaps)
        if coverage_percentage is not None:
            summary['coverage_percentage'] = round(float(coverage_percentage), 1)
            summary['coverage_grade'] = coverage_score_label or _coverage_grade(summary['coverage_percentage'])
        else:
            summary['coverage_percentage'] = summary['requirements_covered_pct']
            summary['coverage_grade'] = coverage_score_label or _coverage_grade(summary['requirements_covered_pct'])

        minimum_viable_set = cls._build_minimum_viable_set(test_cases, merged_mappings)

        return {
            'summary': summary,
            'requirement_mappings': merged_mappings,
            'coverage_gaps': [
                {'id': f'GAP-{i + 1}', 'description': gap}
                for i, gap in enumerate(coverage_gaps)
            ],
            'acceptance_criteria_gaps': acceptance_criteria_gaps,
            'risk_areas': risk_areas,
            'minimum_viable_set': minimum_viable_set,
            'priority_breakdown': cls._priority_breakdown(test_cases),
        }

    @classmethod
    def _heuristic_mappings(
        cls,
        requirements: List[str],
        test_cases: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        mappings = []
        for req_index, requirement in enumerate(requirements):
            scored: List[Tuple[int, float]] = []
            for tc_index, tc in enumerate(test_cases):
                score = _similarity(requirement, _test_case_text(tc))
                if score >= cls.PARTIAL_THRESHOLD:
                    scored.append((tc_index, score))

            scored.sort(key=lambda x: x[1], reverse=True)
            mapped_indices = [idx for idx, _ in scored[:5]]
            top_score = scored[0][1] if scored else 0.0

            if top_score >= cls.FULL_THRESHOLD:
                status = 'full'
            elif top_score >= cls.PARTIAL_THRESHOLD:
                status = 'partial'
            else:
                status = 'gap'

            mappings.append({
                'requirement_index': req_index,
                'coverage_status': status,
                'mapped_test_indices': mapped_indices,
                'confidence': round(top_score, 2),
            })
        return mappings

    @classmethod
    def _merge_mappings(
        cls,
        requirements: List[str],
        test_cases: List[Dict[str, Any]],
        llm_mappings: Optional[List[Dict[str, Any]]],
        heuristic_mappings: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        llm_by_index: Dict[int, Dict[str, Any]] = {}
        if llm_mappings:
            for item in llm_mappings:
                idx = item.get('requirement_index')
                if idx is not None:
                    llm_by_index[int(idx)] = item

        result = []
        for req_index, requirement in enumerate(requirements):
            req_id = f'REQ-{req_index + 1:03d}'
            llm = llm_by_index.get(req_index, {})
            heuristic = heuristic_mappings[req_index] if req_index < len(heuristic_mappings) else {}

            status = llm.get('coverage_status') or heuristic.get('coverage_status', 'gap')
            mapped_indices = llm.get('mapped_test_indices') or heuristic.get('mapped_test_indices', [])

            if status not in ('full', 'partial', 'gap'):
                status = 'gap'

            mapped_tests = []
            for tc_index in mapped_indices:
                if 0 <= tc_index < len(test_cases):
                    tc = test_cases[tc_index]
                    mapped_tests.append({
                        'test_case_id': _resolve_test_identifier(tc, tc_index),
                        'db_id': tc.get('id'),
                        'title': tc.get('title', ''),
                        'priority': _normalize_priority(tc.get('priority')),
                        'category': tc.get('category', ''),
                    })

            if status != 'gap' and not mapped_tests:
                status = 'gap'

            result.append({
                'requirement_id': req_id,
                'requirement_index': req_index,
                'requirement_text': requirement,
                'coverage_status': status,
                'mapped_test_cases': mapped_tests,
                'coverage_notes': llm.get('coverage_notes') or cls._default_notes(status, mapped_tests),
                'confidence': llm.get('confidence') or heuristic.get('confidence', 0.0),
            })

        return result

    @staticmethod
    def _default_notes(status: str, mapped_tests: List[Dict[str, Any]]) -> str:
        if status == 'full':
            count = len(mapped_tests)
            return f'Covered by {count} test case{"s" if count != 1 else ""}.'
        if status == 'partial':
            return 'Some aspects covered; additional scenarios recommended.'
        return 'No matching test cases found — coverage gap.'

    @classmethod
    def _build_summary(
        cls,
        mappings: List[Dict[str, Any]],
        requirements: List[str],
        test_cases: List[Dict[str, Any]],
        coverage_gaps: List[str],
    ) -> Dict[str, Any]:
        total_reqs = len(requirements)
        full = sum(1 for m in mappings if m['coverage_status'] == 'full')
        partial = sum(1 for m in mappings if m['coverage_status'] == 'partial')
        gap = sum(1 for m in mappings if m['coverage_status'] == 'gap')

        if total_reqs == 0:
            covered_pct = 100.0 if test_cases else 0.0
        else:
            covered_pct = round(((full + partial * 0.5) / total_reqs) * 100, 1)

        p0_count = sum(1 for tc in test_cases if _normalize_priority(tc.get('priority')) == 'P0')
        p1_count = sum(1 for tc in test_cases if _normalize_priority(tc.get('priority')) == 'P1')

        return {
            'total_requirements': total_reqs,
            'requirements_full': full,
            'requirements_partial': partial,
            'requirements_gap': gap,
            'requirements_covered_pct': covered_pct,
            'total_test_cases': len(test_cases),
            'total_coverage_gaps': len(coverage_gaps),
            'p0_test_cases': p0_count,
            'p1_test_cases': p1_count,
            'minimum_viable_count': p0_count + min(p1_count, max(3, total_reqs)),
        }

    @classmethod
    def _build_minimum_viable_set(
        cls,
        test_cases: List[Dict[str, Any]],
        mappings: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        selected_ids: List[str] = []
        selected_set: Set[str] = set()
        rationale_parts: List[str] = []

        def add_test(tc_index: int, reason: str) -> None:
            if tc_index < 0 or tc_index >= len(test_cases):
                return
            tc = test_cases[tc_index]
            tid = _resolve_test_identifier(tc, tc_index)
            if tid in selected_set:
                return
            selected_set.add(tid)
            selected_ids.append(tid)
            rationale_parts.append(reason)

        for tc_index, tc in enumerate(test_cases):
            if _normalize_priority(tc.get('priority')) == 'P0':
                add_test(tc_index, f'P0 critical: {tc.get("title", "")[:60]}')

        for mapping in mappings:
            if mapping['coverage_status'] in ('partial', 'gap'):
                for mapped in mapping.get('mapped_test_cases', [])[:1]:
                    tc_id = mapped.get('test_case_id')
                    for tc_index, tc in enumerate(test_cases):
                        if _resolve_test_identifier(tc, tc_index) == tc_id:
                            add_test(
                                tc_index,
                                f'Covers {mapping["coverage_status"]} requirement {mapping["requirement_id"]}',
                            )
                            break

        for tc_index, tc in enumerate(test_cases):
            if len(selected_ids) >= 15:
                break
            if _normalize_priority(tc.get('priority')) == 'P1':
                add_test(tc_index, f'P1 high priority: {tc.get("title", "")[:60]}')

        test_entries = []
        for tc_index, tc in enumerate(test_cases):
            tid = _resolve_test_identifier(tc, tc_index)
            if tid in selected_set:
                test_entries.append({
                    'test_case_id': tid,
                    'db_id': tc.get('id'),
                    'title': tc.get('title', ''),
                    'priority': _normalize_priority(tc.get('priority')),
                    'category': tc.get('category', ''),
                })

        return {
            'description': 'Minimum set to run when time is limited — all P0 cases plus tests covering partial/gap requirements and key P1 cases.',
            'total_count': len(test_entries),
            'test_cases': test_entries,
            'rationale': rationale_parts[:20],
        }

    @staticmethod
    def _priority_breakdown(test_cases: List[Dict[str, Any]]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for tc in test_cases:
            p = _normalize_priority(tc.get('priority'))
            counts[p] = counts.get(p, 0) + 1
        return dict(sorted(counts.items()))
