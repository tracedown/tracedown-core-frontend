import type { ServiceMetricsDto } from '@/data/metrics/MetricsDto';

export interface ProjectSummary {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: string;
  metrics: ServiceMetricsDto | null;
  serviceCount: number;
}

export interface CreateProjectRequest {
  workspaceId: string;
  name: string;
}

export interface UpdateProjectRequest {
  name: string;
}
