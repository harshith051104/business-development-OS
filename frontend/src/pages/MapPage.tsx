import Navbar from '../components/layout/Navbar'
import OrgMap from '../components/map/OrgMap'

export default function MapPage() {
  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Organization Map</h1>
          <p className="text-slate-400 mt-1">Geographic view of all organizations in the pipeline</p>
        </div>
        <OrgMap height="calc(100vh - 200px)" />
      </div>
    </div>
  )
}
