from typing import List, Dict, Any, Optional, Tuple
from app.services.discovery_providers.base import BaseOrganizationDiscoveryProvider
from app.services.discovery_providers.ai_qualification import qualify_organization


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
        "source_type": "directory",
        "source_name": "Approved Directory",
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
        "source_type": "directory",
        "source_name": "Approved Directory",
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
        "source_type": "directory",
        "source_name": "Approved Directory",
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
        "source_type": "directory",
        "source_name": "Approved Directory",
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
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "Medanta — The Medicity",
        "organization_type": "Hospital",
        "country": "India",
        "state": "Haryana",
        "city": "Gurugram",
        "address": "CH Bakhtawar Singh Road, Sector 38",
        "website": "https://www.medanta.org",
        "email": "info@medanta.org",
        "phone": "+91 124 414 1414",
        "description": "One of India's largest multi-super specialty medical institutes housing over 1,250 beds and 29 departments.",
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "Lilavati Hospital & Research Centre",
        "organization_type": "Hospital",
        "country": "India",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "A-791, Bandra Reclamation, Bandra West",
        "website": "https://www.lilavatihospital.com",
        "email": "info@lilavatihospital.com",
        "phone": "+91 22 2675 1000",
        "description": "Premier multi-specialty tertiary care hospital in Mumbai known for excellence in clinical and diagnostic services.",
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "Qure.ai Technologies",
        "organization_type": "Healthcare Technology Company",
        "country": "India",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "7th Floor, Prime Center, Santacruz West",
        "website": "https://www.qure.ai",
        "email": "partnerships@qure.ai",
        "phone": "+91 22 4970 0500",
        "description": "Pioneering healthcare AI technology enterprise providing automated medical imaging intelligence and screening software.",
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "Aster DM Healthcare",
        "organization_type": "Hospital Group",
        "country": "India",
        "state": "Kerala",
        "city": "Kochi",
        "address": "Aster Medcity, Kuttisahib Road, Cheranelloor",
        "website": "https://www.asterdmhealthcare.com",
        "email": "collaborate@asterdmhealthcare.com",
        "phone": "+91 484 669 9999",
        "description": "Integrated healthcare service provider across India and GCC operating hospitals, clinics, and pharmacies.",
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "KIMS Hospitals (Krishna Institute of Medical Sciences)",
        "organization_type": "Hospital Group",
        "country": "India",
        "state": "Telangana",
        "city": "Secunderabad",
        "address": "1-8-31/1, Minister Road, Krishna Nagar Colony",
        "website": "https://www.kimshospitals.com",
        "email": "corporate@kimshospitals.com",
        "phone": "+91 40 4488 5000",
        "description": "One of the largest corporate healthcare groups in South India with multi-specialty hospitals.",
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "CARE Hospitals Group",
        "organization_type": "Hospital Group",
        "country": "India",
        "state": "Telangana",
        "city": "Hyderabad",
        "address": "Road No 1, Banjara Hills",
        "website": "https://www.carehospitals.com",
        "email": "business@carehospitals.com",
        "phone": "+91 40 6165 6565",
        "description": "Multi-specialty healthcare network with state-of-the-art hospitals across 6 states in India.",
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "Tata Memorial Centre",
        "organization_type": "Hospital",
        "country": "India",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "Dr. E Borges Road, Parel",
        "website": "https://tmc.gov.in",
        "email": "dean@tmc.gov.in",
        "phone": "+91 22 2417 7000",
        "description": "Comprehensive national cancer center for prevention, treatment, education and research in oncology.",
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "Dr. Lal PathLabs",
        "organization_type": "Diagnostic Center",
        "country": "India",
        "state": "Delhi",
        "city": "New Delhi",
        "address": "Block E, Okhla Phase II, Okhla Industrial Area",
        "website": "https://www.lalpathlabs.com",
        "email": "bd@lalpathlabs.com",
        "phone": "+91 11 3988 5050",
        "description": "India's leading diagnostic network offering over 5,000 diagnostic tests with 200+ laboratories.",
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "Metropolis Healthcare Ltd",
        "organization_type": "Diagnostic Center",
        "country": "India",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "Kohinoor City Mall, Commercial Building, Kurla West",
        "website": "https://www.metropolisindia.com",
        "email": "support@metropolisindia.com",
        "phone": "+91 22 3399 3939",
        "description": "International diagnostic chain with operations across India, Africa, and South Asia.",
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "Thyrocare Technologies Ltd",
        "organization_type": "Diagnostic Center",
        "country": "India",
        "state": "Maharashtra",
        "city": "Navi Mumbai",
        "address": "D-37/1, TTC Industrial Area, MIDC Turbhe",
        "website": "https://www.thyrocare.com",
        "email": "partnerships@thyrocare.com",
        "phone": "+91 22 4125 2525",
        "description": "Automated clinical diagnostic laboratory specializing in preventive health check-up profiles.",
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "Practo Technologies Pvt Ltd",
        "organization_type": "Healthcare Technology Company",
        "country": "India",
        "state": "Karnataka",
        "city": "Bengaluru",
        "address": "Salarpuria Symbiosis, Bannerghatta Main Road",
        "website": "https://www.practo.com",
        "email": "business@practo.com",
        "phone": "+91 80 4710 5555",
        "description": "Leading digital healthcare platform connecting patients with doctors, clinics, and hospital networks.",
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "HealthifyMe (Ignite World)",
        "organization_type": "Healthcare Technology Company",
        "country": "India",
        "state": "Karnataka",
        "city": "Bengaluru",
        "address": "Indiranagar 100ft Road",
        "website": "https://www.healthifyme.com",
        "email": "enterprise@healthifyme.com",
        "phone": "+91 80 4567 8900",
        "description": "Digital health and wellness enterprise delivering AI-driven health management tools.",
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "PharmEasy (API Holdings)",
        "organization_type": "Pharmacy",
        "country": "India",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "Thane West, Godrej Castlemaine",
        "website": "https://www.pharmeasy.in",
        "email": "partners@pharmeasy.in",
        "phone": "+91 22 6678 9000",
        "description": "India's premier digital healthcare delivery platform providing online medicines, teleconsultation, and diagnostics.",
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
    {
        "name": "Poly Medicure Ltd (Polymed)",
        "organization_type": "Medical Equipment Company",
        "country": "India",
        "state": "Haryana",
        "city": "Faridabad",
        "address": "Plot No. 1049, Modern Industrial Estate",
        "website": "https://www.polymed.net",
        "email": "info@polymed.net",
        "phone": "+91 129 428 1000",
        "description": "Leading manufacturer and exporter of medical devices and consumables across 110+ countries.",
        "source_type": "directory",
        "source_name": "Approved Directory",
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
        "source_type": "directory",
        "source_name": "Approved Directory",
    },
]


class DirectoryDiscoveryProvider(BaseOrganizationDiscoveryProvider):
    """
    Curated Healthcare Directory Discovery Provider.
    Performs multi-attribute filtering, fuzzy keyword evaluation, and
    dynamic AI-assisted fit qualification with explainable reasoning.
    """

    def __init__(self, data: Optional[List[Dict[str, Any]]] = None):
        self._dataset = data or CURATED_HEALTHCARE_DIRECTORY

    @property
    def provider_name(self) -> str:
        return "Curated Healthcare Directory"

    @property
    def provider_type(self) -> str:
        return "directory"

    def search_organizations(
        self,
        keyword: Optional[str] = None,
        location: Optional[str] = None,
        organization_type: Optional[str] = None,
        product_description: Optional[str] = None,
        target_icp: Optional[str] = None,
        discovery_objective: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Tuple[List[Dict[str, Any]], int]:
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

        # Apply AI qualification & fit reasoning
        qualified_results = []
        for raw_org in paginated:
            fit_level, score, reason = qualify_organization(
                raw_org,
                product_description=product_description,
                target_icp=target_icp,
                discovery_objective=discovery_objective,
            )
            item = dict(raw_org)
            item["potential_fit"] = fit_level
            item["potential_fit_score"] = score
            item["qualification_reason"] = reason
            item["product_description"] = product_description
            item["target_icp"] = target_icp
            item["discovery_objective"] = discovery_objective
            qualified_results.append(item)

        # Sort by fit score descending
        qualified_results.sort(key=lambda x: x.get("potential_fit_score", 50), reverse=True)
        return qualified_results, total

    def get_organization_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        for item in self._dataset:
            if item.get("name", "").lower() == external_id.lower():
                return item
        return None
