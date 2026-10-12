import { queryOptions } from '@tanstack/react-query';
import { getPublicPartners } from './public-partners.functions';

export const publicPartnersOptions = queryOptions({
  queryKey: ['public-partner-directory'],
  queryFn: () => getPublicPartners(),
  staleTime: 5 * 60 * 1000,
});