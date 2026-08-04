import "./legacyGuard.js";
import "./credentialCopy.js";
import "./credentialSession.js";
import "./formPersistence.js";
import "./signingActions.js";
import "./vaultLifecycle.js";
import { initialiseVaultUi } from "./vaultUi.js";

// Build every credential control before the vault inspects and locks them. This
// removes the need for a page-wide MutationObserver and prevents observer
// callbacks from reacting to their own status DOM updates.
await import("./testTools.js");
await import("./credentialLabels.js");
await import("./credentialRevealPolicy.js");
await import("./credentialStatus.js");
await import("./credentialWording.js");
initialiseVaultUi();

const { initialiseMaintenanceAuditUi } = await import("./maintenanceAuditUi.js");
initialiseMaintenanceAuditUi();
