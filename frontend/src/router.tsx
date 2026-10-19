import { createBrowserRouter } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './components/auth/RouteGuards';
import { Layout } from './components/layout/Layout';
import { PanelLayout } from './components/layout/PanelLayout';
import { AddPropertyPage } from './pages/AddPropertyPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminExportPage } from './pages/AdminExportPage';
import { AdminPropertiesPage } from './pages/AdminPropertiesPage';
import { AdminReportsPage } from './pages/AdminReportsPage';
import { AdminReviewsPage } from './pages/AdminReviewsPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AdminSecurityPage } from './pages/AdminSecurityPage';
import { AdminVerificationsPage } from './pages/AdminVerificationsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { BoarderDashboardPage } from './pages/BoarderDashboardPage';
import { BoarderFavoritesPage } from './pages/BoarderFavoritesPage';
import { BoarderInquiriesPage } from './pages/BoarderInquiriesPage';
import { BoarderActivityPage } from './pages/BoarderActivityPage';
import { BoarderSettingsPage } from './pages/BoarderSettingsPage';
import { EditPropertyPage } from './pages/EditPropertyPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HealthPage } from './pages/HealthPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MyPropertiesPage } from './pages/MyPropertiesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { OwnerDashboardPage } from './pages/OwnerDashboardPage';
import { OwnerInquiriesPage } from './pages/OwnerInquiriesPage';
import { OwnerPaymentsPage } from './pages/OwnerPaymentsPage';
import { OwnerReviewsPage } from './pages/OwnerReviewsPage';
import { OwnerRoomsPage } from './pages/OwnerRoomsPage';
import { OwnerSettingsPage } from './pages/OwnerSettingsPage';
import { OwnerVerificationPage } from './pages/OwnerVerificationPage';
import { PublicPropertiesPage } from './pages/PublicPropertiesPage';
import { PublicPropertyDetailPage } from './pages/PublicPropertyDetailPage';
import { RegisterPage } from './pages/RegisterPage';
import { ViewPropertyPage } from './pages/ViewPropertyPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'health', element: <HealthPage /> },
      { path: 'properties', element: <PublicPropertiesPage /> },
      { path: 'properties/:id', element: <PublicPropertyDetailPage /> },
      { path: 'auth/callback', element: <OAuthCallbackPage /> },

      // Only for visitors who are not logged in
      {
        element: <GuestRoute />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
        ],
      },

      // Any logged-in user
      { element: <ProtectedRoute />, children: [] },

      { path: '*', element: <NotFoundPage /> },
    ],
  },

  // ---- Role panels: each role gets its own sidebar layout (see lib/panelNav.ts) ----
  {
    element: <ProtectedRoute allowedRoles={['ADMIN']} />,
    children: [
      {
        element: <PanelLayout />,
        children: [
          { path: 'admin', element: <AdminDashboardPage /> },
          { path: 'admin/properties', element: <AdminPropertiesPage /> },
          { path: 'admin/users', element: <AdminUsersPage /> },
          { path: 'admin/reviews', element: <AdminReviewsPage /> },
          { path: 'admin/reports', element: <AdminReportsPage /> },
          { path: 'admin/verifications', element: <AdminVerificationsPage /> },
          { path: 'admin/security', element: <AdminSecurityPage /> },
          { path: 'admin/export', element: <AdminExportPage /> },
          { path: 'admin/settings', element: <AdminSettingsPage /> },
          { path: 'admin/*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['OWNER']} />,
    children: [
      {
        element: <PanelLayout />,
        children: [
          { path: 'owner', element: <OwnerDashboardPage /> },
          { path: 'owner/properties', element: <MyPropertiesPage /> },
          { path: 'owner/properties/new', element: <AddPropertyPage /> },
          { path: 'owner/properties/:id', element: <ViewPropertyPage /> },
          { path: 'owner/properties/:propertyId/rooms', element: <OwnerRoomsPage /> },
          { path: 'owner/properties/:id/edit', element: <EditPropertyPage /> },
          { path: 'owner/inquiries', element: <OwnerInquiriesPage /> },
          { path: 'owner/reviews', element: <OwnerReviewsPage /> },
          { path: 'owner/verification', element: <OwnerVerificationPage /> },
          { path: 'owner/payments', element: <OwnerPaymentsPage /> },
          { path: 'owner/settings', element: <OwnerSettingsPage /> },
          { path: 'owner/*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['BOARDER']} />,
    children: [
      {
        element: <PanelLayout />,
        children: [
          { path: 'boarder', element: <BoarderDashboardPage /> },
          { path: 'boarder/find-place', element: <PublicPropertiesPage /> },
          { path: 'boarder/favorites', element: <BoarderFavoritesPage /> },
          { path: 'boarder/inquiries', element: <BoarderInquiriesPage /> },
          { path: 'boarder/reviews', element: <BoarderActivityPage kind="reviews" /> },
          { path: 'boarder/reports', element: <BoarderActivityPage kind="reports" /> },
          { path: 'boarder/settings', element: <BoarderSettingsPage /> },
          { path: 'boarder/*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
