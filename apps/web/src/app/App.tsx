import { BrowserRouter } from 'react-router-dom';

export function App() {
  return (
    <BrowserRouter>
      <main className="grid min-h-screen place-items-center p-8">
        <section className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm">
          <h1 className="text-3xl font-semibold">GroundQ</h1>
          <p className="mt-2 text-slate-600">Scaffold initialized.</p>
        </section>
      </main>
    </BrowserRouter>
  );
}
