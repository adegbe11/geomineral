"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Something interrupted your exploration.</h1>
      <p>
        Your saved projects are still available. Try loading this view again.
      </p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
