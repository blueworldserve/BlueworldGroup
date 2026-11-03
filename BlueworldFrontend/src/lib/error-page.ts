export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load — Blue World Cosmetics</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; background: #fdfdff; color: #1f2a44; font: 16px/1.6 Georgia, "Times New Roman", serif; }
      .card { max-width: 30rem; width: 100%; text-align: center; }
      .logo { width: 80px; height: 80px; object-fit: contain; background: #f26b1d; margin: 0 auto 1.75rem; display: block; }
      .eyebrow { margin: 0 0 .75rem; font-size: .75rem; font-weight: 700; letter-spacing: .28em; text-transform: uppercase; color: #f26b1d; }
      h1 { margin: 0 0 1rem; font-size: 2rem; line-height: 1.15; color: #0b2a5b; }
      p { margin: 0 0 2rem; color: #4b5563; }
      .actions { display: flex; gap: .75rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: .8rem 1.4rem; font: 700 .75rem/1 Georgia, serif; letter-spacing: .14em; text-transform: uppercase; text-decoration: none; cursor: pointer; border: 1px solid #0b2a5b; }
      .primary { background: #f26b1d; border-color: #f26b1d; color: #0b2a5b; }
      .secondary { background: #fff; color: #0b2a5b; }
    </style>
  </head>
  <body>
    <main class="card">
      <img class="logo" src="/blueworld.png" alt="Blue World Cosmetics" />
      <p class="eyebrow">Something went wrong</p>
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. Please try again, or head back to the home page.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Back to home</a>
      </div>
    </main>
  </body>
</html>`;
}