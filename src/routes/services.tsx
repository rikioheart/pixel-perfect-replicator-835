import { createFileRoute, redirect } from '@tanstack/react-router';

// Activités détaillées : source unique sur le site officiel.
export const Route = createFileRoute('/services')({
  beforeLoad: () => { throw redirect({ href: 'https://lavoixduchien.fr/', statusCode: 301 }); },
});
