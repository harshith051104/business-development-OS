from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class OrganizationDiscoveryProvider(ABC):
    """
    Abstract provider interface for Organization Discovery.
    Encapsulates search queries and details retrieval away from the router & UI.
    """

    @abstractmethod
    def search(
        self,
        keyword: Optional[str] = None,
        location: Optional[str] = None,
        organization_type: Optional[str] = None,
        industry: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[List[Dict[str, Any]], int]:
        pass

    @abstractmethod
    def get_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        pass


CURATED_HEALTHCARE_DIRECTORY = [
    {
        "name": "Apollo Hospitals Enterprise Ltd",
        "organization_type": "Hospital Group",
        "country": "India",
        "state": "Telangana",
        "city": "Hyderabad",
        "address": "Jubilee Hills, Road No 72",
        "website": "https://www.apollohospitals.com",
        "email": "corporate.bd@apollohospitals.com",
        "phone": "+91 40 2360 7777",
        "description": "Leading healthcare network in Asia operating over 70 multi-specialty hospitals and 5,000 pharmacies.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "High",
    },
    {
        "name": "Manipal Health Enterprises",
        "organization_type": "Hospital Group",
        "country": "India",
        "state": "Karnataka",
        "city": "Bengaluru",
        "address": "98 Rustam Bagh, HAL Airport Road",
        "website": "https://www.manipalhospitals.com",
        "email": "outreach@manipalhospitals.com",
        "phone": "+91 80 2502 4444",
        "description": "Major hospital network with extensive multi-specialty presence across India.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "High",
    },
    {
        "name": "Max Healthcare Institute",
        "organization_type": "Hospital Group",
        "country": "India",
        "state": "Delhi",
        "city": "New Delhi",
        "address": "1 Press Enclave Road, Saket",
        "website": "https://www.maxhealthcare.in",
        "email": "enterprise@maxhealthcare.com",
        "phone": "+91 11 2651 5050",
        "description": "Premier healthcare provider operating advanced tertiary care hospitals across North and West India.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "High",
    },
    {
        "name": "Narayana Health",
        "organization_type": "Hospital Group",
        "country": "India",
        "state": "Karnataka",
        "city": "Bengaluru",
        "address": "Bommasandra Industrial Area, Anekal Taluk",
        "website": "https://www.narayanahealth.org",
        "email": "partnerships@narayanahealth.org",
        "phone": "+91 80 7122 2222",
        "description": "Pan-India healthcare provider known for high-volume cardiac and multi-specialty clinical infrastructure.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "High",
    },
    {
        "name": "Fortis Healthcare Limited",
        "organization_type": "Hospital Group",
        "country": "India",
        "state": "Haryana",
        "city": "Gurugram",
        "address": "Sector 44, Opposite HUDA City Centre",
        "website": "https://www.fortishealthcare.com",
        "email": "bd.enterprise@fortishealthcare.com",
        "phone": "+91 124 492 1021",
        "description": "Integrated healthcare delivery service provider with hospitals, diagnostics, and daycare specialty facilities.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "High",
    },
    {
        "name": "Aster DM Healthcare",
        "organization_type": "Hospital Group",
        "country": "India",
        "state": "Kerala",
        "city": "Kochi",
        "address": "Aster Medcity, South Chittoor",
        "website": "https://www.asterdmhealthcare.com",
        "email": "bd@asterdmhealthcare.com",
        "phone": "+91 484 669 9999",
        "description": "Multi-national private healthcare conglomerate operating hospitals, clinics, and medical retail.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "Medium",
    },
    {
        "name": "KIMS Hospitals (Krishna Institute of Medical Sciences)",
        "organization_type": "Hospital Group",
        "country": "India",
        "state": "Telangana",
        "city": "Hyderabad",
        "address": "Minister Road, Secunderabad",
        "website": "https://www.kimshospitals.com",
        "email": "business@kimshospitals.com",
        "phone": "+91 40 4488 5000",
        "description": "One of the largest multi-specialty corporate healthcare groups in Telangana and Andhra Pradesh.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "High",
    },
    {
        "name": "Yashoda Hospitals",
        "organization_type": "Hospital",
        "country": "India",
        "state": "Telangana",
        "city": "Hyderabad",
        "address": "Alexander Road, Secunderabad",
        "website": "https://www.yashodahospitals.com",
        "email": "info@yashodahospitals.com",
        "phone": "+91 40 4567 4567",
        "description": "Leading tertiary care multi-specialty hospital group operating across Hyderabad.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "Medium",
    },
    {
        "name": "Medanta The Medicity",
        "organization_type": "Hospital",
        "country": "India",
        "state": "Haryana",
        "city": "Gurugram",
        "address": "CH Bakhtawar Singh Road, Sector 38",
        "website": "https://www.medanta.org",
        "email": "bd@medanta.org",
        "phone": "+91 124 414 1414",
        "description": "Multi-super specialty institute housing 1,250+ beds and research capabilities.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "High",
    },
    {
        "name": "Lilavati Hospital and Research Centre",
        "organization_type": "Hospital",
        "country": "India",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "A-791, Bandra Reclamation, Bandra West",
        "website": "https://www.lilavatihospital.com",
        "email": "admin@lilavatihospital.com",
        "phone": "+91 22 2675 1000",
        "description": "Premier multi-specialty hospital in Mumbai with advanced clinical care.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "Medium",
    },
    {
        "name": "Dr Lal PathLabs",
        "organization_type": "Diagnostic Center",
        "country": "India",
        "state": "Delhi",
        "city": "New Delhi",
        "address": "National Reference Lab, Sector 18, Rohini",
        "website": "https://www.lalpathlabs.com",
        "email": "corporate.solutions@lalpathlabs.com",
        "phone": "+91 11 3988 5050",
        "description": "International diagnostic testing services provider with extensive laboratory network.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "High",
    },
    {
        "name": "Metropolis Healthcare Ltd",
        "organization_type": "Diagnostic Center",
        "country": "India",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "Commercial Building 1A, Kohinoor Mall, Kurla West",
        "website": "https://www.metropolisindia.com",
        "email": "business@metropolisindia.com",
        "phone": "+91 22 6258 2000",
        "description": "Major diagnostic services pathology lab chain across India, Africa, and South Asia.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "Medium",
    },
    {
        "name": "Vijaya Diagnostic Centre",
        "organization_type": "Diagnostic Center",
        "country": "India",
        "state": "Telangana",
        "city": "Hyderabad",
        "address": "3-6-16 & 17, Street No 19, Himayatnagar",
        "website": "https://www.vijayadiagnostic.com",
        "email": "bd@vijayadiagnostic.com",
        "phone": "+91 40 2342 0420",
        "description": "Comprehensive integrated diagnostic network in South India offering pathology and radiology services.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "Medium",
    },
    {
        "name": "HealthPlix Technologies",
        "organization_type": "Healthcare Technology",
        "country": "India",
        "state": "Karnataka",
        "city": "Bengaluru",
        "address": "HSR Layout, Sector 6",
        "website": "https://www.healthplix.com",
        "email": "enterprise@healthplix.com",
        "phone": "+91 80 4718 1800",
        "description": "Healthtech pioneer building AI-assisted medical software and electronic medical records systems.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "High",
    },
    {
        "name": "Innovaccer Technologies",
        "organization_type": "Healthcare Technology",
        "country": "India",
        "state": "Uttar Pradesh",
        "city": "Noida",
        "address": "Sector 62, Electronic City",
        "website": "https://www.innovaccer.com",
        "email": "partners@innovaccer.com",
        "phone": "+91 120 456 7890",
        "description": "Healthcare technology company providing cloud-native data activation platforms for hospitals and payers.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "High",
    },
    {
        "name": "Qure.ai Technologies",
        "organization_type": "Healthcare Technology",
        "country": "India",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "B-Wing, Trade Star Building, Andheri East",
        "website": "https://www.qure.ai",
        "email": "alliances@qure.ai",
        "phone": "+91 22 6833 4400",
        "description": "Healthcare software solutions provider specializing in radiology workflows and medical image analysis.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "High",
    },
    {
        "name": "Siemens Healthineers India",
        "organization_type": "Medical Equipment",
        "country": "India",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "Kalpataru Square, Kondivita Road, Andheri East",
        "website": "https://www.siemens-healthineers.com/en-in",
        "email": "inquiry.india@siemens-healthineers.com",
        "phone": "+91 22 3967 7000",
        "description": "Global medical technology and clinical diagnostics equipment manufacturer.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "High",
    },
    {
        "name": "GE HealthCare South Asia",
        "organization_type": "Medical Infrastructure",
        "country": "India",
        "state": "Karnataka",
        "city": "Bengaluru",
        "address": "John F Welch Technology Centre, Whitefield",
        "website": "https://www.gehealthcare.in",
        "email": "contact.southasia@ge.com",
        "phone": "+91 80 4180 1000",
        "description": "Provider of medical technology, diagnostic imaging infrastructure, and digital solutions.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "High",
    },
    {
        "name": "Poly Medicure Ltd (Polymed)",
        "organization_type": "Medical Equipment",
        "country": "India",
        "state": "Haryana",
        "city": "Faridabad",
        "address": "Plot No. 1049, Modern Industrial Estate",
        "website": "https://www.polymed.net",
        "email": "info@polymed.net",
        "phone": "+91 129 428 1000",
        "description": "Leading manufacturer and exporter of medical devices and consumables across 110+ countries.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "Medium",
    },
    {
        "name": "Portea Medical",
        "organization_type": "Home Healthcare",
        "country": "India",
        "state": "Karnataka",
        "city": "Bengaluru",
        "address": "69/4, Millers Road, Vasanth Nagar",
        "website": "https://www.portea.com",
        "email": "business@portea.com",
        "phone": "+91 80 3355 4554",
        "description": "Largest home healthcare provider in India offering post-operative care, nursing, and elderly support.",
        "source_type": "search",
        "source_name": "Approved Healthcare Directory",
        "potential_fit": "Medium",
    },
]


class DirectoryDiscoveryProvider(OrganizationDiscoveryProvider):
    """
    Curated Healthcare Directory Discovery Provider.
    Implements multi-attribute filtering across name, location, type, and industry.
    """

    def __init__(self, data: Optional[List[Dict[str, Any]]] = None):
        self._dataset = data or CURATED_HEALTHCARE_DIRECTORY

    def search(
        self,
        keyword: Optional[str] = None,
        location: Optional[str] = None,
        organization_type: Optional[str] = None,
        industry: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[List[Dict[str, Any]], int]:
        results = self._dataset

        if keyword and keyword.strip():
            kw = keyword.strip().lower()
            results = [
                r for r in results
                if kw in r["name"].lower()
                or (r.get("description") and kw in r["description"].lower())
                or (r.get("website") and kw in r["website"].lower())
            ]

        if location and location.strip():
            loc = location.strip().lower()
            results = [
                r for r in results
                if (r.get("city") and loc in r["city"].lower())
                or (r.get("state") and loc in r["state"].lower())
                or (r.get("country") and loc in r["country"].lower())
                or (r.get("address") and loc in r["address"].lower())
            ]

        if organization_type and organization_type.strip() and organization_type.strip() != "All":
            ot = organization_type.strip().lower()
            results = [r for r in results if r["organization_type"].lower() == ot]

        total = len(results)
        paginated = results[offset : offset + limit]
        return paginated, total

    def get_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        for item in self._dataset:
            if item.get("name", "").lower() == external_id.lower():
                return item
        return None


# Global singleton instance of provider
discovery_provider = DirectoryDiscoveryProvider()
