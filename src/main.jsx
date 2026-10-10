import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import AuthInitializer from './components/auth/AuthInitializer'
import { store } from './store/store'
import { Toaster } from './components/ui/sonner'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'
import './styles/globals.css'

// Data in this app changes from many places (billing, check-ins, the biometric machine, other devices),
// so cached lists must not linger:
//  - any successful write refreshes every query (open pages refetch now, the rest on their next visit);
//  - data older than 15 s is refetched when a page is opened again or the window regains focus.
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 15,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthInitializer>
            <App />
          </AuthInitializer>
          <Toaster />
          <PwaUpdatePrompt />
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>,
)
