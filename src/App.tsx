import { RouterProvider } from 'react-router'
import { AuthProvider } from '@/features/auth/context/AuthProvider'
import { router } from '@/routes/router'

/** Application composition root: global providers + router. */
export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
