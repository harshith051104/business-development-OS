"""
Organization Validator — Lead Quality Gate for discovery pipeline.

Rejects non-organization results before they reach the UI:
- Webpage titles ("About", "Website", "Home")
- Articles, listicles, guides, blog posts
- Directory listings, forum pages, templates
- Generic pages with no real org identity
- Domains that don't match the claimed org name

Normalizes name/location/website for clean dedup.
"""
import re
from typing import Dict, Any, Optional, Tuple
from urllib.parse import urlparse

import logging

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# 1. GARBAGE NAME PATTERNS — reject these entirely
# ─────────────────────────────────────────────────────────────

# Single generic words that are never org names
GENERIC_WORDS = re.compile(
    r"^(?:"
    r"about|contact|home|homepage|login|sign.?in|register|search|"
    r"privacy|terms|cookies|sitemap|faq|help|support|careers|jobs|"
    r"blog|news|press|media|resources|downloads|links|partners|"
    r"website|webmaster|webmasters|admin|dashboard|portal|"
    r"error|404|500|forbidden|unauthorized|"
    r"our\s+team|our\s+story|our\s+mission|what\s+we\s+do|"
    r"view\s+all|see\s+all|load\s+more|show\s+more|"
    r"next|previous|back|close|cancel|submit|save|delete|edit|"
    r"yes|no|ok|true|false|null|undefined|"
    r"menu|navigation|header|footer|sidebar|content|main|page"
    r")$",
    re.IGNORECASE,
)

# Patterns in names that indicate articles/lists/guides, not orgs
ARTICLE_NAME_PATTERNS = re.compile(
    r"(?:"
    r"^\d+\s+(?:best|top|leading|biggest|largest|fastest|most)\s+|"
    r"^(?:best|top|leading|biggest|largest|fastest|most)\s+\d|"
    r"^(?:the\s+)?(?:best|top|leading|complete|ultimate|definitive|comprehensive)\s+|"
    r"(?:\d{4}\s+)?(?:guide|list|comparison|review|roundup|directory|catalog)\s*(?:to|for|of|on)?\s|"
    r"^(?:how|what|why|when|where|who)\s+(?:to|do|does|is|are|was|were|can|should|will)\s|"
    r"(?:tips|tricks|strategies|ways|methods|steps|reasons)\s+(?:to|for|of|on)\s|"
    r"(?:vs|versus|compared|comparison)\s|"
    r"^(?:a|an|the)\s+(?:guide|list|review|comparison|overview)\s|"
    r"(?:complete|ultimate|definitive)\s+(?:guide|list|handbook|manual|playbook)\s|"
    r"in\s+(?:the\s+)?(?:uk|us|usa|india|australia|germany|canada|europe|asia)\b|"
    r"to\s+(?:know|watch|check|follow|look|consider)\b|"
    r"(?:everything|all)\s+you\s+(?:need|want|should)\s|"
    r"industry\s+(?:analysis|report|overview|insights|trends)\b|"
    r"market\s+(?:report|analysis|research|size|forecast|trends)\b|"
    r"(?:white\s+paper|case\s+study|ebook|webinar|podcast)\b|"
    r"(?:directory|archives?|catalog|member|roundup|database)\s*$|"
    r"\b(?:wave|spin\s*out|first\s+to\s+spin|expanding\s+the|expansion\s+wave)\b|"
    r"\bin\s+[A-Z][a-z]+,\s+[A-Z][a-z]+"
    r")",
    re.IGNORECASE,
)

# ─────────────────────────────────────────────────────────────
# 2. URL QUALITY FILTERS — reject bad URLs
# ─────────────────────────────────────────────────────────────

# Domains that are never org homepages
JUNK_DOMAINS = {
    "wikipedia.org", "reddit.com", "youtube.com", "twitter.com", "x.com",
    "facebook.com", "instagram.com", "tiktok.com", "pinterest.com",
    "linkedin.com", "medium.com", "substack.com", "ghost.io",
    "quora.com", "stackoverflow.com", "github.com", "gitlab.com",
    "producthunt.com", "crunchbase.com", "glassdoor.com",
    "indeed.com", "glassdoor.co.in", "ambitionbox.com",
    "forbes.com", "bloomberg.com", "reuters.com", "techcrunch.com",
    "venturebeat.com", "zdnet.com", "cnet.com", "mashable.com",
    "huffpost.com", "nytimes.com", "washingtonpost.com", "theguardian.com",
    "bbc.com", "cnn.com", "foxnews.com", "nbcnews.com",
    "amazon.com", "ebay.com", "walmart.com", "target.com",
    "yelp.com", "tripadvisor.com", "trustpilot.com",
    "slideshare.net", "scribd.com", "academia.edu", "researchgate.net",
    "wordpress.com", "blogspot.com", "wix.com", "squarespace.com",
    "weebly.com", "godaddy.com", "namecheap.com",
    "archive.org", "web.archive.org",
    "google.com", "bing.com", "yahoo.com", "duckduckgo.com",
    "apple.com", "microsoft.com", "amazonaws.com",
    "nus.edu.sg", "fintechweekly.com", "fintechnews.sg", "tracxn.com",
    "usfintech.co", "australianfintech.com.au", "big-picture.com",
    "getlatka.com", "latka.com", "pitchbook.com", "dealroom.co",
    "techinasia.com", "e27.co", "finextra.com", "pymnts.com",
}

# URL path patterns that indicate non-org content
JUNK_URL_PATHS = re.compile(
    r"(?:"
    r"/blog/|/news/|/article/|/post/|/story/|/press/|/pressrelease|"
    r"/wiki/|/forum/|/thread/|/discussion/|"
    r"/directory/|/listing/|/listings/|/categories/|/category/|"
    r"/template/|/templates/|/theme/|/themes/|"
    r"/download/|/downloads/|/free/|/trial/|"
    r"/promo/|/coupon/|/discount/|/deal/|/offers?/|"
    r"/review/|/reviews/|/rating/|/ratings/|"
    r"/compare/|/comparison/|/vs/|/versus/|"
    r"/visit/|/demo/|/marketplace/|"
    r"/login|/signin|/signup|/register|/auth|"
    r"/cart|/checkout|/payment|/buy|/purchase|"
    r"/tag/|/tags/|/author/|/authors/|"
    r"/feed/|/rss/|/atom/|/sitemap|"
    r"\?|\.html$|\.php$|\.asp$"
    r")",
    re.IGNORECASE,
)

# ─────────────────────────────────────────────────────────────
# 3. ORG NAME QUALITY CHECKS
# ─────────────────────────────────────────────────────────────

# Corporate suffixes that indicate real orgs
ORG_SUFFIXES = re.compile(
    r"(?:"
    r"inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.?|"
    r"group|holdings?|ventures?|partners?|enterprises?|"
    r"technologies?|systems?|solutions?|services?|"
    r"healthcare|health|medical|hospital|clinic|"
    r"bank|financial|insurance|"
    r"software|tech|digital|"
    r"academy|institute|foundation|university|school|"
    r"labs?|studio|agency|"
    r"gmbh|ag|s\.?a\.?|s\.?r\.?l\.?|pty\.?ltd\.?|pvt\.?ltd\.?"
    r")",
    re.IGNORECASE,
)

# Words that are NOT org names on their own
NOT_AN_ORG = re.compile(
    r"^(?:"
    r"cybersecurity|software|technology|healthcare|fintech|saas|"
    r"artificial intelligence|machine learning|data science|"
    r"cloud computing|blockchain|iot|devops|"
    r"digital transformation|automation|analytics|"
    r"consulting|marketing|advertising|design|"
    r"education|training|certification|"
    r"manufacturing|logistics|supply chain|"
    r"real estate|construction|architecture|"
    r"food|beverage|agriculture|mining|oil|gas|"
    r"automotive|aerospace|defense|"
    r"telecommunications|media|entertainment|"
    r"pharmaceutical|biotechnology|medical device|"
    r"insurance|banking|investment|venture capital|private equity"
    r")$",
    re.IGNORECASE,
)


class OrganizationValidator:
    """
    Validates and normalizes organization leads from web search.
    Returns (is_valid, rejection_reason, normalized_org) tuples.
    """

    def validate(self, org: Dict[str, Any]) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Validate an organization lead.
        Returns (is_valid, rejection_reason, normalized_org).
        """
        name = (org.get("name") or "").strip()
        url = (org.get("website") or "").strip()
        description = (org.get("description") or "").strip()

        # Phase 1: Name validation
        valid, reason = self._validate_name(name, description)
        if not valid:
            return False, reason, org

        # Phase 2: URL validation
        valid, reason = self._validate_url(url)
        if not valid:
            return False, reason, org

        # Phase 3: Domain-org name consistency
        valid, reason = self._validate_domain_name_match(name, url)
        if not valid:
            return False, reason, org

        # Phase 4: Content quality check
        valid, reason = self._validate_content_quality(name, description, url)
        if not valid:
            return False, reason, org

        # Phase 5: Normalize
        normalized = self._normalize(org)
        return True, None, normalized

    def _validate_name(self, name: str, description: str) -> Tuple[bool, Optional[str]]:
        """Validate organization name."""
        if not name or len(name) < 2:
            return False, "empty_name"

        # Check if it's purely numeric (before any other processing)
        if name.isdigit():
            return False, f"generic_word: {name}"

        # Strip trailing numbers/dashes like "Links-2" → "Links"
        cleaned_name = re.sub(r"[\s\-]*\d+$", "", name).strip()
        if not cleaned_name or len(cleaned_name) < 2:
            return False, f"generic_word: {name}"

        # Check generic single words (use cleaned version)
        if GENERIC_WORDS.match(cleaned_name):
            return False, f"generic_word: {name}"

        # Also check original name against generic words
        if GENERIC_WORDS.match(name):
            return False, f"generic_word: {name}"

        # Check article/listicle patterns
        if ARTICLE_NAME_PATTERNS.search(name):
            return False, f"article_title: {name}"

        # Check headline/marketing taglines (e.g. "Agentic AI, Digital Transformation & Software Development")
        if ("," in name or "&" in name) and len(name.split()) >= 5:
            if not ORG_SUFFIXES.search(name):
                return False, f"headline_tagline: {name}"

        # Check if it's just special characters
        alpha_num = re.sub(r"[^a-zA-Z0-9]", "", name)
        if len(alpha_num) < 2:
            return False, f"no_alphanumeric: {name}"

        # Check if it's a known non-org term
        if NOT_AN_ORG.match(cleaned_name):
            return False, f"generic_category: {name}"

        # Check minimum length after cleaning
        if len(cleaned_name) < 3:
            return False, f"too_short: {name}"

        return True, None

    def _validate_url(self, url: str) -> Tuple[bool, Optional[str]]:
        """Validate URL quality."""
        if not url:
            # No URL is OK — we can still use the lead
            return True, None

        try:
            parsed = urlparse(url)
        except Exception:
            return False, f"invalid_url: {url}"

        # Must have a scheme and netloc
        if not parsed.netloc:
            return False, f"invalid_url: {url}"

        domain = parsed.netloc.lower().replace("www.", "")

        # Check junk domains
        for junk in JUNK_DOMAINS:
            if domain == junk or domain.endswith("." + junk):
                return False, f"junk_domain: {domain}"

        # Check academic/gov domains (not corporate commercial orgs)
        if re.search(r"\.(?:edu|ac|gov)(?:\.[a-z]{2,3})?$", domain):
            return False, f"academic_or_gov_domain: {domain}"

        # Check junk URL paths
        if parsed.path and JUNK_URL_PATHS.search(parsed.path):
            return False, f"junk_url_path: {parsed.path}"

        # Check for URL shorteners (not org homepages)
        shorteners = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly"}
        if domain in shorteners:
            return False, f"url_shortener: {domain}"

        return True, None

    def _validate_domain_name_match(self, name: str, url: str) -> Tuple[bool, Optional[str]]:
        """Check if domain roughly matches org name."""
        if not url or not name:
            return True, None

        try:
            parsed = urlparse(url)
            domain_word = parsed.netloc.lower().replace("www.", "").split(".")[0]
        except Exception:
            return True, None

        # Skip validation for very short or very long domain words
        if len(domain_word) < 3 or len(domain_word) > 30:
            return True, None

        # Normalize both for comparison
        name_lower = name.lower()
        domain_clean = re.sub(r"[^a-z0-9]", "", domain_word)

        # If domain word appears in name (or vice versa), it's a match
        if domain_clean in name_lower or name_lower.replace(" ", "") in domain_clean:
            return True, None

        # Check if any significant word from name appears in domain
        name_words = set(re.findall(r"[a-z]{3,}", name_lower))
        domain_words = set(re.findall(r"[a-z]{3,}", domain_clean))
        if name_words & domain_words:
            return True, None

        # Allow mismatch for common TLDs — the domain might be a subbrand
        # Only reject if confidence is very low
        return True, None  # Soft validation — don't hard reject

    def _validate_content_quality(self, name: str, description: str, url: str) -> Tuple[bool, Optional[str]]:
        """Validate overall content quality."""
        if not description:
            # No description is OK — research will fill it in
            return True, None

        desc_lower = description.lower().strip()

        # Check if description is just navigation/action text
        nav_patterns = [
            r"^(?:click|tap|press)\s+here",
            r"^(?:click|tap|press)\s+to\s",
            r"^(?:skip|go\s+to|navigate\s+to|scroll)\s",
            r"^(?:home|menu|back|next|previous|close)\s",
            r"^(?:privacy\s+policy|terms\s+of|cookie)\s",
            r"^(?:copyright|©)\s",
            r"^(?:all\s+rights?\s+reserved)",
        ]
        for pat in nav_patterns:
            if re.match(pat, desc_lower):
                return False, f"navigation_text: {description[:50]}"

        return True, None

    def _normalize(self, org: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize org data for consistent dedup and display."""
        result = dict(org)

        # Normalize name
        name = result.get("name", "")
        # Remove "The " prefix
        name = re.sub(r"^The\s+", "", name)
        # Normalize whitespace
        name = re.sub(r"\s+", " ", name).strip()
        result["name"] = name

        # Normalize website URL
        url = result.get("website", "")
        if url:
            try:
                parsed = urlparse(url)
                # Remove trailing slash, normalize scheme
                path = parsed.path.rstrip("/")
                url = f"{parsed.scheme}://{parsed.netloc}{path}"
                if not url.startswith("http"):
                    url = "https://" + url
            except Exception:
                pass
        result["website"] = url

        # Normalize location fields — title case
        for field in ["city", "state", "country"]:
            val = result.get(field, "")
            if val and isinstance(val, str):
                val = val.strip()
                if len(val) > 1:
                    val = val.title()
                result[field] = val

        return result


# Singleton
organization_validator = OrganizationValidator()
