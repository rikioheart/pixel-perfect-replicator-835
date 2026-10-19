import { queryOptions } from '@tanstack/react-query';
import { getPublicPros } from './public-articles.functions';

export const publicPartnersOptions = queryOptions({
  queryKey: ['public-pros-list'],
  queryFn: () => getPublicPros(),
  staleTime: 5 * 60 * 1000,
});