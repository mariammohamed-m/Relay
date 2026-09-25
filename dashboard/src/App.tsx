import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RelayApp } from './components/relay/RelayApp';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RelayApp />
    </QueryClientProvider>
  );
}
