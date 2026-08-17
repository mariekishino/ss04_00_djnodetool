// ProjectToolbar holds the project-level actions: Save (to the local server),
// Export JSON and Import JSON.
//
// Phase 6: it stays presentational. It does not own project state; it calls
// back to App via onExport / onImportFile. Keeping these controls here avoids
// mixing save/load UI into the Track Library.

import { useRef } from "react";

type ProjectToolbarProps = {
  // False when the local server is not running: saving is then unavailable,
  // while the file-based Export/Import keep working.
  canSaveToServer: boolean;
  // The result of the last save attempt, or null before any save.
  saveStatus: string | null;
  onSave: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
};

function ProjectToolbar({
  canSaveToServer,
  saveStatus,
  onSave,
  onExport,
  onImportFile,
}: ProjectToolbarProps) {
  // A hidden file input drives the import; the visible button just opens it.
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
    // Reset so selecting the same file again still fires a change event.
    event.target.value = "";
  }

  return (
    <div className="project-toolbar">
      <button
        type="button"
        className="toolbar-button"
        disabled={!canSaveToServer}
        title={
          canSaveToServer
            ? "Save the project on the local server"
            : "Start the local server (npm run server) to save"
        }
        onClick={onSave}
      >
        Save
      </button>
      <button type="button" className="toolbar-button" onClick={onExport}>
        Export JSON
      </button>
      <button
        type="button"
        className="toolbar-button"
        onClick={handleImportClick}
      >
        Import JSON
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="toolbar-file-input"
        onChange={handleFileChange}
      />
      {saveStatus && <span className="toolbar-status">{saveStatus}</span>}
    </div>
  );
}

export default ProjectToolbar;
