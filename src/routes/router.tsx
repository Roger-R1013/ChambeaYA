import { createBrowserRouter } from 'react-router'
import { ROUTES } from '@/config/routes'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { RootLayout } from '@/layouts/RootLayout'
import { AccountTypePage } from '@/pages/AccountTypePage'
import { ActivityPage } from '@/pages/ActivityPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { RegisterPage } from '@/pages/RegisterPage'
import { SearchPage } from '@/pages/SearchPage'
import { SplashPage } from '@/pages/SplashPage'
import { WelcomePage } from '@/pages/WelcomePage'
import { WorkerDetailPage } from '@/pages/WorkerDetailPage'
import { GuestOnly, RequireAccountType, RequireAuth } from './guards'

/**
 * Route tree:
 *   /                         Splash (decides destination)
 *   Guest only   -> /welcome, /login, /register
 *   Auth         -> /onboarding/account-type
 *   Auth + type  -> /app/* (Home, Search, Activity, Profile, Worker detail)
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
