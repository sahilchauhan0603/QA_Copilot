"""
API Helper with retry logic for handling rate limits
"""
import time
import google.generativeai as genai
from typing import Dict, Any, Optional
import re


def call_gemini_with_retry(
    model: genai.GenerativeModel,
    prompt: str,
    generation_config: Dict[str, Any],
    max_retries: int = 3
) -> str:
    """
    Call Gemini API with automatic retry on rate limit errors
    
    Args:
        model: Gemini model instance
        prompt: The prompt to send
        generation_config: Generation configuration
        max_retries: Maximum number of retry attempts
    
    Returns:
        Response text from the API
    
    Raises:
        Exception: If all retries are exhausted
    """
    last_error = None
    
    for attempt in range(max_retries):
        try:
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(**generation_config)
            )
            return response.text
        
        except Exception as e:
            error_str = str(e)
            last_error = e
            
            # Check if it's a 429 rate limit error
            if "429" in error_str or "quota" in error_str.lower() or "rate" in error_str.lower():
                # Extract retry delay from error message if available
                retry_delay = extract_retry_delay(error_str)
                
                if retry_delay is None:
                    # Default exponential backoff: 15s, 30s, 60s
                    retry_delay = min(15 * (2 ** attempt), 60)
                
                if attempt < max_retries - 1:
                    print(f"⏱️ Rate limit hit. Waiting {retry_delay:.1f}s before retry {attempt + 1}/{max_retries}...")
                    time.sleep(retry_delay)
                    continue
            else:
                # Non-rate-limit error, raise immediately
                raise
    
    # All retries exhausted
    raise last_error


def extract_retry_delay(error_message: str) -> Optional[float]:
    """
    Extract retry delay from error message
    
    Args:
        error_message: Error message from API
    
    Returns:
        Retry delay in seconds, or None if not found
    """
    # Look for patterns like "retry in 13.86s" or "Please retry in 13.868766102s"
    patterns = [
        r"retry in (\d+\.?\d*)\s*s",
        r"retry_delay.*?seconds:\s*(\d+)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, error_message, re.IGNORECASE)
        if match:
            try:
                return float(match.group(1)) + 1.0  # Add 1 second buffer
            except ValueError:
                continue
    
    return None
