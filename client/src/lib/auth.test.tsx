import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuth } from './auth';

const demo = { id: 1, name: 'Demo User', email: 'demo@example.com', role: 'ROLE' };

function Probe() {
  const { user, isLoading, login, logout } = useAuth();
  if (isLoading) return <p>loading</p>;
  return (
    <div>
      <p>{user ? `Signed in as ${user.name}` : 'Guest'}</p>
      <button onClick={() => login(demo.email, 'Password1!')}>Log in</button>
      <button onClick={() => logout()}>Log out</button>
    </div>
  );
}

function json(status: number, body?: unknown) {
  return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.endsWith('/auth/me')) return json(401, { error: 'Not signed in' });
      if (url.endsWith('/auth/login')) return json(200, { user: demo });
      return json(204);
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('useAuth', () => {
  it('updates every component on login and logout without a page reload', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();

    expect(await screen.findByText('Guest')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Signed in as Demo User')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByText('Guest')).toBeInTheDocument();
  });
});
