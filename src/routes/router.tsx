import { createBrowserRouter } from 'react-router'
import { ROUTES } from '@/config/routes'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { RootLayout } from '@/layouts/RootLayout'
import { AccountTypePage } from '@/pages/AccountTypePage'
import { ActivityPage } from '@/pages/ActivityPage'
import { EditProfilePage } from '@/pages/EditProfilePage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { RegisterPage } from '@/pages/RegisterPage'
import { SearchPage } from '@/pages/SearchPage'
import { SplashPage } from '@/pages/SplashPage'
import { WelcomePage } from '@/pages/WelcomePage'
import { WorkerDetailPage } from '@/pages/WorkerDetailPage'
import { WorkerProfessionalPage } from '@/pages/WorkerProfessionalPage'
import { WorkerVerificationPage } from '@/pages/WorkerVerificationPage'
import { GuestOnly, RequireAccountType, RequireAuth, RequireWorker } from './guards'

/**
 * Route tree:
 *   /                         Splash (decides destination)
 *   Guest only   -> /welcome, /login, /register
 *   Auth         -> /onboarding/account-type
 *   Auth + type  -> /app/* (Home, Search, Activity, Profile, Edit profile, Worker detail)
 *   Worker only  -> /app/profile/professional, /app/profile/verification
 */
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
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
                  { path: ROUTES.search, element: <SearchPage /> },
                  { path: ROUTES.activity, element: <ActivityPage /> },
                  { path: ROUTES.profile, element: <ProfilePage /> },
                  { path: ROUTES.profileEdit, element: <EditProfilePage /> },
                  {
                    element: <RequireWorker />,
                    children: [
                      { path: ROUTES.workerProfessional, element: <WorkerProfessionalPage /> },
                      { path: ROUTES.workerVerification, element: <WorkerVerificationPage /> },
                    ],
                  },
                  { path: ROUTES.workerDetail, element: <WorkerDetailPage /> },
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
