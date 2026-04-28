export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', name);
  document.body.appendChild(a);
  a.click();
  a.parentNode?.removeChild(a);
  URL.revokeObjectURL(url);
}
