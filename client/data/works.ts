import { Api, type WorkSummary } from '@/utils/api';

export async function loadWorks() {
  return Api.get<WorkSummary[]>('/api/v1/works');
}