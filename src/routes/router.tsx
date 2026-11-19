import { createBrowserRouter } from 'react-router'
import { LoadingState } from '@/components/ui/LoadingState'
import { ROUTES } from '@/config/routes'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { RootLayout } from '@/layouts/RootLayout'
import { AccountTypePage } from '@/pages/AccountTypePage'
import { EditProfilePage } from '@/pages/EditProfilePage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { RegisterPage } from '@/pages/RegisterPage'
import { SplashPage } from '@/pages/SplashPage'
import { WelcomePage } from '@/pages/WelcomePage'
import { WorkerDetailPage } from '@/pages/WorkerDetailPage'
import { WorkerVerificationPage } from '@/pages/WorkerVerificationPage'
import { GuestOnly, RequireAccountType, RequireAuth, RequireWorker } from './guards'

/**
 * Route tree:
 *   /                         Splash (decides destination)
 *   Guest only   -> /welcome, /login, /register
 *   Auth         -> /onboarding/account-type
 *   Auth + type  -> /app/* (Home, Search, Activity, Profile, Edit profile, Worker detail)
 *   Worker only  -> /app/profile/professional, /app/profile/verification
 *   Admin only   -> /admin
 */
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    hydrateFallbackElement: <LoadingState label="Cargando página..." />,
    children: [
      { path: ROUTES.splash, element: <SplashPage /> },
      {
        element: <GuestOnly />,
        children: [
          { path: ROUTES.welcome, element: <WelcomePage /> },
          {
            element: <AuthLayout />,
            children: [
              { path: ROUTES.login, element: <LoginPage /> },
              { path: ROUTES.register, element: <RegisterPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: ROUTES.admin,
                lazy: { Component: async () => (await import('@/pages/AdminPage')).AdminPage },
              },
            ],
          },
          {
            element: <AuthLayout />,
            children: [{ path: ROUTES.accountType, element: <AccountTypePage /> }],
          },
          {
            element: <RequireAccountType />,
            children: [
              {
                path: ROUTES.home,
                element: <AppLayout />,
                children: [
                  { index: true, element: <HomePage /> },
                  {
                    path: ROUTES.search,
                    lazy: { Component: async () => (await import('@/pages/SearchPage')).SearchPage },
                  },
                  {
                    path: ROUTES.activity,
                    lazy: { Component: async () => (await import('@/pages/ActivityPage')).ActivityPage },
                  },
                  {
                    path: ROUTES.serviceRequest,
                    lazy: { Component: async () => (await import('@/pages/ServiceRequestPage')).ServiceRequestPage },
                  },
                  {
                    path: ROUTES.serviceJourney,
                    lazy: { Component: async () => (await import('@/pages/ServiceJourneyPage')).ServiceJourneyPage },
                  },
                  { path: ROUTES.profile, element: <ProfilePage /> },
                  { path: ROUTES.profileEdit, element: <EditProfilePage /> },
                  {
                    path: ROUTES.settings,
                    lazy: { Component: async () => (await import('@/pages/SettingsPage')).SettingsPage },
                  },
                  {
                    element: <RequireWorker />,
                    children: [
                      {
                        path: ROUTES.workerProfessional,
                        lazy: { Component: async () => (await import('@/pages/WorkerProfessionalPage')).WorkerProfessionalPage },
                      },
                      { path: ROUTES.workerVerification, element: <WorkerVerificationPage /> },
                    ],
                  },
                  { path: ROUTES.workerDetail, element: <WorkerDetailPage /> },
                  {
                    path: ROUTES.requestWorker,
                    lazy: { Component: async () => (await import('@/pages/RequestWorkerPage')).RequestWorkerPage },
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
