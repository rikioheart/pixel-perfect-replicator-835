import { createFileRoute, redirect } from '@tanstack/react-router';

// Les articles vivent désormais sur le site officiel lavoixduchien.fr.
export const Route = createFileRoute('/articles')({
  beforeLoad: () => { throw redirect({ href: 'https://lavoixduchien.fr/', statusCode: 301 }); },
});
