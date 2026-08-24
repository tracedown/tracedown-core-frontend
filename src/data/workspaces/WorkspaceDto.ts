export interface WorkspaceSummary {
  id: string;
  name: string;
  createdAt: string;
}

export interface WorkspaceListResponse {
  items: WorkspaceSummary[];
}

export interface CreateWorkspaceRequest {
  name: string;
}

export interface UpdateWorkspaceRequest {
  name: string;
}
