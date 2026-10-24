import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SavedWorkflowRecord, WorkflowRepository } from './repository';

export class SqliteWorkflowRepository implements WorkflowRepository {
  private db: Database.Database;

  constructor(dbPath?: string) {
    if (dbPath === ':memory:') {
      this.db = new Database(':memory:');
    } else {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const resolvedPath = dbPath || path.join(dataDir, 'workflows.db');
      this.db = new Database(resolvedPath);
    }

    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        user_prompt TEXT NOT NULL,
        target_version TEXT NOT NULL,
        blueprint_json TEXT NOT NULL,
        workflow_json TEXT NOT NULL,
        generated_prompt TEXT NOT NULL,
        validation_report_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  async saveWorkflow(record: SavedWorkflowRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workflows (
        id, name, user_prompt, target_version,
        blueprint_json, workflow_json, generated_prompt,
        validation_report_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.name,
      record.userPrompt,
      record.targetN8nVersion,
      JSON.stringify(record.blueprint),
      JSON.stringify(record.workflowJson),
      record.generatedPrompt,
      JSON.stringify(record.validationReport),
      record.createdAt
    );
  }

  async listWorkflows(): Promise<SavedWorkflowRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM workflows ORDER BY created_at DESC LIMIT 50
    `);

    const rows = stmt.all() as Array<{
      id: string;
      name: string;
      user_prompt: string;
      target_version: string;
      blueprint_json: string;
      workflow_json: string;
      generated_prompt: string;
      validation_report_json: string;
      created_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      userPrompt: r.user_prompt,
      targetN8nVersion: r.target_version,
      blueprint: JSON.parse(r.blueprint_json),
      workflowJson: JSON.parse(r.workflow_json),
      generatedPrompt: r.generated_prompt,
      validationReport: JSON.parse(r.validation_report_json),
      createdAt: r.created_at,
    }));
  }

  async getWorkflowById(id: string): Promise<SavedWorkflowRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM workflows WHERE id = ?');
    const row = stmt.get(id) as
      | {
          id: string;
          name: string;
          user_prompt: string;
          target_version: string;
          blueprint_json: string;
          workflow_json: string;
          generated_prompt: string;
          validation_report_json: string;
          created_at: string;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      userPrompt: row.user_prompt,
      targetN8nVersion: row.target_version,
      blueprint: JSON.parse(row.blueprint_json),
      workflowJson: JSON.parse(row.workflow_json),
      generatedPrompt: row.generated_prompt,
      validationReport: JSON.parse(row.validation_report_json),
      createdAt: row.created_at,
    };
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM workflows WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }
}

// Singleton repository instance for app runtime
let repoInstance: SqliteWorkflowRepository | null = null;

export function getWorkflowRepository(): WorkflowRepository {
  if (!repoInstance) {
    repoInstance = new SqliteWorkflowRepository();
  }
  return repoInstance;
}
