export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Cette page n'a pas pu s'afficher — La Voix du Chien</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #f7f3ec; color: #1f2433; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4a4f5c; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #6b2237; color: #fbf8f1; }
      .secondary { background: #fff; color: #1f2433; border-color: #8a8f9c; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Cette page n'a pas pu s'afficher</h1>
      <p>Un souci de notre côté, pas du vôtre. Vous pouvez réessayer, ou revenir à l'accueil.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Réessayer</button>
        <a class="secondary" href="/">Revenir à l'accueil</a>
      </div>
    </div>
  </body>
</html>`;
}
