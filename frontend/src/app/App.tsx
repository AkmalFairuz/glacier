import { RouterProvider } from 'react-router'
import { useApplyAppearance } from '../features/settings/useApplyAppearance'
import { Providers } from './providers'
import { useUnhandledErrors } from './useUnhandledErrors'
import { router } from './router'

export function App() {
  useApplyAppearance()
  useUnhandledErrors()
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  )
}
