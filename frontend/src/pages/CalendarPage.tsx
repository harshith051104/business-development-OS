import Navbar from '../components/layout/Navbar'
import CalendarView from '../components/calendar/CalendarView'
import type { CalendarEvent } from '../services/calendar'

export default function CalendarPage() {
  function handleEventClick(event: CalendarEvent) {
    console.log('Event clicked:', event)
  }

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="text-slate-400 mt-1">All scheduled meetings and events</p>
        </div>
        <CalendarView onEventClick={handleEventClick} height="calc(100vh - 220px)" />
      </div>
    </div>
  )
}
