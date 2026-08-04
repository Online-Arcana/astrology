const labels: Readonly<Record<string, string>> = {
  signingIssuer: "issuer",
  signingPrivatePkcs8: "privatePkcs8",
  signingPublicRaw: "publicRaw",
};

for (const [id, text] of Object.entries(labels)) {
  const input = document.getElementById(id);
  const label = input?.closest("label");
  if (label === null || label === undefined) continue;
  const node = [...label.childNodes].find((child) => child.nodeType === Node.TEXT_NODE);
  if (node !== undefined) node.textContent = text;
}
