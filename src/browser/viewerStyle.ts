const stylesheetId = "viewerEnhancementsStylesheet";

if (document.getElementById(stylesheetId) === null) {
  const link = document.createElement("link");
  link.id = stylesheetId;
  link.rel = "stylesheet";
  link.href = "./viewer-enhancements.css";
  document.head.append(link);
}
