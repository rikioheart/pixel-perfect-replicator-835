import { createFileRoute, redirect } from '@tanstack/react-router';

// Présentation de l'association : source unique sur le site officiel.
export const Route = createFileRoute('/association')({
  beforeLoad: () => { throw redirect({ href: 'https://lavoixduchien.fr/', statusCode: 301 }); },
});
