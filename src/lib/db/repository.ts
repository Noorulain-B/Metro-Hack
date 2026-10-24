import { WorkflowBlueprint } from '../schemas/blueprint';
import { N8nWorkflowExport } from '../n8n/generator';
import { ValidationReport } from '../schemas/validation';

export interface SavedWorkflowRecord {
  id: string;
  name: string;
  userPrompt: string;
  targetN8nVersion: string;
  blueprint: WorkflowBlueprint;
  workflowJson: N8nWorkflowExport;
  generatedPrompt: string;
  validationReport: ValidationReport;
  createdAt: string;
}

export interface WorkflowRepository {
  saveWorkflow(record: SavedWorkflowRecord): Promise<void>;
  listWorkflows(): Promise<SavedWorkflowRecord[]>;
  getWorkflowById(id: string): Promise<SavedWorkflowRecord | null>;
  deleteWorkflow(id: string): Promise<boolean>;
}
