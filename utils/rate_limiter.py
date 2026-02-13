"""
Rate Limiter for Gemini API calls
Handles free tier limits: 5 requests per minute (RPM)
"""
import time
from collections import deque
from threading import Lock
from typing import Optional
import streamlit as st


class RateLimiter:
    """
    Token bucket rate limiter for API calls
    """
    
    def __init__(self, max_requests: int = 5, time_window: int = 60):
        """
        Args:
            max_requests: Maximum number of requests allowed in time_window
            time_window: Time window in seconds (default: 60 for per minute)
        """
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = deque()
        self.lock = Lock()
        # Minimum seconds between requests (for free tier: 60/5 = 12 seconds)
        self.min_interval = time_window / max_requests if max_requests > 0 else 0
    
    def wait_if_needed(self, progress_callback: Optional[callable] = None) -> float:
        """
        Wait if rate limit would be exceeded
        
        Args:
            progress_callback: Optional callback(seconds_to_wait) for UI updates
        
        Returns:
            Seconds waited (0 if no wait needed)
        """
        with self.lock:
            now = time.time()
            wait_time = 0.0
            
            # Remove requests outside the time window
            while self.requests and now - self.requests[0] >= self.time_window:
                self.requests.popleft()
            
            # Check if we need to wait due to max requests
            if len(self.requests) >= self.max_requests:
                # Calculate wait time until oldest request expires
                oldest_request = self.requests[0]
                wait_time = self.time_window - (now - oldest_request) + 0.5  # Add buffer
            
            # Also enforce minimum interval between requests (for free tier)
            if self.requests and len(self.requests) > 0:
                last_request = self.requests[-1]
                time_since_last = now - last_request
                min_wait = self.min_interval - time_since_last
                
                # Use the maximum of the two wait times
                wait_time = max(wait_time, min_wait)
            
            # Wait if needed
            if wait_time > 0:
                # Notify about wait
                if progress_callback:
                    progress_callback(wait_time)
                
                # Wait with visual feedback
                self._wait_with_feedback(wait_time)
                
                # Clean up after waiting
                now = time.time()
                while self.requests and now - self.requests[0] >= self.time_window:
                    self.requests.popleft()
            
            # Record this request
            self.requests.append(time.time())
            return wait_time
    
    def _wait_with_feedback(self, wait_time: float):
        """Wait with incremental sleep to allow UI updates"""
        end_time = time.time() + wait_time
        
        while time.time() < end_time:
            remaining = end_time - time.time()
            sleep_duration = min(0.1, remaining)  # Sleep in small chunks
            if sleep_duration > 0:
                time.sleep(sleep_duration)
    
    def get_remaining_capacity(self) -> int:
        """Get number of requests available without waiting"""
        with self.lock:
            now = time.time()
            
            # Remove expired requests
            while self.requests and now - self.requests[0] >= self.time_window:
                self.requests.popleft()
            
            return max(0, self.max_requests - len(self.requests))
    
    def reset(self):
        """Reset the rate limiter"""
        with self.lock:
            self.requests.clear()


# Global rate limiter instance
_global_limiter = None


def get_rate_limiter(max_requests: int = 5, time_window: int = 60) -> RateLimiter:
    """
    Get or create the global rate limiter instance
    
    Args:
        max_requests: Maximum requests per time window
        time_window: Time window in seconds
    
    Returns:
        RateLimiter instance
    """
    global _global_limiter
    
    if _global_limiter is None:
        _global_limiter = RateLimiter(max_requests, time_window)
    
    return _global_limiter


def reset_rate_limiter():
    """Reset the global rate limiter"""
    global _global_limiter
    if _global_limiter:
        _global_limiter.reset()
