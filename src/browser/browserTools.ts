import "./legacyGuard.js";
import "./credentialCopy.js";
import "./credentialSession.js";
import "./formPersistence.js";
import "./signingActions.js";
import "./vaultLifecycle.js";
import { initialiseVaultUi } from "./vaultUi.js";

initialiseVaultUi();
await import("./testTools.js");
await import("./credentialLabels.js");
await import("./credentialRevealPolicy.js");
await import("./credentialStatus.js");
await import("./credentialWording.js");
await import("./synthesisCategory.js");
const { initialiseMaintenanceAuditUi } = await import("./maintenanceAuditUi.js");
initialiseMaintenanceAuditUi();
