import hashlib
import json
import time
import logging
from typing import Optional, List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# In-memory search result cache with TTL
# ponytail: dict cache, good enough for single-server. Add Redis if scaling.
_cache: Dict[str, Tuple[List[Dict[str, Any]], int, float]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour


def _make_cache_key(
    keyword: Optional[str],
    location: Optional[str],
    organization_type: Optional[str],
    product_description: Optional[str],
    target_icp: Optional[str],
    discovery_objective: Optional[str],
) -> str:
    raw = json.dumps({
        "k": (keyword or "").strip().lower(),
        "l": (location or "").strip().lower(),
        "t": (organization_type or "").strip().lower(),
        "p": (product_description or "").strip().lower(),
        "i": (target_icp or "").strip().lower(),
        "o": (discovery_objective or "").strip().lower(),
    }, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def get_cached_results(
    keyword: Optional[str],
    location: Optional[str],
    organization_type: Optional[str],
    product_description: Optional[str],
    target_icp: Optional[str],
    discovery_objective: Optional[str],
) -> Optional[Tuple[List[Dict[str, Any]], int]]:
    key = _make_cache_key(keyword, location, organization_type, product_description, target_icp, discovery_objective)
    if key in _cache:
        results, total, ts = _cache[key]
        if time.time() - ts < CACHE_TTL_SECONDS:
            logger.info(f"Cache HIT for key={key}")
            return results, total
        else:
            del _cache[key]
            logger.info(f"Cache EXPIRED for key={key}")
    return None


def clear_cache():
    global _cache
    _cache.clear()
    logger.info("Search cache cleared.")

_cache.clear()

def set_cached_results(
    keyword: Optional[str],
    location: Optional[str],
    organization_type: Optional[str],
    product_description: Optional[str],
    target_icp: Optional[str],
    discovery_objective: Optional[str],
    results: List[Dict[str, Any]],
    total: int,
):
    key = _make_cache_key(keyword, location, organization_type, product_description, target_icp, discovery_objective)
    _cache[key] = (results, total, time.time())
    logger.info(f"Cache SET for key={key}, total={total}")


def clear_cache():
    _cache.clear()
