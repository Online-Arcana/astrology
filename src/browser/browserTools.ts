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

// Test packages have a deliberately distinct outer magic. Install their narrow
// transport before biometric/package handling so only a cryptographically
// verified TEST-ONLY artifact can use the public test password path.
await import("./testPackageTransport.js");

// Install the optional biometric package gate before the ordinary package
// password handler. Recognised encrypted file fingerprints can then unlock and
// decrypt in one passkey action, while every unrecognised or declined file falls
// through to the normal password dialog.
await import("./packageBiometric.js");
await import("./packageWording.js");
await import("./packageFlow.js");
// Wrap ordinary download packaging only after it is installed. Verified
// test-key artifacts use the public TEST-ONLY package; every other .astral file
// delegates back to the ordinary password-protected path unchanged.
await import("./testPackageDownload.js");
await import("./authorityUi.js");

// Synthesis correction runs before the hierarchy pass. The hierarchy classifies
// from each reading's preserved canonical title, while the final presentation
// pass translates the rendered labels into plain customer language. The initial
// state pass owns default disclosure state. Glyph enhancement runs last so it can
// decorate stable customer titles without becoming part of hierarchy semantics.
await import("./synthesisCategory.js");
await import("./viewerHierarchy.js");
await import("./customerLanguagePass.js");
await import("./viewerInitialState.js");
await import("./viewerGlyphs.js");

// The chart wheel is part of the browser presentation graph. It listens for the
// calculation-complete event during new generation and reconstructs the same
// deterministic wheel from astral-calculation data when an existing file opens.
await import("./chartWheelBootstrap.js");

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

// Test-key policy is applied after maintenance controls exist. The random chart
// tester is last: it exercises the completed browser viewer without entering the
// OpenAI generation path.
await import("./testKeyPolicyUi.js");
await import("./randomChartTest.js");
