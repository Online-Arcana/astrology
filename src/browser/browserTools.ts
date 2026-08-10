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
await import("./viewerStyle.js");
await import("./viewerEnhancements.js");
await import("./credentialLabels.js");
await import("./credentialRevealPolicy.js");
await import("./credentialStatus.js");
await import("./credentialWording.js");
initialiseVaultUi();

// Install the optional biometric package gate before the ordinary package
// password handler. Recognised encrypted file fingerprints can then unlock and
// decrypt in one passkey action, while every unrecognised or declined file falls
// through to the normal password dialog.
await import("./packageBiometric.js");
await import("./packageWording.js");
await import("./packageFlow.js");
await import("./authorityUi.js");

// Synthesis correction runs before the final hierarchy pass so late category
// moves are normalised into Overview -> group -> section rather than fighting
// the customer-facing navigation structure.
await import("./synthesisCategory.js");
await import("./viewerHierarchy.js");
const { initialiseMaintenanceAuditUi } = await import("./maintenanceAuditUi.js");
initialiseMaintenanceAuditUi();

// Recalculation uses the original generation screen and its full checkpoint,
// lane, stage, ETA and billing presentation. The guards initialise first so an
// active generation cannot receive a queued maintenance checkpoint. The paint
// gate yields two animation frames before the synchronous hand-off begins.
await import("./maintenanceProgress.js");
await import("./maintenanceAvailability.js");
await import("./maintenancePaint.js");
await import("./maintenanceResume.js");
await import("./maintenancePolicy.js");
