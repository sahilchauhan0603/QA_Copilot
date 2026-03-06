"""
Rate Limiter for Gemini API calls
Handles rate limits with configurable RPM (requests per minute)
"""
import time
import logging
from collections import deque
from threading import Lock
from typing import Optional

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Token bucket rate limiter for API calls
    """
    
    def __init__(self, max_requests: int = 15, time_window: int = 60):
        """
        Args:
            max_requests: Maximum number of requests allowed in time_window
            time_window: Time window in seconds (default: 60 for per minute)
        """
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = deque()
        self.lock = Lock()
        # Small buffer between requests to avoid bursts (1 second)
        self.min_interval = 1.0
    
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
                wait_time = self.time_window - (now - oldest_request) + 0.5
                logger.info(f"Rate limit reached ({self.max_requests} RPM). Waiting {wait_time:.1f}s...")
            
            # Enforce minimum interval between requests to avoid bursts
            if self.requests:
                last_request = self.requests[-1]
                time_since_last = now - last_request
                min_wait = self.min_interval - time_since_last
                wait_time = max(wait_time, min_wait)
            
            # Wait if needed
            if wait_time > 0:
                if progress_callback:
                    progress_callback(wait_time)
                time.sleep(wait_time)
                
                # Clean up after waiting
                now = time.time()
                while self.requests and now - self.requests[0] >= self.time_window:
                    self.requests.popleft()
            
            # Record this request
            self.requests.append(time.time())
            return wait_time
    
    def get_remaining_capacity(self) -> int:
        """Get number of requests available without waiting"""
        with self.lock:
            now = time.time()
            while self.requests and now - self.requests[0] >= self.time_window:
                self.requests.popleft()
            return max(0, self.max_requests - len(self.requests))
    
    def reset(self):
        """Reset the rate limiter"""
        with self.lock:
            self.requests.clear()


# Global rate limiter instance
_global_limiter = None


def get_rate_limiter(max_requests: int = 15, time_window: int = 60) -> RateLimiter:
    """
    Get or create the global rate limiter instance
    
    Args:
        max_requests: Maximum requests per time window (default: 15 for Gemini free tier)
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
