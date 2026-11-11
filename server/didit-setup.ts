// One-time: `DIDIT_API_KEY=... npm run didit:setup` → prints the workflow id to set as DIDIT_WORKFLOW_ID.
import { createWorkflow } from "./lib/didit";
const w = await createWorkflow();
console.log("DIDIT_WORKFLOW_ID =", w.uuid ?? w.workflow_id ?? w.id, "\n", JSON.stringify(w, null, 2));
