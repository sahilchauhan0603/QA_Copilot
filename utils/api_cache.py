"""
Simple caching system for API responses
Reduces redundant API calls for identical requests
"""
import hashlib
import json
import os
from pathlib import Path
from typing import Optional, Dict, Any
import time


class APICache:
    """
    File-based cache for API responses
    """
    
    def __init__(self, cache_dir: str = ".api_cache", ttl: int = 3600):
        """
        Args:
            cache_dir: Directory to store cache files
            ttl: Time-to-live in seconds (default: 1 hour)
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        self.ttl = ttl
    
    def _get_cache_key(self, prompt: str, model: str, config: Dict) -> str:
        """Generate a unique cache key from request parameters"""
        # Combine all parameters that affect the response
        key_data = {
            "prompt": prompt,
            "model": model,
            "config": config
        }
        key_string = json.dumps(key_data, sort_keys=True)
        return hashlib.sha256(key_string.encode()).hexdigest()
    
    def get(self, prompt: str, model: str, config: Dict) -> Optional[str]:
        """
        Retrieve cached response if available and not expired
        
        Args:
            prompt: The prompt sent to the API
            model: Model name
            config: Generation config dict
        
        Returns:
            Cached response text or None if not found/expired
        """
        cache_key = self._get_cache_key(prompt, model, config)
        cache_file = self.cache_dir / f"{cache_key}.json"
        
        if not cache_file.exists():
            return None
        
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            # Check if expired
            if time.time() - cache_data['timestamp'] > self.ttl:
                cache_file.unlink()  # Delete expired cache
                return None
            
            return cache_data['response']
        
        except Exception:
            # If cache is corrupted, remove it
            if cache_file.exists():
                cache_file.unlink()
            return None
    
    def set(self, prompt: str, model: str, config: Dict, response: str):
        """
        Cache an API response
        
        Args:
            prompt: The prompt sent to the API
            model: Model name
            config: Generation config dict
            response: Response text to cache
        """
        cache_key = self._get_cache_key(prompt, model, config)
        cache_file = self.cache_dir / f"{cache_key}.json"
        
        cache_data = {
            'timestamp': time.time(),
            'prompt': prompt[:200],  # Store truncated prompt for reference
            'model': model,
            'response': response
        }
        
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, indent=2)
        except Exception as e:
            # Silently fail if caching doesn't work
            pass
    
    def clear(self):
        """Clear all cached responses"""
        for cache_file in self.cache_dir.glob("*.json"):
            try:
                cache_file.unlink()
            except Exception:
                pass
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        cache_files = list(self.cache_dir.glob("*.json"))
        valid_count = 0
        expired_count = 0
        
        for cache_file in cache_files:
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cache_data = json.load(f)
                
                if time.time() - cache_data['timestamp'] <= self.ttl:
                    valid_count += 1
                else:
                    expired_count += 1
            except Exception:
                expired_count += 1
        
        return {
            'total_entries': len(cache_files),
            'valid_entries': valid_count,
            'expired_entries': expired_count
        }


# Global cache instance
_global_cache = None


def get_api_cache(ttl: int = 3600) -> APICache:
    """
    Get or create the global API cache instance
    
    Args:
        ttl: Time-to-live in seconds
    
    Returns:
        APICache instance
    """
    global _global_cache
    
    if _global_cache is None:
        _global_cache = APICache(ttl=ttl)
    
    return _global_cache
