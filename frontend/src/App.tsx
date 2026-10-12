import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import BusinessDevelopmentPortal from './pages/BusinessDevelopmentPortal'
import OrganizationsListPage from './pages/organizations/OrganizationsListPage'
import OrganizationNewPage from './pages/organizations/OrganizationNewPage'
import OrganizationDetailPage from './pages/organizations/OrganizationDetailPage'
import OrganizationEditPage from './pages/organizations/OrganizationEditPage'
import ContactsListPage from './pages/contacts/ContactsListPage'
import ContactNewPage from './pages/contacts/ContactNewPage'
import ContactDetailPage from './pages/contacts/ContactDetailPage'
import ContactEditPage from './pages/contacts/ContactEditPage'
import ShowcaseListPage from './pages/showcase/ShowcaseListPage'
import ProjectDetailPage from './pages/showcase/ProjectDetailPage'
import ProjectPresentationPage from './pages/showcase/ProjectPresentationPage'
import MeetingsListPage from './pages/meetings/MeetingsListPage'
import MeetingNewPage from './pages/meetings/MeetingNewPage'
import MeetingDetailPage from './pages/meetings/MeetingDetailPage'
import MeetingEditPage from './pages/meetings/MeetingEditPage'
import FollowUpsListPage from './pages/followups/FollowUpsListPage'
import ConnectionsBoardPage from './pages/connections/ConnectionsBoardPage'
import OpportunitiesListPage from './pages/opportunities/OpportunitiesListPage'
import OpportunityNewPage from './pages/opportunities/OpportunityNewPage'
import OpportunityDetailPage from './pages/opportunities/OpportunityDetailPage'
import OpportunityEditPage from './pages/opportunities/OpportunityEditPage'
import CommunicationsListPage from './pages/communications/CommunicationsListPage'
import CommunicationNewPage from './pages/communications/CommunicationNewPage'
import CommunicationDetailPage from './pages/communications/CommunicationDetailPage'
import CommunicationEditPage from './pages/communications/CommunicationEditPage'
import AnalyticsPage from './pages/analytics/AnalyticsPage'
import DiscoveryPage from './pages/discovery/DiscoveryPage'
import DiscoveryDetailPage from './pages/discovery/DiscoveryDetailPage'
import OutreachWorkspacePage from './pages/outreach/OutreachWorkspacePage'
import OutreachTrackerPage from './pages/outreach/OutreachTrackerPage'
import OutreachDraftsListPage from './pages/outreach/OutreachDraftsListPage'
import GmailSetupPage from './pages/outreach/GmailSetupPage'
import PartnershipsListPage from './pages/partnerships/PartnershipsListPage'
import PartnershipNewPage from './pages/partnerships/PartnershipNewPage'
import PartnershipDetailPage from './pages/partnerships/PartnershipDetailPage'
import PartnershipEditPage from './pages/partnerships/PartnershipEditPage'
import AdminProtectedRoute from './components/auth/AdminProtectedRoute'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminUsersListPage from './pages/admin/AdminUsersListPage'
import AdminUserNewPage from './pages/admin/AdminUserNewPage'
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage'
import AdminTeamPage from './pages/admin/AdminTeamPage'
import AdminShowcasePage from './pages/admin/AdminShowcasePage'
import AdminKnowledgeBasePage from './pages/admin/AdminKnowledgeBasePage'
import AdminShowcaseNewPage from './pages/admin/AdminShowcaseNewPage'
import AdminShowcaseEditPage from './pages/admin/AdminShowcaseEditPage'
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage'
import AdminSettingsPage from './pages/admin/AdminSettingsPage'
import { CopilotDrawer } from './components/copilot/CopilotDrawer'
import { ActiveMeetingLauncher } from './components/meetings/ActiveMeetingLauncher'
import { DemosView } from './pages/DemosView'
import { ProposalsView } from './pages/ProposalsView'
import { NegotiationsView } from './pages/NegotiationsView'
import { TasksView } from './pages/TasksView'
import { CustomersView } from './pages/CustomersView'
import { CallsView } from './pages/CallsView'
import CalendarPage from './pages/CalendarPage'
import MapPage from './pages/MapPage'
import { ReportsView } from './pages/ReportsView'
import CampaignsListPage from './pages/campaigns/CampaignsListPage'
import CampaignNewPage from './pages/campaigns/CampaignNewPage'
import CampaignDetailPage from './pages/campaigns/CampaignDetailPage'
import FundingPage from './pages/funding/FundingPage'
import FundingCampaignsPage from './pages/funding/FundingCampaignsPage'
import LeadImportPage from './pages/leads/LeadImportPage'
import LeadTrackerPage from './pages/leads/LeadTrackerPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Business Development Dashboard */}
        <Route
          path="/business-development"
          element={
            <ProtectedRoute>
              <BusinessDevelopmentPortal />
            </ProtectedRoute>
          }
        />

        {/* Phase 3: Organization Discovery & Management Routes */}
        <Route
          path="/business-development/organizations"
          element={
            <ProtectedRoute>
              <OrganizationsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/organizations/new"
          element={
            <ProtectedRoute>
              <OrganizationNewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/organizations/:id"
          element={
            <ProtectedRoute>
              <OrganizationDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/organizations/:id/edit"
          element={
            <ProtectedRoute>
              <OrganizationEditPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 4: Contact & Connection Management Routes */}
        <Route
          path="/business-development/contacts"
          element={
            <ProtectedRoute>
              <ContactsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/contacts/new"
          element={
            <ProtectedRoute>
              <ContactNewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/contacts/add"
          element={
            <ProtectedRoute>
              <ContactNewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/contacts/:id"
          element={
            <ProtectedRoute>
              <ContactDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/contacts/:id/edit"
          element={
            <ProtectedRoute>
              <ContactEditPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 5: Project Showcase & Presentation Routes */}
        <Route
          path="/business-development/showcase"
          element={
            <ProtectedRoute>
              <ShowcaseListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/showcase/:id"
          element={
            <ProtectedRoute>
              <ProjectDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/showcase/:id/presentation"
          element={
            <ProtectedRoute>
              <ProjectPresentationPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 6: Meetings & Follow-ups Routes */}
        <Route
          path="/business-development/meetings"
          element={
            <ProtectedRoute>
              <MeetingsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/meetings/new"
          element={
            <ProtectedRoute>
              <MeetingNewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/meetings/schedule"
          element={
            <ProtectedRoute>
              <MeetingNewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/meetings/:id"
          element={
            <ProtectedRoute>
              <MeetingDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/meetings/:id/edit"
          element={
            <ProtectedRoute>
              <MeetingEditPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/business-development/followups"
          element={
            <ProtectedRoute>
              <FollowUpsListPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 7: Connection Pipeline Board & Opportunity Management */}
        <Route
          path="/business-development/connections"
          element={
            <ProtectedRoute>
              <ConnectionsBoardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/opportunities"
          element={
            <ProtectedRoute>
              <OpportunitiesListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/opportunities/new"
          element={
            <ProtectedRoute>
              <OpportunityNewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/opportunities/:id"
          element={
            <ProtectedRoute>
              <OpportunityDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/opportunities/:id/edit"
          element={
            <ProtectedRoute>
              <OpportunityEditPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 8: Communication & Outreach Tracking */}
        <Route
          path="/business-development/communications"
          element={
            <ProtectedRoute>
              <CommunicationsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/communications/new"
          element={
            <ProtectedRoute>
              <CommunicationNewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/communications/:id"
          element={
            <ProtectedRoute>
              <CommunicationDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/communications/:id/edit"
          element={
            <ProtectedRoute>
              <CommunicationEditPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 9: Business Development Analytics & Reporting */}
        <Route
          path="/business-development/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 11: Organization Discovery & Lead Sourcing */}
        <Route
          path="/business-development/discover"
          element={
            <ProtectedRoute>
              <DiscoveryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/discover/:id"
          element={
            <ProtectedRoute>
              <DiscoveryDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Funding / Investor Outreach — additive, no-approval send flow */}
        <Route
          path="/business-development/funding"
          element={
            <ProtectedRoute>
              <FundingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/funding/campaigns"
          element={
            <ProtectedRoute>
              <FundingCampaignsPage />
            </ProtectedRoute>
          }
        />

        {/* Lead list upload — flexible column mapping, syncs into CRM + Google Sheets */}
        <Route
          path="/business-development/leads/import"
          element={
            <ProtectedRoute>
              <LeadImportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/leads/tracker"
          element={
            <ProtectedRoute>
              <LeadTrackerPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 12: Outreach Workspace & Communication Actions */}
        <Route
          path="/business-development/outreach"
          element={
            <ProtectedRoute>
              <OutreachWorkspacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/outreach/tracker"
          element={
            <ProtectedRoute>
              <OutreachTrackerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/outreach/drafts"
          element={
            <ProtectedRoute>
              <OutreachDraftsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/gmail-setup"
          element={
            <ProtectedRoute>
              <GmailSetupPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 13: Partnership Management */}
        <Route
          path="/business-development/partnerships"
          element={
            <ProtectedRoute>
              <PartnershipsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/partnerships/new"
          element={
            <ProtectedRoute>
              <PartnershipNewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/partnerships/:id"
          element={
            <ProtectedRoute>
              <PartnershipDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/partnerships/:id/edit"
          element={
            <ProtectedRoute>
              <PartnershipEditPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 17: Commercial Lifecycle Operating System Routes */}
        <Route
          path="/business-development/demos"
          element={
            <ProtectedRoute>
              <DemosView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/proposals"
          element={
            <ProtectedRoute>
              <ProposalsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/negotiations"
          element={
            <ProtectedRoute>
              <NegotiationsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/tasks"
          element={
            <ProtectedRoute>
              <TasksView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/customers"
          element={
            <ProtectedRoute>
              <CustomersView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/calls"
          element={
            <ProtectedRoute>
              <CallsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/reports"
          element={
            <ProtectedRoute>
              <ReportsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/calendar"
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/map"
          element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 25/28: Campaigns & Multi-Step Sequence Routes */}
        <Route
          path="/business-development/campaigns"
          element={
            <ProtectedRoute>
              <CampaignsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/campaigns/new"
          element={
            <ProtectedRoute>
              <CampaignNewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business-development/campaigns/:id"
          element={
            <ProtectedRoute>
              <CampaignDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 14: Admin & Business Development Team Management Routes */}
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminDashboardPage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminProtectedRoute>
              <AdminUsersListPage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/users/new"
          element={
            <AdminProtectedRoute>
              <AdminUserNewPage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/users/:id"
          element={
            <AdminProtectedRoute>
              <AdminUserDetailPage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/team"
          element={
            <AdminProtectedRoute>
              <AdminTeamPage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/showcase"
          element={
            <AdminProtectedRoute>
              <AdminShowcasePage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/showcase/new"
          element={
            <AdminProtectedRoute>
              <AdminShowcaseNewPage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/showcase/:id/edit"
          element={
            <AdminProtectedRoute>
              <AdminShowcaseEditPage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/knowledge-base"
          element={
            <AdminProtectedRoute>
              <AdminKnowledgeBasePage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <AdminProtectedRoute>
              <AdminAuditLogsPage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <AdminProtectedRoute>
              <AdminSettingsPage />
            </AdminProtectedRoute>
          }
        />

        {/* Default route redirect to /business-development */}
        <Route path="/" element={<Navigate to="/business-development" replace />} />
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/business-development" replace />} />
      </Routes>
      <CopilotDrawer />
      <ActiveMeetingLauncher />
    </AuthProvider>
  )
}
